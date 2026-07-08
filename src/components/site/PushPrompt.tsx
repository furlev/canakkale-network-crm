'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './PushPrompt.module.css';

/**
 * Nazik web push izin isteği — canakkale.network son dakika bildirimleri.
 *
 * İlke: RAHATSIZ ETME. İzin, ancak ziyaretçi siteyle biraz haşır neşir olduktan
 * sonra istenir (varsayılan: 2. ziyaret) veya bir haberi sonuna kadar okuyunca
 * (`trigger="article-end"` ile mount edildiğinde hemen). Tarayıcının native izin
 * penceresi ASLA kendiliğinden açılmaz — önce bu nazik kart, kullanıcı "İzin ver"e
 * basınca native istem tetiklenir (tarayıcı politikalarına da uygun).
 *
 * Karar `localStorage('cn-push')` içinde saklanır; bir kez karar verilince tekrar
 * sorulmaz. İlçe tercihi (`localStorage('cn-district')`, DistrictPref'ten) abonelikle
 * birlikte gönderilir → ilçe-hedefli bildirim.
 *
 * NOT: Bu bileşen global olmalıdır; (public)/layout.tsx içinde <PushPrompt /> olarak
 * bir kez mount edin (mevcut CookieConsent'in yanına). Haber sonu tetikleyici için
 * haber sayfasının altına <PushPrompt trigger="article-end" /> koyulabilir.
 */

const DECISION_KEY = 'cn-push';
const VISIT_KEY = 'cn-visits';
const VISIT_THRESHOLD = 2;

/** VAPID public key (base64url) → Uint8Array (applicationServerKey).
 *  Somut ArrayBuffer üzerine kurulur → BufferSource'a atanabilir (SharedArrayBuffer değil). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export default function PushPrompt({ trigger = 'auto' }: { trigger?: 'auto' | 'article-end' }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const decide = useCallback((value: 'granted' | 'denied' | 'dismissed') => {
    try { localStorage.setItem(DECISION_KEY, value); } catch { /* gizli mod */ }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === 'denied') return;

    let decided: string | null = null;
    let visits = 1;
    try {
      decided = localStorage.getItem(DECISION_KEY);
      visits = (parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) || 0) + 1;
      localStorage.setItem(VISIT_KEY, String(visits));
    } catch { /* gizli mod → tek oturumluk davranış */ }

    if (decided) return; // zaten karar verilmiş
    if (Notification.permission === 'granted') return; // izin var; tekrar sorma

    const eligible = trigger === 'article-end' || visits >= VISIT_THRESHOLD;
    if (!eligible) return;

    // Özellik açık mı? Public key'i sunucudan al.
    let cancelled = false;
    fetch('/api/site/push/subscribe')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.enabled || !data.publicKey) return;
        setPublicKey(data.publicKey);
        setVisible(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trigger]);

  const enable = useCallback(async () => {
    if (!publicKey || !pushSupported()) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/site-sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        decide('denied');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

      let district: string | null = null;
      try { district = localStorage.getItem('cn-district'); } catch { /* yoksay */ }

      await fetch('/api/site/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, district }),
      });

      decide('granted');
    } catch {
      // Kayıt/abonelik başarısızsa nazikçe kapat; bir dahaki ziyarette tekrar denenmesin
      decide('dismissed');
    } finally {
      setBusy(false);
    }
  }, [publicKey, decide]);

  if (!visible) return null;

  return (
    <div className={styles.wrap} role="dialog" aria-labelledby="cn-push-title" aria-describedby="cn-push-desc">
      <div className={styles.card}>
        <span className={styles.bell} aria-hidden="true">🔔</span>
        <div className={styles.body}>
          <h2 id="cn-push-title" className={styles.title}>Son dakikayı kaçırma</h2>
          <p id="cn-push-desc" className={styles.text}>
            Çanakkale&apos;de önemli bir gelişme olduğunda anında haberdar olmak ister misin? İstediğin an
            kapatabilirsin.
          </p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={enable} disabled={busy}>
              {busy ? 'Ayarlanıyor…' : 'Bildirimlere izin ver'}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide('dismissed')} disabled={busy}>
              Şimdi değil
            </button>
          </div>
        </div>
        <button type="button" className={styles.close} aria-label="Kapat" onClick={() => decide('dismissed')}>
          ✕
        </button>
      </div>
    </div>
  );
}
