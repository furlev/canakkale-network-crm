'use client';
import { useState, useEffect } from 'react';

type Client = { id: string; companyName: string };
type Contract = {
  id: string;
  title: string;
  value: number;
  status: string;
  progress: number;
  startDate?: string | null;
  endDate?: string | null;
  clientId?: string | null;
  client?: Client | null;
  publicToken?: string | null;
  convertedToId?: string | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'badge-success' },
  expired: { label: 'Süresi Dolmuş', cls: 'badge-error' },
  draft: { label: 'Taslak', cls: 'badge-warning' },
};

const emptyForm = { title: '', clientId: '', value: 0, status: 'draft', progress: 0, startDate: '', endDate: '' };

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerateInvoice = async (c: Contract) => {
    if (c.convertedToId) {
      showToast('Bu sözleşmeden zaten fatura üretilmiş.', 'error');
      return;
    }
    if (!confirm(`"${c.title}" sözleşmesinden fatura üretmek istiyor musunuz?`)) return;
    setInvoicingId(c.id);
    try {
      const res = await fetch(`/api/contracts/${c.id}/invoice`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setContracts((prev) => prev.map((x) => (x.id === c.id ? { ...x, convertedToId: data?.id || 'converted' } : x)));
        showToast(`Fatura üretildi${data?.invoiceNo ? ` (${data.invoiceNo})` : ''}. Faturalar sayfasından takip edebilirsiniz.`, 'success');
      } else if (res.status === 409) {
        setContracts((prev) => prev.map((x) => (x.id === c.id ? { ...x, convertedToId: 'converted' } : x)));
        showToast(data?.error || 'Bu sözleşmeden zaten fatura üretilmiş.', 'error');
      } else {
        showToast(data?.error || 'Fatura üretilemedi.', 'error');
      }
    } catch {
      showToast('Fatura üretilemedi. Lütfen tekrar deneyin.', 'error');
    } finally {
      setInvoicingId(null);
    }
  };

  const handleCopyLink = async (c: Contract) => {
    if (!c.publicToken) return;
    const url = `https://canakkale.network/site/teklif/${c.publicToken}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Onay/imza linki panoya kopyalandı.', 'success');
    } catch {
      showToast('Link kopyalanamadı. Manuel kopyalayın: ' + url, 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contractsRes, clientsRes] = await Promise.all([fetch('/api/contracts'), fetch('/api/clients')]);
      setContracts(await contractsRes.json());
      setClients(await clientsRes.json());
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      clientId: c.clientId || '',
      value: c.value,
      status: c.status,
      progress: c.progress,
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    const payload = {
      ...form,
      value: Number(form.value) || 0,
      progress: Number(form.progress) || 0,
      clientId: form.clientId || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    try {
      const res = editingId
        ? await fetch(`/api/contracts/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setContracts(editingId ? contracts.map(c => (c.id === editingId ? saved : c)) : [saved, ...contracts]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving contract:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu sözleşmeyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
      if (res.ok) setContracts(contracts.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  const activeCount = contracts.filter(c => c.status === 'active').length;
  const expiredCount = contracts.filter(c => c.status === 'expired').length;
  const totalValue = contracts.reduce((s, c) => s + c.value, 0);
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '-');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📝 Sözleşmeler</h1>
          <p className="page-subtitle">Sözleşme yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Sözleşme</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          { l: 'Aktif Sözleşme', v: loading ? '-' : String(activeCount), c: 'success', i: '📋' },
          { l: 'Toplam Değer', v: loading ? '-' : `₺${totalValue.toLocaleString('tr-TR')}`, c: 'primary', i: '💰' },
          { l: 'Süresi Dolan', v: loading ? '-' : String(expiredCount), c: 'error', i: '⚠️' },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
            <div className="stat-card-value" style={{ fontSize: 'var(--text-2xl)' }}>{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : contracts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">Henüz sözleşme yok</div>
          <div className="empty-state-desc">İlk sözleşmenizi ekleyerek başlayın.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Sözleşme</button>
        </div>
      ) : (
        <div className="grid-2">
          {contracts.map(c => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{c.title}</h3>
                <span className={`badge ${(statusMap[c.status] || statusMap.draft).cls}`}>{(statusMap[c.status] || statusMap.draft).label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Müşteri</span><div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{c.client?.companyName || '-'}</div></div>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Değer</span><div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary-light)' }}>₺{c.value.toLocaleString('tr-TR')}</div></div>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Başlangıç</span><div style={{ fontSize: 'var(--text-sm)' }}>{fmtDate(c.startDate)}</div></div>
                <div><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Bitiş</span><div style={{ fontSize: 'var(--text-sm)' }}>{fmtDate(c.endDate)}</div></div>
              </div>
              <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>İlerleme</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{c.progress}%</span>
              </div>
              <div className="progress-bar"><div className={`progress-bar-fill ${c.status === 'expired' ? 'warning' : 'primary'}`} style={{ width: `${c.progress}%` }} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                {c.convertedToId ? (
                  <span className="badge badge-success" style={{ flex: 1, textAlign: 'center', alignSelf: 'center' }} title="Bu sözleşmeden fatura üretildi">✓ Fatura üretildi</span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    disabled={invoicingId === c.id}
                    onClick={() => handleGenerateInvoice(c)}
                  >
                    {invoicingId === c.id ? '...' : '🧾 Fatura Üret'}
                  </button>
                )}
                {c.publicToken && (
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleCopyLink(c)} title="Halka açık onay/imza linkini kopyala">🔗 İmza linki</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(c)}>✏️ Düzenle</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(c.id)}>🗑️ Sil</button>
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
              <h2 className="modal-title">{editingId ? 'Sözleşmeyi Düzenle' : 'Yeni Sözleşme'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
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
                  <label className="form-label">Değer (₺)</label>
                  <input className="form-input" type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Başlangıç</label>
                  <input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bitiş</label>
                  <input className="form-input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="draft">Taslak</option>
                    <option value="active">Aktif</option>
                    <option value="expired">Süresi Dolmuş</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">İlerleme (%)</label>
                  <input className="form-input" type="number" min={0} max={100} value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`crm-toast crm-toast-${toast.type}`} role="status" aria-live="polite" onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
