'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type LiveNotification = {
  id: string;
  type: string;
  title: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

const PROMPT_DISMISS_KEY = 'crm-notif-prompt-dismissed';

/**
 * SSE bildirim akışı istemcisi.
 * - /api/notifications/stream kaynağına bağlanır, hata durumunda artan
 *   gecikmeyle (1s → 30s) yeniden bağlanır.
 * - Yeni bildirimde onNotification callback'ini çağırır (rozet/panel güncellemesi).
 * - Sekme arka plandaysa ve izin verilmişse tarayıcı bildirimi gösterir
 *   (tıklama → pencereye odaklan + ilgili sayfaya git).
 * - Bildirim izni, sayfa yüklenirken değil ilk kullanıcı etkileşiminden sonra
 *   küçük bir kartla istenir; "Şimdi değil" tercihi localStorage'da saklanır.
 */
export default function NotificationStream({
  onNotification,
}: {
  onNotification: (n: LiveNotification) => void;
}) {
  const router = useRouter();
  const [promptVisible, setPromptVisible] = useState(false);

  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const routerRef = useRef(router);
  routerRef.current = router;

  /* ── SSE bağlantısı + backoff'lu yeniden bağlanma ── */
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let stopped = false;

    const showBrowserNotification = (n: LiveNotification) => {
      if (!document.hidden) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        const bn = new Notification('Çanakkale Network CRM', {
          body: n.title,
          tag: n.id,
          icon: '/favicon.ico',
        });
        bn.onclick = () => {
          window.focus();
          if (n.link) routerRef.current.push(n.link);
          bn.close();
        };
      } catch {
        /* bazı tarayıcılar sayfa bağlamında Notification'a izin vermez */
      }
    };

    const connect = () => {
      if (stopped) return;
      es = new EventSource('/api/notifications/stream');
      es.onopen = () => {
        attempts = 0;
      };
      es.onmessage = (ev) => {
        try {
          const n = JSON.parse(ev.data) as LiveNotification;
          if (!n || !n.id) return;
          onNotificationRef.current(n);
          showBrowserNotification(n);
        } catch {
          /* bozuk event yut */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        const delay = Math.min(30_000, 1_000 * 2 ** attempts);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  /* ── İzin istemi: ilk etkileşimde, yüklenirken değil ── */
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem(PROMPT_DISMISS_KEY)) return;
    } catch { /* */ }

    const onFirstInteraction = () => setPromptVisible(true);
    window.addEventListener('pointerdown', onFirstInteraction, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstInteraction);
  }, []);

  const dismissPrompt = () => {
    setPromptVisible(false);
    try { localStorage.setItem(PROMPT_DISMISS_KEY, '1'); } catch { /* */ }
  };

  const grantPermission = () => {
    setPromptVisible(false);
    try { localStorage.setItem(PROMPT_DISMISS_KEY, '1'); } catch { /* */ }
    if ('Notification' in window) {
      Notification.requestPermission().catch(() => {});
    }
  };

  if (!promptVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 320,
        zIndex: 1100,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>🔔 Tarayıcı bildirimleri</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Sekme arka plandayken yeni bildirimlerden haberdar olmak için tarayıcı bildirimlerine izin verin.
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={dismissPrompt}>Şimdi değil</button>
        <button className="btn btn-primary btn-sm" onClick={grantPermission}>İzin ver</button>
      </div>
    </div>
  );
}
