'use client';

/**
 * Kategori rayı için ileri/geri kaydırma okları.
 * Sunucu bileşeni CategoryRail'in yanında, hedef raya id üzerinden erişir.
 */
export default function RailControls({ targetId, label }: { targetId: string; label: string }) {
  const scroll = (dir: -1 | 1) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <div className="rail-controls">
      <button type="button" onClick={() => scroll(-1)} aria-label={`${label}: geriye kaydır`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </svg>
      </button>
      <button type="button" onClick={() => scroll(1)} aria-label={`${label}: ileriye kaydır`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
