import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** Son dakika arşivi iskeleti — başlık + sonuç notu + ızgara shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Son dakika haberleri yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '70px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '44%' }} />
          <span className="s-skel s-skel-line" style={{ width: '58%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section" style={{ paddingTop: 'clamp(24px, 4vw, 44px)' }}>
        <div className="s-container">
          <span className="s-skel s-skel-line" style={{ width: '240px', height: '16px', marginBottom: '20px' }} />
          <div className="p-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
