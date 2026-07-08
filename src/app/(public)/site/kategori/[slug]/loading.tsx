import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** Kategori sayfası iskeleti — başlık + ızgara shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Kategori yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '100px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '46%' }} />
          <span className="s-skel s-skel-line" style={{ width: '38%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div className="p-grid">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
