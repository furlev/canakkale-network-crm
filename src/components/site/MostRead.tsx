'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useInViewOnce from './useInViewOnce';
import styles from './MostRead.module.css';

export type MostReadItem = {
  slug: string;
  title: string;
  /** Gösterilecek görüntülenme — sunucu displayViews (görüntülenme takviyesi dahil,
   *  src/lib/view-boost.ts) ile hesaplayıp sayı olarak geçebilir. */
  views: number;
  categoryName: string | null;
};

/** Sekme içi tekil satır — animasyon `count` değerini hedef alır. */
type Row = { slug: string; title: string; count: number; categoryName: string | null };
type Tab = 'top' | 'trend';

/** /api/site/trend yanıt öğesi (hafif). */
type TrendApiItem = { slug: string; title: string; views: number; trendCount: number; categoryName: string | null };

/**
 * "En Çok Okunanlar" + "Trend (24s)" sekmeli liste — dev kontur numaralı satırlar;
 * görünürlükte sayılar count-up ile dolar. Trend sekmesi ilk açılışta /api/site/trend'i
 * lazy çeker (client-side); veri yoksa/başarısızsa zarifçe boş durum gösterir.
 *
 * Geriye uyum: `items` imzası korunur; sunucu değişmeden çalışır (trend istemcide gelir).
 */
export default function MostRead({ items }: { items: MostReadItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const started = useInViewOnce(ref); // IO + güvenlik ağı (rect süpürmesi)

  const topRows: Row[] = items.map(i => ({ slug: i.slug, title: i.title, count: i.views, categoryName: i.categoryName }));

  const [tab, setTab] = useState<Tab>('top');
  const [trendRows, setTrendRows] = useState<Row[] | null>(null); // null = henüz çekilmedi

  const activeRows: Row[] = tab === 'trend' ? trendRows ?? [] : topRows;
  const trendLoading = tab === 'trend' && trendRows === null;
  const countLabel = tab === 'trend' ? 'son 24s' : 'görüntülenme';

  // Başlangıç GERÇEK değer: SSR ve ilk client render doğru sayıyı basar (hydration uyumlu).
  const [counts, setCounts] = useState<number[]>(() => topRows.map(r => r.count));

  // Trend sekmesi ilk kez açılınca veriyi çek (best-effort; hata → boş liste).
  useEffect(() => {
    if (tab !== 'trend' || trendRows !== null) return;
    let cancelled = false;
    fetch('/api/site/trend', { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('trend'))))
      .then((d: { items?: TrendApiItem[] }) => {
        if (cancelled) return;
        setTrendRows(
          (d.items ?? []).map(it => ({
            slug: it.slug,
            title: it.title,
            count: it.trendCount ?? 0,
            categoryName: it.categoryName ?? null,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setTrendRows([]); // zarif boş durum
      });
    return () => {
      cancelled = true;
    };
  }, [tab, trendRows]);

  // Aktif liste (sekme/started/trend verisi) değişince count-up animasyonu.
  useEffect(() => {
    if (!started) return;
    const rows = tab === 'trend' ? trendRows ?? [] : topRows;
    const target = rows.map(r => r.count);
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCounts(target);
      return;
    }
    setCounts(rows.map(() => 0));
    const DURATION = 1500;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DURATION);
      const eased = 1 - Math.pow(1 - k, 3);
      setCounts(target.map(v => Math.round(v * eased)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // topRows sunucudan bir kez gelir; trendRows/tab/started deps yeterli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, tab, trendRows]);

  if (items.length === 0) return null;

  return (
    <section className="s-section mostread-section" ref={ref}>
      <div className="s-container mostread-layout">
        <div className="mostread-head s-reveal">
          <span className="s-kicker">Şehrin Gündemi</span>
          <h2 className="s-section-title">
            En Çok <span className="tick">Okunanlar</span>
          </h2>
          <p className="mostread-desc">Çanakkale&apos;nin bu aralar en çok konuştuğu haberler.</p>

          <div className={styles.tabs} role="tablist" aria-label="Liste türü">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'top'}
              className={`${styles.tab} ${tab === 'top' ? styles.tabActive : ''}`}
              onClick={() => setTab('top')}
            >
              En Çok Okunan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'trend'}
              className={`${styles.tab} ${tab === 'trend' ? styles.tabActive : ''}`}
              onClick={() => setTab('trend')}
            >
              Trend (24s)
            </button>
          </div>
        </div>

        {trendLoading ? (
          <p className={styles.state} role="status">
            Trend yükleniyor…
          </p>
        ) : activeRows.length === 0 ? (
          <p className={styles.state} role="status">
            Şimdilik trend haber yok — birazdan burası hareketlenir.
          </p>
        ) : (
          <ol className="mostread-list">
            {activeRows.map((item, i) => (
              <li
                key={`${tab}-${item.slug}`}
                className="s-reveal"
                style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}
              >
                <Link href={`/haber/${item.slug}`} className="mr-item">
                  <span className="mr-no" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="mr-body">
                    <span className="mr-title">{item.title}</span>
                    <span className="mr-meta">
                      <span className="mr-views">
                        {(counts[i] ?? item.count).toLocaleString('tr-TR')} {countLabel}
                      </span>
                      {item.categoryName && (
                        <>
                          <span className="mr-dot" aria-hidden="true" />
                          <span>{item.categoryName}</span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
