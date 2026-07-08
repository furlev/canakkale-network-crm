'use client';
import { useState, useEffect, useMemo } from 'react';

type Stats = { total: number; opened: number; clicked: number };
type Newsletter = {
  id: string;
  subject: string;
  intro?: string | null;
  content: string;
  status: string;
  recipients: number;
  sentAt?: string | null;
  createdAt: string;
  stats?: Stats;
};

type Subscriber = {
  id: string;
  email: string;
  status: string;
  confirmedAt?: string | null;
  tags?: string | null;
};

const emptyForm = { subject: '', intro: '', content: '' };

/** tags JSON string → string[] (güvenli). */
function parseTags(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function rate(part: number, whole: number): string {
  if (!whole) return '—';
  return `%${Math.round((part / whole) * 100)}`;
}

export default function NewslettersPage() {
  const [items, setItems] = useState<Newsletter[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Gönderim modalı (segment + önizleme)
  const [sendTarget, setSendTarget] = useState<Newsletter | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [nRes, sRes] = await Promise.all([fetch('/api/newsletters'), fetch('/api/subscribers')]);
      const nData = await nRes.json();
      const sData = await sRes.json();
      setItems(Array.isArray(nData) ? nData : []);
      setSubscribers(Array.isArray(sData) ? sData : []);
    } catch (error) {
      console.error('Error fetching newsletters:', error);
    } finally {
      setLoading(false);
    }
  };

  // Abone segment metrikleri
  const confirmed = useMemo(() => subscribers.filter(s => s.status === 'active' && s.confirmedAt), [subscribers]);
  const pendingCount = subscribers.filter(s => s.status === 'pending').length;
  const unsubCount = subscribers.filter(s => s.status === 'unsubscribed').length;

  // Onaylı abonelerin tag'lerinden segment seçenekleri
  const segmentOptions = useMemo(() => {
    const set = new Set<string>();
    confirmed.forEach(s => parseTags(s.tags).forEach(t => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [confirmed]);

  // Seçili segmente uyan onaylı abone sayısı (önizleme)
  const audienceCount = useMemo(() => {
    if (selectedTags.length === 0) return confirmed.length;
    return confirmed.filter(s => {
      const t = new Set(parseTags(s.tags));
      return selectedTags.some(tag => t.has(tag));
    }).length;
  }, [confirmed, selectedTags]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setMsg(''); setModalOpen(true); };
  const openEdit = (n: Newsletter) => {
    if (n.status === 'sent') return;
    setEditingId(n.id);
    setForm({ subject: n.subject, intro: n.intro || '', content: n.content });
    setMsg('');
    setModalOpen(true);
  };

  const generateIntro = async () => {
    setAiBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/ai/newsletter-intro', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setForm(f => ({ ...f, intro: data.intro }));
      else setMsg(`❌ ${data.error}`);
    } catch {
      setMsg('❌ Sunucuya ulaşılamadı');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async () => {
    if (!form.subject || !form.content) return;
    try {
      const res = editingId
        ? await fetch(`/api/newsletters/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : await fetch('/api/newsletters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        const saved = await res.json();
        setItems(editingId ? items.map(n => n.id === editingId ? { ...n, ...saved } : n) : [saved, ...items]);
        setModalOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        setMsg(`❌ ${data?.error || 'Kaydedilemedi'}`);
      }
    } catch (error) {
      console.error('Error saving newsletter:', error);
    }
  };

  const openSend = (n: Newsletter) => {
    setSendTarget(n);
    setSelectedTags([]);
    setMsg('');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const confirmSend = async () => {
    if (!sendTarget) return;
    setSending(true);
    setMsg('');
    try {
      const res = await fetch(`/api/newsletters/${sendTarget.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: selectedTags }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ ${data.sent}/${data.audience} onaylı aboneye gönderildi${data.failed ? ` (${data.failed} başarısız)` : ''}`);
        setItems(items.map(x => x.id === sendTarget.id ? { ...x, ...data.newsletter } : x));
        setSendTarget(null);
      } else {
        setMsg(`❌ ${data.error || 'Gönderilemedi'}`);
      }
    } catch {
      setMsg('❌ Sunucuya ulaşılamadı');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bülteni silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/newsletters/${id}`, { method: 'DELETE' });
    if (res.ok) setItems(items.filter(n => n.id !== id));
  };

  const sentItems = items.filter(n => n.status === 'sent');
  const sentCount = sentItems.length;
  // Ortalama açılma oranı (gönderilen bültenler üzerinden)
  const avgOpen = useMemo(() => {
    const withReach = sentItems.filter(n => (n.stats?.total ?? n.recipients) > 0);
    if (withReach.length === 0) return null;
    const sum = withReach.reduce((acc, n) => {
      const total = n.stats?.total ?? n.recipients;
      const opened = n.stats?.opened ?? 0;
      return acc + (total ? opened / total : 0);
    }, 0);
    return Math.round((sum / withReach.length) * 100);
  }, [sentItems]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📧 Bülten</h1>
          <p className="page-subtitle">Çift-onaylı abonelere kişiselleştirilmiş gönderim + açılma/tık takibi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Bülten</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Onaylı Abone</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : confirmed.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Onay Bekleyen</div><div className="stat-card-value" style={{ color: 'var(--warning)' }}>{loading ? '-' : pendingCount}</div></div>
        <div className="stat-card"><div className="stat-card-label">Gönderilen Bülten</div><div className="stat-card-value">{loading ? '-' : sentCount}</div></div>
        <div className="stat-card"><div className="stat-card-label">Ort. Açılma</div><div className="stat-card-value" style={{ color: 'var(--accent)' }}>{loading ? '-' : (avgOpen === null ? '—' : `%${avgOpen}`)}</div></div>
      </div>

      {!loading && confirmed.length === 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(253,203,110,0.12)', color: 'var(--warning)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          ⚠️ Henüz çift-onayını tamamlamış (confirmedAt) abone yok. Bülten yalnız onaylı abonelere gider — {unsubCount > 0 ? `${unsubCount} ayrılan, ` : ''}{pendingCount} onay bekliyor.
        </div>
      )}

      {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.startsWith('✅') ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📧</div>
          <div className="empty-state-title">Henüz bülten yok</div>
          <div className="empty-state-desc">İlk bülteninizi oluşturup onaylı abonelerinize gönderin.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Bülten</button>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead><tr><th>Konu</th><th>Durum</th><th>Alıcı</th><th>Açılma</th><th>Tık</th><th>Tarih</th><th>İşlemler</th></tr></thead>
            <tbody>
              {items.map(n => {
                const total = n.stats?.total ?? n.recipients;
                const opened = n.stats?.opened ?? 0;
                const clicked = n.stats?.clicked ?? 0;
                return (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.subject}</td>
                    <td><span className={`badge ${n.status === 'sent' ? 'badge-success' : 'badge-warning'}`}>{n.status === 'sent' ? 'Gönderildi' : 'Taslak'}</span></td>
                    <td>{n.status === 'sent' ? total.toLocaleString('tr-TR') : '-'}</td>
                    <td>{n.status === 'sent' ? <span>{opened} <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({rate(opened, total)})</span></span> : '-'}</td>
                    <td>{n.status === 'sent' ? <span>{clicked} <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({rate(clicked, total)})</span></span> : '-'}</td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{n.sentAt ? new Date(n.sentAt).toLocaleDateString('tr-TR') : new Date(n.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      {n.status !== 'sent' && <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(n)}>✏️</button>
                        <button className="btn btn-primary btn-sm" onClick={() => openSend(n)}>📤 Gönder</button>
                      </>}
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(n.id)}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Compose modal */}
      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Bülteni Düzenle' : 'Yeni Bülten'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Konu *</label>
                <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Bu Haftanın Çanakkale Gündemi" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Giriş Paragrafı</span>
                  <button type="button" className="btn btn-accent btn-sm" disabled={aiBusy} onClick={generateIntro}>🤖 {aiBusy ? 'Üretiliyor...' : 'AI ile Üret'}</button>
                </label>
                <textarea className="form-textarea" rows={3} value={form.intro} onChange={e => setForm({ ...form, intro: e.target.value })} placeholder="Son haberlerden AI ile otomatik üretebilir ya da elle yazabilirsiniz." />
              </div>
              <div className="form-group">
                <label className="form-label">İçerik *</label>
                <textarea className="form-textarea" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Bülten gövdesi. Paragrafları boş satırla ayırın. Site bağlantıları (https://canakkale.network/...) otomatik takip edilir." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* Send modal (segment + preview) */}
      {sendTarget && (
        <>
          <div className="modal-backdrop" onClick={() => !sending && setSendTarget(null)}></div>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">📤 Bülteni Gönder</h2>
              <button className="modal-close" onClick={() => !sending && setSendTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{sendTarget.subject}</strong>
              </p>

              {segmentOptions.length > 0 ? (
                <div className="form-group">
                  <label className="form-label">Segment (ilçe / kategori)</label>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                    Hiçbiri seçili değilse tüm onaylı abonelere gider. Seçilirse yalnız o etiketlerden en az birine sahip aboneler.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {segmentOptions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`badge ${selectedTags.includes(tag) ? 'badge-primary' : 'badge-info'}`}
                        style={{ cursor: 'pointer', border: 'none', padding: '6px 12px', fontSize: 'var(--text-sm)', opacity: selectedTags.includes(tag) ? 1 : 0.55 }}
                      >
                        {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  Abonelerde segment etiketi tanımlı değil — gönderim tüm onaylı abonelere yapılır.
                </p>
              )}

              <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'var(--surface-3, rgba(108,92,231,0.08))', fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>
                Bu gönderim <strong style={{ color: 'var(--accent)' }}>{audienceCount}</strong> onaylı aboneye ulaşacak.
                {audienceCount === 0 && <span style={{ color: 'var(--error)' }}> Hedef abone yok.</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" disabled={sending} onClick={() => setSendTarget(null)}>İptal</button>
              <button className="btn btn-primary" disabled={sending || audienceCount === 0} onClick={confirmSend}>
                {sending ? 'Gönderiliyor...' : `📤 Gönder (${audienceCount})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
