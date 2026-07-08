'use client';
import { useState, useEffect } from 'react';

type Perf = {
  id: string; name: string; title?: string | null; role: string; department?: string | null;
  tasksDone: number; tasksTotal: number; newsCount: number; newsViews: number; tipsConverted: number;
  siteArticles: number; siteViews: number; breakingCount: number; draftsApproved: number;
  totalReads: number; weeklyTrend: number[];
};

/** Küçük haftalık trend sütun grafiği (SVG). */
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const n = data.length || 1;
  const gap = 2;
  const bw = (44 - gap * (n - 1)) / n;
  return (
    <svg width={44} height={20} style={{ display: 'block' }} aria-hidden>
      {data.map((v, i) => {
        const h = Math.max(1, (v / max) * 18);
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={20 - h}
            width={bw}
            height={h}
            rx={1}
            fill={i === n - 1 ? 'var(--primary)' : 'var(--primary-light)'}
            opacity={i === n - 1 ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

export default function EditorPerformancePage() {
  const [rows, setRows] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState<keyof Perf>('totalReads');

  useEffect(() => {
    fetch('/api/editor-performance')
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error || 'Bu panele erişim yetkiniz yok');
        }
        return r.json();
      })
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rows].sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
  const totSite = rows.reduce((s, r) => s + r.siteArticles, 0);
  const totReads = rows.reduce((s, r) => s + r.totalReads, 0);
  const totDrafts = rows.reduce((s, r) => s + r.draftsApproved, 0);
  const totBreaking = rows.reduce((s, r) => s + r.breakingCount, 0);
  const maxReads = Math.max(1, ...rows.map((r) => r.totalReads));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📊 Editör Verimlilik</h1>
          <p className="page-subtitle">Site haberleri, okunma, görev ve ihbar performansı</p>
        </div>
      </div>

      {err ? (
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--error)' }}>🔒 {err}</div>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="stat-card">
              <div className="stat-card-label">Site Haberi</div>
              <div className="stat-card-value">{loading ? '-' : totSite}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--primary)' }}>
              <div className="stat-card-label">Toplam Okunma</div>
              <div className="stat-card-value" style={{ color: 'var(--primary-light)' }}>{loading ? '-' : totReads.toLocaleString('tr-TR')}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--warning)' }}>
              <div className="stat-card-label">Son Dakika</div>
              <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{loading ? '-' : totBreaking}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--success)' }}>
              <div className="stat-card-label">Onaylanan Taslak</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : totDrafts}</div>
            </div>
          </div>

          <div className="data-table-container">
            {loading ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Ekip üyesi bulunamadı.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Personel</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('siteArticles')}>Site Haberi</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('totalReads')}>Okunma ▾</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('breakingCount')}>Son Dakika</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('draftsApproved')}>Onay</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('tasksDone')}>Görev (Bitti/Toplam)</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('tipsConverted')}>İhbar→Haber</th>
                    <th>Haftalık Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div className="avatar avatar-sm">{r.name.substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.name}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.title || (r.role === 'editor' ? 'Editör' : 'Üye')}</div>
                          </div>
                        </div>
                      </td>
                      <td><strong>{r.siteArticles}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ flex: 1, maxWidth: 120, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${(r.totalReads / maxReads) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                          </div>
                          <strong>{r.totalReads.toLocaleString('tr-TR')}</strong>
                        </div>
                      </td>
                      <td>{r.breakingCount > 0 ? <span className="badge badge-warning">{r.breakingCount}</span> : '-'}</td>
                      <td>{r.draftsApproved}</td>
                      <td>{r.tasksDone} / {r.tasksTotal}</td>
                      <td>{r.tipsConverted}</td>
                      <td><Sparkline data={r.weeklyTrend} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
