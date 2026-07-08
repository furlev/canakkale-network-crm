import SkeletonCard from '@/components/site/SkeletonCard';

/** Anasayfa iskeleti — hero + haber ızgarası shimmer (CLS=0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">İçerik yükleniyor…</span>

      <section className="s-skel-hero">
        <div className="s-skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
        <div className="s-container s-skel-stack" style={{ position: 'relative', zIndex: 2, maxWidth: '62ch' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '150px' }} />
          <span className="s-skel s-skel-line s-skel-hero-title" style={{ width: '82%' }} />
          <span className="s-skel s-skel-line s-skel-hero-title" style={{ width: '54%' }} />
          <span className="s-skel s-skel-line" style={{ width: '40%', height: '44px', borderRadius: '999px', marginTop: '10px' }} />
        </div>
      </section>

      <section className="s-section">
        <div className="s-container">
          <div className="home-grid">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
