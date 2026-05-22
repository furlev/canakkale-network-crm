'use client';

import { useEffect, useState, useRef } from 'react';

/* ───────── SAMPLE DATA ───────── */
const STATS = [
  { label: 'Toplam Gelir', value: 284500, prefix: '₺', suffix: '', change: 12.5, up: true, color: 'primary', icon: '💰' },
  { label: 'Aktif Müşteri', value: 142, prefix: '', suffix: '', change: 8.3, up: true, color: 'accent', icon: '👥' },
  { label: 'Aktif Proje', value: 38, prefix: '', suffix: '', change: 2.1, up: false, color: 'success', icon: '📁' },
  { label: 'Haber İhbarı', value: 12, prefix: '', suffix: '', change: 24, up: true, color: 'warning', icon: '🔔' },
];

const REVENUE_DATA = [
  { month: 'Haz', value: 18500 },
  { month: 'Tem', value: 22000 },
  { month: 'Ağu', value: 19800 },
  { month: 'Eyl', value: 24200 },
  { month: 'Eki', value: 28000 },
  { month: 'Kas', value: 25500 },
  { month: 'Ara', value: 31000 },
  { month: 'Oca', value: 27800 },
  { month: 'Şub', value: 23400 },
  { month: 'Mar', value: 29600 },
  { month: 'Nis', value: 32100 },
  { month: 'May', value: 34500 },
];

const ACTIVITIES = [
  { text: 'Yeni ihbar alındı - Çanakkale Boğazı', time: '10 dk önce', dot: 'warning', emoji: '⚠️' },
  { text: 'Fatura #1042 ödendi - ₺12,500', time: '25 dk önce', dot: 'success', emoji: '✅' },
  { text: 'Proje güncellendi - Tanıtım Kampanyası', time: '1 saat önce', dot: 'primary', emoji: '📝' },
  { text: 'Yeni müşteri eklendi - ABC Medya', time: '2 saat önce', dot: 'accent', emoji: '🤝' },
  { text: 'Görev tamamlandı - Site Bakımı', time: '3 saat önce', dot: 'success', emoji: '✅' },
];

const TASKS = [
  { name: 'Web Sitesi Yenileme', progress: 75, color: 'primary' },
  { name: 'Sosyal Medya Kampanyası', progress: 45, color: 'accent' },
  { name: 'İçerik Planlaması', progress: 90, color: 'success' },
  { name: 'Müşteri Toplantısı', progress: 20, color: 'warning' },
];

const NEWS = [
  { title: 'Çanakkale\'de Turizm Sezonu Erken Başladı', time: '2 saat önce', views: '1.2K' },
  { title: 'Belediye Yeni Projeleri Açıkladı', time: '5 saat önce', views: '890' },
  { title: 'Tarım Sektöründe Rekor Üretim', time: '8 saat önce', views: '654' },
  { title: 'Eğitimde Dijital Dönüşüm', time: '12 saat önce', views: '432' },
  { title: 'Spor Tesisleri Yenileniyor', time: '1 gün önce', views: '321' },
];

const IHBAR_STATS = [
  { label: 'Yeni', value: 12, color: '#6c5ce7' },
  { label: 'İnceleniyor', value: 8, color: '#00cec9' },
  { label: 'Tamamlandı', value: 24, color: '#00b894' },
];

/* ───────── helpers ───────── */
function formatNumber(n: number, prefix = '') {
  if (prefix === '₺') {
    return `₺${n.toLocaleString('tr-TR')}`;
  }
  return `${prefix}${n.toLocaleString('tr-TR')}`;
}

