/**
 * Sunucu açılışında ortam değişkeni doğrulaması.
 * Zorunlu değişken eksikse uygulama "sessizce bozuk" çalışmak yerine anlaşılır hata verir.
 */
export async function register() {
  const required = ['DATABASE_URL', 'AUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Eksik zorunlu ortam değişken(ler)i: ${missing.join(', ')}`);
  }

  const recommended = ['CRON_SECRET'];
  for (const key of recommended) {
    if (!process.env[key]) {
      console.warn(`[startup] Uyarı: ${key} tanımlı değil — ilgili cron uçları çalışmaz.`);
    }
  }

  await initSentry();
}

/**
 * Sentry (gözlemlenebilirlik) — TAMAMEN GRACEFUL / opsiyonel.
 * SENTRY_DSN yoksa hiçbir şey yapılmaz. DSN varsa `@sentry/nextjs` çalışma zamanında
 * dinamik yüklenir; paket kurulu değilse (peer opsiyonel) sessizce atlanır — build/runtime
 * KIRILMAZ. Paketi aktifleştirmek için: `npm i @sentry/nextjs` + DSN env'i tanımlamak yeter.
 */
async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // Değişken specifier → bundler statik çözmez; paket yoksa runtime'da yakalanır.
    const pkg = '@sentry/nextjs';
    const Sentry: any = await import(/* @vite-ignore */ /* webpackIgnore: true */ pkg).catch(() => null);
    if (Sentry && typeof Sentry.init === 'function') {
      Sentry.init({
        dsn,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0') || 0,
        environment: process.env.NODE_ENV,
      });
      console.log('[startup] Sentry etkin.');
    }
  } catch (e) {
    console.warn('[startup] Sentry başlatılamadı (opsiyonel), atlanıyor:', e);
  }
}
