import '@/app/(public)/pages.css';

/** Nöbetçi eczane iskeleti — başlık + ilçe sekmeleri + eczane kartları shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Nöbetçi eczaneler yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '50%' }} />
          <span className="s-skel s-skel-line" style={{ width: '62%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {/* İlçe filtre sekmeleri */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '22px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="s-skel" style={{ width: `${72 + (i % 3) * 20}px`, height: '36px', borderRadius: '999px' }} />
            ))}
          </div>
          {/* Eczane kartları */}
          <div style={{ display: 'grid', gap: '16px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '116px', borderRadius: '16px' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
