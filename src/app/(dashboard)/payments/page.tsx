'use client';
import { useState, useEffect } from 'react';

type Me = { id: string; name: string; role: string; title?: string | null };
type UserLite = { id: string; name: string; email: string; role: string };
type Payment = {
  id: string; kind: string; title: string; amount: number; status: string;
  note?: string | null; dueDate?: string | null; paidAt?: string | null; createdAt: string;
  user: { id: string; name: string; email: string };
  budget?: { id: string; title: string } | null;
};

const fmt = (n: number) => '₺' + (n || 0).toLocaleString('tr-TR');

export default function PaymentsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'paid'>('all');

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [bTitle, setBTitle] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bDue, setBDue] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [equalTotal, setEqualTotal] = useState('');

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [sUser, setSUser] = useState('');
  const [sTitle, setSTitle] = useState('');
  const [sAmount, setSAmount] = useState('');
  const [sNote, setSNote] = useState('');
  const [msg, setMsg] = useState('');

  const manager = !!me && (me.role === 'admin' || me.role === 'editor');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => {});
    load();
  }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = res.ok ? await res.json() : [];
      setPayments(Array.isArray(data) ? data : []);
      const ures = await fetch('/api/team');
      const udata = ures.ok ? await ures.json() : [];
      setUsers(Array.isArray(udata) ? udata : []);
    } catch {
      /* sessiz */
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (id: string) => {
    const res = await fetch(`/api/payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) });
    if (res.ok) {
      const u = await res.json();
      setPayments((p) => p.map((x) => (x.id === id ? { ...x, status: 'paid', paidAt: u.paidAt } : x)));
    } else {
      alert('İşlem başarısız oldu.');
    }
  };
  const setStatus = async (id: string, status: string) => {
    if (status === 'cancelled' && !confirm('Bu ödeme talebini iptal etmek istiyor musunuz?')) return;
    const res = await fetch(`/api/payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) setPayments((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));
  };
  const removePay = async (id: string) => {
    if (!confirm('Kaydı silmek istiyor musunuz?')) return;
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    if (res.ok) setPayments((p) => p.filter((x) => x.id !== id));
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const n = { ...prev };
      if (id in n) delete n[id];
      else n[id] = '';
      return n;
    });
  };
  const distributeEqual = () => {
    const ids = Object.keys(picked);
    const total = Number(equalTotal);
    if (!ids.length || !total) return;
    const per = Math.round((total / ids.length) * 100) / 100;
    const next: Record<string, string> = {};
    ids.forEach((id) => (next[id] = String(per)));
    setPicked(next);
  };

  const createBudget = async () => {
    setMsg('');
    const distributions = Object.entries(picked).filter(([, a]) => Number(a) > 0).map(([userId, a]) => ({ userId, amount: Number(a) }));
    if (!bTitle || distributions.length === 0) {
      setMsg('Başlık ve en az bir kişi/tutar gerekli');
      return;
    }
    const res = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: bTitle, description: bDesc || null, dueDate: bDue || null, distributions }) });
    if (res.ok) {
      setBudgetOpen(false);
      setBTitle(''); setBDesc(''); setBDue(''); setPicked({}); setEqualTotal('');
      load();
    } else {
      const d = await res.json().catch(() => null);
      setMsg(d?.error || 'Bütçe oluşturulamadı');
    }
  };

  const createSalary = async () => {
    setMsg('');
    if (!sUser || !sTitle || !Number(sAmount)) {
      setMsg('Kişi, başlık ve tutar gerekli');
      return;
    }
    const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'salary', userId: sUser, title: sTitle, amount: Number(sAmount), note: sNote || null }) });
    if (res.ok) {
      setSalaryOpen(false);
      setSUser(''); setSTitle(''); setSAmount(''); setSNote('');
      load();
    } else {
      const d = await res.json().catch(() => null);
      setMsg(d?.error || 'Kayıt oluşturulamadı');
    }
  };

  const filtered = payments.filter((p) => (tab === 'all' ? true : p.status === tab));
  const totPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const totPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const statusBadge = (s: string) => (s === 'paid' ? 'badge-success' : s === 'cancelled' ? 'badge-error' : 'badge-warning');
  const statusLabel = (s: string) => (s === 'paid' ? 'Ödendi' : s === 'cancelled' ? 'İptal' : 'Bekliyor');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💳 Ödemeler & Maaş</h1>
          <p className="page-subtitle">{manager ? 'Ortak harcama bütçeleri ve maaş kayıtları' : 'Sana atanan ödemeler'}</p>
        </div>
        {manager && (
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => { setSalaryOpen(true); setMsg(''); }}>+ Maaş / Ödeme</button>
            <button className="btn btn-primary" onClick={() => { setBudgetOpen(true); setMsg(''); }}>+ Bütçe Oluştur</button>
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-label">Bekleyen Toplam</div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{loading ? '-' : fmt(totPending)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Ödenen Toplam</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : fmt(totPaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Kayıt Sayısı</div>
          <div className="stat-card-value">{loading ? '-' : payments.length}</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
        {(['all', 'pending', 'paid'] as const).map((t) => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'Tümü' : t === 'pending' ? 'Bekleyen' : 'Ödenen'}
          </button>
        ))}
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
                <th>Başlık</th>
                {manager && <th>Kişi</th>}
                <th>Tür</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Son Tarih</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.title}</div>
                    {p.budget && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Bütçe: {p.budget.title}</div>}
                    {p.note && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{p.note}</div>}
                  </td>
                  {manager && <td>{p.user?.name}</td>}
                  <td><span className="badge badge-info">{p.kind === 'salary' ? 'Maaş' : 'Ortak Harcama'}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(p.amount)}</td>
                  <td><span className={`badge ${statusBadge(p.status)}`}>{statusLabel(p.status)}</span></td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{p.dueDate ? new Date(p.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>
                    {p.status === 'pending' && p.kind === 'collection' && (
                      <button className="btn btn-primary btn-sm" onClick={() => markPaid(p.id)}>✓ Ödedim</button>
                    )}
                    {manager && p.status === 'pending' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p.id, p.kind === 'salary' ? 'paid' : 'cancelled')}>{p.kind === 'salary' ? 'Ödendi işaretle' : 'İptal'}</button>
                    )}
                    {manager && <button className="btn btn-ghost btn-sm" onClick={() => removePay(p.id)}>Sil</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Bütçe modalı ── */}
      {budgetOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setBudgetOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">💰 Ortak Harcama Bütçesi</h2>
              <button className="modal-close" onClick={() => setBudgetOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="Ör. Ofis kirası katkısı" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Açıklama</label>
                  <input className="form-input" value={bDesc} onChange={(e) => setBDesc(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Son Ödeme Tarihi</label>
                  <input type="date" className="form-input" value={bDue} onChange={(e) => setBDue(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Toplam tutarı eşit paylaştır</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input type="number" className="form-input" value={equalTotal} onChange={(e) => setEqualTotal(e.target.value)} placeholder="Toplam ₺" />
                  <button className="btn btn-ghost" onClick={distributeEqual}>Eşit Böl</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Kişiler ve tutarlar</label>
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--border-radius)' }}>
                  {users.map((u) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <input type="checkbox" checked={u.id in picked} onChange={() => togglePick(u.id)} />
                      <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{u.name}</span>
                      {u.id in picked && (
                        <input type="number" className="form-input" style={{ width: 120, padding: '4px 8px' }} value={picked[u.id]} onChange={(e) => setPicked((p) => ({ ...p, [u.id]: e.target.value }))} placeholder="₺" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {msg && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{msg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBudgetOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={createBudget}>Bütçeyi Oluştur</button>
            </div>
          </div>
        </>
      )}

      {/* ── Maaş / tekil ödeme modalı ── */}
      {salaryOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setSalaryOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">💵 Maaş / Ödeme Kaydı</h2>
              <button className="modal-close" onClick={() => setSalaryOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Kişi *</label>
                <select className="form-select" value={sUser} onChange={(e) => setSUser(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Başlık *</label>
                  <input className="form-input" value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Ör. Temmuz maaşı" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tutar (₺) *</label>
                  <input type="number" className="form-input" value={sAmount} onChange={(e) => setSAmount(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Not</label>
                <input className="form-input" value={sNote} onChange={(e) => setSNote(e.target.value)} />
              </div>
              {msg && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{msg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSalaryOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={createSalary}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
