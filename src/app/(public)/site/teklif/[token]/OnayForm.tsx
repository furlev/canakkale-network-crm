'use client';

/**
 * Teklif/sözleşme onay + basit e-imza formu (halka açık).
 * site/ihbar honeypot desenini izler; /api/site/sign uç noktasına yazar.
 */

import { useState } from 'react';

export default function OnayForm({ token, subtype }: { token: string; subtype: string }) {
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (action: 'accept' | 'reject') => {
    if (busy) return;
    setError(null);
    if (action === 'accept') {
      if (name.trim().length < 2) {
        setError('Lütfen imza için ad soyadınızı yazın.');
        return;
      }
      if (!consent) {
        setError('Onaylamak için imza kutusunu işaretleyin.');
        return;
      }
    }
    setBusy(action);
    try {
      const res = await fetch('/api/site/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, name: name.trim() || undefined, website: honeypot }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setError(json?.error || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
        return;
      }
      setDone(action === 'accept' ? 'accepted' : 'rejected');
    } catch {
      setError('Bağlantı hatası — internetinizi kontrol edip tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    return (
      <div className="p-success" role="status" aria-live="polite">
        <span className="glyph" aria-hidden="true">
          {done === 'accepted' ? '✓' : '✕'}
        </span>
        <h2>{done === 'accepted' ? 'Onayınız alındı!' : 'Yanıtınız kaydedildi.'}</h2>
        <p>
          {done === 'accepted'
            ? `${subtype} dijital olarak imzalandı. Teşekkür ederiz.`
            : `${subtype} reddedildi olarak işaretlendi.`}
        </p>
      </div>
    );
  }

  return (
    <form className="p-form" onSubmit={(e) => { e.preventDefault(); submit('accept'); }}>
      <div className="p-field">
        <label htmlFor="sign-name">
          Ad Soyad (dijital imza)
          <span className="req" aria-hidden="true">*</span>
        </label>
        <input
          id="sign-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Belgeyi onaylayan kişi"
          maxLength={120}
          autoComplete="name"
        />
      </div>

      <label style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', fontSize: '.9rem' }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Yukarıdaki bilgileri okudum, {subtype.toLowerCase()} içeriğini kabul ediyorum ve
          adımla dijital olarak imzalıyorum.
        </span>
      </label>

      {/* Honeypot */}
      <div className="p-hp" aria-hidden="true">
        <label htmlFor="sign-website">Web siteniz</label>
        <input
          id="sign-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && (
        <p className="p-form-error" role="alert">
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
        <button type="submit" className="s-btn s-btn-primary p-form-submit" disabled={busy !== null}>
          {busy === 'accept' ? 'Gönderiliyor…' : 'Onayla ve İmzala →'}
        </button>
        <button
          type="button"
          className="s-btn"
          disabled={busy !== null}
          onClick={() => submit('reject')}
        >
          {busy === 'reject' ? 'Gönderiliyor…' : 'Reddet'}
        </button>
      </div>
    </form>
  );
}
