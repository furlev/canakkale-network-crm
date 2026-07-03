'use client';
import { useState, useEffect } from 'react';

type Estimate = {
  id: string;
  estimateNo: string;
  client?: { companyName: string };
  clientId: string | null;
  amount: number;
  status: string;
  validUntil?: string;
  createdAt: string;
};

type Client = {
  id: string;
  companyName: string;
};

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEstimate, setNewEstimate] = useState({ clientId: '', amount: 0, status: 'draft', validUntil: '' });
  const [editingEstimate, setEditingEstimate] = useState<{ id: string; clientId: string; amount: number; status: string; validUntil: string } | null>(null);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [estRes, cliRes] = await Promise.all([
        fetch('/api/estimates'),
        fetch('/api/clients')
      ]);
      setEstimates(await estRes.json());
      setClients(await cliRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEstimate = async () => {
    if (!newEstimate.amount) return;
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEstimate),
      });
      if (res.ok) {
        const created = await res.json();
        const client = clients.find(c => c.id === created.clientId);
        created.client = client;
        
        setEstimates([created, ...estimates]);
        setIsAdding(false);
        setNewEstimate({ clientId: '', amount: 0, status: 'draft', validUntil: '' });
      }
    } catch (error) {
      console.error('Error creating estimate:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/estimates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setEstimates(estimates.map(e => e.id === id ? { ...e, status } : e));
      }
    } catch (error) {
      console.error('Error updating estimate:', error);
    }
  };

  const openEdit = (est: Estimate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditError('');
    setEditingEstimate({
      id: est.id,
      clientId: est.clientId || '',
      amount: est.amount,
      status: est.status,
      validUntil: est.validUntil ? est.validUntil.slice(0, 10) : '',
    });
  };

  const handleUpdateEstimate = async () => {
    if (!editingEstimate) return;
    setEditError('');
    try {
      const res = await fetch(`/api/estimates/${editingEstimate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: editingEstimate.clientId || null,
          amount: editingEstimate.amount,
          status: editingEstimate.status,
          validUntil: editingEstimate.validUntil || null,
        }),
      });
      if (res.ok) {
        const client = clients.find(c => c.id === editingEstimate.clientId);
        setEstimates(estimates.map(est => est.id === editingEstimate.id ? {
          ...est,
          clientId: editingEstimate.clientId || null,
          amount: editingEstimate.amount,
          status: editingEstimate.status,
          validUntil: editingEstimate.validUntil || undefined,
          client,
        } : est));
        setEditingEstimate(null);
      } else {
        setEditError('Teklif güncellenemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error updating estimate:', error);
      setEditError('Teklif güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu teklifi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEstimates(estimates.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Error deleting estimate:', error);
    }
  };

  const totalAmount = estimates.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📄 Teklifler</h1>
          <p className="page-subtitle">Müşterilere sunulan fiyat teklifleri</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Teklif</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Toplam Teklif Sayısı</div>
          <div className="stat-card-value">{loading ? '-' : estimates.length}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--accent)'}}>
          <div className="stat-card-label">Toplam Hacim</div>
          <div className="stat-card-value" style={{color:'var(--accent)'}}>₺{loading ? '-' : totalAmount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--success)'}}>
          <div className="stat-card-label">Kabul Edilen</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : estimates.filter(e => e.status === 'accepted').length}
          </div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : estimates.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Kayıtlı teklif yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Teklif No</th>
                <th>Müşteri</th>
                <th>Tutar</th>
                <th>Geçerlilik</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est) => (
                <tr key={est.id}>
                  <td><span className="font-mono" style={{color:'var(--primary-light)'}}>{est.estimateNo}</span></td>
                  <td style={{fontWeight:500}}>{est.client?.companyName || 'Belirtilmemiş'}</td>
                  <td>₺{est.amount.toLocaleString('tr-TR')}</td>
                  <td style={{color:'var(--text-muted)'}}>{est.validUntil ? new Date(est.validUntil).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)', width:'110px'}} 
                      value={est.status} 
                      onChange={(e) => updateStatus(est.id, e.target.value)}
                    >
                      <option value="draft">Taslak</option>
                      <option value="sent">Gönderildi</option>
                      <option value="accepted">Kabul Edildi</option>
                      <option value="rejected">Reddedildi</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(est, e)}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(est.id, e)}>Sil</button>
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
              <h2 className="modal-title">Yeni Teklif Oluştur</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Müşteri Seçin</label>
                <select className="form-select" value={newEstimate.clientId} onChange={e=>setNewEstimate({...newEstimate, clientId: e.target.value})}>
                  <option value="">-- Müşteri Seçin --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tutar (₺) *</label>
                  <input type="number" className="form-input" value={newEstimate.amount} onChange={e=>setNewEstimate({...newEstimate, amount: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Geçerlilik Tarihi</label>
                  <input type="date" className="form-input" value={newEstimate.validUntil} onChange={e=>setNewEstimate({...newEstimate, validUntil: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={newEstimate.status} onChange={e=>setNewEstimate({...newEstimate, status: e.target.value})}>
                  <option value="draft">Taslak</option>
                  <option value="sent">Gönderildi</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateEstimate}>Teklif Oluştur</button>
            </div>
          </div>
        </>
      )}

      {editingEstimate && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingEstimate(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Teklifi Düzenle</h2>
              <button className="modal-close" onClick={() => setEditingEstimate(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editError && (
                <div className="form-group" style={{color:'var(--error)', fontSize:'var(--text-sm)'}}>{editError}</div>
              )}
              <div className="form-group">
                <label className="form-label">Müşteri Seçin</label>
                <select className="form-select" value={editingEstimate.clientId} onChange={e=>setEditingEstimate({...editingEstimate, clientId: e.target.value})}>
                  <option value="">-- Müşteri Seçin --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tutar (₺) *</label>
                  <input type="number" className="form-input" value={editingEstimate.amount} onChange={e=>setEditingEstimate({...editingEstimate, amount: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Geçerlilik Tarihi</label>
                  <input type="date" className="form-input" value={editingEstimate.validUntil} onChange={e=>setEditingEstimate({...editingEstimate, validUntil: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={editingEstimate.status} onChange={e=>setEditingEstimate({...editingEstimate, status: e.target.value})}>
                  <option value="draft">Taslak</option>
                  <option value="sent">Gönderildi</option>
                  <option value="accepted">Kabul Edildi</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingEstimate(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateEstimate}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
