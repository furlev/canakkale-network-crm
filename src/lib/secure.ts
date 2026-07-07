import { timingSafeEqual, createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Sabit-zamanlı string eşitliği — secret/token karşılaştırmalarında timing attack'a kapalı.
 *  Uzunluk farklıysa erken (yine sabit-zamanlı davranışla) reddeder. */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* ── Sır şifreleme (rest'te): AES-256-GCM, anahtar = SHA-256(AUTH_SECRET) ──
 * Format: enc:v1:<iv-base64>:<tag-base64>:<ciphertext-base64>
 * DB'deki API anahtarları (Setting: wordpress/ai) bu biçimde saklanır. */

const ENC_PREFIX = 'enc:v1:';

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET tanımlı değil — sır şifreleme/çözme yapılamıyor');
  }
  return createHash('sha256').update(secret).digest();
}

/** Düz metni AES-256-GCM ile şifreler → enc:v1:iv:tag:ct (hepsi base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); // GCM için 96-bit IV önerilir
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** enc:v1: ile başlamayan girdiyi OLDUĞU GİBİ döndürür (eski düz metin kayıtlarla geriye uyumluluk). */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const parts = stored.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Şifreli sır biçimi geçersiz (enc:v1 bekleniyor)');
  }
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
