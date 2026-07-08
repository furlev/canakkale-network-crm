import '@/app/(public)/pages.css';

/** Haber detay iskeleti — sinematik hero + gövde satırları shimmer (CLS=0). */
export default function Loading() {
  return (
    <article aria-busy="true" aria-live="polite">
      <span className="sr-only">Haber yükleniyor…</span>

      <header className="p-hero">
        <div className="p-hero-media s-skel" style={{ borderRadius: 0 }} />
        <div className="p-hero-inner">
          <div className="s-container s-skel-stack" style={{ maxWidth: '920px' }}>
            <span className="s-skel s-skel-line s-skel-kicker" style={{ width: '110px' }} />
            <span className="s-skel s-skel-line s-skel-hero-title" style={{ width: '86%' }} />
            <span className="s-skel s-skel-line s-skel-hero-title" style={{ width: '58%' }} />
            <span className="s-skel s-skel-line" style={{ width: '46%', height: '16px', marginTop: '10px' }} />
          </div>
        </div>
      </header>

      <div className="p-article">
        <div className="s-skel-stack">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="s-skel s-skel-line s-skel-prose"
              style={{ width: i % 4 === 3 ? '64%' : '100%' }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
