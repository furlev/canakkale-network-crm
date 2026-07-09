'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AreaChart, StackedBar, Donut, formatTr, formatCompact } from '@/components/charts';

/* API sözleşmesi: GET /api/site-admin/analytics?days= (requireLevel B) */
type Analytics = {
  range: { days: number; from: string; to: string };
  totals: { views: number; reads: number; shares: number; outboundClicks: number };
  topArticles: { slug: string; title: string; views: number }[];
  trafficSources: { host: string | null; count: number }[];
  daily: { date: string; views: number }[];
  districts: { slug: string | null; name: string; views: number }[];
  categories: { category: string; views: number }[];
};

const RANGES: { days: number; label: string }[] = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
];

/** 'YYYY-MM-DD' → 'DD.MM' (eksen/tooltip için kısa). */
function shortDate(iso: string): string {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : iso;
}

/** Host etiketini sadeleştir (www. at, boşsa "Doğrudan"). */
function hostLabel(host: string | null): string {
  if (!host || !host.trim()) return 'Doğrudan / bilinmiyor';
  return host.replace(/^www\./, '');
}

export default function SiteAnalitikPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/site-admin/analytics?days=${d}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        setData(json);
      } else {
        setError(json?.error || 'Analitik verileri yüklenemedi.');
        setData(null);
      }
    } catch {
      setError('Sunucuya ulaşılamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  // Trafik kaynağı: ilk 7 host + kalanı "Diğer" olarak topla (donut okunur kalsın).
  const trafficSegments = (() => {
    if (!data) return [];
    const rows = [...data.trafficSources].sort((a, b) => b.count - a.count);
    const top = rows.slice(0, 7).map((r) => ({ label: hostLabel(r.host), value: r.count }));
    const rest = rows.slice(7).reduce((s, r) => s + r.count, 0);
    if (rest > 0) top.push({ label: 'Diğer', value: rest });
    return top;
  })();

  const STAT_CARDS = data
    ? [
        { l: 'Görüntülenme', v: data.totals.views, c: 'primary', i: '👁️' },
        { l: 'Okuma Tamamlama', v: data.totals.reads, c: 'success', i: '✅' },
        { l: 'Paylaşım', v: data.totals.shares, c: 'accent', i: '🔗' },
        { l: 'Dış Tıklama', v: data.totals.outboundClicks, c: 'warning', i: '↗️' },
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📊 Site Analitiği</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· canakkale.network okuyucu davranışı (first-party, KVKK-dostu)
          </p>
        </div>
        <div className="page-header-actions">
          <div className="tabs" style={{ marginBottom: 0 }}>
            {RANGES.map((r) => (
              <button key={r.days} className={`tab ${days === r.days ? 'active' : ''}`} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>{error}</div>
      ) : loading && !data ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : data ? (
        <>
          {/* Toplam kartları */}
          <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
            {STAT_CARDS.map((s, i) => (
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
                <div className="stat-card-value">{formatTr(s.v)}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Günlük görüntülenme */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Günlük Görüntülenme</h3>
            <AreaChart
              series={[{ name: 'Görüntülenme', color: 'var(--primary)', points: data.daily.map((d) => ({ x: d.date, y: d.views })) }]}
              formatValue={formatTr}
              formatAxis={formatCompact}
              formatX={shortDate}
              height={240}
              ariaLabel="Günlük görüntülenme grafiği"
            />
          </div>

          <div className="grid-2">
            {/* Trafik kaynağı */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Trafik Kaynağı</h3>
              {trafficSegments.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Kaynak verisi yok.</div>
              ) : (
                <Donut centerLabel="Ziyaret" segments={trafficSegments} ariaLabel="Trafik kaynağı dağılımı" />
              )}
            </div>

            {/* Kategori kırılımı */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Kategoriye Göre Görüntülenme</h3>
              {data.categories.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Kategori verisi yok.</div>
              ) : (
                <StackedBar
                  categories={data.categories.map((c) => c.category)}
                  series={[{ name: 'Görüntülenme', color: 'var(--accent)', values: data.categories.map((c) => c.views) }]}
                  formatValue={formatTr}
                  formatAxis={formatCompact}
                  height={240}
                  ariaLabel="Kategoriye göre görüntülenme"
                />
              )}
            </div>
          </div>

          {/* İlçe kırılımı */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>İlçeye Göre Görüntülenme</h3>
            {data.districts.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>İlçe verisi yok.</div>
            ) : (
              <StackedBar
                categories={data.districts.map((d) => d.name)}
                series={[{ name: 'Görüntülenme', color: 'var(--success)', values: data.districts.map((d) => d.views) }]}
                formatValue={formatTr}
                formatAxis={formatCompact}
                height={260}
                ariaLabel="İlçeye göre görüntülenme"
              />
            )}
          </div>

          {/* En çok okunanlar */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>En Çok Okunan Haberler</h3>
            {data.topArticles.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>Bu dönemde görüntülenme yok.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th style={{ width: 40 }}>#</th><th>Başlık</th><th style={{ textAlign: 'right' }}>Görüntülenme</th></tr>
                </thead>
                <tbody>
                  {data.topArticles.map((a, i) => (
                    <tr key={a.slug}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>
                        <a href={`https://canakkale.network/haber/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {a.title}
                        </a>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>/{a.slug} ↗</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono" style={{ color: 'var(--primary-light)' }}>{formatTr(a.views)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
