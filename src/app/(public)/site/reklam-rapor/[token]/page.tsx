import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import styles from './reklam-rapor.module.css';

/**
 * Reklamveren self-servis performans raporu (canakkale.network/reklam-rapor/<token>).
 * Advertiser.reportToken ile çözülür; salt-okunur olarak kampanya gösterim/tık/CTR
 * verilerini gösterir. Gösterim/tık AdEvent'ten toplanır. Token geçersizse 404.
 * Oturum GEREKMEZ — /site altında olduğu için proxy'de zaten public.
 */

export const dynamic = 'force-dynamic';

// Özel rapor — arama motorlarına kapalı
export const metadata: Metadata = {
  title: 'Reklam Performans Raporu',
  robots: { index: false, follow: false },
};

const PLACEMENT_LABEL: Record<string, string> = {
  banner: 'Banner',
  native: 'Native',
  video: 'Video',
  sidebar: 'Kenar',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  ended: 'Bitti',
};

const fmtInt = (n: number) => (Number(n) || 0).toLocaleString('tr-TR');
const fmtPct = (n: number) => `%${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');

export default async function ReklamRaporPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) notFound();

  const advertiser = await prisma.advertiser.findUnique({
    where: { reportToken: token },
    include: { campaigns: { orderBy: { createdAt: 'desc' } } },
  });
  if (!advertiser) notFound();

  // Gerçek teslim ölçümü: AdEvent'ten gösterim/tık say (kampanya bazında)
  const campaignIds = advertiser.campaigns.map((c) => c.id);
  const grouped = campaignIds.length
    ? await prisma.adEvent.groupBy({
        by: ['campaignId', 'type'],
        where: { campaignId: { in: campaignIds } },
        _count: { _all: true },
      })
    : [];

  const evMap = new Map<string, { impressions: number; clicks: number }>();
  for (const g of grouped) {
    const e = evMap.get(g.campaignId) || { impressions: 0, clicks: 0 };
    if (g.type === 'impression') e.impressions = g._count._all;
    else if (g.type === 'click') e.clicks = g._count._all;
    evMap.set(g.campaignId, e);
  }

  const rows = advertiser.campaigns.map((c) => {
    const e = evMap.get(c.id) || { impressions: 0, clicks: 0 };
    const ctr = e.impressions > 0 ? (e.clicks / e.impressions) * 100 : 0;
    return { c, imp: e.impressions, clk: e.clicks, ctr };
  });

  const totImp = rows.reduce((s, r) => s + r.imp, 0);
  const totClk = rows.reduce((s, r) => s + r.clk, 0);
  const totCtr = totImp > 0 ? (totClk / totImp) * 100 : 0;
  const activeCount = advertiser.campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className={styles.wrap}>
      <span className={styles.kicker}>Reklam Performans Raporu</span>
      <h1 className={styles.title}>{advertiser.company}</h1>
      <p className={styles.sub}>
        Kampanyalarınızın güncel gösterim, tıklama ve tıklama oranı (CTR) verileri.
        Bu sayfa yalnızca size özeldir; bağlantıyı paylaşan herkes görüntüleyebilir.
      </p>

      {/* Özet metrikler */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Toplam Gösterim</div>
          <div className={styles.cardValue}>{fmtInt(totImp)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Toplam Tıklama</div>
          <div className={styles.cardValue}>{fmtInt(totClk)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Ortalama CTR</div>
          <div className={styles.cardValue}>{fmtPct(totCtr)}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Aktif Kampanya</div>
          <div className={styles.cardValue}>{fmtInt(activeCount)}</div>
        </div>
      </div>

      {/* Kampanya kırılımı */}
      {rows.length === 0 ? (
        <div className={`${styles.tableWrap} ${styles.empty}`}>
          Henüz kayıtlı kampanyanız bulunmuyor.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kampanya</th>
                <th>Konum</th>
                <th>Durum</th>
                <th>Dönem</th>
                <th className={styles.num}>Gösterim</th>
                <th className={styles.num}>Tıklama</th>
                <th className={styles.num}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, imp, clk, ctr }) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{PLACEMENT_LABEL[c.placement] || c.placement}</td>
                  <td><span className={styles.status}>{STATUS_LABEL[c.status] || c.status}</span></td>
                  <td>{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</td>
                  <td className={styles.num}>{fmtInt(imp)}</td>
                  <td className={styles.num}>{fmtInt(clk)}</td>
                  <td className={styles.num}>{fmtPct(ctr)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Toplam</td>
                <td className={styles.num}>{fmtInt(totImp)}</td>
                <td className={styles.num}>{fmtInt(totClk)}</td>
                <td className={styles.num}>{fmtPct(totCtr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className={styles.foot}>
        Veriler gerçek zamanlıya yakındır ve sayfa her açılışta güncellenir. Sorularınız için
        Çanakkale Network reklam ekibiyle iletişime geçebilirsiniz.
      </p>
    </div>
  );
}
