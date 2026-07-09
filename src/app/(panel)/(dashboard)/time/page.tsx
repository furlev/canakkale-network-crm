'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

type TimeEntry = {
  id: string;
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  minutes: number;
  billable: boolean;
  rate?: number | null;
  note?: string | null;
  date: string;
  projectName?: string | null;
  taskTitle?: string | null;
  userName?: string | null;
};

type Opt = { id: string; name: string };
type Me = { id: string; role: string } | null;

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ date: todayStr(), projectId: '', taskId: '', minutes: '', billable: true, rate: '', note: '' });

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

export default function TimePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);
  const [team, setTeam] = useState<Opt[]>([]);
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const isLeader = me?.role === 'admin' || me?.role === 'editor';

  const fetchEntries = useCallback(async () => {
    try {
      const qs = userFilter ? `?userId=${encodeURIComponent(userFilter)}` : '';
      const res = await fetch(`/api/time-entries${qs}`);
      if (res.ok) setEntries(await res.json());
    } catch (e) {
      console.error('Zaman kayıtları alınamadı:', e);
    } finally {
      setLoading(false);
    }
  }, [userFilter]);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => {});
    fetch('/api/tasks').then((r) => (r.ok ? r.json() : [])).then((d) =>
      setTasks(Array.isArray(d) ? d.map((t: { id: string; title: string }) => ({ id: t.id, name: t.title })) : [])
    ).catch(() => {});
    // Proje listesi B+ gerektirir; C için sessizce boş kalır.
    fetch('/api/projects').then((r) => (r.ok ? r.json() : [])).then((d) =>
      setProjects(Array.isArray(d) ? d.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) : [])
    ).catch(() => {});
    fetch('/api/team').then((r) => (r.ok ? r.json() : [])).then((d) =>
      setTeam(Array.isArray(d) ? d.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })) : [])
    ).catch(() => {});
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); setErr(''); };

  const submit = async () => {
    setErr('');
    const minutes = parseInt(form.minutes, 10);
    if (!minutes || minutes < 1) { setErr('Geçerli bir süre (dakika) girin.'); return; }
    if (!form.date) { setErr('Tarih seçin.'); return; }
    const payload = {
      date: form.date,
      projectId: form.projectId || null,
      taskId: form.taskId || null,
      minutes,
      billable: form.billable,
      rate: form.billable && form.rate ? parseFloat(form.rate) : null,
      note: form.note || null,
    };
    try {
      const res = await fetch(editingId ? `/api/time-entries/${editingId}` : '/api/time-entries', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { resetForm(); await fetchEntries(); }
      else { const d = await res.json().catch(() => ({})); setErr(d.error || 'Kayıt başarısız.'); }
    } catch (e) {
      console.error(e); setErr('Kayıt başarısız.');
    }
  };

  const startEdit = (e: TimeEntry) => {
    setEditingId(e.id);
    setErr('');
    setForm({
      date: e.date.slice(0, 10),
      projectId: e.projectId || '',
      taskId: e.taskId || '',
      minutes: String(e.minutes),
      billable: e.billable,
      rate: e.rate != null ? String(e.rate) : '',
      note: e.note || '',
    });
  };

  const remove = async (id: string) => {
    if (!confirm('Bu zaman kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
      if (res.ok) setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { console.error(e); }
  };

  const stats = useMemo(() => {
    const today = todayStr();
    let todayMin = 0, totalMin = 0, billableAmount = 0;
    for (const e of entries) {
      totalMin += e.minutes;
      if (e.date.slice(0, 10) === today) todayMin += e.minutes;
      if (e.billable && e.rate) billableAmount += (e.minutes / 60) * e.rate;
    }
    return { todayMin, totalMin, billableAmount };
  }, [entries]);

  // Proje bazlı harcanan saat özeti
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; billable: number }>();
    for (const e of entries) {
      const key = e.projectId || '__none__';
      const name = e.projectName || (e.projectId ? 'Bilinmeyen proje' : 'Projesiz');
      const cur = map.get(key) || { name, minutes: 0, billable: 0 };
      cur.minutes += e.minutes;
      if (e.billable && e.rate) cur.billable += (e.minutes / 60) * e.rate;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">⏱️ Zaman Takibi</h1>
          <p className="page-subtitle">Günlük çalışma süresi girişi; proje bazlı harcanan saat ve faturalanabilir tutar</p>
        </div>
        {isLeader && (
          <div className="page-header-actions">
            <select className="form-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">Tüm Ekip</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Bugün</div><div className="stat-card-value">{loading ? '-' : fmtHours(stats.todayMin)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Toplam (listelenen)</div><div className="stat-card-value" style={{ color: 'var(--accent)' }}>{loading ? '-' : fmtHours(stats.totalMin)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Faturalanabilir Tutar</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : `${stats.billableAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`}</div></div>
        <div className="stat-card"><div className="stat-card-label">Kayıt Sayısı</div><div className="stat-card-value">{loading ? '-' : entries.length}</div></div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>{editingId ? 'Kaydı Düzenle' : 'Yeni Zaman Girişi'}</h3>
          {err && <div style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{err}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Tarih *</label>
              <input type="date" className="form-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Süre (dakika) *</label>
              <input type="number" min={1} className="form-input" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="ör. 90" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Görev</label>
            <select className="form-select" value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
              <option value="">— Seçilmedi —</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {projects.length > 0 && (
            <div className="form-group">
              <label className="form-label">Proje</label>
              <select className="form-select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— Seçilmedi —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
                Faturalanabilir
              </label>
            </div>
            {form.billable && (
              <div className="form-group">
                <label className="form-label">Saatlik Ücret (₺)</label>
                <input type="number" min={0} className="form-input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="ör. 500" />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Not</label>
            <input className="form-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Kısa açıklama (opsiyonel)" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={submit}>{editingId ? 'Güncelle' : 'Kaydet'}</button>
            {editingId && <button className="btn btn-ghost" onClick={resetForm}>İptal</button>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Proje Bazlı Harcanan Saat</h3>
          {byProject.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Henüz kayıt yok.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Proje</th><th>Süre</th><th>Faturalanabilir</th></tr></thead>
              <tbody>
                {byProject.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{fmtHours(p.minutes)}</td>
                    <td>{p.billable > 0 ? `${p.billable.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Zaman Kayıtları</h3>
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : entries.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Henüz zaman kaydı yok.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>{isLeader && <th>Kişi</th>}<th>Görev / Proje</th><th>Süre</th><th>Fatura.</th><th>Not</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.date).toLocaleDateString('tr-TR')}</td>
                    {isLeader && <td>{e.userName || '—'}</td>}
                    <td>
                      <div>{e.taskTitle || '—'}</div>
                      {e.projectName && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{e.projectName}</div>}
                    </td>
                    <td>{fmtHours(e.minutes)}</td>
                    <td>{e.billable ? <span className="badge badge-success">{e.rate ? `${e.rate}₺/s` : 'Evet'}</span> : <span className="badge badge-info">Hayır</span>}</td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{e.note || ''}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(e)}>Düzenle</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
