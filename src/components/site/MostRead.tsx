'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useInViewOnce from './useInViewOnce';

export type MostReadItem = {
  slug: string;
  title: string;
  views: number;
  categoryName: string | null;
};

/**
 * "En Çok Okunanlar" — dev kontur numaralı (01–05) satırlar;
 * görünürlükte görüntülenme sayıları count-up ile dolar.
 */
export default function MostRead({ items }: { items: MostReadItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const started = useInViewOnce(ref); // IO + güvenlik ağı (rect süpürmesi)
  const [counts, setCounts] = useState<number[]>(() => items.map(() => 0));

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCounts(items.map(i => i.views));
      return;
    }
    const DURATION = 1500;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DURATION);
      const eased = 1 - Math.pow(1 - k, 3);
      setCounts(items.map(i => Math.round(i.views * eased)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // items sunucudan bir kez gelir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

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
        </div>
        <ol className="mostread-list">
          {items.map((item, i) => (
            <li key={item.slug} className="s-reveal" style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}>
              <Link href={`/haber/${item.slug}`} className="mr-item">
                <span className="mr-no" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mr-body">
                  <span className="mr-title">{item.title}</span>
                  <span className="mr-meta">
                    <span className="mr-views">{counts[i].toLocaleString('tr-TR')} görüntülenme</span>
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
      </div>
    </section>
  );
}
