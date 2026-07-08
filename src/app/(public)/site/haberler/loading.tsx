import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** Arşiv (Tüm Haberler) iskeleti — sayfa başlığı + ızgara shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Haberler yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '58%' }} />
          <span className="s-skel s-skel-line" style={{ width: '44%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section" style={{ paddingTop: 'clamp(24px, 4vw, 44px)' }}>
        <div className="s-container">
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
