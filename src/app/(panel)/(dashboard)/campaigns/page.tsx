'use client';
import { useState, useEffect } from 'react';

type Advertiser = { id: string; company: string };
type Campaign = {
  id: string;
  name: string;
  placement: string;
  status: string;
  budget: number;
  startDate?: string | null;
  endDate?: string | null;
  impressions: number;
  clicks: number;
  advertiserId?: string | null;
  advertiser?: Advertiser | null;
};

const placementMap: Record<string, string> = { banner: 'Banner', native: 'Native', video: 'Video', sidebar: 'Kenar' };
const statusMap: Record<string, { l: string; c: string }> = {
  active: { l: 'Aktif', c: 'badge-success' },
  paused: { l: 'Duraklatıldı', c: 'badge-warning' },
  ended: { l: 'Bitti', c: 'badge-error' },
};

const emptyForm = { name: '', placement: 'banner', status: 'active', budget: 0, startDate: '', endDate: '', advertiserId: '' };

function daysLeft(endDate?: string | null): number | null {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [cRes, aRes] = await Promise.all([fetch('/api/campaigns'), fetch('/api/advertisers')]);
      setItems(await cRes.json());
      setAdvertisers(await aRes.json());
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      name: c.name, placement: c.placement, status: c.status, budget: c.budget,
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
      advertiserId: c.advertiserId || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const payload = { ...form, budget: Number(form.budget) || 0, advertiserId: form.advertiserId || null, startDate: form.startDate || null, endDate: form.endDate || null };
    try {
      const res = editingId
        ? await fetch(`/api/campaigns/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setItems(editingId ? items.map(c => c.id === editingId ? saved : c) : [saved, ...items]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kampanyayı silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    if (res.ok) setItems(items.filter(c => c.id !== id));
  };

  const activeCount = items.filter(c => c.status === 'active').length;
  const totalBudget = items.reduce((s, c) => s + c.budget, 0);
  const expiringSoon = items.filter(c => c.status === 'active' && (daysLeft(c.endDate) ?? 99) <= 7).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🎬 Reklam Kampanyaları</h1>
          <p className="page-subtitle">Banner ve reklam alanı yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Kampanya</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Aktif Kampanya</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : activeCount}</div></div>
        <div className="stat-card"><div className="stat-card-label">Toplam Bütçe</div><div className="stat-card-value" style={{ color: 'var(--primary-light)' }}>{loading ? '-' : `₺${totalBudget.toLocaleString('tr-TR')}`}</div></div>
        <div className="stat-card"><div className="stat-card-label">Süresi Yaklaşan</div><div className="stat-card-value" style={{ color: expiringSoon ? 'var(--warning)' : 'var(--text-primary)' }}>{loading ? '-' : expiringSoon}</div></div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎬</div>
          <div className="empty-state-title">Henüz kampanya yok</div>
          <div className="empty-state-desc">İlk reklam kampanyanızı oluşturun.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Kampanya</button>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead><tr><th>Kampanya</th><th>Reklam Veren</th><th>Tür</th><th>Bütçe</th><th>Bitiş</th><th>Durum</th><th>İşlemler</th></tr></thead>
            <tbody>
              {items.map(c => {
                const dl = daysLeft(c.endDate);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.advertiser?.company || '-'}</td>
                    <td><span className="badge badge-info">{placementMap[c.placement] || c.placement}</span></td>
                    <td className="font-mono" style={{ color: 'var(--primary-light)' }}>₺{c.budget.toLocaleString('tr-TR')}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {c.endDate ? new Date(c.endDate).toLocaleDateString('tr-TR') : '-'}
                      {c.status === 'active' && dl !== null && dl <= 7 && dl >= 0 && <span className="badge badge-warning" style={{ marginLeft: 6 }}>{dl} gün</span>}
                      {c.status === 'active' && dl !== null && dl < 0 && <span className="badge badge-error" style={{ marginLeft: 6 }}>Doldu</span>}
                    </td>
                    <td><span className={`badge ${statusMap[c.status]?.c}`}>{statusMap[c.status]?.l}</span></td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Kampanya Adı *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Reklam Veren</label>
                  <select className="form-select" value={form.advertiserId} onChange={e => setForm({ ...form, advertiserId: e.target.value })}>
                    <option value="">Seçiniz...</option>
                    {advertisers.map(a => <option key={a.id} value={a.id}>{a.company}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reklam Türü</label>
                  <select className="form-select" value={form.placement} onChange={e => setForm({ ...form, placement: e.target.value })}>
                    <option value="banner">Banner</option><option value="native">Native</option><option value="video">Video</option><option value="sidebar">Kenar Çubuğu</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bütçe (₺)</label>
                  <input className="form-input" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Aktif</option><option value="paused">Duraklatıldı</option><option value="ended">Bitti</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Başlangıç</label>
                  <input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bitiş</label>
                  <input className="form-input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
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
    </div>
  );
}
