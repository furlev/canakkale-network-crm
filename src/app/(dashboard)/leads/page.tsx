'use client';
import { useState, useEffect } from 'react';

type Lead = {
  id: string;
  name: string;
  company?: string;
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

const priorityMap: Record<string,{label:string;cls:string}> = {
  urgent:{label:'Acil',cls:'badge-error'},
  high:{label:'Yüksek',cls:'badge-warning'},
  normal:{label:'Normal',cls:'badge-primary'},
  low:{label:'Düşük',cls:'badge-info'},
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
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

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🎯 Müşteri Adayları (Leads)</h1>
          <p className="page-subtitle">Satış fırsatları ve potansiyel müşteriler</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Aday</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
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
                        <button className="btn btn-ghost btn-sm" style={{padding:0,color:'var(--text-muted)'}} onClick={() => handleDelete(lead.id)}>🗑️</button>
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
    </div>
  );
}
