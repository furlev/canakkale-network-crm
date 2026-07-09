'use client';

import { useState } from 'react';
import styles from './ContactForm.module.css';

/**
 * Halka açık iletişim formu (#33). POST /api/site/contact → CRM Lead.
 * Honeypot ("website") + sunucu tarafı IP rate-limit ile korunur.
 * Başarıda nötr teşekkür mesajı gösterir (bilgi sızdırmaz).
 */
export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/site/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDone(true);
      } else {
        setError(data?.error || 'Mesaj gönderilemedi. Lütfen daha sonra tekrar dene.');
      }
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={styles.wrap}>
        <div className={styles.success} role="status">
          Mesajın bize ulaştı. Teşekkürler! En kısa sürede dönüş yapacağız.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          Bize yaz<span className={styles.tint}>.</span>
        </h2>
        <p className={styles.sub}>
          E-postayla uğraşmak istemiyorsan formu doldur; mesajın doğrudan ekibimize düşer.
        </p>
      </div>

      <form onSubmit={submit} noValidate>
        {/* Honeypot — insanlar görmez, botlar doldurur */}
        <div className={styles.hp} aria-hidden="true">
          <label htmlFor="cf-website">Web sitesi (boş bırak)</label>
          <input
            id="cf-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cf-name">Ad Soyad</label>
          <input
            id="cf-name"
            className={styles.input}
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adın Soyadın"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cf-email">E-posta</label>
          <input
            id="cf-email"
            className={styles.input}
            type="email"
            required
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cf-message">Mesajın</label>
          <textarea
            id="cf-message"
            className={styles.textarea}
            required
            minLength={5}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nasıl yardımcı olabiliriz?"
          />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button type="submit" className="s-btn s-btn-primary" disabled={busy}>
            {busy ? 'Gönderiliyor…' : 'Mesajı Gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
