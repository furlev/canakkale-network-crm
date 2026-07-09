'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './ReaderAuthForm.module.css';

/**
 * Okuyucu (site üyesi) giriş/kayıt formu — tek bileşen, mode ile ikiye ayrılır.
 * POST /api/site/reader/login | /register. Honeypot ("website") + zaman-tuzağı (ts)
 * ile korunur; sunucuda ayrıca IP rate-limit vardır. Başarıda ?next veya ana sayfaya döner.
 */
export default function ReaderAuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const renderedAt = useRef(Date.now());

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const endpoint = isRegister ? '/api/site/reader/register' : '/api/site/reader/login';
      const payload = isRegister
        ? { email, password, name: name || undefined, website, ts: renderedAt.current }
        : { email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // Sunucu bileşenlerinin taze okuyucu durumunu görmesi için tam yenileme.
        window.location.assign(next.startsWith('/') ? next : '/');
      } else {
        setError(data?.error || 'İşlem tamamlanamadı. Lütfen tekrar dene.');
        setBusy(false);
      }
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar dene.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>
        {isRegister ? 'Üye ol' : 'Giriş yap'}
        <span className={styles.tint}>.</span>
      </h2>
      <p className={styles.sub}>
        {isRegister
          ? 'Ücretsiz üyelikle yorum yap, bülteni yönet ve premium içeriklere erişimini yükselt.'
          : 'Hesabınla giriş yap; premium haberler ve üyelik ayarların seni bekliyor.'}
      </p>

      <form onSubmit={submit} noValidate>
        {/* Honeypot — insanlar görmez, botlar doldurur */}
        <div className={styles.hp} aria-hidden="true">
          <label htmlFor="ra-website">Web sitesi (boş bırak)</label>
          <input
            id="ra-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={e => setWebsite(e.target.value)}
          />
        </div>

        {isRegister && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ra-name">Ad (opsiyonel)</label>
            <input
              id="ra-name"
              className={styles.input}
              type="text"
              maxLength={80}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Görünen adın"
              autoComplete="name"
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ra-email">E-posta</label>
          <input
            id="ra-email"
            className={styles.input}
            type="email"
            required
            maxLength={160}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ra-password">Şifre</label>
          <input
            id="ra-password"
            className={styles.input}
            type="password"
            required
            minLength={isRegister ? 8 : 1}
            maxLength={200}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isRegister ? 'En az 8 karakter' : 'Şifren'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button type="submit" className="s-btn s-btn-primary" disabled={busy}>
            {busy ? 'Lütfen bekle…' : isRegister ? 'Üye Ol' : 'Giriş Yap'}
          </button>
        </div>
      </form>

      <p className={styles.alt}>
        {isRegister ? (
          <>
            Zaten üye misin?{' '}
            <Link href={`/uye/giris${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Giriş yap</Link>
          </>
        ) : (
          <>
            Hesabın yok mu?{' '}
            <Link href={`/uye/kayit${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Üye ol</Link>
          </>
        )}
      </p>
    </div>
  );
}
