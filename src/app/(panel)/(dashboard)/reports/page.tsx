'use client';
import { useState, useEffect } from 'react';
import { StackedBar, LineChart, Donut, formatTry, formatCompact } from '@/components/charts';
import ReportExport from '@/components/ReportExport';

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
  const months = data.monthly.map(m => m.month);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📈 Raporlar</h1>
          <p className="page-subtitle">Detaylı analizler ve raporlar</p>
        </div>
        <div className="page-header-actions">
          <ReportExport />
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
              <StackedBar
                categories={months}
                series={[{ name: 'Gelir', color: 'var(--primary)', values: data.monthly.map(m => m.revenue) }]}
                formatValue={formatTry}
                formatAxis={formatCompact}
                height={220}
              />
            </div>

            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Proje Durumu</h3>
              <Donut
                centerLabel="Proje"
                segments={[
                  { label: 'Aktif', value: data.projectStatus.active, color: 'var(--primary)' },
                  { label: 'Tamamlanan', value: data.projectStatus.completed, color: 'var(--success)' },
                  { label: 'Bekleyen', value: data.projectStatus.on_hold, color: 'var(--warning)' },
                ]}
              />
              <div className="text-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)', textAlign: 'center' }}>Toplam {totalProj} proje</div>
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
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Gelir vs Gider</h3>
              <StackedBar
                categories={months}
                stacked={false}
                formatValue={formatTry}
                formatAxis={formatCompact}
                height={230}
                series={[
                  { name: 'Gelir', color: 'var(--success)', values: data.monthly.map(m => m.revenue) },
                  { name: 'Gider', color: 'var(--error)', values: data.monthly.map(m => m.expense) },
                ]}
              />
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Nakit Akışı</h3>
              <LineChart
                formatValue={formatTry}
                formatAxis={formatCompact}
                height={230}
                series={[
                  { name: 'Gelir', color: 'var(--success)', points: data.monthly.map(m => ({ x: m.month, y: m.revenue })) },
                  { name: 'Gider', color: 'var(--error)', points: data.monthly.map(m => ({ x: m.month, y: m.expense })) },
                ]}
              />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Tahsilat Durumu (yaşlandırma)</h3>
              <Donut
                centerLabel="Fatura"
                segments={[
                  { label: 'Ödendi', value: data.invoiceStatus.paid, color: 'var(--success)' },
                  { label: 'Ödenmedi', value: data.invoiceStatus.unpaid, color: 'var(--warning)' },
                  { label: 'Gecikmiş', value: data.invoiceStatus.overdue, color: 'var(--error)' },
                  { label: 'İptal', value: data.invoiceStatus.cancelled, color: 'var(--text-muted)' },
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
                centerLabel="Lead"
                segments={[
                  { label: 'Yeni', value: data.leadStatus.new, color: 'var(--primary)' },
                  { label: 'İletişimde', value: data.leadStatus.contacted, color: 'var(--info)' },
                  { label: 'Teklif', value: data.leadStatus.proposal, color: 'var(--warning)' },
                  { label: 'Kazanıldı', value: data.leadStatus.won, color: 'var(--success)' },
                  { label: 'Kaybedildi', value: data.leadStatus.lost, color: 'var(--error)' },
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
              centerLabel="İhbar"
              segments={[
                { label: 'Yeni', value: data.tipStatus.new, color: 'var(--primary)' },
                { label: 'İnceleniyor', value: data.tipStatus.investigating, color: 'var(--accent)' },
                { label: 'Doğrulandı', value: data.tipStatus.verified, color: 'var(--info)' },
                { label: 'Habere Dönüştü', value: data.tipStatus.converted, color: 'var(--success)' },
                { label: 'Reddedildi', value: data.tipStatus.rejected, color: 'var(--error)' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
