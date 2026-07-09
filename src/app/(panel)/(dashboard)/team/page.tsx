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

/* ── Ekran erişimi (efektif durum, istemci tarafı) ─────────────────────────
 * NOT: Yetkinin kaynak-doğrusu SUNUCUDUR (src/lib/access.ts + proxy gating);
 * buradaki hesap yalnızca UI göstergesi içindir ve sunucu mantığının birebir
 * kopyasıdır: kişiye özel kural > rol geneli kural > taban RBAC.
 * Aynı özgüllükte en yeni kural kazanır (kurallar createdAt DESC sıralı tutulur).
 */
type AccessRule = {
  id: string;
  path: string;
  targetRole: string | null;   // 'B' | 'C' | null
  targetUserId: string | null;
  allow: boolean;
  grantedById?: string | null;
  createdAt: string;
};
type ManagedPath = { path: string; label: string };

/** Taban RBAC — C seviyesinin (üye) erişebildiği ekranlar (allowlist). */
const C_ALLOWED_PATHS = new Set([
  '/', '/notifications', '/tasks', '/calendar', '/messages', '/notes',
  '/payments', '/knowledge-base', '/announcements', '/news', '/tips',
]);

/** Taban RBAC: hiç kural yokken rolün ekranı görüp göremediği. */
function baseAllowed(role: string, path: string): boolean {
  if (role === 'admin') return true;                              // A her şeyi görür
  if (path === '/settings') return false;                         // yalnız A
  if (path === '/editor-performance') return role === 'editor';   // yalnız A/B
  if (role === 'editor') return true;                             // B: /settings hariç her şey
  return C_ALLOWED_PATHS.has(path);                               // C: allowlist
}

