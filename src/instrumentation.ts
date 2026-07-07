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

  const recommended = ['CRON_SECRET', 'WEBHOOK_SECRET'];
  for (const key of recommended) {
    if (!process.env[key]) {
      console.warn(`[startup] Uyarı: ${key} tanımlı değil — ilgili cron/webhook uçları çalışmaz.`);
    }
  }
}
