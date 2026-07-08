'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { JoinFormSchema } from '@/lib/site'; // yalnızca tip — derlemede silinir

type Application = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  data: string;              // JSON: dinamik form yanıtları
  status: string;            // new | reviewed | accepted | rejected
  note: string | null;
  createdAt: string;
};

type StatusKey = 'new' | 'reviewed' | 'accepted' | 'rejected' | 'all';

const TABS: { key: StatusKey; label: string }[] = [
  { key: 'new', label: 'Yeni' },
  { key: 'reviewed', label: 'İncelendi' },
  { key: 'accepted', label: 'Kabul' },
  { key: 'rejected', label: 'Red' },
  { key: 'all', label: 'Tümü' },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  new: { cls: 'badge-warning', label: 'Yeni' },
  reviewed: { cls: 'badge-info', label: 'İncelendi' },
  accepted: { cls: 'badge-success', label: 'Kabul' },
  rejected: { cls: 'badge-error', label: 'Red' },
};

/** Başvurunun data JSON'unu güvenle çözer. */
function parseData(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export default function BasvurularPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<StatusKey>('new');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formSchema, setFormSchema] = useState<JoinFormSchema | null>(null);

  const fetchApplications = useCallback(async (status: StatusKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/site-admin/applications?status=${status}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCounts(data.counts || {});
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(tab); }, [tab, fetchApplications]);

  useEffect(() => {
    // Alan id → etiket eşlemesi için form şeması
    fetch('/api/site-admin/join-form')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setFormSchema(data); })
      .catch(() => {});
  }, []);

  const openApplication = (a: Application) => {
    setSelected(a);
    setNote(a.note || '');
    setCopied(false);
  };

  const updateApplication = async (patch: { status?: string; note?: string }) => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/site-admin/applications/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSelected(data);
        setNote(data.note || '');
        await fetchApplications(tab);
      } else {
        alert(data?.error || 'İşlem başarısız oldu.');
      }
    } catch {
      alert('Sunucuya ulaşılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`"${selected.name}" başvurusu KALICI olarak silinsin mi? (KVKK — geri alınamaz)`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/site-admin/applications/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelected(null);
        await fetchApplications(tab);
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Silme başarısız oldu.');
      }
    } finally {
      setBusy(false);
    }
  };

  const copyEmail = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(selected.email);
    }
  };

  /** Form şemasındaki etiketlerle data alanlarını sırayla göster; şemada olmayanlar sona. */
  const detailRows = (a: Application): { label: string; value: string }[] => {
    const data = parseData(a.data);
    const rows: { label: string; value: string }[] = [];
    const used = new Set<string>();
    const format = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Evet ✓' : 'Hayır') : String(v ?? ''));

    for (const f of formSchema?.fields || []) {
      if (['name', 'email', 'phone'].includes(f.id)) continue; // üstte zaten gösteriliyor
      if (f.id in data) {
        rows.push({ label: f.label, value: format(data[f.id]) });
        used.add(f.id);
      }
    }
    for (const [key, value] of Object.entries(data)) {
      if (used.has(key) || ['name', 'email', 'phone'].includes(key)) continue;
      rows.push({ label: key, value: format(value) });
    }
    return rows;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📋 Başvurular</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· &quot;Ekibimize Katıl&quot; başvuru gelen kutusu
          </p>
        </div>
      </div>

      {/* Durum sekmeleri */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'new' && (counts.new ?? 0) > 0 && (
              <span className="badge badge-error" style={{ marginLeft: 6 }}>{counts.new}</span>
            )}
            {t.key !== 'new' && t.key !== 'all' && ` (${counts[t.key] ?? 0})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* ── Sol: başvuru listesi ── */}
        <div className="data-table-container">
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
              Bu durumda başvuru bulunmuyor.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Başvuran</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const st = STATUS_BADGE[a.status] || { cls: 'badge-primary', label: a.status };
                  return (
                    <tr
                      key={a.id}
                      onClick={() => openApplication(a)}
                      style={{ cursor: 'pointer', background: selected?.id === a.id ? 'rgba(108,92,231,0.08)' : undefined }}
                    >
                      <td style={{ fontWeight: a.status === 'new' ? 600 : 400 }}>
                        {a.name}
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{a.email}</div>
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Sağ: detay paneli ── */}
        {selected ? (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{selected.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {selected.email}
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={copyEmail} title="E-postayı kopyala">
                    {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
                  </button>
                </div>
                {selected.phone && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>📞 {selected.phone}</div>
                )}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Başvuru: {new Date(selected.createdAt).toLocaleString('tr-TR')}
                </div>
              </div>
              {(() => {
                const st = STATUS_BADGE[selected.status] || { cls: 'badge-primary', label: selected.status };
                return <span className={`badge ${st.cls}`}>{st.label}</span>;
              })()}
            </div>

            {/* Dinamik form yanıtları */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              {detailRows(selected).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Ek form yanıtı yok.</div>
              ) : (
                detailRows(selected).map((row, i) => (
                  <div key={i} style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {row.label}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{row.value || '—'}</div>
                  </div>
                ))
              )}
            </div>

            {/* Durum işlemleri */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              {selected.status !== 'reviewed' && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => updateApplication({ status: 'reviewed' })}>
                  👁️ İncelendi
                </button>
              )}
              {selected.status !== 'accepted' && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => updateApplication({ status: 'accepted' })}>
                  ✓ Kabul Et
                </button>
              )}
              {selected.status !== 'rejected' && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => updateApplication({ status: 'rejected' })}>
                  ✕ Reddet
                </button>
              )}
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleDelete} style={{ marginLeft: 'auto' }} title="KVKK gereği kalıcı silme">
                🗑️ Kalıcı Sil
              </button>
            </div>

            {/* Not */}
            <div className="form-group">
              <label className="form-label">Değerlendirme Notu</label>
              <textarea className="form-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İç not (başvurana gösterilmez)" />
            </div>
            <button className="btn btn-ghost btn-sm" disabled={busy || note === (selected.note || '')} onClick={() => updateApplication({ note })}>
              💾 Notu Kaydet
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Detayını görmek için soldan bir başvuru seçin.
          </div>
        )}
      </div>
    </div>
  );
}
