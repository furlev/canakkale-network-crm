'use client';
import { useState, useEffect } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  createdAt: string;
};

const roleMap: Record<string,{label:string;cls:string}> = {
  admin:{label:'Yönetici',cls:'badge-error'},
  editor:{label:'Editör',cls:'badge-warning'},
  user:{label:'Kullanıcı',cls:'badge-info'},
};

export default function TeamPage() {
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'user', department: '', status: 'active' });

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) return;
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        const created = await res.json();
        setTeam([created, ...team]);
        setIsAdding(false);
        setNewUser({ name: '', email: '', role: 'user', department: '', status: 'active' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTeam(team.map(t => t.id === id ? { ...t, status } : t));
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTeam(team.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👥 Ekip ve Kullanıcılar</h1>
          <p className="page-subtitle">Sistem erişimi ve personel yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Kullanıcı</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Personel</div>
          <div className="stat-card-value">{loading ? '-' : team.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Aktif Kullanıcı</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>{loading ? '-' : team.filter(t => t.status === 'active').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Yöneticiler</div>
          <div className="stat-card-value" style={{color:'var(--error)'}}>{loading ? '-' : team.filter(t => t.role === 'admin').length}</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : team.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Sistemde kayıtlı kullanıcı yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Departman</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {team.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'var(--space-3)'}}>
                      <div className="avatar avatar-sm">{user.name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <div style={{fontWeight:500}}>{user.name}</div>
                        <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.department || '-'}</td>
                  <td><span className={`badge ${roleMap[user.role]?.cls}`}>{roleMap[user.role]?.label}</span></td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)'}} 
                      value={user.status} 
                      onChange={(e) => updateStatus(user.id, e.target.value)}
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Pasif</option>
                    </select>
                  </td>
                  <td style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(user.id)}>Sil</button>
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
              <h2 className="modal-title">Yeni Kullanıcı Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Ad Soyad *</label>
                <input className="form-input" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">E-Posta Adresi *</label>
                <input type="email" className="form-input" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-select" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                    <option value="user">Kullanıcı (Standart)</option>
                    <option value="editor">Editör (Haber Yönetimi)</option>
                    <option value="admin">Yönetici (Tam Yetki)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Departman</label>
                  <input className="form-input" value={newUser.department} onChange={e=>setNewUser({...newUser, department: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateUser}>Kullanıcı Ekle</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
