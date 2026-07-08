'use client';
import { useState, useEffect } from 'react';
import DataTable, { type Column } from '@/components/DataTable';
import { SkeletonStats } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

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
  const [view, setView] = useState<'grid'|'list'>('list');
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

  const handleDelete = async (id: string) => {
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

  const handleBulkDelete = async (rows: Client[]) => {
    if (!confirm(`${rows.length} müşteriyi silmek istediğinize emin misiniz?`)) return;
    const ids = new Set(rows.map(r => r.id));
    try {
      await Promise.all(rows.map(r => fetch(`/api/clients/${r.id}`, { method: 'DELETE' })));
      setClients(prev => prev.filter(c => !ids.has(c.id)));
    } catch (error) {
      console.error('Error bulk deleting clients:', error);
    }
  };

  const avgSatisfaction = clients.length === 0 ? 0 : Math.round(clients.reduce((acc, c) => acc + c.satisfaction, 0) / clients.length);

  const columns: Column<Client>[] = [
    {
      key: 'companyName',
      header: 'Firma Adı',
      filterable: true,
      render: (c) => <span style={{ fontWeight: 500 }}>{c.companyName}</span>,
    },
    { key: 'contactName', header: 'Yetkili', filterable: true },
    { key: 'email', header: 'E-Posta', render: (c) => <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>{c.email}</span> },
    { key: 'phone', header: 'Telefon', render: (c) => c.phone || '-', defaultHidden: true },
    {
      key: 'status',
      header: 'Durum',
      accessor: (c) => (c.status === 'active' ? 'Aktif' : 'Pasif'),
      filterable: true,
      render: (c) => (
        <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-error'}`}>
          {c.status === 'active' ? 'Aktif' : 'Pasif'}
        </span>
      ),
    },
    {
      key: 'satisfaction',
      header: 'Memnuniyet',
      accessor: (c) => c.satisfaction,
      numeric: true,
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <div className="progress-bar" style={{ width: 60 }}>
            <div className="progress-bar-fill accent" style={{ width: `${c.satisfaction}%` }} />
          </div>
          <span className="dt-num" style={{ fontSize: 'var(--text-xs)' }}>{c.satisfaction}%</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      sortable: false,
      hideable: false,
      csv: false,
      align: 'right',
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>Sil</button>
        </div>
      ),
    },
  ];

  const viewToggle = (
    <div className="tabs" style={{ marginBottom: 0 }}>
      <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>Tablo</button>
      <button className={`tab ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>Grid</button>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🏢 Müşteriler</h1>
          <p className="page-subtitle">Toplam {clients.length} kurumsal müşteri</p>
        </div>
        <div className="page-header-actions">
          {view === 'grid' && viewToggle}
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Müşteri</button>
        </div>
      </div>

      {loading ? (
        <SkeletonStats count={3} />
      ) : (
        <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
          <div className="stat-card">
            <div className="stat-card-label">Toplam Müşteri</div>
            <div className="stat-card-value">{clients.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Aktif Müşteri</div>
            <div className="stat-card-value" style={{color:'var(--success)'}}>
              {clients.filter(c => c.status === 'active').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Ort. Memnuniyet</div>
            <div className="stat-card-value" style={{color:'var(--accent)'}}>{avgSatisfaction}%</div>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <DataTable<Client>
          columns={columns}
          rows={clients}
          rowKey={(c) => c.id}
          loading={loading}
          searchPlaceholder="Firma, yetkili veya e-posta ara..."
          csvFileName="musteriler"
          selectable
          initialSort={{ key: 'companyName', dir: 'asc' }}
          toolbarExtra={viewToggle}
          bulkActions={[{ label: 'Sil', icon: '🗑️', variant: 'danger', onClick: handleBulkDelete }]}
          emptyState={<EmptyState icon="🏢" title="Henüz müşteri yok" description="İlk kurumsal müşterinizi ekleyerek başlayın." actionLabel="+ Yeni Müşteri" onAction={() => setIsAdding(true)} />}
        />
      ) : loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)', color:'var(--text-muted)'}}>Yükleniyor...</div>
      ) : clients.length === 0 ? (
        <EmptyState icon="🏢" title="Henüz müşteri yok" description="İlk kurumsal müşterinizi ekleyerek başlayın." actionLabel="+ Yeni Müşteri" onAction={() => setIsAdding(true)} />
      ) : (
        <div className="grid-3">
          {clients.map(client => (
            <div key={client.id} className="card" style={{position:'relative'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-4)'}}>
                <div className="avatar" style={{background:'var(--surface-2)'}}>
                  {client.companyName.substring(0,2).toUpperCase()}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(client.id)}>Sil</button>
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

              <div style={{borderTop:'1px solid var(--border-subtle)', paddingTop:'var(--space-4)'}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)', marginBottom:'var(--space-2)'}}>
                  <span>Memnuniyet</span>
                  <span style={{color:'var(--accent)'}}>{client.satisfaction}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill primary" style={{width: `${client.satisfaction}%`}}></div>
                </div>
              </div>
            </div>
          ))}
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
