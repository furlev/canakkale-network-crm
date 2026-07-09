import '@/app/(public)/pages.css';

/** Namaz vakitleri iskeleti — başlık + geri sayım kartı + 6 vakit tile shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Namaz vakitleri yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '46%' }} />
          <span className="s-skel s-skel-line" style={{ width: '60%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {/* Sıradaki vakit geri sayım kartı */}
          <div className="s-skel" style={{ height: 'clamp(150px, 22vw, 200px)', borderRadius: '18px', marginBottom: '18px' }} />
          {/* Günün 6 vakti */}
          <div
            style={{
              display: 'grid',
              gap: '12px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(110px, 100%), 1fr))',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '96px', borderRadius: '14px' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
