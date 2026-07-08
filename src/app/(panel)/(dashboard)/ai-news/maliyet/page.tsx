import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';
import { budgetStatus } from '@/lib/ai-usage';

/** DB'den istek anında okur → statik önbelleğe alınmaz. */
export const dynamic = 'force-dynamic';

/* ── Biçimlendirme ── */
function fmtUsd(n: number): string {
  if (!n) return '$0.00';
  return `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
}
const fmtNum = (n: number) => (n || 0).toLocaleString('tr-TR');
const localKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** withUsage'daki fn adlarını okunur adıma çevirir. */
const FN_LABEL: Record<string, string> = {
  discoverTopics: 'Konu Bulma',
  factCheck: 'Doğrulama (grounding)',
  writeArticle: 'Haber Yazımı',
  analyzeArticle: 'SEO Analizi',
  embed: 'Embedding (kümeleme)',
  image: 'Görsel (Imagen)',
  writeWeeklyRoundup: 'Haftalık Panorama',
  draftArticleFromTip: 'İhbardan Taslak',
  analyzeTip: 'İhbar Analizi',
  summarizeText: 'Özet',
};

export default async function AiCostPage() {
  const session = await getSession();
  if (!isLeaderOrAdmin(session)) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">💸 AI Maliyet</h1>
          </div>
        </div>
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--error)' }}>
            🔒 Bu panele yalnızca ekip lideri ve yöneticiler erişebilir.
          </div>
        </div>
      </div>
    );
  }

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const start7 = new Date(startToday);
  start7.setDate(start7.getDate() - 6);
  const start14 = new Date(startToday);
  start14.setDate(start14.getDate() - 13);
  const start30 = new Date(startToday);
  start30.setDate(start30.getDate() - 29);

  const [todayAgg, agg7, agg30, byFnRaw, byModelRaw, dayRows, failCount, draftStatusRaw, budget] = await Promise.all([
    prisma.aiUsageLog.aggregate({ _sum: { costUsd: true }, _count: true, where: { createdAt: { gte: startToday } } }),
    prisma.aiUsageLog.aggregate({ _sum: { costUsd: true }, _count: true, where: { createdAt: { gte: start7 } } }),
    prisma.aiUsageLog.aggregate({ _sum: { costUsd: true, inputTokens: true, outputTokens: true, images: true }, _count: true, where: { createdAt: { gte: start30 } } }),
    prisma.aiUsageLog.groupBy({ by: ['fn'], _sum: { costUsd: true }, _count: true, where: { createdAt: { gte: start30 } } }),
    prisma.aiUsageLog.groupBy({ by: ['model'], _sum: { costUsd: true }, _count: true, where: { createdAt: { gte: start30 } } }),
    prisma.aiUsageLog.findMany({ where: { createdAt: { gte: start14 } }, select: { createdAt: true, costUsd: true } }),
    prisma.aiUsageLog.count({ where: { ok: false, createdAt: { gte: start30 } } }),
    prisma.aiDraft.groupBy({ by: ['status'], _count: true, where: { createdAt: { gte: start30 } } }),
    budgetStatus(),
  ]);

  const todayCost = todayAgg._sum.costUsd ?? 0;
  const cost7 = agg7._sum.costUsd ?? 0;
  const cost30 = agg30._sum.costUsd ?? 0;
  const calls30 = agg30._count;
  const tokensIn30 = agg30._sum.inputTokens ?? 0;
  const tokensOut30 = agg30._sum.outputTokens ?? 0;
  const images30 = agg30._sum.images ?? 0;
  const failRate = calls30 > 0 ? (failCount / calls30) * 100 : 0;

  const byFn = [...byFnRaw]
    .map((r) => ({ fn: r.fn, label: FN_LABEL[r.fn] || r.fn, calls: r._count, cost: r._sum.costUsd ?? 0 }))
    .sort((a, b) => b.cost - a.cost);
  const byModel = [...byModelRaw]
    .map((r) => ({ model: r.model, calls: r._count, cost: r._sum.costUsd ?? 0 }))
    .sort((a, b) => b.cost - a.cost);

  // 14 günlük maliyet serisi (yerel gün başına)
  const days: { label: string; cost: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startToday);
    d.setDate(d.getDate() - i);
    dayIndex.set(localKey(d), days.length);
    days.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, cost: 0 });
  }
  for (const row of dayRows) {
    const idx = dayIndex.get(localKey(new Date(row.createdAt)));
    if (idx !== undefined) days[idx].cost += row.costUsd ?? 0;
  }
  const maxDayCost = Math.max(...days.map((d) => d.cost), 0.000001);

  // Taslak kabul/red oranı (30g)
  const ds: Record<string, number> = {};
  for (const r of draftStatusRaw) ds[r.status] = r._count;
  const accepted = (ds.approved ?? 0) + (ds.published ?? 0);
  const rejected = ds.rejected ?? 0;
  const pending = ds.pending ?? 0;
  const decided = accepted + rejected;
  const acceptRate = decided > 0 ? (accepted / decided) * 100 : null;

  // Bütçe çubuğu
  const budgetRatio = budget.enabled && budget.dailyUsd > 0 ? Math.min(1, budget.spentUsd / budget.dailyUsd) : 0;

  // SVG grafik ölçüleri
  const chartW = 620;
  const chartH = 170;
  const padB = 22;
  const bw = chartW / days.length;

  const hasData = calls30 > 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💸 AI Maliyet</h1>
          <p className="page-subtitle">Yapay zekâ motorunun çağrı, token ve tahmini maliyet dağılımı (fiyatlar tahminidir)</p>
        </div>
        <div className="page-header-actions">
          <Link href="/ai-news" className="btn btn-ghost">← AI Haber Kuyruğu</Link>
        </div>
      </div>

      {/* Bütçe durumu */}
      {budget.enabled && (
        <div className="data-table-container" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span style={{ fontWeight: 600 }}>
              Günlük Bütçe {budget.exceeded && <span className="badge badge-error" style={{ marginLeft: 8 }}>Aşıldı</span>}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {fmtUsd(budget.spentUsd)} / {fmtUsd(budget.dailyUsd)} (bugün)
            </span>
          </div>
          <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${budgetRatio * 100}%`, height: '100%', background: budget.exceeded ? 'var(--error)' : budgetRatio > 0.8 ? 'var(--warning)' : 'var(--success)' }} />
          </div>
        </div>
      )}

      {/* Özet kartlar */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card" style={{ borderTop: '2px solid var(--primary)' }}>
          <div className="stat-card-label">Bugün (tahmini)</div>
          <div className="stat-card-value" style={{ color: 'var(--primary-light)' }}>{fmtUsd(todayCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Son 7 Gün</div>
          <div className="stat-card-value">{fmtUsd(cost7)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Son 30 Gün</div>
          <div className="stat-card-value">{fmtUsd(cost30)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">30g Çağrı</div>
          <div className="stat-card-value">{fmtNum(calls30)}</div>
        </div>
        <div className="stat-card" style={{ borderTop: failRate > 10 ? '2px solid var(--error)' : undefined }}>
          <div className="stat-card-label">30g Hata Oranı</div>
          <div className="stat-card-value" style={{ color: failRate > 10 ? 'var(--error)' : undefined }}>%{failRate.toFixed(1)}</div>
        </div>
      </div>

      {!hasData ? (
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Son 30 günde AI kullanım kaydı yok. Taslak üretimi çalıştıkça buraya maliyet dağılımı gelir.
          </div>
        </div>
      ) : (
        <>
          {/* Günlük maliyet grafiği */}
          <div className="data-table-container" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Son 14 Gün — Günlük Tahmini Maliyet</div>
            <div style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Günlük maliyet grafiği">
                {days.map((d, i) => {
                  const h = (d.cost / maxDayCost) * (chartH - padB - 12);
                  const x = i * bw;
                  const y = chartH - padB - h;
                  return (
                    <g key={i}>
                      <rect x={x + bw * 0.15} y={y} width={bw * 0.7} height={Math.max(h, d.cost > 0 ? 2 : 0)} rx={2} fill={i === days.length - 1 ? 'var(--primary)' : 'var(--primary-light)'} opacity={i === days.length - 1 ? 1 : 0.6}>
                        <title>{`${d.label}: ${fmtUsd(d.cost)}`}</title>
                      </rect>
                      {i % 2 === 0 && (
                        <text x={x + bw / 2} y={chartH - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.label}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {/* Adım dağılımı */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Adım (30g)</th><th>Çağrı</th><th>Tahmini Maliyet</th></tr>
                </thead>
                <tbody>
                  {byFn.map((r) => (
                    <tr key={r.fn}>
                      <td>{r.label}</td>
                      <td>{fmtNum(r.calls)}</td>
                      <td><strong>{fmtUsd(r.cost)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Model dağılımı */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Model (30g)</th><th>Çağrı</th><th>Tahmini Maliyet</th></tr>
                </thead>
                <tbody>
                  {byModel.map((r) => (
                    <tr key={r.model}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.model}>{r.model}</td>
                      <td>{fmtNum(r.calls)}</td>
                      <td><strong>{fmtUsd(r.cost)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Token + taslak kabul/red */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-label">30g Giriş Token</div>
              <div className="stat-card-value">{fmtNum(tokensIn30)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">30g Çıkış Token</div>
              <div className="stat-card-value">{fmtNum(tokensOut30)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">30g Üretilen Görsel</div>
              <div className="stat-card-value">{fmtNum(images30)}</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--success)' }}>
              <div className="stat-card-label">Taslak Kabul Oranı (30g)</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {acceptRate === null ? '—' : `%${acceptRate.toFixed(0)}`}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                ✓ {fmtNum(accepted)} onay · ✕ {fmtNum(rejected)} red · ⏳ {fmtNum(pending)} bekleyen
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
