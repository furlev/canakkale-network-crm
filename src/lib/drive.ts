/**
 * Google Drive köprüsü — ek npm bağımlılığı YOK, düz fetch ile OAuth2 + Drive v3.
 *
 * Kimlik: authorized_user JSON'u ({client_id, client_secret, refresh_token})
 *   - `GOOGLE_DRIVE_CREDENTIALS_JSON` env değişkeninde JSON string (prod/DO), veya
 *   - `GOOGLE_DRIVE_CREDENTIALS_FILE` env değişkeninde dosya yolu (yerel dev,
 *     `node scripts/prep-drive-oauth.mjs` ile üretilen gitignored drive-credentials.json).
 *
 * `GOOGLE_DRIVE_ROOT_FOLDER_ID` doluysa yüklemeler o klasörün altına gider.
 */
import { readFileSync } from 'fs';

export type DriveCredentials = {
  client_id: string;
  client_secret: string;
  refresh_token: string;
};

const NOT_CONFIGURED_MSG = 'Google Drive bağlı değil (GOOGLE_DRIVE_CREDENTIALS_JSON eksik)';

function loadCredentials(): DriveCredentials | null {
  let raw: string | null = null;
  if (process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
    raw = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
  } else if (process.env.GOOGLE_DRIVE_CREDENTIALS_FILE) {
    try {
      raw = readFileSync(process.env.GOOGLE_DRIVE_CREDENTIALS_FILE, 'utf8');
    } catch {
      return null;
    }
  }
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as Partial<DriveCredentials>;
    if (!json.client_id || !json.client_secret || !json.refresh_token) return null;
    return { client_id: json.client_id, client_secret: json.client_secret, refresh_token: json.refresh_token };
  } catch {
    return null;
  }
}

/** Drive entegrasyonu kullanılabilir mi? (UI banner'ı ve upload guard'ı için) */
export function isDriveConfigured(): boolean {
  return loadCredentials() !== null;
}

/* ── Access token önbelleği (modül belleği; bitişten ~5 dk önce yenilenir) ── */

let tokenCache: { token: string; expiresAt: number } | null = null;
const TOKEN_SAFETY_MS = 5 * 60 * 1000;

export async function getAccessToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) throw new Error(NOT_CONFIGURED_MSG);

  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_SAFETY_MS) {
    return tokenCache.token;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive erişim token'ı alınamadı (HTTP ${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Google Drive token yanıtında access_token yok');

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/* ── Drive v3 işlemleri ── */

/**
 * Multipart yükleme. parentFolderId verilmezse GOOGLE_DRIVE_ROOT_FOLDER_ID (varsa) kullanılır.
 */
export async function driveUpload(
  name: string,
  mime: string,
  buffer: Buffer,
  parentFolderId?: string
): Promise<{ id: string; size: number }> {
  const token = await getAccessToken();
  const parent = parentFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
  const metadata: { name: string; parents?: string[] } = { name };
  if (parent) metadata.parents = [parent];

  const boundary = `cn-depot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mime || 'application/octet-stream'}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body: body as unknown as BodyInit,
    }
  );
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive yüklemesi başarısız (HTTP ${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { id?: string; size?: string | number };
  if (!data.id) throw new Error('Google Drive yükleme yanıtında dosya id yok');
  return { id: data.id, size: Number(data.size ?? buffer.length) || buffer.length };
}

/**
 * Dosya içeriğini indirir; çağıran Response.body'yi stream'ler.
 */
export async function driveDownload(fileId: string): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive indirmesi başarısız (HTTP ${res.status}): ${detail}`);
  }
  return res;
}

/**
 * Byte-serving stream: gelen HTTP Range başlığını Drive'a iletir; video gibi büyük
 * dosyaların tarayıcıda oynatılması (seek/partial content) için gereklidir.
 * Drive Range varsa 206 Partial Content, yoksa 200 döndürür; çağıran header'ları aktarır.
 * Range geçersizse (416) yanıt olduğu gibi döndürülür (çağıran 416'yı forward eder).
 */
export async function driveStream(fileId: string, range?: string | null): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers['Range'] = range;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers }
  );
  // 200 (tam) ve 206 (kısmi) başarı; 416 (Range Not Satisfiable) çağırana iletilir.
  if (!res.ok && res.status !== 416) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive akışı başarısız (HTTP ${res.status}): ${detail}`);
  }
  return res;
}

/**
 * Drive'da bir klasör oluşturur ve id'sini döndürür. parentFolderId verilmezse
 * GOOGLE_DRIVE_ROOT_FOLDER_ID (varsa) altında oluşturulur. CRM klasör ağacını
 * Drive klasör ağacıyla eşlemek için kullanılır (Folder.driveFolderId).
 */
export async function driveCreateFolder(name: string, parentFolderId?: string): Promise<string> {
  const token = await getAccessToken();
  const parent = parentFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parent) metadata.parents = [parent];

  const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive klasörü oluşturulamadı (HTTP ${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('Google Drive klasör yanıtında id yok');
  return data.id;
}

/**
 * Drive dosyasını siler (hard-delete akışı için — henüz bağlanmadı, ileride kullanılacak).
 * Dosya zaten yoksa (404) sessizce geçer.
 */
export async function driveDelete(fileId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Google Drive silme işlemi başarısız (HTTP ${res.status}): ${detail}`);
  }
}
