import '@/app/(public)/pages.css';

/** Feribot saatleri iskeleti — başlık + deniz durumu şeridi + hat/sefer listesi shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Feribot saatleri yükleniyor…</span>

      <header className="p-page-head">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '120px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '44%' }} />
          <span className="s-skel s-skel-line" style={{ width: '68%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          {/* Boğaz deniz durumu şeridi */}
          <div className="s-skel" style={{ height: '64px', borderRadius: '14px', marginBottom: '18px' }} />
          {/* Hat grupları / sefer satırları */}
          <div style={{ display: 'grid', gap: '16px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="s-skel" style={{ height: '148px', borderRadius: '16px' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
