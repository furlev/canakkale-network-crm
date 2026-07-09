import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest yapılandırması — SAF fonksiyon birim testleri (tests/ altında).
 *
 * Build'den tamamen bağımsızdır: `next build` bu dosyayı görmez, `vitest run`
 * de Next/webpack'e dokunmaz. Amaç kritik iş kurallarını (fatura/KDV, RBAC,
 * sanitize, ilçe normalizasyonu, AI özgünlük/kalite skoru) hızlı ve DB'siz
 * doğrulamak. `@/` alias'ı tsconfig ile aynı köke (./src) çözülür.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // DB/ağ gerektiren entegrasyon testleri burada değil — saf birim kapsamı.
    passWithNoTests: false,
  },
});
