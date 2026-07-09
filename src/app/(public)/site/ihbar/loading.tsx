import '@/app/(public)/pages.css';

/** Haber ihbarı iskeleti — join-hero başlık + form alanları shimmer (CLS≈0). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">İhbar formu yükleniyor…</span>

      <header className="p-join-hero">
        <div className="s-container s-skel-stack" style={{ maxWidth: '640px' }}>
          <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '200px' }} />
          <span className="s-skel s-skel-line s-skel-page-title" style={{ width: '46%' }} />
          <span className="s-skel s-skel-line" style={{ width: '72%', height: '18px' }} />
        </div>
      </header>

      <section className="s-section">
        <div className="s-container">
          <div style={{ display: 'grid', gap: '20px', maxWidth: '640px' }}>
            {[
              { label: '120px', field: '52px' },
              { label: '90px', field: '52px' },
              { label: '140px', field: '150px' },
              { label: '110px', field: '52px' },
              { label: '130px', field: '52px' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="s-skel s-skel-line" style={{ width: row.label, height: '14px' }} />
                <span className="s-skel" style={{ height: row.field, borderRadius: '12px' }} />
              </div>
            ))}
            <span className="s-skel" style={{ width: '180px', height: '52px', borderRadius: '999px' }} />
          </div>
        </div>
      </section>
    </div>
  );
}
