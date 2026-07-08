import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Object storage (DigitalOcean Spaces / S3-uyumlu) — görsel/PDF/IG varlıkları
 * DB'de base64 data-URI tutmak yerine buraya yüklenir; imageUrl'e yalnız URL yazılır.
 *
 * YAPILANDIRILMAMIŞSA (env yoksa) zarifçe geri düşer: veriyi olduğu gibi (data-URI)
 * döndürür → mevcut /site/img/[id] endpoint'i çalışmaya devam eder, hiçbir şey kırılmaz.
 * Bu yüzden bu göç additive ve güvenlidir; kullanıcı Spaces sağlayınca otomatik devreye girer.
 *
 * Gerekli env (opsiyonel): SPACES_ENDPOINT (ör. https://fra1.digitaloceanspaces.com),
 * SPACES_REGION (ör. fra1), SPACES_KEY, SPACES_SECRET, SPACES_BUCKET, SPACES_CDN (opsiyonel).
 */

const ENDPOINT = process.env.SPACES_ENDPOINT || '';
const REGION = process.env.SPACES_REGION || 'fra1';
const KEY = process.env.SPACES_KEY || '';
const SECRET = process.env.SPACES_SECRET || '';
const BUCKET = process.env.SPACES_BUCKET || '';
const CDN = process.env.SPACES_CDN || ''; // ör. https://cdn.canakkale.network

export function isStorageConfigured(): boolean {
  return Boolean(ENDPOINT && KEY && SECRET && BUCKET);
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: false,
      credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    });
  }
  return _client;
}

function publicUrl(key: string): string {
  if (CDN) return `${CDN.replace(/\/$/, '')}/${key}`;
  // Spaces varsayılan public URL: https://<bucket>.<region>.digitaloceanspaces.com/<key>
  const host = ENDPOINT.replace(/^https?:\/\//, '');
  return `https://${BUCKET}.${host}/${key}`;
}

/** Ham buffer yükler; yapılandırılmamışsa null döner (çağıran fallback uygular). */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string | null> {
  if (!isStorageConfigured()) return null;
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return publicUrl(key);
}

/**
 * data:<mime>;base64,<...> URI'yi Spaces'e taşır ve public URL döner.
 * Yapılandırılmamışsa VEYA girdi zaten http(s) URL ise girdiyi olduğu gibi döndürür (fallback).
 */
export async function storeDataUri(
  dataUri: string | null | undefined,
  keyPrefix: string,
): Promise<string | null> {
  if (!dataUri) return null;
  if (/^https?:\/\//i.test(dataUri)) return dataUri; // zaten URL
  if (!dataUri.startsWith('data:')) return dataUri;
  if (!isStorageConfigured()) return dataUri; // fallback: data-URI'yi koru

  const m = dataUri.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return dataUri;
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  const ext = mime.split('/')[1]?.replace('+xml', '') || 'bin';
  const rand = Math.abs(hashStr(m[2].slice(0, 64) + m[2].length)).toString(36);
  const key = `${keyPrefix.replace(/\/$/, '')}/${Date.now().toString(36)}-${rand}.${ext}`;
  const url = await putObject(key, buf, mime);
  return url || dataUri;
}

// Küçük deterministik hash (dosya adı benzersizliği için; Math.random gerektirmez)
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
