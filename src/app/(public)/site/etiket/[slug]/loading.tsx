import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** Etiket hub iskeleti — başlık + ızgara shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Etiket sayfası yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '80px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '42%' }} />
          <span className="s-skel s-skel-line" style={{ width: '50%', height: '18px' }} />
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
