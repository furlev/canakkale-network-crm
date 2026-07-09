import '@/app/(public)/pages.css';

/** Hava durumu iskeleti — başlık + ilçe sekmeleri + güncel blok + 5 günlük tahmin shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Hava durumu yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '40%' }} />
          <span className="s-skel s-skel-line" style={{ width: '66%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {/* İlçe sekmeleri */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '22px' }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="s-skel" style={{ width: `${70 + (i % 3) * 22}px`, height: '34px', borderRadius: '999px' }} />
            ))}
          </div>
          {/* Güncel durum */}
          <div className="s-skel" style={{ height: 'clamp(180px, 26vw, 240px)', borderRadius: '18px', marginBottom: '18px' }} />
          {/* 5 günlük tahmin */}
          <div
            style={{
              display: 'grid',
              gap: '12px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))',
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '128px', borderRadius: '14px' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
