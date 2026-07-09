/**
 * Cloudflare Turnstile doğrulaması — GRACEFUL: env yoksa no-op.
 *
 * `TURNSTILE_SECRET` tanımlı DEĞİLSE hiçbir şey doğrulanmaz ve `{ ok:true, skipped:true }`
 * döner (kod yolu değişmez, build/runtime kırılmaz). Secret varsa istemciden gelen token
 * Cloudflare siteverify API'sine sorulur. Doğrulama servisine ulaşılamazsa (ağ hatası)
 * fail-open davranır (skipped:true) — düşük riskli halka açık formları ağ arızasında
 * bloklamamak için; ama eksik token secret varken açıkça reddedilir.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = {
  /** Doğrulama geçti mi (ya da atlandı mı). false yalnızca gerçek başarısızlıkta. */
  ok: boolean;
  /** Doğrulama yapılmadı (secret yok ya da servis erişilemez) → çağıran karar verir. */
  skipped?: boolean;
  /** Cloudflare hata kodları (varsa). */
  error?: string;
};

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'missing-input-response' };

  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (remoteIp) form.append('remoteip', remoteIp);

    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    const data = (await res.json()) as { success?: boolean; ['error-codes']?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, error: (data['error-codes'] || []).join(',') || 'verification-failed' };
  } catch (e) {
    // Doğrulama servisi erişilemez → fail-open (formu bloklama), ama logla.
    console.error('[turnstile] doğrulama servisi hatası:', e);
    return { ok: true, skipped: true };
  }
}
