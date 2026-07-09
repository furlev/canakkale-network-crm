'use client';
import { useState, useEffect } from 'react';
import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';

type Lead = {
  id: string;
  name: string;
  company?: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  value: number;
  status: string;
  priority: string;
  createdAt: string;
};

const columns = [
  {key:'new',title:'Yeni Aday',color:'var(--primary)'},
  {key:'contacted',title:'İletişim Kuruldu',color:'var(--info)'},
  {key:'proposal',title:'Teklif Verildi',color:'var(--warning)'},
  {key:'won',title:'Kazanıldı',color:'var(--success)'},
  {key:'lost',title:'Kaybedildi',color:'var(--error)'},
];

const statusLabel: Record<string, string> = {
  new: 'Yeni Aday', contacted: 'İletişim Kuruldu', proposal: 'Teklif Verildi', won: 'Kazanıldı', lost: 'Kaybedildi',
};

const priorityMap: Record<string,{label:string;cls:string}> = {
  urgent:{label:'Acil',cls:'badge-error'},
  high:{label:'Yüksek',cls:'badge-warning'},
  normal:{label:'Normal',cls:'badge-primary'},
  low:{label:'Düşük',cls:'badge-info'},
};

export default function LeadsPage() {
  const [view, setView] = useState<'board'|'table'>('board');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editErr, setEditErr] = useState('');
  const [newLead, setNewLead] = useState({ name: '', company: '', value: 0, status: 'new', priority: 'normal' });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLead.name) return;
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });
      if (res.ok) {
        const created = await res.json();
        setLeads([created, ...leads]);
        setIsAdding(false);
        setNewLead({ name: '', company: '', value: 0, status: 'new', priority: 'normal' });
      }
    } catch (error) {
      console.error('Error creating lead:', error);
    }
  };

  const updateLeadStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
      }
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  const bulkUpdateStatus = async (rows: Lead[], newStatus: string) => {
    const ids = new Set(rows.map(r => r.id));
    try {
      await Promise.all(rows.map(r => fetch(`/api/leads/${r.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
      })));
      setLeads(prev => prev.map(l => ids.has(l.id) ? { ...l, status: newStatus } : l));
    } catch (error) {
      console.error('Error bulk updating leads:', error);
    }
  };

  const handleUpdateLead = async () => {
    if (!editing || !editing.name) return;
    setEditErr('');
    try {
      const res = await fetch(`/api/leads/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, company: editing.company, value: editing.value, status: editing.status, priority: editing.priority }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads(leads.map(l => l.id === editing.id ? { ...l, ...updated } : l));
        setEditing(null);
      } else {
        setEditErr('Güncelleme başarısız oldu.');
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      setEditErr('Sunucuya ulaşılamadı.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Adayı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(leads.filter(l => l.id !== id));
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const handleBulkDelete = async (rows: Lead[]) => {
    if (!confirm(`${rows.length} adayı silmek istediğinize emin misiniz?`)) return;
    const ids = new Set(rows.map(r => r.id));
    try {
      await Promise.all(rows.map(r => fetch(`/api/leads/${r.id}`, { method: 'DELETE' })));
      setLeads(prev => prev.filter(l => !ids.has(l.id)));
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
    }
  };

  const tableColumns: Column<Lead>[] = [
    { key: 'name', header: 'Aday', filterable: true, render: (l) => <span style={{ fontWeight: 500 }}>{l.name}</span> },
    { key: 'company', header: 'Şirket', accessor: (l) => l.company || '', filterable: true, render: (l) => l.company || '-' },
    { key: 'email', header: 'E-posta / Kaynak', accessor: (l) => l.email || '', filterable: true, render: (l) => (
      l.email || l.source
        ? <span style={{ fontSize: 13 }}>{l.email || '-'}{l.source ? <em style={{ color: 'var(--muted)' }}> · {l.source}</em> : null}</span>
        : '-'
    ) },
    { key: 'value', header: 'Değer', accessor: (l) => l.value, numeric: true, render: (l) => <span className="dt-num" style={{ color: 'var(--accent)', fontWeight: 600 }}>₺{l.value.toLocaleString('tr-TR')}</span> },
    {
      key: 'priority', header: 'Öncelik', accessor: (l) => priorityMap[l.priority]?.label || l.priority, filterable: true,
      render: (l) => <span className={`badge ${priorityMap[l.priority]?.cls || 'badge-primary'}`}>{priorityMap[l.priority]?.label || l.priority}</span>,
    },
    {
      key: 'status', header: 'Durum', accessor: (l) => statusLabel[l.status] || l.status, filterable: true,
      render: (l) => (
        <select className="form-select" style={{ padding: '4px 24px 4px 8px', fontSize: 'var(--text-xs)' }} value={l.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLeadStatus(l.id, e.target.value)}>
          {columns.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
        </select>
      ),
    },
    {
      key: 'actions', header: 'İşlemler', sortable: false, hideable: false, csv: false, align: 'right',
      render: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditErr(''); setEditing(l); }}>✏️</button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l.id)}>🗑️</button>
        </div>
      ),
    },
  ];

  const viewToggle = (
    <div className="tabs" style={{ marginBottom: 0 }}>
      <button className={`tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>Kanban</button>
      <button className={`tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Tablo</button>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🎯 Müşteri Adayları (Leads)</h1>
          <p className="page-subtitle">Satış fırsatları ve potansiyel müşteriler</p>
        </div>
        <div className="page-header-actions">
          {view === 'board' && viewToggle}
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Aday</button>
        </div>
      </div>

      {view === 'table' ? (
        <DataTable<Lead>
          columns={tableColumns}
          rows={leads}
          rowKey={(l) => l.id}
          loading={loading}
          searchPlaceholder="Aday veya şirket ara..."
          csvFileName="adaylar"
          selectable
          initialSort={{ key: 'value', dir: 'desc' }}
          toolbarExtra={viewToggle}
          bulkActions={[
            { label: 'Kazanıldı', icon: '🏆', variant: 'primary', onClick: (r) => bulkUpdateStatus(r, 'won') },
            { label: 'Kaybedildi', icon: '✖', onClick: (r) => bulkUpdateStatus(r, 'lost') },
            { label: 'Sil', icon: '🗑️', variant: 'danger', onClick: handleBulkDelete },
          ]}
          emptyState={<EmptyState icon="🎯" title="Henüz aday yok" description="İlk müşteri adayınızı ekleyin." actionLabel="+ Yeni Aday" onAction={() => setIsAdding(true)} />}
        />
      ) : loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)', color:'var(--text-muted)'}}>Yükleniyor...</div>
      ) : (
        <div className="kanban-board">
          {columns.map(col => {
            const items = leads.filter(l => l.status === col.key);
            const totalValue = items.reduce((acc, curr) => acc + curr.value, 0);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{width:8,height:8,borderRadius:'50%',background:col.color,display:'inline-block'}} />
                    {col.title}
                    <span className="kanban-column-count">{items.length}</span>
                  </div>
                  <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'4px'}}>
                    ₺{totalValue.toLocaleString('tr-TR')}
                  </div>
                </div>
                <div className="kanban-column-body">
                  {items.map(lead => (
                    <div key={lead.id} className="kanban-card">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'var(--space-2)'}}>
                        <span className={`badge ${priorityMap[lead.priority]?.cls || 'badge-primary'}`}>{priorityMap[lead.priority]?.label || lead.priority}</span>
                        <div style={{display:'flex',gap:'var(--space-1)'}}>
                          <button className="btn btn-ghost btn-sm" style={{padding:0,color:'var(--text-muted)'}} onClick={() => { setEditErr(''); setEditing(lead); }}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{padding:0,color:'var(--text-muted)'}} onClick={() => handleDelete(lead.id)}>🗑️</button>
                        </div>
                      </div>
                      <div className="kanban-card-title">{lead.name}</div>
                      <div className="kanban-card-desc">{lead.company}</div>

                      <div style={{fontSize:'var(--text-sm)', fontWeight:600, color:'var(--accent)', marginTop:'var(--space-3)'}}>
                        ₺{lead.value.toLocaleString('tr-TR')}
                      </div>

                      <div style={{marginTop:'var(--space-3)'}}>
                        <select
                          className="form-select"
                          style={{padding:'4px 8px', fontSize:'var(--text-xs)'}}
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        >
                          <option value="new">Yeni Aday</option>
                          <option value="contacted">İletişim Kuruldu</option>
                          <option value="proposal">Teklif Verildi</option>
                          <option value="won">Kazanıldı</option>
                          <option value="lost">Kaybedildi</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Müşteri Adayı</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Aday Adı Soyadı *</label>
                <input className="form-input" value={newLead.name} onChange={e=>setNewLead({...newLead, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Şirket</label>
                <input className="form-input" value={newLead.company} onChange={e=>setNewLead({...newLead, company: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tahmini Değer (₺)</label>
                  <input type="number" className="form-input" value={newLead.value} onChange={e=>setNewLead({...newLead, value: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={newLead.priority} onChange={e=>setNewLead({...newLead, priority: e.target.value})}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateLead}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Müşteri Adayını Düzenle</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editErr && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(255,118,117,0.12)', color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                  {editErr}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Aday Adı Soyadı *</label>
                <input className="form-input" value={editing.name} onChange={e=>setEditing({...editing, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Şirket</label>
                <input className="form-input" value={editing.company ?? ''} onChange={e=>setEditing({...editing, company: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tahmini Değer (₺)</label>
                  <input type="number" className="form-input" value={editing.value} onChange={e=>setEditing({...editing, value: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={editing.priority} onChange={e=>setEditing({...editing, priority: e.target.value})}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={editing.status} onChange={e=>setEditing({...editing, status: e.target.value})}>
                  <option value="new">Yeni Aday</option>
                  <option value="contacted">İletişim Kuruldu</option>
                  <option value="proposal">Teklif Verildi</option>
                  <option value="won">Kazanıldı</option>
                  <option value="lost">Kaybedildi</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateLead}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
