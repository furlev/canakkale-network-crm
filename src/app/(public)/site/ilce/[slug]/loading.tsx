import SkeletonCard from '@/components/site/SkeletonCard';
import '@/app/(public)/pages.css';

/** İlçe haber arşivi iskeleti — sayfa başlığı + ızgara + ilçe haritası shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">İlçe haberleri yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '90px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '46%' }} />
          <span className="s-skel s-skel-line" style={{ width: '52%', height: '18px' }} />
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

      <section className="s-section" style={{ paddingTop: 0 }}>
        <div className="s-container">
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '38%', marginBottom: '18px' }} />
          <div className="s-skel" style={{ height: 'clamp(220px, 32vw, 340px)', borderRadius: '18px' }} />
        </div>
      </section>
    </div>
  );
}
