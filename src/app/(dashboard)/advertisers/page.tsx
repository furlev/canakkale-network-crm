'use client';
import { useState, useEffect } from 'react';

type Advertiser = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  activeAds: number;
  totalSpent: number;
  status: string;
  createdAt: string;
};

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newAdvertiser, setNewAdvertiser] = useState({ company: '', contactName: '', email: '', phone: '', activeAds: 0, totalSpent: 0, status: 'active' });

  useEffect(() => {
    fetchAdvertisers();
  }, []);

  const fetchAdvertisers = async () => {
    try {
      const res = await fetch('/api/advertisers');
      const data = await res.json();
      setAdvertisers(data);
    } catch (error) {
      console.error('Error fetching advertisers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdvertiser = async () => {
    if (!newAdvertiser.company || !newAdvertiser.email) return;
    try {
      const res = await fetch('/api/advertisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdvertiser),
      });
      if (res.ok) {
        const created = await res.json();
        setAdvertisers([created, ...advertisers]);
        setIsAdding(false);
        setNewAdvertiser({ company: '', contactName: '', email: '', phone: '', activeAds: 0, totalSpent: 0, status: 'active' });
      }
    } catch (error) {
      console.error('Error creating advertiser:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/advertisers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAdvertisers(advertisers.map(a => a.id === id ? { ...a, status } : a));
      }
    } catch (error) {
      console.error('Error updating advertiser:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu reklamvereni silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/advertisers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAdvertisers(advertisers.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting advertiser:', error);
    }
  };

  const totalRevenue = advertisers.reduce((acc, curr) => acc + curr.totalSpent, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📢 Reklamverenler</h1>
          <p className="page-subtitle">Sitede reklam veren sponsor ve firmalar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Reklamveren</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Sponsor</div>
          <div className="stat-card-value">{loading ? '-' : advertisers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Aktif Reklamlar</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : advertisers.reduce((acc, curr) => acc + curr.activeAds, 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Reklam Geliri</div>
          <div className="stat-card-value" style={{color:'var(--accent)'}}>
            ₺{loading ? '-' : totalRevenue.toLocaleString('tr-TR')}
          </div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : advertisers.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Henüz reklamveren yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Yetkili</th>
                <th>İletişim</th>
                <th>Aktif Reklam</th>
                <th>Toplam Harcama</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {advertisers.map((adv) => (
                <tr key={adv.id}>
                  <td style={{fontWeight:500}}>{adv.company}</td>
                  <td>{adv.contactName}</td>
                  <td style={{fontSize:'var(--text-xs)'}}>
                    <div>{adv.email}</div>
                    <div style={{color:'var(--text-muted)'}}>{adv.phone}</div>
                  </td>
                  <td>
                    <span className="badge badge-info">{adv.activeAds} Kampanya</span>
                  </td>
                  <td style={{fontWeight:600, color:'var(--accent)'}}>₺{adv.totalSpent.toLocaleString('tr-TR')}</td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)'}} 
                      value={adv.status} 
                      onChange={(e) => updateStatus(adv.id, e.target.value)}
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Pasif</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(adv.id)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Reklamveren</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Firma / Marka Adı *</label>
                <input className="form-input" value={newAdvertiser.company} onChange={e=>setNewAdvertiser({...newAdvertiser, company: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Yetkili Kişi *</label>
                <input className="form-input" value={newAdvertiser.contactName} onChange={e=>setNewAdvertiser({...newAdvertiser, contactName: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">E-Posta *</label>
                  <input type="email" className="form-input" value={newAdvertiser.email} onChange={e=>setNewAdvertiser({...newAdvertiser, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={newAdvertiser.phone} onChange={e=>setNewAdvertiser({...newAdvertiser, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Başlangıç Aktif Reklam</label>
                  <input type="number" className="form-input" value={newAdvertiser.activeAds} onChange={e=>setNewAdvertiser({...newAdvertiser, activeAds: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Başlangıç Harcaması (₺)</label>
                  <input type="number" className="form-input" value={newAdvertiser.totalSpent} onChange={e=>setNewAdvertiser({...newAdvertiser, totalSpent: Number(e.target.value)})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateAdvertiser}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
