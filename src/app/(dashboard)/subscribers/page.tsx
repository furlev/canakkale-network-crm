'use client';
import { useState, useEffect } from 'react';

type Subscriber = {
  id: string;
  email: string;
  source: string;
  status: string;
  createdAt: string;
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubscriber, setNewSubscriber] = useState({ email: '', source: 'website', status: 'active' });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const res = await fetch('/api/subscribers');
      const data = await res.json();
      setSubscribers(data);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscriber = async () => {
    if (!newSubscriber.email) return;
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscriber),
      });
      if (res.ok) {
        const created = await res.json();
        setSubscribers([created, ...subscribers]);
        setIsAdding(false);
        setNewSubscriber({ email: '', source: 'website', status: 'active' });
      }
    } catch (error) {
      console.error('Error creating subscriber:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/subscribers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSubscribers(subscribers.map(s => s.id === id ? { ...s, status } : s));
      }
    } catch (error) {
      console.error('Error updating subscriber:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu aboneyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubscribers(subscribers.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting subscriber:', error);
    }
  };

  const handleExportCsv = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ['email', 'source', 'status'];
    const rows = subscribers.map(s => [s.email, s.source, s.status].map(escapeCsv).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aboneler.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📩 Bülten Aboneleri</h1>
          <p className="page-subtitle">E-posta bültenine kayıtlı kullanıcılar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={handleExportCsv}>Dışa Aktar (CSV)</button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Abone Ekle</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Abone</div>
          <div className="stat-card-value">{loading ? '-' : subscribers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Aktif Aboneler</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : subscribers.filter(s => s.status === 'active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Ayrılanlar</div>
          <div className="stat-card-value" style={{color:'var(--error)'}}>
            {loading ? '-' : subscribers.filter(s => s.status === 'unsubscribed').length}
          </div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : subscribers.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Henüz abone yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>E-Posta Adresi</th>
                <th>Kayıt Kaynağı</th>
                <th>Kayıt Tarihi</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.id}>
                  <td style={{fontWeight:500}}>{sub.email}</td>
                  <td>
                    <span className="badge badge-info">{sub.source === 'website' ? 'Web Sitesi' : sub.source}</span>
                  </td>
                  <td style={{color:'var(--text-muted)'}}>{new Date(sub.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)'}} 
                      value={sub.status} 
                      onChange={(e) => updateStatus(sub.id, e.target.value)}
                    >
                      <option value="active">Aktif</option>
                      <option value="unsubscribed">Ayrıldı</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(sub.id)}>Sil</button>
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
              <h2 className="modal-title">Yeni Abone Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">E-Posta Adresi *</label>
                <input type="email" className="form-input" value={newSubscriber.email} onChange={e=>setNewSubscriber({...newSubscriber, email: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kaynak</label>
                  <select className="form-select" value={newSubscriber.source} onChange={e=>setNewSubscriber({...newSubscriber, source: e.target.value})}>
                    <option value="website">Web Sitesi</option>
                    <option value="manual">Manuel Ekleme</option>
                    <option value="campaign">Kampanya</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={newSubscriber.status} onChange={e=>setNewSubscriber({...newSubscriber, status: e.target.value})}>
                    <option value="active">Aktif</option>
                    <option value="unsubscribed">Ayrıldı</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateSubscriber}>Abone Ekle</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
