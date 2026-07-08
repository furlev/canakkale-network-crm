'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DISTRICTS } from '@/lib/districts';

/* API: /api/ai/sources (GET/POST) + /api/ai/sources/[id] (GET?test=1 / PUT / DELETE) */
type NewsSource = {
  id: string;
  name: string;
  feedUrl: string;
  type: string; // rss | google_news
  enabled: boolean;
  needsUA: boolean;
  trustScore: number;
  sourceType: string; // official | local | aggregator | social
  district: string | null;
  lastFetchedAt: string | null;
  lastItemCount: number | null;
  lastError: string | null;
  notes: string | null;
  createdAt: string;
};

type SourceForm = {
  name: string; feedUrl: string; type: string; sourceType: string;
  district: string; trustScore: number; needsUA: boolean; enabled: boolean; notes: string;
};

const emptyForm: SourceForm = {
  name: '', feedUrl: '', type: 'rss', sourceType: 'local',
  district: '', trustScore: 50, needsUA: false, enabled: true, notes: '',
};

const TYPE_LABEL: Record<string, string> = { rss: 'RSS', google_news: 'Google News' };
const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: 'Resmi', local: 'Yerel', aggregator: 'Agregatör', social: 'Sosyal',
};
const SOURCE_TYPE_BADGE: Record<string, string> = {
  official: 'badge-success', local: 'badge-info', aggregator: 'badge-warning', social: 'badge-primary',
};

function trustBadge(score: number): string {
  if (score >= 70) return 'badge-success';
  if (score >= 40) return 'badge-warning';
  return 'badge-error';
}

type TestResult =
  | { ok: true; count: number; items: { title: string; link: string; pubDate: string | null }[] }
  | { ok: false; error: string };