/* ───────── COMPONENT ───────── */
export default function DashboardPage() {
  const [counters, setCounters] = useState(STATS.map(() => 0));
  const [mounted, setMounted] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  /* Animated counters */
  useEffect(() => {
    setMounted(true);
    const duration = 1600; // ms
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setCounters(STATS.map((s) => Math.round(s.value * ease)));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* Revenue chart helpers */
  const maxRevenue = Math.max(...REVENUE_DATA.map((d) => d.value));

  /* Donut chart: conic-gradient */
  const ihbarTotal = IHBAR_STATS.reduce((a, b) => a + b.value, 0);
  const ihbarAngles: number[] = [];
  let cumAngle = 0;
  IHBAR_STATS.forEach((s) => {
    ihbarAngles.push(cumAngle);
    cumAngle += (s.value / ihbarTotal) * 360;
  });
  const conicStops = IHBAR_STATS.map((s, i) => {
    const startDeg = ihbarAngles[i];
    const endDeg = i < IHBAR_STATS.length - 1 ? ihbarAngles[i + 1] : 360;
    return `${s.color} ${startDeg}deg ${endDeg}deg`;
  }).join(', ');

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
          <button className="btn btn-ghost">
            <span>📅</span> Bu Ay
          </button>
          <button className="btn btn-primary">
            <span>➕</span> Yeni Kayıt
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid stagger-children">
        {STATS.map((stat, idx) => (
          <div className={`stat-card ${stat.color}`} key={stat.label}>
            <div className="stat-card-top">
              <div className="stat-card-icon">
                <span>{stat.icon}</span>
              </div>
              <div className={`stat-card-change ${stat.up ? 'up' : 'down'}`}>
                <span>{stat.up ? '▲' : '▼'}</span>
                {stat.change}%
              </div>
            </div>
            <div className="stat-card-value counter-animate">
              {formatNumber(counters[idx], stat.prefix)}
            </div>
            <div className="stat-card-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Bento Grid ── */}
      <div className="bento-grid stagger-children">

        {/* ─ a) Revenue Chart (span 2) ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <div>
              <h3 className="card-title">Aylık Gelir</h3>
              <p className="card-subtitle">Son 12 ay gelir grafiği</p>
            </div>
            <span className="badge badge-primary">₺284,500</span>
          </div>
          <div className="chart-container">
            <div className="chart-bar-group" style={{ height: 220 }}>
              {REVENUE_DATA.map((d, i) => {
                const pct = (d.value / maxRevenue) * 100;
                return (
                  <div className="chart-bar-wrapper" key={d.month}>
                    <div
                      className={`chart-bar ${i === REVENUE_DATA.length - 1 ? 'accent' : 'primary'}`}
                      style={{
                        height: `${pct}%`,
                        animationDelay: `${i * 0.06}s`,
                      }}
                      title={`${d.month}: ₺${d.value.toLocaleString('tr-TR')}`}
                    />
                    <span className="chart-bar-label">{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─ b) Activity Timeline ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">Son Aktiviteler</h3>
            <button className="btn btn-ghost btn-sm">Tümünü Gör</button>
          </div>
          <div className="timeline stagger-children">
            {ACTIVITIES.map((act, i) => (
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
                  <span className="timeline-time">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ c) Tasks with progress ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">Yaklaşan Görevler</h3>
            <span className="badge badge-accent">{TASKS.length} Görev</span>
          </div>
          <div className="flex flex-col gap-4">
            {TASKS.map((task) => (
              <div key={task.name}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {task.name}
                  </span>
                  <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {task.progress}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${task.color}`}
                    style={{ width: mounted ? `${task.progress}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
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
              WordPress Son Haberler
            </h3>
            <button className="btn btn-ghost btn-sm">Siteye Git ↗</button>
          </div>
          <div className="flex flex-col gap-3" style={{ marginTop: 'var(--space-2)' }}>
            {NEWS.map((n, i) => (
              <div
                key={i}
                className="slide-up"
                style={{
                  display: 'flex',
                  gap: 'var(--space-4)',
                  alignItems: 'flex-start',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  animationDelay: `${i * 0.07}s`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-hover)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-1)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)';
                }}
              >
                {/* Number badge */}
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
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      🕐 {n.time}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      👁 {n.views} görüntülenme
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ e) Donut Stats ─ */}
        <div className="card bento-span-2">
          <div className="card-header">
            <h3 className="card-title">Hızlı İstatistikler</h3>
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
                {/* Inner cutout */}
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
              {IHBAR_STATS.map((s) => (
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
                          width: mounted ? `${(s.value / ihbarTotal) * 100}%` : '0%',
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
              {Math.round((24 / ihbarTotal) * 100)}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
