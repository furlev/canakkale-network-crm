'use client';

/**
 * Halka açık haber ihbarı formu. "Ekibimize Katıl" (JoinForm) desenini şablon alır:
 * aynı sınıf/stil sistemi, honeypot + sessiz durumlar. Sunucu tarafı savunma
 * /api/site/tip içindedir (honeypot + IP saatlik limit + gövde sınırı).
 *
 * Not: bu sayfa bilinçli olarak Client Component'tir (tek dosyada form etkileşimi);
 * SEO metadata gerektirmeyen bir yardımcı araç sayfasıdır, layout başlık şablonu geçerlidir.
 */

import { useState } from 'react';
import { DISTRICTS } from '@/lib/districts';
import '@/app/(public)/pages.css';

export default function IhbarPage() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [district, setDistrict] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/site/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          content: content.trim(),
          district: district || undefined,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          website: honeypot, // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setError(json?.error || 'İhbar gönderilemedi. Lütfen tekrar dene.');
        return;
      }
      setDone(true);
    } catch {
      setError('Bağlantı hatası — internetini kontrol edip tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="p-join-hero">
        <div className="s-container">
          <span className="s-kicker">Şehrin Gözü Kulağı Sensin</span>
          <h1 className="p-join-title">
            Haber İhbarı<span className="tick">.</span>
          </h1>
          <p className="p-page-sub">
            Çanakkale&apos;de gördüğün, tanık olduğun ya da bildiğin bir olayı bize ulaştır. İhbarın
            editör ekibimizce değerlendirilir. Dilersen adını vermeden de gönderebilirsin.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {done ? (
            <div className="p-success" role="status" aria-live="polite">
              <span className="glyph" aria-hidden="true">
                ✓
              </span>
              <h2>İhbarın bize ulaştı!</h2>
              <p>Teşekkür ederiz. Editör ekibimiz en kısa sürede değerlendirecek.</p>
            </div>
          ) : (
            <form className="p-form" onSubmit={onSubmit}>
              <div className="p-field">
                <label htmlFor="ih-subject">
                  Konu / Başlık
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="ih-subject"
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Kısaca ne oldu?"
                  required
                  minLength={4}
                  maxLength={160}
                />
              </div>

              <div className="p-field p-field-select">
                <label htmlFor="ih-district">İlçe</label>
                <select id="ih-district" value={district} onChange={e => setDistrict(e.target.value)}>
                  <option value="">Farketmez / bilinmiyor</option>
                  {DISTRICTS.map(d => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-field">
                <label htmlFor="ih-content">
                  İhbar Detayı
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <textarea
                  id="ih-content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Olayı olabildiğince ayrıntılı anlat: ne, nerede, ne zaman?"
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={6}
                />
              </div>

              <div className="p-field">
                <label htmlFor="ih-name">Adın (opsiyonel)</label>
                <input
                  id="ih-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Anonim kalmak istersen boş bırak"
                  maxLength={120}
                  autoComplete="name"
                />
              </div>

              <div className="p-field">
                <label htmlFor="ih-phone">Telefon (opsiyonel)</label>
                <input
                  id="ih-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Teyit için ulaşmamız gerekebilir"
                  maxLength={32}
                  autoComplete="tel"
                />
              </div>

              <div className="p-field">
                <label htmlFor="ih-email">E-posta (opsiyonel)</label>
                <input
                  id="ih-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                  maxLength={160}
                  autoComplete="email"
                />
              </div>

              {/* Honeypot — insanlar ve ekran okuyucular görmez, botlar doldurur */}
              <div className="p-hp" aria-hidden="true">
                <label htmlFor="ih-website">Web siteniz</label>
                <input
                  id="ih-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                />
              </div>

              {error && (
                <p className="p-form-error" role="alert">
                  {error}
                </p>
              )}

              <p style={{ fontSize: 'var(--text-sm, 0.85rem)', color: 'var(--ink-faint)', margin: 0 }}>
                Gönderdiğin bilgiler yalnızca haber değerlendirmesi için kullanılır.
              </p>

              <button type="submit" className="s-btn s-btn-primary p-form-submit" disabled={submitting}>
                {submitting ? 'Gönderiliyor…' : 'İhbarı Gönder →'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
