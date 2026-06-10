'use client';
import { useState, useEffect } from 'react';

type Client = { id: string; companyName: string };
type Proposal = {
  id: string;
  title: string;
  description?: string | null;
  value: number;
  status: string;
  clientId?: string | null;
  client?: Client | null;
  createdAt: string;
};

const statusMap: Record<string, { l: string; c: string }> = {
  sent: { l: 'Gönderildi', c: 'badge-info' },
  approved: { l: 'Onaylandı', c: 'badge-success' },
  rejected: { l: 'Reddedildi', c: 'badge-error' },
  draft: { l: 'Taslak', c: 'badge-warning' },
};

const emptyForm = { title: '', description: '', clientId: '', value: 0, status: 'draft' };

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [proposalsRes, clientsRes] = await Promise.all([fetch('/api/proposals'), fetch('/api/clients')]);
      setProposals(await proposalsRes.json());
      setClients(await clientsRes.json());
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Proposal) => {
    setEditingId(p.id);
    setForm({ title: p.title, description: p.description || '', clientId: p.clientId || '', value: p.value, status: p.status });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    const payload = { ...form, value: Number(form.value) || 0, clientId: form.clientId || null };
    try {
      const res = editingId
        ? await fetch(`/api/proposals/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setProposals(editingId ? proposals.map(p => (p.id === editingId ? saved : p)) : [saved, ...proposals]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving proposal:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setProposals(proposals.map(p => (p.id === id ? { ...p, status } : p)));
    } catch (error) {
      console.error('Error updating proposal:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu teklifnameyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
      if (res.ok) setProposals(proposals.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting proposal:', error);
    }
  };

  const convertToInvoice = async (p: Proposal) => {
    if (!confirm(`"${p.title}" teklifnamesi ₺${p.value.toLocaleString('tr-TR')} tutarında faturaya dönüştürülsün mü?`)) return;
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: p.value, clientId: p.clientId || null, status: 'unpaid' }),
      });
      if (res.ok) {
        const invoice = await res.json();
        alert(`Fatura oluşturuldu: ${invoice.invoiceNo}`);
      }
    } catch (error) {
      console.error('Error converting proposal:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📑 Teklifnameler</h1>
          <p className="page-subtitle">Profesyonel teklifnameler oluşturun</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Teklifname</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : proposals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <div className="empty-state-title">Henüz teklifname yok</div>
          <div className="empty-state-desc">İlk teklifnamenizi oluşturarak başlayın.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Teklifname</button>
        </div>
      ) : (
        <div className="grid-2">
          {proposals.map(p => (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{p.title}</h3>
                <span className={`badge ${(statusMap[p.status] || statusMap.draft).c}`}>{(statusMap[p.status] || statusMap.draft).l}</span>
              </div>
              {p.description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>{p.description}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Müşteri</span><div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{p.client?.companyName || '-'}</div></div>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Tutar</span><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-light)' }}>₺{p.value.toLocaleString('tr-TR')}</div></div>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Durum</span>
                  <select className="form-select" style={{ padding: '4px', fontSize: 'var(--text-xs)' }} value={p.status} onChange={e => updateStatus(p.id, e.target.value)}>
                    <option value="draft">Taslak</option>
                    <option value="sent">Gönderildi</option>
                    <option value="approved">Onaylandı</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p)}>✏️ Düzenle</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(p.id)}>🗑️ Sil</button>
                {p.status === 'approved' && (
                  <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={() => convertToInvoice(p)}>🔄 Faturaya Dönüştür</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Teklifnameyi Düzenle' : 'Yeni Teklifname'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Müşteri</label>
                  <select className="form-select" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">Seçiniz...</option>
                    {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.companyName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tutar (₺)</label>
                  <input className="form-input" type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Taslak</option>
                  <option value="sent">Gönderildi</option>
                  <option value="approved">Onaylandı</option>
                  <option value="rejected">Reddedildi</option>
                </select>
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
