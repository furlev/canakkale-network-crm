'use client';
import { useState, useEffect } from 'react';

type Client = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  satisfaction: number;
  createdAt: string;
};

export default function ClientsPage() {
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newClient, setNewClient] = useState({ companyName: '', contactName: '', email: '', phone: '', status: 'active', satisfaction: 100 });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.companyName || !newClient.email) return;
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        const created = await res.json();
        setClients([created, ...clients]);
        setIsAdding(false);
        setNewClient({ companyName: '', contactName: '', email: '', phone: '', status: 'active', satisfaction: 100 });
      }
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClients(clients.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🏢 Müşteriler</h1>
          <p className="page-subtitle">Toplam {clients.length} aktif kurumsal müşteri</p>
        </div>
        <div className="page-header-actions">
          <div className="tabs" style={{marginBottom: 0}}>
            <button className={`tab ${view==='grid'?'active':''}`} onClick={()=>setView('grid')}>Grid</button>
            <button className={`tab ${view==='list'?'active':''}`} onClick={()=>setView('list')}>Liste</button>
          </div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Müşteri</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Müşteri</div>
          <div className="stat-card-value">{loading ? '-' : clients.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Aktif Müşteri</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : clients.filter(c => c.status === 'active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Ort. Memnuniyet</div>
          <div className="stat-card-value" style={{color:'var(--accent)'}}>
            {loading || clients.length === 0 ? '-' : Math.round(clients.reduce((acc, c) => acc + c.satisfaction, 0) / clients.length)}%
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : clients.length === 0 ? (
        <div style={{textAlign:'center', padding:'var(--space-8)', color:'var(--text-muted)'}}>Henüz hiç müşteri eklenmemiş.</div>
      ) : view === 'grid' ? (
        <div className="grid-3">
          {clients.map(client => (
            <div key={client.id} className="card" style={{position:'relative'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-4)'}}>
                <div className="avatar" style={{background:'var(--surface-2)'}}>
                  {client.companyName.substring(0,2).toUpperCase()}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(client.id, e)}>Sil</button>
              </div>
              <h3 style={{fontSize:'var(--text-lg)', marginBottom:'var(--space-2)'}}>{client.companyName}</h3>
              <p style={{color:'var(--text-muted)', fontSize:'var(--text-sm)', marginBottom:'var(--space-4)'}}>
                Yetkili: {client.contactName}
              </p>
              
              <div style={{display:'flex', flexDirection:'column', gap:'var(--space-2)', fontSize:'var(--text-sm)', marginBottom:'var(--space-4)'}}>
                <div style={{display:'flex', alignItems:'center', gap:'var(--space-2)'}}>
                  <span>📧</span> {client.email}
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'var(--space-2)'}}>
                  <span>📞</span> {client.phone || '-'}
                </div>
              </div>

              <div style={{borderTop:'1px solid var(--border)', paddingTop:'var(--space-4)'}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)', marginBottom:'var(--space-2)'}}>
                  <span>Memnuniyet</span>
                  <span style={{color:'var(--accent)'}}>{client.satisfaction}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${client.satisfaction}%`, background:'var(--primary-gradient)'}}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Firma Adı</th>
                <th>Yetkili</th>
                <th>İletişim</th>
                <th>Durum</th>
                <th>Memnuniyet</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id}>
                  <td style={{fontWeight:500}}>{client.companyName}</td>
                  <td>{client.contactName}</td>
                  <td style={{fontSize:'var(--text-xs)'}}>
                    <div>{client.email}</div>
                    <div style={{color:'var(--text-muted)'}}>{client.phone}</div>
                  </td>
                  <td>
                    <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                      {client.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'var(--space-2)'}}>
                      <div className="progress-bar" style={{width: 60}}>
                        <div className="progress-fill" style={{width: `${client.satisfaction}%`, background:'var(--accent)'}}></div>
                      </div>
                      <span style={{fontSize:'var(--text-xs)'}}>{client.satisfaction}%</span>
                    </div>
                  </td>
                  <td><button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(client.id, e)}>Sil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* YENİ MÜŞTERİ MODALI */}
      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Kurumsal Müşteri</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Firma Adı *</label>
                <input className="form-input" value={newClient.companyName} onChange={e=>setNewClient({...newClient, companyName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Yetkili Kişi *</label>
                <input className="form-input" value={newClient.contactName} onChange={e=>setNewClient({...newClient, contactName: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">E-Posta *</label>
                  <input type="email" className="form-input" value={newClient.email} onChange={e=>setNewClient({...newClient, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={newClient.phone} onChange={e=>setNewClient({...newClient, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Memnuniyet Skoru (0-100)</label>
                <input type="number" min="0" max="100" className="form-input" value={newClient.satisfaction} onChange={e=>setNewClient({...newClient, satisfaction: parseInt(e.target.value)})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateClient}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
