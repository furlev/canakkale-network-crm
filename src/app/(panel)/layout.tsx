import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * GÜVENLİK + DOĞRULUK: Panel tamamen oturum-ardı ve kullanıcıya özeldir; hiçbir
 * sayfası statik prerender edilip CDN'de public önbelleğe ALINMAMALIDIR.
 * Aksi halde (yaşanan olay) dashboard kökü `/` boş statik kabuk olarak
 * `Cache-Control: s-maxage=31536000` ile CDN'e düşüyor, oturumsuz ziyaretçiye
 * 204 boş yanıt servis ediliyor (proxy'deki /login yönlendirmesi baypas ediliyor)
 * ve "linke girince hiçbir şey olmuyor" hatası oluşuyor. force-dynamic tüm panel
 * alt ağacını istek-başına render'a zorlar → yanıtlar private/no-store, CDN cache'lemez.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Çanakkale Network CRM',
  description: 'canakkale.network haber sitesi için profesyonel CRM ve proje yönetim sistemi',
  manifest: '/manifest.json',
  keywords: ['CRM', 'Çanakkale', 'haber', 'yönetim', 'proje'],
  authors: [{ name: 'Çanakkale Network' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('crm-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
