'use client';
import { useState, useEffect } from 'react';

type Ticket = {
  id: string;
  ticketNo: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  client?: { companyName: string };
  clientId: string | null;
  assignee?: { name: string };
  assigneeId: string | null;
  createdAt: string;
};

type Client = { id: string; companyName: string; };

type TeamMember = { id: string; name: string; };

const priorityMap: Record<string,{label:string;cls:string}> = {
  urgent:{label:'Acil',cls:'badge-error'},
  high:{label:'Yüksek',cls:'badge-warning'},
  normal:{label:'Normal',cls:'badge-primary'},
  low:{label:'Düşük',cls:'badge-info'},
};

const statusLabels: Record<string,{label:string;cls:string}> = {
  open:{label:'Açık',cls:'badge-error'},
  in_progress:{label:'İşlemde',cls:'badge-warning'},
  resolved:{label:'Çözüldü',cls:'badge-success'},
  closed:{label:'Kapalı',cls:'badge-info'},
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'normal', clientId: '', assigneeId: '', status: 'open' });
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', description: '', priority: 'normal', clientId: '', assigneeId: '' });
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tktRes, cliRes, teamRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/clients'),
        fetch('/api/team')
      ]);
      setTickets(await tktRes.json());
      setClients(await cliRes.json());
      setTeam(await teamRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject) return;
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      if (res.ok) {
        const created = await res.json();
        created.client = clients.find(c => c.id === created.clientId);
        setTickets([created, ...tickets]);
        setIsAdding(false);
        setNewTicket({ subject: '', description: '', priority: 'normal', clientId: '', assigneeId: '', status: 'open' });
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const openEdit = (tkt: Ticket) => {
    setEditingTicket(tkt);
    setEditForm({
      subject: tkt.subject,
      description: tkt.description || '',
      priority: tkt.priority,
      clientId: tkt.clientId || '',
      assigneeId: tkt.assigneeId || '',
    });
    setEditError('');
  };

  const handleUpdateTicket = async () => {
    if (!editingTicket) return;
    if (!editForm.subject) return;
    setEditError('');
    try {
      const res = await fetch(`/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        updated.client = clients.find(c => c.id === updated.clientId);
        setTickets(tickets.map(t => t.id === editingTicket.id ? { ...t, ...updated } : t));
        setEditingTicket(null);
      } else {
        setEditError('Talep güncellenemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      setEditError('Talep güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Talebi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTickets(tickets.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🎧 Destek Talepleri</h1>
          <p className="page-subtitle">Müşteri şikayet, istek ve yardım talepleri</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Talep</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card" style={{borderTop:'2px solid var(--error)'}}>
          <div className="stat-card-label">Açık Talepler</div>
          <div className="stat-card-value" style={{color:'var(--error)'}}>{loading ? '-' : tickets.filter(t => t.status === 'open').length}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--warning)'}}>
          <div className="stat-card-label">İşlemde</div>
          <div className="stat-card-value" style={{color:'var(--warning)'}}>{loading ? '-' : tickets.filter(t => t.status === 'in_progress').length}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--success)'}}>
          <div className="stat-card-label">Çözülen (Bu Ay)</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
          </div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : tickets.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Kayıtlı destek talebi yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Talep No</th>
                <th>Müşteri</th>
                <th>Konu</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((tkt) => (
                <tr key={tkt.id}>
                  <td><span className="font-mono" style={{color:'var(--primary-light)'}}>{tkt.ticketNo}</span></td>
                  <td>{tkt.client?.companyName || 'Bilinmiyor'}</td>
                  <td style={{fontWeight:500}}>{tkt.subject}</td>
                  <td><span className={`badge ${priorityMap[tkt.priority]?.cls}`}>{priorityMap[tkt.priority]?.label}</span></td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)', width:'100px'}} 
                      value={tkt.status} 
                      onChange={(e) => updateStatus(tkt.id, e.target.value)}
                    >
                      <option value="open">Açık</option>
                      <option value="in_progress">İşlemde</option>
                      <option value="resolved">Çözüldü</option>
                      <option value="closed">Kapalı</option>
                    </select>
                  </td>
                  <td style={{color:'var(--text-muted)', fontSize:'var(--text-xs)'}}>{new Date(tkt.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tkt)}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(tkt.id)}>Sil</button>
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
              <h2 className="modal-title">Yeni Destek Talebi</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Konu / Başlık *</label>
                <input className="form-input" value={newTicket.subject} onChange={e=>setNewTicket({...newTicket, subject: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={newTicket.description} onChange={e=>setNewTicket({...newTicket, description: e.target.value})}></textarea>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Müşteri</label>
                  <select className="form-select" value={newTicket.clientId} onChange={e=>setNewTicket({...newTicket, clientId: e.target.value})}>
                    <option value="">-- Seçin --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={newTicket.priority} onChange={e=>setNewTicket({...newTicket, priority: e.target.value})}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Atanan Kişi</label>
                <select className="form-select" value={newTicket.assigneeId} onChange={e=>setNewTicket({...newTicket, assigneeId: e.target.value})}>
                  <option value="">-- Seçin --</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateTicket}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {editingTicket && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingTicket(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Destek Talebini Düzenle</h2>
              <button className="modal-close" onClick={() => setEditingTicket(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editError && <div className="badge badge-error" style={{marginBottom:'var(--space-4)'}}>{editError}</div>}
              <div className="form-group">
                <label className="form-label">Konu / Başlık *</label>
                <input className="form-input" value={editForm.subject} onChange={e=>setEditForm({...editForm, subject: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={editForm.description} onChange={e=>setEditForm({...editForm, description: e.target.value})}></textarea>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Müşteri</label>
                  <select className="form-select" value={editForm.clientId} onChange={e=>setEditForm({...editForm, clientId: e.target.value})}>
                    <option value="">-- Seçin --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={editForm.priority} onChange={e=>setEditForm({...editForm, priority: e.target.value})}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Atanan Kişi</label>
                <select className="form-select" value={editForm.assigneeId} onChange={e=>setEditForm({...editForm, assigneeId: e.target.value})}>
                  <option value="">-- Seçin --</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingTicket(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateTicket}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
