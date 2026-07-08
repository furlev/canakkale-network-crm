'use client';

import { useMemo, useState } from 'react';
import type { JoinFormField, JoinFormSchema } from '@/lib/site';

/** Konfeti renk paleti (marka: kızıl, altın, lacivert tonları + yeşil). */
const CONFETTI_COLORS = ['#e23140', '#b98a2f', '#2fb96b', '#2f7db9', '#8a5cd6', '#f3eee4'];

function Confetti() {
  // Deterministik "rastgelelik" — hydration uyumsuzluğu olmasın
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${((i * 53) % 140) / 100}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${(i * 47) % 360}deg`,
      })),
    []
  );
  return (
    <span className="p-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: p.left,
            background: p.color,
            transform: `rotate(${p.rotate})`,
            ['--fall-delay' as string]: p.delay,
          }}
        />
      ))}
    </span>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: JoinFormField;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const inputId = `jf-${field.id}`;
  const req = field.required ? (
    <span className="req" aria-hidden="true">
      *
    </span>
  ) : null;

  if (field.type === 'checkbox') {
    return (
      <label className="p-check" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={value === true}
          required={field.required}
          onChange={e => onChange(e.target.checked)}
        />
        <span>
          {field.label}
          {req}
        </span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="p-field">
        <label htmlFor={inputId}>
          {field.label}
          {req}
        </label>
        <textarea
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          required={field.required}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="p-field p-field-select">
        <label htmlFor={inputId}>
          {field.label}
          {req}
        </label>
        <select
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          required={field.required}
          onChange={e => onChange(e.target.value)}
        >
          <option value="" disabled>
            Seçiniz…
          </option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="p-field">
      <label htmlFor={inputId}>
        {field.label}
        {req}
      </label>
      <input
        id={inputId}
        type={field.type}
        value={typeof value === 'string' ? value : ''}
        placeholder={field.placeholder}
        required={field.required}
        autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.id === 'name' ? 'name' : undefined}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/** CRM'den düzenlenen şemaya göre dinamik "Ekibimize Katıl" formu. */
export default function JoinForm({ schema }: { schema: JoinFormSchema }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (id: string) => (v: string | boolean) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // name/email/phone üst seviyeye, kalan alanlar data'ya
    const data: Record<string, string | boolean> = {};
    for (const f of schema.fields) {
      if (f.id === 'name' || f.id === 'email' || f.id === 'phone') continue;
      const v = values[f.id];
      if (v !== undefined && v !== '') data[f.id] = v;
    }

    try {
      const res = await fetch('/api/site/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(values.name || '').trim(),
          email: String(values.email || '').trim(),
          phone: String(values.phone || '').trim() || undefined,
          data,
          website: honeypot, // honeypot — insanlar bunu doldurmaz
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Başvuru gönderilemedi. Lütfen tekrar dene.');
        return;
      }
      setDone(true);
    } catch {
      setError('Bağlantı hatası — internetini kontrol edip tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="p-success" role="status" aria-live="polite">
        <Confetti />
        <span className="glyph" aria-hidden="true">
          ✓
        </span>
        <h2>Başvurun alındı!</h2>
        <p>{schema.successMessage}</p>
      </div>
    );
  }

  return (
    <form className="p-form" onSubmit={onSubmit} noValidate={false}>
      {schema.fields.map(f => (
        <Field key={f.id} field={f} value={values[f.id] ?? (f.type === 'checkbox' ? false : '')} onChange={setValue(f.id)} />
      ))}

      {/* Honeypot — ekran okuyucular ve insanlar görmez, botlar doldurur */}
      <div className="p-hp" aria-hidden="true">
        <label htmlFor="jf-website">Web siteniz</label>
        <input
          id="jf-website"
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

      <button type="submit" className="s-btn s-btn-primary p-form-submit" disabled={submitting}>
        {submitting ? 'Gönderiliyor…' : 'Başvuruyu Gönder →'}
      </button>
    </form>
  );
}
