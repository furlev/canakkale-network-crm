'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'ok' | 'error';

/**
 * Bülten kayıt bandı — POST /api/site/subscribe { email }.
 * Başarı/hata durumları aria-live ile duyurulur.
 */
export default function NewsletterCTA({ adsNotice }: { adsNotice?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus('error');
      setMessage('Geçerli bir e-posta adresi gir.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/site/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (res.ok) {
        setStatus('ok');
        setMessage('Kaydın alındı! Şehrin gündemi artık her hafta kutunda. 🎉');
        setEmail('');
      } else {
        const data = await res.json().catch(() => null);
        setStatus('error');
        setMessage(
          (data && typeof data.error === 'string' && data.error) ||
            'Bir şeyler ters gitti — biraz sonra tekrar dene.'
        );
      }
    } catch {
      setStatus('error');
      setMessage('Bağlantı kurulamadı — internetini kontrol edip tekrar dene.');
    }
  };

  return (
    <section className="s-section newsletter-section">
      <div className="s-container">
        <div className="newsletter s-reveal">
          <div className="newsletter-copy">
            <span className="s-kicker">Bülten</span>
            <h2 className="newsletter-title">
              Şehri kaçırma, <span className="tick">kutuna</span> gelsin.
            </h2>
            <p className="newsletter-sub">
              Haftanın öne çıkan haberleri, röportajları ve etkinlikleri — kısa, öz ve reklamsız bir mektup.
            </p>
          </div>
          <div className="newsletter-action">
            <form className="newsletter-form" onSubmit={submit} noValidate>
              <label htmlFor="newsletter-email" className="sr-only">
                E-posta adresin
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                placeholder="eposta@ornek.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={status === 'loading'}
              />
              <button type="submit" className="s-btn s-btn-primary" disabled={status === 'loading'}>
                {status === 'loading' ? 'Gönderiliyor…' : 'Abone Ol'}
              </button>
            </form>
            <p
              className={`newsletter-status${status === 'ok' ? ' is-ok' : ''}${status === 'error' ? ' is-error' : ''}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
            {adsNotice && <p className="newsletter-notice">{adsNotice}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
