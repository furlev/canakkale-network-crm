'use client';
import { useState, useEffect } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  title?: string | null;
  managerId?: string | null;
  manager?: { id: string; name: string } | null;
  status: string;
  createdAt: string;
  _count?: { teamMembers: number; warnsReceived: number };
};

type Warn = {
  id: string; reason: string; severity: string; createdAt: string;
  issuedBy?: { id: string; name: string } | null;
};

const levelInfo = (role: string) =>
  role === 'admin'
    ? { l: 'A · Baş Yönetici', c: 'badge-error' }
    : role === 'editor'
      ? { l: 'B · Lider / Muhasebe', c: 'badge-warning' }
      : { l: 'C · Üye', c: 'badge-info' };

const emptyForm = { name: '', email: '', role: 'user', title: '', department: '', managerId: '', status: 'active', password: '' };

export default function TeamPage() {
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ ...emptyForm });

  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const [warnTarget, setWarnTarget] = useState<User | null>(null);
  const [warns, setWarns] = useState<Warn[]>([]);
  const [warnReason, setWarnReason] = useState('');
  const [warnSeverity, setWarnSeverity] = useState('normal');

  const [err, setErr] = useState('');

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/team');
      const data = res.ok ? await res.json() : [];
      setTeam(Array.isArray(data) ? data : []);
    } catch {
      setTeam([]);
    } finally {
      setLoading(false);
    }
  };

  const managers = team.filter((t) => t.role === 'editor' || t.role === 'admin');

  const handleCreateUser = async () => {
    setErr('');
    if (!newUser.name || !newUser.email) {
      setErr('Ad ve e-posta zorunlu');
      return;
    }
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, managerId: newUser.managerId || null }),
      });
      if (res.ok) {
        const created = await res.json();
        setTeam([created, ...team]);
        setIsAdding(false);
        setNewUser({ ...emptyForm });
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Kullanıcı oluşturulamadı');
      }
    } catch {
      setErr('Sunucuya ulaşılamadı');
    }
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setEditForm({
      name: u.name, email: u.email, role: u.role, title: u.title || '',
      department: u.department || '', managerId: u.managerId || '', status: u.status, password: '',
    });
    setErr('');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setErr('');
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name, email: editForm.email, role: editForm.role,
        title: editForm.title || null, department: editForm.department || null,
        managerId: editForm.managerId || null, status: editForm.status,
      };
      const res = await fetch(`/api/team/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setTeam(team.map((t) => (t.id === editing.id ? updated : t)));
        setEditing(null);
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Güncellenemedi');
      }
    } catch {
      setErr('Sunucuya ulaşılamadı');
    }
  };

  const handleSetPassword = async () => {
    if (!pwTarget || pwValue.length < 8) {
      setPwMsg('Şifre en az 8 karakter olmalı');
      return;
    }
    try {
      const res = await fetch(`/api/team/${pwTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwValue }),
      });
      if (res.ok) {
        setPwTarget(null); setPwValue(''); setPwMsg('');
      } else {
        const data = await res.json().catch(() => null);
        setPwMsg(data?.error || 'Şifre atanamadı');
      }
    } catch {
      setPwMsg('Sunucuya ulaşılamadı');
    }
  };

  const openWarns = async (u: User) => {
    setWarnTarget(u);
    setWarnReason('');
    setWarnSeverity('normal');
    try {
      const res = await fetch(`/api/warns?userId=${u.id}`);
      const data = res.ok ? await res.json() : [];
      setWarns(Array.isArray(data) ? data : []);
    } catch {
      setWarns([]);
    }
  };
  const addWarn = async () => {
    if (!warnTarget || !warnReason.trim()) return;
    const res = await fetch('/api/warns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: warnTarget.id, reason: warnReason, severity: warnSeverity }),
    });
    if (res.ok) {
      const created = await res.json();
      setWarns([created, ...warns]);
      setWarnReason('');
      setTeam(team.map((t) => (t.id === warnTarget.id ? { ...t, _count: { teamMembers: t._count?.teamMembers || 0, warnsReceived: (t._count?.warnsReceived || 0) + 1 } } : t)));
    }
  };
  const removeWarn = async (id: string) => {
    const res = await fetch(`/api/warns/${id}`, { method: 'DELETE' });
    if (res.ok) setWarns(warns.filter((w) => w.id !== id));
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (res.ok) setTeam(team.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch { /* sessiz */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (res.ok) setTeam(team.filter((t) => t.id !== id));
      else { const d = await res.json().catch(() => null); alert(d?.error || 'Silinemedi'); }
    } catch { /* sessiz */ }
  };

  const filtered = team.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase()) || (t.title || '').toLowerCase().includes(search.toLowerCase()));

  const severityBadge = (s: string) => (s === 'high' ? 'badge-error' : s === 'low' ? 'badge-info' : 'badge-warning');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👥 Ekip ve Kullanıcılar</h1>
          <p className="page-subtitle">A / B / C rol sistemi, ekip yapısı ve personel yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setIsAdding(true); setErr(''); }}>+ Yeni Kullanıcı</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Toplam Personel</div><div className="stat-card-value">{loading ? '-' : team.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Aktif</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : team.filter((t) => t.status === 'active').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">A · Yönetici</div><div className="stat-card-value" style={{ color: 'var(--error)' }}>{loading ? '-' : team.filter((t) => t.role === 'admin').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">B · Lider/Muhasebe</div><div className="stat-card-value" style={{ color: 'var(--warning)' }}>{loading ? '-' : team.filter((t) => t.role === 'editor').length}</div></div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input className="form-input" style={{ maxWidth: 320 }} placeholder="İsim, e-posta veya pozisyon ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Kayıt yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Pozisyon</th>
                <th>Seviye</th>
                <th>Ekip Lideri</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const lvl = levelInfo(user.role);
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar avatar-sm">{user.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{user.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {user.title || '-'}
                      {(user._count?.teamMembers ?? 0) > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>👥 {user._count?.teamMembers} üye</div>}
                    </td>
                    <td><span className={`badge ${lvl.c}`}>{lvl.l}</span></td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{user.manager?.name || '-'}</td>
                    <td>
                      <select className="form-select" style={{ padding: '4px', fontSize: 'var(--text-xs)' }} value={user.status} onChange={(e) => updateStatus(user.id, e.target.value)}>
                        <option value="active">Aktif</option>
                        <option value="inactive">Pasif</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" title="Düzenle" onClick={() => openEdit(user)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" title="Uyarılar" onClick={() => openWarns(user)}>
                        ⚠️{(user._count?.warnsReceived ?? 0) > 0 ? ` ${user._count?.warnsReceived}` : ''}
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Giriş şifresi ata/sıfırla" onClick={() => { setPwTarget(user); setPwValue(''); setPwMsg(''); }}>🔑</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(user.id)}>Sil</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Yeni kullanıcı ── */}
      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Kullanıcı Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <UserFormFields form={newUser} setForm={(f) => setNewUser(f)} managers={managers} withPassword />
              {err && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateUser}>Kullanıcı Ekle</button>
            </div>
          </div>
        </>
      )}

      {/* ── Kullanıcı düzenle ── */}
      {editing && (
        <>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Düzenle — {editing.name}</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <UserFormFields form={editForm} setForm={(f) => setEditForm(f)} managers={managers.filter((m) => m.id !== editing.id)} />
              {err && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* ── Şifre ── */}
      {pwTarget && (
        <>
          <div className="modal-backdrop" onClick={() => setPwTarget(null)}></div>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔑 Şifre Ata — {pwTarget.name}</h2>
              <button className="modal-close" onClick={() => setPwTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Yeni Giriş Şifresi</label>
                <input type="password" className="form-input" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="En az 8 karakter" autoFocus />
              </div>
              {pwMsg && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{pwMsg}</div>}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Kullanıcı bu şifreyle <strong>{pwTarget.email}</strong> adresini kullanarak giriş yapabilir.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPwTarget(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSetPassword}>Şifreyi Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* ── Uyarılar (warn) ── */}
      {warnTarget && (
        <>
          <div className="modal-backdrop" onClick={() => setWarnTarget(null)}></div>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">⚠️ Uyarılar — {warnTarget.name}</h2>
              <button className="modal-close" onClick={() => setWarnTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Yeni uyarı</label>
                <input className="form-input" value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="Uyarı sebebi" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <select className="form-select" value={warnSeverity} onChange={(e) => setWarnSeverity(e.target.value)} style={{ maxWidth: 160 }}>
                  <option value="low">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                </select>
                <button className="btn btn-primary" onClick={addWarn}>Uyarı Ekle</button>
              </div>
              {warns.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>Uyarı yok 👍</div>
              ) : (
                warns.map((w) => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className={`badge ${severityBadge(w.severity)}`}>{w.severity === 'high' ? 'Yüksek' : w.severity === 'low' ? 'Düşük' : 'Normal'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)' }}>{w.reason}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{w.issuedBy?.name || 'Sistem'} · {new Date(w.createdAt).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeWarn(w.id)}>Sil</button>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setWarnTarget(null)}>Kapat</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Ortak form alanları (yeni + düzenle) */
function UserFormFields({
  form, setForm, managers, withPassword,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  managers: User[];
  withPassword?: boolean;
}) {
  return (
    <>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Ad Soyad *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">E-Posta *</label>
          <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Seviye (A/B/C)</label>
          <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="user">C · Ekip Üyesi</option>
            <option value="editor">B · Lider / Muhasebe</option>
            <option value="admin">A · Baş Yönetici (tam yetki)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Pozisyon / Ünvan</label>
          <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ekip Lideri, Muhasebe, Muhabir..." />
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Bağlı Olduğu Ekip Lideri</label>
          <select className="form-select" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
            <option value="">— Yok —</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Departman</label>
          <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
      </div>
      {withPassword && (
        <div className="form-group">
          <label className="form-label">Giriş Şifresi (opsiyonel, en az 8 karakter)</label>
          <input type="password" className="form-input" placeholder="Boş bırakılırsa kullanıcı giriş yapamaz" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
      )}
    </>
  );
}
