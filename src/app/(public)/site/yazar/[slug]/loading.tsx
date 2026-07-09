import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** Yazar hub iskeleti — avatar + başlık + ızgara shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Yazar sayfası yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '90px' }} />
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <span className="s-skel" style={{ width: 76, height: 76, borderRadius: '50%', flex: '0 0 auto' }} />
            <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '220px' }} />
          </div>
          <span className="s-skel s-skel-line" style={{ width: '54%', height: '16px' }} />
        </div>
      </header>

      <section className="s-section">
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