/** Kurallar + taban RBAC → efektif durum. userId verilirse kişiye özel kural da değerlendirilir. */
function effectiveState(
  rules: AccessRule[],
  path: string,
  opts: { userId?: string; role: string },
): { allow: boolean; rule: AccessRule | null } {
  const forPath = rules.filter((r) => r.path === path); // DESC sıralı → find = en yeni kural
  if (opts.userId) {
    const userRule = forPath.find((r) => r.targetUserId === opts.userId);
    if (userRule) return { allow: userRule.allow, rule: userRule };
  }
  const lvl = opts.role === 'editor' ? 'B' : 'C';
  const roleRule = forPath.find((r) => !r.targetUserId && r.targetRole === lvl);
  if (roleRule) return { allow: roleRule.allow, rule: roleRule };
  return { allow: baseAllowed(opts.role, path), rule: null };
}

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

  // ── Ekran erişimi ──
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [managed, setManaged] = useState<ManagedPath[]>([]);
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [accessTarget, setAccessTarget] = useState<User | null>(null);
  const [roleAccessOpen, setRoleAccessOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(''); // işlemdeki toggle anahtarı (path:hedef)
  const [accessErr, setAccessErr] = useState('');

  useEffect(() => {
    fetchTeam();
    // Oturumdaki kullanıcı (buton görünürlüğü için) + yönetilebilir ekran listesi
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.id) setMe({ id: d.id, role: d.role }); })
      .catch(() => {});
    fetch('/api/access/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.managed)) setManaged(d.managed); })
      .catch(() => {});
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

  // ── Ekran erişimi işlemleri ──
  const fetchRules = async (initial = false) => {
    if (initial) setRulesLoading(true);
    try {
      const res = await fetch('/api/access/rules');
      const data = res.ok ? await res.json() : [];
      // effectiveState "en yeni kural kazanır" varsayar → DESC sıralamayı garanti et
      setRules(Array.isArray(data)
        ? [...data].sort((a: AccessRule, b: AccessRule) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : []);
    } catch {
      setRules([]);
    } finally {
      if (initial) setRulesLoading(false);
    }
  };

  /** Satırdaki 🔓 butonu: A herkese; B yalnız kendi alt ekibine (A hedefi anlamsız — A her şeyi görür). */
  const canManageAccess = (u: User) =>
    !!me && u.role !== 'admin' &&
    (me.role === 'admin' || (me.role === 'editor' && u.managerId === me.id));

  const openAccess = (u: User) => {
    setAccessTarget(u);
    setAccessErr('');
    fetchRules(true);
  };

  const openRoleAccess = () => {
    setRoleAccessOpen(true);
    setAccessErr('');
    fetchRules(true);
  };

  const toggleAccess = async (path: string, target: { userId?: string; role?: 'B' | 'C' }, allow: boolean) => {
    setAccessErr('');
    const key = `${path}:${target.userId || target.role}`;
    setAccessBusy(key);
    try {
      const res = await fetch('/api/access/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, targetUserId: target.userId || undefined, targetRole: target.role || undefined, allow }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setAccessErr(d?.error || 'Erişim kuralı oluşturulamadı');
      }
      await fetchRules(); // başarı da hata da olsa güncel durumu çek
    } catch {
      setAccessErr('Sunucuya ulaşılamadı');
    } finally {
      setAccessBusy('');
    }
  };

  const deleteAccessRule = async (id: string) => {
    setAccessErr('');
    try {
      const res = await fetch(`/api/access/rules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setAccessErr(d?.error || 'Erişim kuralı silinemedi');
      }
      await fetchRules();
    } catch {
      setAccessErr('Sunucuya ulaşılamadı');
    }
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
          {me?.role === 'admin' && (
            <button className="btn btn-ghost" title="B ve C rolleri için rol geneli ekran görünürlüğü" onClick={openRoleAccess}>🔓 Rol Erişimi</button>
          )}
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

      <WorkloadPanel />

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
                      {canManageAccess(user) && (
                        <button className="btn btn-ghost btn-sm" title="Ekran Erişimi" onClick={() => openAccess(user)}>🔓</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(user.id)}>Sil</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── İK-lite: İzin & Mesai (W3-C, additive bölüm) ── */}
      <HrLeaveSection me={me} team={team} />

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

      {/* ── Ekran erişimi (kişiye özel) ── */}
      {accessTarget && (
        <>
          <div className="modal-backdrop" onClick={() => setAccessTarget(null)}></div>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔓 Ekran Erişimi — {accessTarget.name}</h2>
              <button className="modal-close" onClick={() => setAccessTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              {accessErr && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{accessErr}</div>}
              {rulesLoading ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {managed.map(({ path, label }) => {
                    const st = effectiveState(rules, path, { userId: accessTarget.id, role: accessTarget.role });
                    return (
                      <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 'var(--text-sm)' }}>{label}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{path}</div>
                        </div>
                        <AccessToggle
                          state={st}
                          busy={accessBusy === `${path}:${accessTarget.id}`}
                          onToggle={() => toggleAccess(path, { userId: accessTarget.id }, !st.allow)}
                          onDeleteRule={deleteAccessRule}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
                Değişiklikler kullanıcıların menüsüne ~1 dk içinde yansır. &quot;kural&quot; rozeti, durumun taban rol yerine
                özel bir kuraldan geldiğini gösterir; ✕ ile kural silinince taban yetkiye dönülür.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAccessTarget(null)}>Kapat</button>
            </div>
          </div>
        </>
      )}

      {/* ── Ekran erişimi (rol geneli — yalnız A) ── */}
      {roleAccessOpen && me?.role === 'admin' && (
        <>
          <div className="modal-backdrop" onClick={() => setRoleAccessOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔓 Rol Genelinde Ekran Erişimi</h2>
              <button className="modal-close" onClick={() => setRoleAccessOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {accessErr && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{accessErr}</div>}
              {rulesLoading ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <div>Ekran</div>
                    <div>B · Lider/Muhasebe</div>
                    <div>C · Üye</div>
                  </div>
                  {managed.map(({ path, label }) => {
                    const stB = effectiveState(rules, path, { role: 'editor' });
                    const stC = effectiveState(rules, path, { role: 'user' });
                    return (
                      <div key={path} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)' }}>{label}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{path}</div>
                        </div>
                        <div>
                          <AccessToggle
                            state={stB}
                            busy={accessBusy === `${path}:B`}
                            onToggle={() => toggleAccess(path, { role: 'B' }, !stB.allow)}
                            onDeleteRule={deleteAccessRule}
                          />
                        </div>
                        <div>
                          <AccessToggle
                            state={stC}
                            busy={accessBusy === `${path}:C`}
                            onToggle={() => toggleAccess(path, { role: 'C' }, !stC.allow)}
                            onDeleteRule={deleteAccessRule}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
                Değişiklikler kullanıcıların menüsüne ~1 dk içinde yansır. Kişiye özel kurallar rol geneli kurallardan
                önceliklidir; &quot;kural&quot; rozetindeki ✕ kuralı siler ve taban yetkiye dönülür.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRoleAccessOpen(false)}>Kapat</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Açık/Kapalı toggle + varsa "kural" rozeti (✕ ile kural silme) */
function AccessToggle({
  state, busy, onToggle, onDeleteRule,
}: {
  state: { allow: boolean; rule: AccessRule | null };
  busy: boolean;
  onToggle: () => void;
  onDeleteRule: (id: string) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <button
        className={`badge ${state.allow ? 'badge-success' : 'badge-error'}`}
        style={{ cursor: busy ? 'wait' : 'pointer', border: 'none' }}
        disabled={busy}
        title={state.allow ? 'Kapatmak için tıkla' : 'Açmak için tıkla'}
        onClick={onToggle}
      >
        {busy ? '...' : state.allow ? 'Açık' : 'Kapalı'}
      </button>
      {state.rule && (
        <span className="badge badge-warning" title={`Özel kural (${new Date(state.rule.createdAt).toLocaleDateString('tr-TR')})`}>
          kural
          <button
            onClick={() => onDeleteRule(state.rule!.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, padding: 0, color: 'inherit', font: 'inherit' }}
            title="Kuralı sil (taban yetkiye dön)"
          >✕</button>
        </span>
      )}
    </span>
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

/* ── İş Yükü Paneli (P2 W3-B) ───────────────────────────────────────────────
 * Kendi kendine yeten bileşen: /api/team/workload (B/A) uçtan kişi başına açık
 * görev, gecikmiş görev, öncelik-ağırlıklı yük ve son 7 gün kaydedilen süreyi
 * çeker; yükün yoğunluğuna göre renkli bir liste (heatmap) gösterir.
 */
type WorkloadRow = {
  userId: string;
  name: string;
  title?: string | null;
  role: string;
  openTasks: number;
  overdueTasks: number;
  loadScore: number;
  byPriority: Record<string, number>;
  loggedMinutes7d: number;
};

function WorkloadPanel() {
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      fetch('/api/team/workload')
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => { setRows(Array.isArray(d) ? d : []); setLoaded(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  const maxLoad = Math.max(1, ...rows.map((r) => r.loadScore));
  const heat = (score: number) => {
    const ratio = score / maxLoad;
    if (ratio >= 0.75) return { bg: 'rgba(239,68,68,0.15)', bar: 'var(--error)' };
    if (ratio >= 0.4) return { bg: 'rgba(245,158,11,0.15)', bar: 'var(--warning)' };
    if (score > 0) return { bg: 'rgba(34,197,94,0.12)', bar: 'var(--success)' };
    return { bg: 'transparent', bar: 'var(--border-strong)' };
  };
  const fmtH = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}s` : `${m}dk`);

  return (
    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={toggle}>
        <h3 style={{ margin: 0 }}>📊 İş Yükü {open ? '' : '(göster)'}</h3>
        <button className="btn btn-ghost btn-sm">{open ? 'Gizle ▲' : 'Aç ▼'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Veri yok.</div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Kişi</th><th>Açık Görev</th><th>Gecikmiş</th><th>Öncelik</th><th>Tahmini Yük</th><th>Son 7 Gün</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const h = heat(r.loadScore);
                    return (
                      <tr key={r.userId} style={{ background: h.bg }}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.name}</div>
                          {r.title && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.title}</div>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.openTasks}</td>
                        <td style={r.overdueTasks > 0 ? { color: 'var(--error)', fontWeight: 600 } : undefined}>{r.overdueTasks || '—'}</td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>
                          {r.byPriority.urgent ? <span className="badge badge-error" style={{ marginRight: 2 }}>{r.byPriority.urgent} acil</span> : null}
                          {r.byPriority.high ? <span className="badge badge-warning" style={{ marginRight: 2 }}>{r.byPriority.high} yük.</span> : null}
                          {!r.byPriority.urgent && !r.byPriority.high ? '—' : null}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ flex: 1, minWidth: 60 }}>
                              <div className="progress-fill" style={{ width: `${Math.round((r.loadScore / maxLoad) * 100)}%`, background: h.bar }}></div>
                            </div>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.loadScore}</span>
                          </div>
                        </td>
                        <td>{r.loggedMinutes7d > 0 ? fmtH(r.loggedMinutes7d) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * İK-lite: İzin talepleri + Mesai (devam) + çeyreklik özet.
 * Tümü self-contained; kendi verisini çeker. team sayfasına additive eklenir.
 * ══════════════════════════════════════════════════════════════════ */

type LeaveRow = {
  id: string; userId: string; type: string; startDate: string; endDate: string;
  status: string; note: string | null; approverId: string | null; createdAt: string;
  user?: { id: string; name: string; title: string | null } | null;
};
type AttendanceRow = {
  id: string; userId: string; date: string; checkIn: string | null; checkOut: string | null;
  note: string | null; user?: { id: string; name: string } | null;
};

const LEAVE_TYPE_LABEL: Record<string, string> = { annual: 'Yıllık İzin', sick: 'Hastalık', unpaid: 'Ücretsiz', other: 'Diğer' };
const LEAVE_STATUS: Record<string, { l: string; c: string }> = {
  pending: { l: 'Bekliyor', c: 'badge-warning' },
  approved: { l: 'Onaylı', c: 'badge-success' },
  rejected: { l: 'Reddedildi', c: 'badge-error' },
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (s: string | null) => (s ? new Date(s).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—');
/** Gün farkı (dahil): 10→12 = 3 gün. */
const leaveDays = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;

function HrLeaveSection({ me, team }: { me: { id: string; role: string } | null; team: User[] }) {
  const isManager = me?.role === 'admin' || me?.role === 'editor';
  const [tab, setTab] = useState<'mine' | 'team' | 'attendance' | 'summary'>('mine');

  const [mine, setMine] = useState<LeaveRow[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRow[]>([]);
  const [myAtt, setMyAtt] = useState<AttendanceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({ type: 'annual', startDate: '', endDate: '', note: '' });

  const loadMine = () => fetch('/api/leave-requests?scope=mine').then((r) => (r.ok ? r.json() : [])).then((d) => setMine(Array.isArray(d) ? d : [])).catch(() => {});
  const loadTeam = () => fetch('/api/leave-requests?scope=team').then((r) => (r.ok ? r.json() : [])).then((d) => setTeamLeaves(Array.isArray(d) ? d : [])).catch(() => {});
  const loadAtt = () => fetch('/api/attendance?scope=mine').then((r) => (r.ok ? r.json() : [])).then((d) => setMyAtt(Array.isArray(d) ? d : [])).catch(() => {});

  useEffect(() => {
    loadMine();
    loadAtt();
    if (isManager) loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const submitLeave = async () => {
    setMsg('');
    if (!form.startDate || !form.endDate) { setMsg('Başlangıç ve bitiş tarihi zorunlu'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ type: 'annual', startDate: '', endDate: '', note: '' });
        await loadMine();
        if (isManager) await loadTeam();
      } else {
        const d = await res.json().catch(() => null);
        setMsg(d?.error || d?.issues?.[0]?.message || 'Talep oluşturulamadı');
      }
    } catch { setMsg('Sunucuya ulaşılamadı'); }
    finally { setBusy(false); }
  };

  const cancelLeave = async (id: string) => {
    if (!confirm('İzin talebini iptal etmek istiyor musunuz?')) return;
    const res = await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
    if (res.ok) { setMine((l) => l.filter((x) => x.id !== id)); if (isManager) loadTeam(); }
  };

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) { const u = await res.json(); setTeamLeaves((l) => l.map((x) => (x.id === id ? { ...x, status: u.status } : x))); }
  };

  const punch = async (action: 'in' | 'out') => {
    const res = await fetch('/api/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    if (res.ok) await loadAtt();
  };

  const pendingCount = teamLeaves.filter((l) => l.status === 'pending').length;

  return (
    <div className="section-card" style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>🏖️ İzin & Mesai</h2>
      <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
        <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>İzinlerim</button>
        {isManager && (
          <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
            Ekip İzinleri{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        )}
        <button className={`tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Mesai</button>
        {isManager && <button className={`tab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>Çeyreklik Özet</button>}
      </div>

      {/* ── İzinlerim ── */}
      {tab === 'mine' && (
        <div>
          <div className="grid-2" style={{ alignItems: 'end', marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">İzin Türü</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="annual">Yıllık İzin</option>
                <option value="sick">Hastalık</option>
                <option value="unpaid">Ücretsiz</option>
                <option value="other">Diğer</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Not (opsiyonel)</label>
              <input className="form-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Kısa açıklama" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Başlangıç</label>
              <input type="date" className="form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bitiş</label>
              <input type="date" className="form-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          {msg && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>{msg}</div>}
          <button className="btn btn-primary btn-sm" onClick={submitLeave} disabled={busy}>{busy ? '...' : '+ İzin Talebi Oluştur'}</button>

          <div style={{ marginTop: 'var(--space-4)' }}>
            {mine.length === 0 ? (
              <div className="empty-hint">Henüz izin talebiniz yok.</div>
            ) : mine.map((l) => {
              const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
              return (
                <div key={l.id} className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-title">{LEAVE_TYPE_LABEL[l.type] || l.type} · {leaveDays(l.startDate, l.endDate)} gün</div>
                    <div className="text-meta">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}{l.note ? ` · ${l.note}` : ''}</div>
                  </div>
                  <div className="list-row-actions">
                    <span className={`badge ${st.c}`}>{st.l}</span>
                    {l.status === 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => cancelLeave(l.id)}>İptal</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ekip İzinleri (yönetici) ── */}
      {tab === 'team' && isManager && (
        <div>
          {teamLeaves.length === 0 ? (
            <div className="empty-hint">Ekipte izin talebi yok.</div>
          ) : teamLeaves.map((l) => {
            const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
            return (
              <div key={l.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{l.user?.name || 'Bilinmeyen'} — {LEAVE_TYPE_LABEL[l.type] || l.type}</div>
                  <div className="text-meta">{fmtDate(l.startDate)} → {fmtDate(l.endDate)} · {leaveDays(l.startDate, l.endDate)} gün{l.note ? ` · ${l.note}` : ''}</div>
                </div>
                <div className="list-row-actions">
                  <span className={`badge ${st.c}`}>{st.l}</span>
                  {l.status === 'pending' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => decide(l.id, 'approved')}>Onayla</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => decide(l.id, 'rejected')}>Reddet</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mesai (devam) ── */}
      {tab === 'attendance' && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => punch('in')}>🟢 Giriş Yap</button>
            <button className="btn btn-ghost btn-sm" onClick={() => punch('out')}>🔴 Çıkış Yap</button>
          </div>
          {myAtt.length === 0 ? (
            <div className="empty-hint">Mesai kaydı yok.</div>
          ) : myAtt.map((a) => (
            <div key={a.id} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{fmtDate(a.date)}</div>
                <div className="text-meta">Giriş: {fmtTime(a.checkIn)} · Çıkış: {fmtTime(a.checkOut)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Çeyreklik Özet (yönetici): Warn + izin metrikleri ── */}
      {tab === 'summary' && isManager && (
        <div>
          <p className="text-meta" style={{ marginBottom: 'var(--space-3)' }}>
            Basit özet: kişi başı uyarı sayısı (Warn) ve onaylı izin günleri. Görev/haber metrikleri için /editor-performance.
          </p>
          {team.filter((u) => u.role !== 'admin').length === 0 ? (
            <div className="empty-hint">Özetlenecek ekip üyesi yok.</div>
          ) : team.filter((u) => u.role !== 'admin').map((u) => {
            const approvedDays = teamLeaves
              .filter((l) => l.userId === u.id && l.status === 'approved')
              .reduce((sum, l) => sum + leaveDays(l.startDate, l.endDate), 0);
            const warns = u._count?.warnsReceived ?? 0;
            return (
              <div key={u.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{u.name}</div>
                  <div className="text-meta">{u.title || '—'}</div>
                </div>
                <div className="list-row-actions">
                  <span className={`badge ${warns > 0 ? 'badge-warning' : 'badge-neutral'}`}>⚠️ {warns} uyarı</span>
                  <span className="badge badge-info">🏖️ {approvedDays} gün izin</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
