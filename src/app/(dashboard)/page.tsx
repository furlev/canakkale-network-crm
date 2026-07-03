'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

/* ───────── Types ───────── */
type DashboardData = {
  stats: {
    totalRevenue: number;
    activeClients: number;
    activeProjects: number;
    newTips: number;
  };
  revenueByMonth: { month: string; value: number }[];
  tipStats: { new: number; investigating: number; completed: number };
  activities: { text: string; date: string; dot: string; emoji: string }[];
  upcomingTasks: { id: string; title: string; status: string; priority: string; dueDate?: string | null; project?: string | null }[];
  latestNews: { id: string; title: string; views: number; publishDate?: string | null }[];
};

const TASK_PROGRESS: Record<string, { pct: number; color: string }> = {
  todo: { pct: 10, color: 'warning' },
  in_progress: { pct: 50, color: 'primary' },
  review: { pct: 80, color: 'accent' },
  done: { pct: 100, color: 'success' },
};

/* ───────── helpers ───────── */
function formatNumber(n: number, prefix = '') {
  if (prefix === '₺') {
    return `₺${n.toLocaleString('tr-TR')}`;
  }
  return `${prefix}${n.toLocaleString('tr-TR')}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

/* ───────── COMPONENT ───────── */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState([0, 0, 0, 0]);
  const [mounted, setMounted] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch('/api/dashboard')
      .then(res => (res.ok ? res.json() : null))
      .then((d: DashboardData | null) => {
        setLoading(false);
        if (!d || !d.stats) return;
        setData(d);

        /* Animated counters */
        const targets = [d.stats.totalRevenue, d.stats.activeClients, d.stats.activeProjects, d.stats.newTips];
        const duration = 1600;
        const start = performance.now();

        function tick(now: number) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setCounters(targets.map(t => Math.round(t * ease)));
          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(tick);
          }
        }
        animFrameRef.current = requestAnimationFrame(tick);
      })
      .catch(err => {
        console.error('Error fetching dashboard:', err);
        setLoading(false);
      });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const statCards = [
    { label: 'Toplam Gelir', prefix: '₺', color: 'primary', icon: '💰', href: '/invoices' },
    { label: 'Aktif Müşteri', prefix: '', color: 'accent', icon: '👥', href: '/clients' },
    { label: 'Aktif Proje', prefix: '', color: 'success', icon: '📁', href: '/projects' },
    { label: 'Yeni İhbar', prefix: '', color: 'warning', icon: '🔔', href: '/tips' },
  ];

  const revenueData = data?.revenueByMonth || [];
  const maxRevenue = Math.max(1, ...revenueData.map(d => d.value));

  /* Donut chart: conic-gradient */
  const ihbarStats = data
    ? [
        { label: 'Yeni', value: data.tipStats.new, color: '#6c5ce7' },
        { label: 'İnceleniyor', value: data.tipStats.investigating, color: '#00cec9' },
        { label: 'Tamamlandı', value: data.tipStats.completed, color: '#00b894' },
      ]
    : [];
  const ihbarTotal = ihbarStats.reduce((a, b) => a + b.value, 0);
  let cumAngle = 0;
  const conicStops = ihbarTotal > 0
    ? ihbarStats.map(s => {
        const startDeg = cumAngle;
        cumAngle += (s.value / ihbarTotal) * 360;
        return `${s.color} ${startDeg}deg ${cumAngle}deg`;
      }).join(', ')
    : 'var(--surface-3) 0deg 360deg';

  if (loading) {
    return (
      <div className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title"><span style={{ fontSize: '1.6rem' }}>📊</span> Dashboard</h1>
            <p className="page-subtitle">Çanakkale Network CRM — Genel Bakış</p>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ animation: mounted ? undefined : 'none' }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span style={{ fontSize: '1.6rem' }}>📊</span>
            Dashboard
          </h1>
          <p className="page-subtitle">Çanakkale Network CRM — Genel Bakış</p>
        </div>
        <div className="page-header-actions">
          <Link href="/reports" className="btn btn-ghost">
            <span>📈</span> Raporlar
          </Link>
          <Link href="/tips" className="btn btn-primary">
            <span>🔔</span> İhbarlar
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid stagger-children">
        {statCards.map((stat, idx) => (
          <Link href={stat.href} className={`stat-card ${stat.color}`} key={stat.label} style={{ textDecoration: 'none' }}>
            <div className="stat-card-top">
              <div className="stat-card-icon">
                <span>{stat.icon}</span>
              </div>
            </div>
            <div className="stat-card-value counter-animate">
              {formatNumber(counters[idx], stat.prefix)}
            </div>
            <div className="stat-card-label">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* ── Bento Grid ── */}
      <div className="bento-grid stagger-children">

        {/* ─ a) Revenue Chart (span 2) ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <div>
              <h3 className="card-title">Aylık Gelir</h3>
              <p className="card-subtitle">Son 12 ay — ödenen faturalar</p>
            </div>
            <span className="badge badge-primary">{formatNumber(data?.stats.totalRevenue || 0, '₺')}</span>
          </div>
          <div className="chart-container">
            {revenueData.every(d => d.value === 0) ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Henüz ödenmiş fatura yok. <Link href="/invoices" style={{ marginLeft: 6, color: 'var(--primary-light)' }}>Fatura ekle →</Link>
              </div>
            ) : (
              <div className="chart-bar-group" style={{ height: 220 }}>
                {revenueData.map((d, i) => {
                  const pct = (d.value / maxRevenue) * 100;
                  return (
                    <div className="chart-bar-wrapper" key={i}>
                      <div
                        className={`chart-bar ${i === revenueData.length - 1 ? 'accent' : 'primary'}`}
                        style={{
                          height: `${Math.max(pct, 2)}%`,
                          animationDelay: `${i * 0.06}s`,
                        }}
                        title={`${d.month}: ₺${d.value.toLocaleString('tr-TR')}`}
                      />
                      <span className="chart-bar-label">{d.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─ b) Activity Timeline ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">Son Aktiviteler</h3>
          </div>
          {(data?.activities.length || 0) === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Henüz aktivite yok.</div>
          ) : (
            <div className="timeline stagger-children">
              {data!.activities.map((act, i) => (
                <div
                  className="timeline-item"
                  key={i}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className={`timeline-dot ${act.dot}`}>
                    <span>{act.emoji}</span>
                  </div>
                  <div className="timeline-content">
                    <p className="timeline-title">{act.text}</p>
                    <span className="timeline-time">{timeAgo(act.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─ c) Tasks with progress ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">Yaklaşan Görevler</h3>
            <span className="badge badge-accent">{data?.upcomingTasks.length || 0} Görev</span>
          </div>
          {(data?.upcomingTasks.length || 0) === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Bekleyen görev yok. <Link href="/tasks" style={{ color: 'var(--primary-light)' }}>Görev ekle →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {data!.upcomingTasks.map(task => {
                const prog = TASK_PROGRESS[task.status] || TASK_PROGRESS.todo;
                return (
                  <div key={task.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {task.title}
                        {task.project && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {task.project}</span>}
                      </span>
                      <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('tr-TR') : '%' + prog.pct}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-bar-fill ${prog.color}`}
                        style={{ width: mounted ? `${prog.pct}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─ d) WordPress News ─ */}
        <div className="card bento-span-2 bento-row-2">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--border-radius-sm)',
                background: 'rgba(0,206,201,0.12)',
                fontSize: '0.9rem',
              }}>📰</span>
              Son Yayınlanan Haberler
            </h3>
            <Link href="/news" className="btn btn-ghost btn-sm">Tümü →</Link>
          </div>
          {(data?.latestNews.length || 0) === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Yayınlanmış haber yok. <Link href="/news" style={{ color: 'var(--primary-light)' }}>Haber ekle →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3" style={{ marginTop: 'var(--space-2)' }}>
              {data!.latestNews.map((n, i) => (
                <div
                  key={n.id}
                  className="slide-up"
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    alignItems: 'flex-start',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-subtle)',
                    animationDelay: `${i * 0.07}s`,
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--border-radius-sm)',
                    background: i === 0 ? 'var(--accent-gradient)' : 'var(--surface-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: i === 0 ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="truncate" style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-3" style={{ marginTop: 'var(--space-1)' }}>
                      {n.publishDate && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          🕐 {timeAgo(n.publishDate)}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        👁 {n.views.toLocaleString('tr-TR')} görüntülenme
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─ e) Donut Stats ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">İhbar İstatistikleri</h3>
            <span className="badge badge-warning">{ihbarTotal} İhbar</span>
          </div>

          <div className="flex items-center gap-6" style={{ marginTop: 'var(--space-4)' }}>
            {/* Donut */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: `conic-gradient(${conicStops})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'scaleIn 0.6s ease-out',
                  boxShadow: '0 0 30px rgba(108,92,231,0.12)',
                }}
              >
                <div style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
                }}>
                  <span className="font-mono font-bold" style={{
                    fontSize: 'var(--text-2xl)',
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}>
                    {ihbarTotal}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}>
                    Toplam
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-4" style={{ flex: 1 }}>
              {ihbarStats.map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: s.color,
                    boxShadow: `0 0 8px ${s.color}40`,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {s.label}
                      </span>
                      <span className="font-mono font-semibold" style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                      }}>
                        {s.value}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ marginTop: 'var(--space-2)', height: 4 }}>
                      <div
                        style={{
                          height: '100%',
                          width: mounted && ihbarTotal > 0 ? `${(s.value / ihbarTotal) * 100}%` : '0%',
                          borderRadius: 'var(--border-radius-full)',
                          background: s.color,
                          transition: 'width 1.2s ease-out',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick summary row */}
          <div className="flex items-center justify-between" style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--surface-1)',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Tamamlanma Oranı
            </span>
            <span className="font-mono font-bold" style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--success)',
            }}>
              {ihbarTotal > 0 ? Math.round(((data?.tipStats.completed || 0) / ihbarTotal) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
