'use client';
import { useState, useEffect } from 'react';

type Perf = {
  id: string; name: string; title?: string | null; role: string; department?: string | null;
  tasksDone: number; tasksTotal: number; newsCount: number; newsViews: number; tipsConverted: number;
};

export default function EditorPerformancePage() {
  const [rows, setRows] = useState<Perf[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState<keyof Perf>('newsCount');

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
  const totNews = rows.reduce((s, r) => s + r.newsCount, 0);
  const totTasks = rows.reduce((s, r) => s + r.tasksDone, 0);
  const totViews = rows.reduce((s, r) => s + r.newsViews, 0);
  const maxNews = Math.max(1, ...rows.map((r) => r.newsCount));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📊 Editör Verimlilik</h1>
          <p className="page-subtitle">Ekip üyelerinin haber, görev ve ihbar performansı</p>
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
              <div className="stat-card-label">Toplam Haber</div>
              <div className="stat-card-value">{loading ? '-' : totNews}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Tamamlanan Görev</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : totTasks}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Toplam Görüntülenme</div>
              <div className="stat-card-value" style={{ color: 'var(--primary-light)' }}>{loading ? '-' : totViews.toLocaleString('tr-TR')}</div>
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
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('newsCount')}>Haber ▾</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('newsViews')}>Görüntülenme</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('tasksDone')}>Görev (Bitti/Toplam)</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setSortBy('tipsConverted')}>İhbar→Haber</th>
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
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ flex: 1, maxWidth: 120, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${(r.newsCount / maxNews) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                          </div>
                          <strong>{r.newsCount}</strong>
                        </div>
                      </td>
                      <td>{r.newsViews.toLocaleString('tr-TR')}</td>
                      <td>{r.tasksDone} / {r.tasksTotal}</td>
                      <td>{r.tipsConverted}</td>
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
