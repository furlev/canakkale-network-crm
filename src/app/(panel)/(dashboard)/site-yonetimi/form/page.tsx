'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { JoinFormSchema, JoinFormField } from '@/lib/site'; // yalnızca tip — derlemede silinir

const CORE_FIELD_IDS = ['name', 'email']; // çekirdek alanlar: silinemez (başvuru kaydı bunlara bağlı)

const TYPE_LABEL: Record<JoinFormField['type'], string> = {
  text: 'Metin',
  email: 'E-posta',
  tel: 'Telefon',
  textarea: 'Uzun Metin',
  select: 'Seçim Listesi',
  checkbox: 'Onay Kutusu',
};

export default function FormBuilderPage() {
  const [form, setForm] = useState<JoinFormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/site-admin/join-form')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setForm(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setField = (index: number, patch: Partial<JoinFormField>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const fields = prev.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
      return { ...prev, fields };
    });
  };

  const moveField = (index: number, dir: -1 | 1) => {
    setForm((prev) => {
      if (!prev) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.fields.length) return prev;
      const fields = [...prev.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...prev, fields };
    });
  };

  const removeField = (index: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const field = prev.fields[index];
      if (CORE_FIELD_IDS.includes(field.id)) {
        alert(`"${field.label}" çekirdek alandır, silinemez (başvuru kaydı bu alana bağlı).`);
        return prev;
      }
      if (!confirm(`"${field.label}" alanı formdan kaldırılsın mı?`)) return prev;
      return { ...prev, fields: prev.fields.filter((_, i) => i !== index) };
    });
  };

  const addField = () => {
    setForm((prev) => {
      if (!prev) return prev;
      const id = `alan-${Date.now().toString(36)}`;
      const field: JoinFormField = { id, label: 'Yeni Alan', type: 'text', required: false, placeholder: '' };
      return { ...prev, fields: [...prev.fields, field] };
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/site-admin/join-form', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      setMsg({ kind: 'success', text: 'Form şeması kaydedildi ✓' });
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
      {loading ? 'Yükleniyor...' : 'Form şeması yüklenemedi.'}
    </div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🧩 &quot;Ekibimize Katıl&quot; Formu</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· Sitedeki başvuru formunun alanlarını düzenleyin
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* ── Sol: form kurucu ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Genel</div>
            <div className="form-group">
              <label className="form-label">Form Başlığı</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Giriş Metni</label>
              <textarea className="form-textarea" rows={2} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Başarı Mesajı</label>
              <textarea className="form-textarea" rows={2} value={form.successMessage} onChange={(e) => setForm({ ...form, successMessage: e.target.value })} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Form aktif (kapatılırsa sitede başvuru alınmaz)
            </label>
          </div>

          {form.fields.map((f, i) => {
            const isCore = CORE_FIELD_IDS.includes(f.id);
            return (
              <div key={f.id} className="card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span className="badge badge-primary">{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{f.label || '(etiketsiz alan)'}</span>
                    {isCore && <span className="badge badge-warning" title="Başvuru kaydı bu alana bağlı — silinemez">🔒 Çekirdek</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="btn btn-ghost btn-sm" title="Yukarı taşı" disabled={i === 0} onClick={() => moveField(i, -1)}>↑</button>
                    <button className="btn btn-ghost btn-sm" title="Aşağı taşı" disabled={i === form.fields.length - 1} onClick={() => moveField(i, 1)}>↓</button>
                    <button className="btn btn-ghost btn-sm" title={isCore ? 'Çekirdek alan silinemez' : 'Alanı sil'} disabled={isCore} onClick={() => removeField(i)}>🗑️</button>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Etiket</label>
                    <input className="form-input" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tip</label>
                    <select
                      className="form-select"
                      value={f.type}
                      disabled={isCore}
                      onChange={(e) => setField(i, { type: e.target.value as JoinFormField['type'] })}
                    >
                      {(Object.keys(TYPE_LABEL) as JoinFormField['type'][]).map((t) => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Placeholder</label>
                    <input className="form-input" value={f.placeholder || ''} onChange={(e) => setField(i, { placeholder: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)', paddingBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        disabled={isCore}
                        onChange={(e) => setField(i, { required: e.target.checked })}
                      />
                      Zorunlu alan
                    </label>
                  </div>
                </div>
                {f.type === 'select' && (
                  <div className="form-group">
                    <label className="form-label">Seçenekler (her satıra bir tane)</label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      value={(f.options || []).join('\n')}
                      onChange={(e) => setField(i, { options: e.target.value.split('\n') })}
                      onBlur={(e) => setField(i, { options: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })}
                      placeholder={'Muhabir\nKamera / Kurgu\nSosyal Medya'}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn btn-ghost" onClick={addField}>➕ Alan Ekle</button>
        </div>

        {/* ── Sağ: canlı önizleme ── */}
        <div className="card" style={{ padding: 'var(--space-5)', position: 'sticky', top: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            Canlı Önizleme {!form.enabled && '· (form kapalı)'}
          </div>
          <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-lg)' }}>{form.title}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{form.intro}</p>
          <div style={{ opacity: form.enabled ? 1 : 0.5 }}>
            {form.fields.map((f) => (
              <div className="form-group" key={f.id}>
                {f.type === 'checkbox' ? (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--text-sm)', cursor: 'default' }}>
                    <input type="checkbox" disabled style={{ marginTop: 3 }} />
                    <span>{f.label}{f.required && <span style={{ color: 'var(--error)' }}> *</span>}</span>
                  </label>
                ) : (
                  <>
                    <label className="form-label">
                      {f.label}{f.required && <span style={{ color: 'var(--error)' }}> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea className="form-textarea" rows={3} placeholder={f.placeholder} disabled />
                    ) : f.type === 'select' ? (
                      <select className="form-select" disabled>
                        <option>{f.placeholder || 'Seçin...'}</option>
                        {(f.options || []).filter(Boolean).map((o, j) => <option key={j}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" type={f.type} placeholder={f.placeholder} disabled />
                    )}
                  </>
                )}
              </div>
            ))}
            <button className="btn btn-primary" disabled style={{ width: '100%' }}>Başvuruyu Gönder</button>
          </div>
        </div>
      </div>
    </div>
  );
}
