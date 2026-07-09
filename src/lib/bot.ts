/**
 * Bot koruması — saf/deterministik yardımcılar (env/ağ gerektirmez).
 *
 * İki hafif sinyal:
 *  - honeypot: forma gizli bir alan (ör. "website") koyulur; insan boş bırakır,
 *    otomatik botlar doldurur. Doluysa istek bot sayılır.
 *  - zaman-tuzağı: form render zamanı (epoch ms) gönderilir; gönderim çok hızlıysa
 *    (insan doldurma süresinin altında) bot sayılır.
 *
 * İkisi de "sinyal yoksa tuzak tetiklenmez" (graceful): alan gelmezse istek geçer.
 * Turnstile gibi ağ tabanlı doğrulamadan bağımsızdır — env olmadan da çalışır.
 */

/** Honeypot alanı dolu mu? (dolu = bot). Boş/eksik → false. */
export function honeypotTriggered(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Gönderim, form render'ından bu yana `minMs`'den kısa sürede mi geldi? (evet = bot).
 * `renderedAt` epoch ms'tir; eksik/geçersiz (≤0 veya NaN) → false (sinyal yok, geçir).
 * Gelecekteki zaman damgaları (elapsed < 0) da tuzağı tetikler.
 */
export function submittedTooFast(renderedAt: unknown, minMs = 2000): boolean {
  const t = typeof renderedAt === 'number' ? renderedAt : Number(renderedAt);
  if (!Number.isFinite(t) || t <= 0) return false;
  const elapsed = Date.now() - t;
  return elapsed < minMs;
}
