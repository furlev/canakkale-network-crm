import '@/app/(public)/pages.css';

/** Piyasa iskeleti — başlık + döviz/altın tile ızgarası shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Piyasa verileri yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '34%' }} />
          <span className="s-skel s-skel-line" style={{ width: '58%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div
            style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '132px', borderRadius: '16px' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
