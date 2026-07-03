import { timingSafeEqual } from 'crypto';

/** Sabit-zamanlı string eşitliği — secret/token karşılaştırmalarında timing attack'a kapalı.
 *  Uzunluk farklıysa erken (yine sabit-zamanlı davranışla) reddeder. */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
