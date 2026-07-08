/*
 * canakkale.network haber sitesi service worker'ı — YALNIZCA web push.
 * (CRM paneli için /sw.js ayrıdır; offline cache mantığını orası taşır.)
 *
 * push:            sunucudan gelen JSON payload'ı bildirime çevirir.
 * notificationclick: bildirimi kapatır, ilgili URL zaten açıksa ona odaklanır,
 *                    yoksa yeni sekmede açar.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Çanakkale Network', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Çanakkale Network';
  const options = {
    body: data.body || 'Yeni bir gelişme var.',
    icon: data.icon || '/site/logo-light.png',
    badge: data.badge || '/icons/icon-72x72.png',
    image: data.image || undefined,
    tag: data.tag || undefined,
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Aynı origin'de zaten açık bir sekme varsa onu öne getir ve yönlendir
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && target) {
            try { client.navigate(target); } catch (e) { /* yoksay */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
