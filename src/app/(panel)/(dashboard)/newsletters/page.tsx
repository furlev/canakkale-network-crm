'use client';
import { useState, useEffect } from 'react';

type Newsletter = {
  id: string;
  subject: string;
  intro?: string | null;
  content: string;
  status: string;
  recipients: number;
  sentAt?: string | null;
  createdAt: string;
};

const emptyForm = { subject: '', intro: '', content: '' };

export default function NewslettersPage() {
  const [items, setItems] = useState<Newsletter[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [nRes, sRes] = await Promise.all([fetch('/api/newsletters'), fetch('/api/subscribers')]);
      setItems(await nRes.json());
      const subs = await sRes.json();
      if (Array.isArray(subs)) setSubscriberCount(subs.filter((s: { status: string }) => s.status === 'active').length);
    } catch (error) {
      console.error('Error fetching newsletters:', error);
    } finally {
      setLoading(false);
    }
  };

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
        setItems(editingId ? items.map(n => n.id === editingId ? saved : n) : [saved, ...items]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving newsletter:', error);
    }
  };

  const handleSend = async (n: Newsletter) => {
    if (!confirm(`"${n.subject}" bülteni ${subscriberCount ?? '?'} aktif aboneye gönderilsin mi?`)) return;
    setMsg('');
    try {
      const res = await fetch(`/api/newsletters/${n.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ ${data.sent} aboneye gönderildi`);
        setItems(items.map(x => x.id === n.id ? data.newsletter : x));
      } else {
        setMsg(`❌ ${data.error || 'Gönderilemedi'}`);
      }
    } catch {
      setMsg('❌ Sunucuya ulaşılamadı');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu bülteni silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/newsletters/${id}`, { method: 'DELETE' });
    if (res.ok) setItems(items.filter(n => n.id !== id));
  };

  const sentCount = items.filter(n => n.status === 'sent').length;
  const totalReached = items.reduce((s, n) => s + n.recipients, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📧 Bülten</h1>
          <p className="page-subtitle">Abonelere toplu e-posta gönderimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Bülten</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Aktif Abone</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{subscriberCount ?? '-'}</div></div>
        <div className="stat-card"><div className="stat-card-label">Gönderilen Bülten</div><div className="stat-card-value">{loading ? '-' : sentCount}</div></div>
        <div className="stat-card"><div className="stat-card-label">Toplam Ulaşılan</div><div className="stat-card-value" style={{ color: 'var(--accent)' }}>{loading ? '-' : totalReached.toLocaleString('tr-TR')}</div></div>
      </div>

      {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.startsWith('✅') ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📧</div>
          <div className="empty-state-title">Henüz bülten yok</div>
          <div className="empty-state-desc">İlk bülteninizi oluşturup abonelerinize gönderin.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Bülten</button>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead><tr><th>Konu</th><th>Durum</th><th>Alıcı</th><th>Tarih</th><th>İşlemler</th></tr></thead>
            <tbody>
              {items.map(n => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 500, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.subject}</td>
                  <td><span className={`badge ${n.status === 'sent' ? 'badge-success' : 'badge-warning'}`}>{n.status === 'sent' ? 'Gönderildi' : 'Taslak'}</span></td>
                  <td>{n.status === 'sent' ? n.recipients.toLocaleString('tr-TR') : '-'}</td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{n.sentAt ? new Date(n.sentAt).toLocaleDateString('tr-TR') : new Date(n.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {n.status !== 'sent' && <>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(n)}>✏️</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSend(n)}>📤 Gönder</button>
                    </>}
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(n.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                <textarea className="form-textarea" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Bülten gövdesi. Paragrafları boş satırla ayırın." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
