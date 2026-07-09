/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Gzip/br sıkıştırma (self-host/DO node sunucusunda HTML/JS/CSS küçülür → LCP/transfer iyileşir).
  compress: true,
  // "X-Powered-By: Next.js" başlığını gizle (bilgi sızıntısını azaltır).
  poweredByHeader: false,
  experimental: {
    viewTransition: true, // haber sitesinde sinematik sayfa geçişleri (shared-element)
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'canakkale.network' },
      { protocol: 'https', hostname: 'crm.canakkale.network' },
    ],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Güvenli, kırılgan olmayan global başlıklar (CSP EKLENMEDİ — inline stil/script'i
        // bozabileceği için object-storage + nonce geçişinden sonra ayrı ele alınacak).
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
