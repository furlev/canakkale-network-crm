import '@/app/(public)/pages.css';

/** İletişim iskeleti — başlık + 3 iletişim kartı + bilgi şeridi shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">İletişim sayfası yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '110px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '38%' }} />
          <span className="s-skel s-skel-line" style={{ width: '66%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div
            style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '180px', borderRadius: '16px' }} />
            ))}
          </div>
          <div className="s-skel" style={{ height: '56px', borderRadius: '14px', marginTop: '20px' }} />
        </div>
      </section>
    </div>
  );
}
