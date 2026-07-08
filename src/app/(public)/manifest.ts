import type { MetadataRoute } from 'next';

/**
 * Haber sitesi (canakkale.network) PWA manifesti. `(public)` grubu kendi kök layout'u
 * olduğundan bu dosya yalnız site rotalarına `/manifest.webmanifest` üretir; panel'e
 * bulaşmaz. Tema/arka plan #070d18 (Network koyu) → Android splash markayla açılır.
 *
 * NOT: logo-dark.png 600×150 (yatay) — maskable ikon güvenli bölgede kırpılır. İdeal
 * PWA ikonu için ileride kare 512×512 maskable bir görsel eklenmeli.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Çanakkale Network — Şehrin Dijital Meydanı',
    short_name: 'Çanakkale Network',
    description:
      "Çanakkale'nin en güncel haber platformu: son dakika, sokak röportajları, üniversite ve etkinlik haberleri.",
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'tr',
    dir: 'ltr',
    categories: ['news', 'magazines'],
    background_color: '#070d18',
    theme_color: '#070d18',
    icons: [
      { src: '/site/logo-dark.png', sizes: '600x150', type: 'image/png', purpose: 'any' },
      { src: '/site/logo-dark.png', sizes: '600x150', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
