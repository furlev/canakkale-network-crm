'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { levelOf, type AccessLevel } from '@/lib/permissions';
import { AreaChart, LineChart, Donut, formatTry, formatCompact, formatTr } from '@/components/charts';
import { SkeletonStats, SkeletonCard } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

/* ───────── Types ───────── */
type DashboardData = {
  stats: { totalRevenue: number; activeClients: number; activeProjects: number; newTips: number };
  revenueByMonth: { month: string; value: number }[];
  tipStats: { new: number; investigating: number; completed: number };
  upcomingTasks: { id: string; title: string; status: string; priority: string; dueDate?: string | null; project?: string | null }[];
};

type ReportsData = {
  summary: { unpaidTotal: number; totalExpenses: number; netIncome: number };
  monthly: { month: string; revenue: number; expense: number }[];
};

type Analytics = {
  totals: { views: number; reads: number; shares: number; outboundClicks: number };
  daily: { date: string; views: number }[];
};

const TASK_PROGRESS: Record<string, { pct: number; color: string }> = {
  todo: { pct: 10, color: 'warning' },
  in_progress: { pct: 50, color: 'primary' },
  review: { pct: 80, color: 'accent' },
  done: { pct: 100, color: 'success' },
};

/* ───────── Widget catalog ───────── */
const ALL_IDS = ['revenue', 'cashflow', 'pending', 'mytasks', 'aidrafts', 'newtips', 'sitetraffic'] as const;
type WidgetId = (typeof ALL_IDS)[number];

const WIDGET_META: Record<WidgetId, { title: string; span: 1 | 2 | 4; roles: AccessLevel[] }> = {
  revenue: { title: '💰 Aylık Gelir', span: 2, roles: ['A', 'B', 'C'] },
  cashflow: { title: '📊 Nakit Akışı', span: 2, roles: ['A', 'B'] },
  pending: { title: '⏳ Bekleyen Tahsilat', span: 1, roles: ['A', 'B'] },
  mytasks: { title: '✅ Bugünkü Görevlerim', span: 2, roles: ['A', 'B', 'C'] },
  aidrafts: { title: '🤖 Onay Bekleyen AI Taslak', span: 1, roles: ['A', 'B'] },
  newtips: { title: '🔔 İhbar Durumu', span: 1, roles: ['A', 'B', 'C'] },
  sitetraffic: { title: '🌐 Canlı Site Trafiği', span: 2, roles: ['A', 'B'] },
};

const LS_KEY = 'crm-dash-layout-v2';
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};

