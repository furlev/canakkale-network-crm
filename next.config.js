/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
