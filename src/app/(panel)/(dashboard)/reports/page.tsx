'use client';
import { useState, useEffect } from 'react';

type ReportData = {
  summary: {
    totalRevenue: number;
    unpaidTotal: number;
    totalExpenses: number;
    netIncome: number;
    activeClients: number;
    totalClients: number;
    completedProjects: number;
    tipConversion: number;
  };
  monthly: { month: string; revenue: number; expense: number }[];
  topClients: { name: string; revenue: number; projects: number; satisfaction: number }[];
  projectStatus: { active: number; completed: number; on_hold: number };
  projects: { id: string; name: string; status: string; progress: number; client?: string | null; deadline?: string | null }[];
  tipStatus: { new: number; investigating: number; verified: number; converted: number; rejected: number };
  totalTips: number;
  leadStatus: { new: number; contacted: number; proposal: number; won: number; lost: number };
  pipelineValue: number;
  expensesByCategory: Record<string, number>;
  invoiceStatus: { paid: number; unpaid: number; overdue: number; cancelled: number };
};

const fmt = (n: number) => `₺${n.toLocaleString('tr-TR')}`;

function Donut({ items, total }: { items: { l: string; v: number; c: string }[]; total: number }) {
  let cum = 0;
  const conicStr = total > 0
    ? items.map(p => { const start = cum; cum += (p.v / total) * 100; return `${p.c} ${start}% ${cum}%`; }).join(', ')
    : 'var(--surface-3) 0% 100%';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
      <div style={{ width: 140, height: 140, borderRadius: '50%', background: `conic-gradient(${conicStr})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{total}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {items.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: p.c }} />
            <span style={{ fontSize: 'var(--text-sm)' }}>{p.l}: <strong>{p.v}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="chart-bar-group" style={{ height: 180 }}>
      {data.map((d, i) => (
        <div key={i} className="chart-bar-wrapper">
          <div className={`chart-bar ${color || 'primary'}`} style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, animationDelay: `${i * 0.1}s` }} title={fmt(d.value)} />
          <span className="chart-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<ReportData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tabs = [{ k: 'overview', l: 'Genel Bakış' }, { k: 'revenue', l: 'Gelir' }, { k: 'client', l: 'Müşteri' }, { k: 'project', l: 'Proje' }, { k: 'tips', l: 'İhbar' }];

  useEffect(() => {
    fetch('/api/reports')
      .then(async res => {
        const d = await res.json().catch(() => null);
        if (!res.ok || !d || typeof d !== 'object' || !d.summary || !d.projectStatus) {
          setErr('Rapor verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.');
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(err => { console.error('Error fetching reports:', err); setErr('Rapor verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.'); setLoading(false); });
  }, []);

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-rapor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (err) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">📈 Raporlar</h1>
            <p className="page-subtitle">Detaylı analizler ve raporlar</p>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>{err}</div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">📈 Raporlar</h1>
            <p className="page-subtitle">Detaylı analizler ve raporlar</p>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      </div>
    );
  }

  const { summary } = data;
  const totalProj = data.projectStatus.active + data.projectStatus.completed + data.projectStatus.on_hold;
  const maxClientRevenue = Math.max(1, ...data.topClients.map(c => c.revenue));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📈 Raporlar</h1>
          <p className="page-subtitle">Detaylı analizler ve raporlar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={handleExport}>📤 Dışa Aktar</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => <button key={t.k} className={`tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>{t.l}</button>)}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            {[
              { l: 'Toplam Gelir', v: fmt(summary.totalRevenue), c: 'primary', i: '💰' },
              { l: 'Aktif Müşteri', v: String(summary.activeClients), c: 'accent', i: '👥' },
              { l: 'Tamamlanan Proje', v: String(summary.completedProjects), c: 'success', i: '✅' },
              { l: 'İhbar Dönüşüm', v: `%${summary.tipConversion}`, c: 'warning', i: '📰' },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value">{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Aylık Gelir</h3>
              <BarChart data={data.monthly.map(m => ({ label: m.month, value: m.revenue }))} />
            </div>

            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Proje Durumu</h3>
              <Donut
                total={totalProj}
                items={[
                  { l: 'Aktif', v: data.projectStatus.active, c: '#6c5ce7' },
                  { l: 'Tamamlanan', v: data.projectStatus.completed, c: '#00b894' },
                  { l: 'Bekleyen', v: data.projectStatus.on_hold, c: '#fdcb6e' },
                ]}
              />
            </div>
          </div>

          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>En İyi 5 Müşteri (Gelire Göre)</h3>
            {data.topClients.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz ödenmiş fatura verisi yok.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>Müşteri</th><th>Gelir</th><th>Projeler</th><th>Oran</th></tr></thead>
                <tbody>
                  {data.topClients.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><span className="font-mono" style={{ color: 'var(--primary-light)' }}>{fmt(c.revenue)}</span></td>
                      <td>{c.projects} proje</td>
                      <td style={{ width: 200 }}>
                        <div className="progress-bar"><div className="progress-bar-fill primary" style={{ width: `${(c.revenue / maxClientRevenue) * 100}%` }} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'revenue' && (
        <>
          <div className="stats-grid">
            {[
              { l: 'Tahsil Edilen', v: fmt(summary.totalRevenue), c: 'success', i: '✅' },
              { l: 'Bekleyen Tahsilat', v: fmt(summary.unpaidTotal), c: 'warning', i: '⏳' },
              { l: 'Toplam Gider', v: fmt(summary.totalExpenses), c: 'error', i: '💸' },
              { l: 'Net Gelir', v: fmt(summary.netIncome), c: 'primary', i: '💰' },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value" style={{ fontSize: 'var(--text-2xl)' }}>{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Aylık Gelir</h3>
              <BarChart data={data.monthly.map(m => ({ label: m.month, value: m.revenue }))} />
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Aylık Gider</h3>
              <BarChart data={data.monthly.map(m => ({ label: m.month, value: m.expense }))} color="accent" />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Fatura Durumu</h3>
              <Donut
                total={data.invoiceStatus.paid + data.invoiceStatus.unpaid + data.invoiceStatus.overdue + data.invoiceStatus.cancelled}
                items={[
                  { l: 'Ödendi', v: data.invoiceStatus.paid, c: '#00b894' },
                  { l: 'Ödenmedi', v: data.invoiceStatus.unpaid, c: '#fdcb6e' },
                  { l: 'Gecikmiş', v: data.invoiceStatus.overdue, c: '#ff7675' },
                  { l: 'İptal', v: data.invoiceStatus.cancelled, c: '#636e72' },
                ]}
              />
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Gider Kategorileri</h3>
              {Object.keys(data.expensesByCategory).length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Gider kaydı yok.</div>
              ) : (
                Object.entries(data.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount], i) => {
                  const maxExp = Math.max(...Object.values(data.expensesByCategory));
                  return (
                    <div key={i} style={{ marginBottom: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--text-sm)' }}>{cat}</span>
                        <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-light)' }}>{fmt(amount)}</span>
                      </div>
                      <div className="progress-bar"><div className="progress-bar-fill accent" style={{ width: `${(amount / maxExp) * 100}%` }} /></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'client' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { l: 'Toplam Müşteri', v: String(summary.totalClients), c: 'primary', i: '👥' },
              { l: 'Aktif Müşteri', v: String(summary.activeClients), c: 'success', i: '✅' },
              { l: 'Pipeline Değeri', v: fmt(data.pipelineValue), c: 'accent', i: '🎯' },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value" style={{ fontSize: 'var(--text-2xl)' }}>{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Müşteri Gelir Sıralaması</h3>
              {data.topClients.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Veri yok.</div>
              ) : (
                data.topClients.map((c, i) => (
                  <div key={i} style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{c.name}</span>
                      <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-light)' }}>{fmt(c.revenue)}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-bar-fill primary" style={{ width: `${(c.revenue / maxClientRevenue) * 100}%` }} /></div>
                  </div>
                ))
              )}
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Lead Hunisi</h3>
              <Donut
                total={data.leadStatus.new + data.leadStatus.contacted + data.leadStatus.proposal + data.leadStatus.won + data.leadStatus.lost}
                items={[
                  { l: 'Yeni', v: data.leadStatus.new, c: '#6c5ce7' },
                  { l: 'İletişimde', v: data.leadStatus.contacted, c: '#74b9ff' },
                  { l: 'Teklif', v: data.leadStatus.proposal, c: '#fdcb6e' },
                  { l: 'Kazanıldı', v: data.leadStatus.won, c: '#00b894' },
                  { l: 'Kaybedildi', v: data.leadStatus.lost, c: '#ff7675' },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {tab === 'project' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { l: 'Aktif Proje', v: String(data.projectStatus.active), c: 'primary', i: '📁' },
              { l: 'Tamamlanan', v: String(data.projectStatus.completed), c: 'success', i: '✅' },
              { l: 'Bekleyen', v: String(data.projectStatus.on_hold), c: 'warning', i: '⏸️' },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value" style={{ fontSize: 'var(--text-2xl)' }}>{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Tüm Projeler</h3>
            {data.projects.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz proje yok.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Proje</th><th>Müşteri</th><th>Durum</th><th>Teslim</th><th>İlerleme</th></tr></thead>
                <tbody>
                  {data.projects.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.client || '-'}</td>
                      <td>
                        <span className={`badge ${p.status === 'active' ? 'badge-info' : p.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Tamamlandı' : 'Beklemede'}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{p.deadline ? new Date(p.deadline).toLocaleDateString('tr-TR') : '-'}</td>
                      <td style={{ width: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div className="progress-bar" style={{ flex: 1 }}><div className="progress-bar-fill primary" style={{ width: `${p.progress}%` }} /></div>
                          <span className="font-mono" style={{ fontSize: 'var(--text-xs)' }}>{p.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'tips' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { l: 'Toplam İhbar', v: String(data.totalTips), c: 'primary', i: '🔔' },
              { l: 'Habere Dönüşen', v: String(data.tipStatus.converted), c: 'success', i: '📰' },
              { l: 'Dönüşüm Oranı', v: `%${summary.tipConversion}`, c: 'accent', i: '📊' },
            ].map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value" style={{ fontSize: 'var(--text-2xl)' }}>{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>İhbar Durum Dağılımı</h3>
            <Donut
              total={data.totalTips}
              items={[
                { l: 'Yeni', v: data.tipStatus.new, c: '#6c5ce7' },
                { l: 'İnceleniyor', v: data.tipStatus.investigating, c: '#00cec9' },
                { l: 'Doğrulandı', v: data.tipStatus.verified, c: '#74b9ff' },
                { l: 'Habere Dönüştü', v: data.tipStatus.converted, c: '#00b894' },
                { l: 'Reddedildi', v: data.tipStatus.rejected, c: '#ff7675' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