export default function DashboardPage() {
  const [level, setLevel] = useState<AccessLevel>('C');
  const [roleLoaded, setRoleLoaded] = useState(false);

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [aiPending, setAiPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [trafficRange, setTrafficRange] = useState(30);

  /* layout */
  const [order, setOrder] = useState<WidgetId[]>([...ALL_IDS]);
  const [hidden, setHidden] = useState<Set<WidgetId>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [dropInfo, setDropInfo] = useState<{ id: WidgetId; pos: 'before' | 'after' } | null>(null);

  /* role */
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setLevel(levelOf(u?.role)))
      .catch(() => {})
      .finally(() => setRoleLoaded(true));
  }, []);

  /* saved layout */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { order?: WidgetId[]; hidden?: WidgetId[] };
        if (Array.isArray(p.order)) setOrder(p.order.filter((id) => ALL_IDS.includes(id)));
        if (Array.isArray(p.hidden)) setHidden(new Set(p.hidden));
      }
    } catch { /* */ }
  }, []);

  const persist = (nextOrder: WidgetId[], nextHidden: Set<WidgetId>) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ order: nextOrder, hidden: [...nextHidden] }));
    } catch { /* */ }
  };

  /* data — after role known, fetch only what this level can access */
  useEffect(() => {
    if (!roleLoaded) return;
    const isBA = level === 'A' || level === 'B';
    setLoading(true);
    const jobs: Promise<void>[] = [
      fetch('/api/dashboard').then((r) => (r.ok ? r.json() : null)).then((d) => setDash(d)).catch(() => {}),
    ];
    if (isBA) {
      jobs.push(fetch('/api/reports').then((r) => (r.ok ? r.json() : null)).then((d) => setReports(d)).catch(() => {}));
      jobs.push(fetch('/api/ai/drafts?status=pending').then((r) => (r.ok ? r.json() : null)).then((d) => setAiPending(Array.isArray(d) ? d.length : 0)).catch(() => {}));
    }
    Promise.all(jobs).finally(() => setLoading(false));
  }, [roleLoaded, level]);

  /* analytics — depends on range */
  useEffect(() => {
    if (!roleLoaded) return;
    if (level !== 'A' && level !== 'B') return;
    fetch(`/api/site-admin/analytics?days=${trafficRange}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAnalytics(d))
      .catch(() => {});
  }, [roleLoaded, level, trafficRange]);

  /* visible widget order for this role */
  const renderOrder = useMemo(() => {
    const avail = ALL_IDS.filter((id) => WIDGET_META[id].roles.includes(level));
    const inOrder = order.filter((id) => avail.includes(id));
    const missing = avail.filter((id) => !inOrder.includes(id));
    return [...inOrder, ...missing];
  }, [order, level]);

  const visible = renderOrder.filter((id) => !hidden.has(id));

  /* DnD */
  const reorder = (from: WidgetId, to: WidgetId, pos: 'before' | 'after') => {
    setOrder((prev) => {
      const base = prev.length ? [...prev] : [...ALL_IDS];
      const arr = base.filter((x) => x !== from);
      const idx = arr.indexOf(to);
      arr.splice(pos === 'after' ? idx + 1 : idx, 0, from);
      persist(arr, hidden);
      return arr;
    });
  };
  const onDragOver = (e: React.DragEvent, id: WidgetId) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropInfo({ id, pos: e.clientX < rect.left + rect.width / 2 ? 'before' : 'after' });
  };
  const onDrop = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    if (dragId && dragId !== id) reorder(dragId, id, dropInfo?.pos || 'before');
    setDragId(null);
    setDropInfo(null);
  };

  const toggleHidden = (id: WidgetId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persist(order, next);
      return next;
    });
  };
  const resetLayout = () => {
    setOrder([...ALL_IDS]);
    setHidden(new Set());
    persist([...ALL_IDS], new Set());
    setSettingsOpen(false);
  };

  /* ───────── widget renderers ───────── */
  function renderWidget(id: WidgetId): React.ReactNode {
    switch (id) {
      case 'revenue': {
        const pts = (dash?.revenueByMonth || []).map((m) => ({ x: m.month, y: m.value }));
        const total = dash?.stats.totalRevenue || 0;
        return (
          <>
            <div className="dash-kpi">{formatTry(total)}</div>
            <div className="dash-kpi-sub">Son 12 ay — ödenen faturalar</div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              {pts.every((p) => p.y === 0) ? (
                <EmptyState compact icon="💳" title="Ödenmiş fatura yok" description="Fatura ödendiğinde burada görünür." actionLabel="Faturalar →" actionHref="/invoices" />
              ) : (
                <AreaChart series={[{ name: 'Gelir', color: 'var(--primary)', points: pts }]} height={190} formatValue={formatTry} formatAxis={formatCompact} ariaLabel="Aylık gelir grafiği" />
              )}
            </div>
          </>
        );
      }
      case 'cashflow': {
        const m = reports?.monthly || [];
        return (
          <>
            <div className="dash-kpi" style={{ color: (reports?.summary.netIncome || 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {formatTry(reports?.summary.netIncome || 0)}
            </div>
            <div className="dash-kpi-sub">Net gelir (gelir − gider)</div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              {m.length === 0 ? (
                <div className="chart-empty">Veri yok.</div>
              ) : (
                <LineChart
                  height={190}
                  formatValue={formatTry}
                  formatAxis={formatCompact}
                  ariaLabel="Nakit akışı grafiği"
                  series={[
                    { name: 'Gelir', color: 'var(--success)', points: m.map((r) => ({ x: r.month, y: r.revenue })) },
                    { name: 'Gider', color: 'var(--error)', points: m.map((r) => ({ x: r.month, y: r.expense })) },
                  ]}
                />
              )}
            </div>
          </>
        );
      }
      case 'pending':
        return (
          <>
            <div className="dash-kpi" style={{ color: 'var(--warning)' }}>{formatTry(reports?.summary.unpaidTotal || 0)}</div>
            <div className="dash-kpi-sub">Tahsil edilmemiş faturalar</div>
            <Link href="/invoices" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-4)' }}>Faturalar →</Link>
          </>
        );
      case 'mytasks': {
        const tasks = dash?.upcomingTasks || [];
        return tasks.length === 0 ? (
          <EmptyState compact icon="✅" title="Bekleyen görev yok" description="Görev eklendiğinde burada listelenir." actionLabel="Görevler →" actionHref="/tasks" />
        ) : (
          <div className="flex flex-col gap-4">
            {tasks.map((t) => {
              const prog = TASK_PROGRESS[t.status] || TASK_PROGRESS.todo;
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                      {t.title}
                      {t.project && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {t.project}</span>}
                    </span>
                    <span className="dt-num" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('tr-TR') : `%${prog.pct}`}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-bar-fill ${prog.color}`} style={{ width: `${prog.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'aidrafts':
        return (
          <>
            <div className="dash-kpi" style={{ color: 'var(--accent)' }}>{aiPending ?? '—'}</div>
            <div className="dash-kpi-sub">Onay kuyruğunda bekleyen taslak</div>
            <Link href="/ai-news" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-4)' }}>Kuyruğa git →</Link>
          </>
        );
      case 'newtips': {
        const t = dash?.tipStats;
        const segs = [
          { label: 'Yeni', value: t?.new || 0, color: 'var(--primary)' },
          { label: 'İnceleniyor', value: t?.investigating || 0, color: 'var(--accent)' },
          { label: 'Tamamlandı', value: t?.completed || 0, color: 'var(--success)' },
        ];
        const total = segs.reduce((a, s) => a + s.value, 0);
        return total === 0 ? (
          <EmptyState compact icon="🔔" title="İhbar yok" description="Yeni ihbar geldiğinde burada görünür." actionLabel="İhbarlar →" actionHref="/tips" />
        ) : (
          <Donut segments={segs} size={140} thickness={22} formatValue={formatTr} centerLabel="İhbar" />
        );
      }
      case 'sitetraffic': {
        const daily = (analytics?.daily || []).map((d) => ({ x: shortDate(d.date), y: d.views }));
        return (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              <div>
                <div className="dash-kpi" style={{ fontSize: 'var(--text-2xl)' }}>{formatTr(analytics?.totals.views || 0)}</div>
                <div className="dash-kpi-sub">Görüntülenme</div>
              </div>
              <div>
                <div className="dash-kpi" style={{ fontSize: 'var(--text-2xl)', color: 'var(--accent)' }}>{formatTr(analytics?.totals.reads || 0)}</div>
                <div className="dash-kpi-sub">Okuma</div>
              </div>
              <div>
                <div className="dash-kpi" style={{ fontSize: 'var(--text-2xl)', color: 'var(--info)' }}>{formatTr(analytics?.totals.shares || 0)}</div>
                <div className="dash-kpi-sub">Paylaşım</div>
              </div>
            </div>
            {daily.length === 0 ? (
              <div className="chart-empty">Bu dönemde trafik verisi yok.</div>
            ) : (
              <AreaChart series={[{ name: 'Görüntülenme', color: 'var(--info)', points: daily }]} height={170} formatValue={formatTr} formatAxis={formatCompact} ariaLabel="Site trafiği grafiği" />
            )}
          </>
        );
      }
    }
  }

  const showLoading = loading && !dash;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title"><span style={{ fontSize: '1.6rem' }}>📊</span> Dashboard</h1>
          <p className="page-subtitle">Çanakkale Network CRM — Genel Bakış</p>
        </div>
        <div className="page-header-actions dash-toolbar">
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => setSettingsOpen((v) => !v)}>⚙ Widgetlar</button>
            {settingsOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setSettingsOpen(false)} />
                <div className="dash-settings-panel">
                  <div className="dt-colmenu-title">Görünen widgetlar</div>
                  {ALL_IDS.filter((id) => WIDGET_META[id].roles.includes(level)).map((id) => (
                    <label key={id} className="dt-colmenu-item">
                      <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggleHidden(id)} />
                      {WIDGET_META[id].title}
                    </label>
                  ))}
                  <button className="btn btn-ghost btn-sm w-full" style={{ marginTop: 'var(--space-2)' }} onClick={resetLayout}>↺ Varsayılana dön</button>
                </div>
              </>
            )}
          </div>
          <Link href="/reports" className="btn btn-primary"><span>📈</span> Raporlar</Link>
        </div>
      </div>

      {showLoading ? (
        <>
          <SkeletonStats count={4} />
          <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
            <SkeletonCard lines={5} />
            <SkeletonCard lines={5} />
          </div>
        </>
      ) : visible.length === 0 ? (
        <EmptyState icon="🧩" title="Görünür widget yok" description="Sağ üstteki Widgetlar menüsünden en az bir widget açın." actionLabel="↺ Varsayılana dön" onAction={resetLayout} />
      ) : (
        <div className="dash-grid">
          {visible.map((id) => {
            const meta = WIDGET_META[id];
            const cls = [
              'card',
              'dash-widget',
              `span-${meta.span}`,
              dragId === id ? 'dragging' : '',
              dropInfo?.id === id ? (dropInfo.pos === 'before' ? 'drop-before' : 'drop-after') : '',
            ].join(' ').trim();
            return (
              <div
                key={id}
                className={cls}
                draggable
                onDragStart={() => setDragId(id)}
                onDragEnd={() => { setDragId(null); setDropInfo(null); }}
                onDragOver={(e) => onDragOver(e, id)}
                onDrop={(e) => onDrop(e, id)}
              >
                <div className="dash-widget-head">
                  <span className="dash-drag-handle" title="Sürükleyerek taşı" aria-hidden>⠿</span>
                  <span className="dash-widget-title">{meta.title}</span>
                  {id === 'sitetraffic' && (
                    <div className="range-tabs">
                      {[7, 30, 90].map((d) => (
                        <button key={d} className={`range-tab${trafficRange === d ? ' active' : ''}`} onClick={() => setTrafficRange(d)}>{d}g</button>
                      ))}
                    </div>
                  )}
                </div>
                {renderWidget(id)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