export default function KaynaklarPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<SourceForm>({ ...emptyForm });

  const [editing, setEditing] = useState<NewsSource | null>(null);
  const [editForm, setEditForm] = useState<SourceForm>({ ...emptyForm });

  const [testTarget, setTestTarget] = useState<NewsSource | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/sources');
      const data = res.ok ? await res.json() : [];
      setSources(Array.isArray(data) ? data : []);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleCreate = async () => {
    setErr('');
    if (!addForm.name.trim() || !addForm.feedUrl.trim()) { setErr('Ad ve feed adresi zorunlu'); return; }
    try {
      const res = await fetch('/api/ai/sources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, district: addForm.district || null }),
      });
      if (res.ok) {
        const created = await res.json();
        setSources((prev) => [created, ...prev]);
        setIsAdding(false);
        setAddForm({ ...emptyForm });
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Kaynak eklenemedi');
      }
    } catch { setErr('Sunucuya ulaşılamadı'); }
  };

  const openEdit = (s: NewsSource) => {
    setEditing(s);
    setErr('');
    setEditForm({
      name: s.name, feedUrl: s.feedUrl, type: s.type, sourceType: s.sourceType,
      district: s.district || '', trustScore: s.trustScore, needsUA: s.needsUA,
      enabled: s.enabled, notes: s.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setErr('');
    try {
      const res = await fetch(`/api/ai/sources/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, district: editForm.district || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSources((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
        setEditing(null);
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Güncellenemedi');
      }
    } catch { setErr('Sunucuya ulaşılamadı'); }
  };

  const toggleEnabled = async (s: NewsSource) => {
    try {
      const res = await fetch(`/api/ai/sources/${s.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSources((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      }
    } catch { /* sessiz */ }
  };

  const handleDelete = async (s: NewsSource) => {
    if (!confirm(`"${s.name}" kaynağını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/ai/sources/${s.id}`, { method: 'DELETE' });
      if (res.ok) setSources((prev) => prev.filter((x) => x.id !== s.id));
      else { const d = await res.json().catch(() => null); alert(d?.error || 'Silinemedi'); }
    } catch { /* sessiz */ }
  };

  const runTest = async (s: NewsSource) => {
    setTestTarget(s);
    setTestResult(null);
    setTestBusy(true);
    try {
      const res = await fetch(`/api/ai/sources/${s.id}?test=1`);
      const data = await res.json().catch(() => null);
      if (data && typeof data.ok === 'boolean') {
        setTestResult(data as TestResult);
        // sağlık alanları sunucuda güncellendi → listeyi tazele
        fetchSources();
      } else {
        setTestResult({ ok: false, error: (data && data.error) || 'Test başarısız' });
      }
    } catch {
      setTestResult({ ok: false, error: 'Sunucuya ulaşılamadı' });
    } finally {
      setTestBusy(false);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const enabledCount = sources.filter((s) => s.enabled).length;
  const errorCount = sources.filter((s) => s.enabled && s.lastError).length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📡 Haber Kaynakları</h1>
          <p className="page-subtitle">AI haber motorunun taradığı RSS / Google News kaynaklarını yönetin</p>
        </div>
        <div className="page-header-actions">
          <Link href="/ai-news" className="btn btn-ghost">← AI Haber Kuyruğu</Link>
          <button className="btn btn-primary" onClick={() => { setIsAdding(true); setErr(''); setAddForm({ ...emptyForm }); }}>+ Yeni Kaynak</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Toplam Kaynak</div><div className="stat-card-value">{loading ? '-' : sources.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Etkin</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : enabledCount}</div></div>
        <div className="stat-card"><div className="stat-card-label">Son Çekimde Hatalı</div><div className="stat-card-value" style={{ color: errorCount ? 'var(--error)' : undefined }}>{loading ? '-' : errorCount}</div></div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : sources.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz kaynak yok. &quot;+ Yeni Kaynak&quot; ile ekleyin.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Kaynak</th>
                <th>Tür</th>
                <th>Güven</th>
                <th>Sağlık</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} style={{ opacity: s.enabled ? 1 : 0.55 }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.feedUrl}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <span className="badge badge-primary">{TYPE_LABEL[s.type] || s.type}</span>
                      <span className={`badge ${SOURCE_TYPE_BADGE[s.sourceType] || 'badge-info'}`}>{SOURCE_TYPE_LABEL[s.sourceType] || s.sourceType}</span>
                      {s.needsUA && <span className="badge badge-warning" title="Tarayıcı User-Agent gerektirir">UA</span>}
                    </div>
                    {s.district && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>📍 {s.district}</div>}
                  </td>
                  <td><span className={`badge ${trustBadge(s.trustScore)}`}>{s.trustScore}</span></td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>
                    <div>🕓 {fmtDate(s.lastFetchedAt)}</div>
                    {s.lastItemCount !== null && <div style={{ color: 'var(--text-muted)' }}>{s.lastItemCount} öğe</div>}
                    {s.lastError && <div style={{ color: 'var(--error)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.lastError}>⚠️ {s.lastError}</div>}
                  </td>
                  <td>
                    <button className={`badge ${s.enabled ? 'badge-success' : 'badge-error'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleEnabled(s)} title={s.enabled ? 'Pasifleştir' : 'Etkinleştir'}>
                      {s.enabled ? 'Etkin' : 'Pasif'}
                    </button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" title="Şimdi Test Et" onClick={() => runTest(s)}>🧪 Test</button>
                    <button className="btn btn-ghost btn-sm" title="Düzenle" onClick={() => openEdit(s)}>✏️</button>
                    <button className="btn btn-ghost btn-sm" title="Sil" onClick={() => handleDelete(s)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Yeni kaynak ── */}
      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">Yeni Kaynak Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <SourceFormFields form={addForm} setForm={setAddForm} />
              {err && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreate}>Kaynağı Ekle</button>
            </div>
          </div>
        </>
      )}

      {/* ── Kaynak düzenle ── */}
      {editing && (
        <>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">Düzenle — {editing.name}</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <SourceFormFields form={editForm} setForm={setEditForm} />
              {err && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* ── Test sonucu ── */}
      {testTarget && (
        <>
          <div className="modal-backdrop" onClick={() => { setTestTarget(null); setTestResult(null); }}></div>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">🧪 Test — {testTarget.name}</h2>
              <button className="modal-close" onClick={() => { setTestTarget(null); setTestResult(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {testBusy ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Feed çekiliyor…</div>
              ) : testResult ? (
                testResult.ok ? (
                  <div>
                    <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(0,184,148,0.12)', color: 'var(--success)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                      ✓ {testResult.count} öğe çekildi. İlk {Math.min(5, testResult.items.length)} başlık:
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {testResult.items.map((it, i) => (
                        <li key={i}>
                          <a href={it.link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)' }}>{it.title}</a>
                          {it.pubDate && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>· {new Date(it.pubDate).toLocaleDateString('tr-TR')}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(255,118,117,0.12)', color: 'var(--error)', fontSize: 'var(--text-sm)' }}>
                    ⚠️ Feed çekilemedi: {testResult.error}
                  </div>
                )
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setTestTarget(null); setTestResult(null); }}>Kapat</button>
              {testTarget && <button className="btn btn-primary" disabled={testBusy} onClick={() => runTest(testTarget)}>Tekrar Dene</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Ortak form alanları (yeni + düzenle). */
function SourceFormFields({ form, setForm }: { form: SourceForm; setForm: (f: SourceForm) => void }) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Kaynak Adı *</label>
        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Çanakkale Olay" />
      </div>
      <div className="form-group">
        <label className="form-label">Feed Adresi (RSS / Google News) *</label>
        <input className="form-input" value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} placeholder="https://ornek.com/rss" />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Feed Türü</label>
          <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="rss">RSS</option>
            <option value="google_news">Google News</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Kaynak Türü</label>
          <select className="form-select" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}>
            <option value="official">Resmi (valilik/belediye)</option>
            <option value="local">Yerel haber</option>
            <option value="aggregator">Agregatör</option>
            <option value="social">Sosyal medya</option>
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">İlçe (opsiyonel)</label>
          <select className="form-select" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
            <option value="">— Genel / İl geneli —</option>
            {DISTRICTS.map((d) => <option key={d.slug} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Güven Skoru: <strong>{form.trustScore}</strong></label>
          <input type="range" min={0} max={100} step={5} value={form.trustScore} onChange={(e) => setForm({ ...form, trustScore: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.needsUA} onChange={(e) => setForm({ ...form, needsUA: e.target.checked })} />
          Tarayıcı User-Agent gerekir (WAF)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Etkin
        </label>
      </div>
      <div className="form-group">
        <label className="form-label">Not (opsiyonel)</label>
        <input className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Kapsam / güvenilirlik notu" />
      </div>
    </>
  );
}
