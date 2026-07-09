import styles from './DistrictMap.module.css';

/**
 * Çanakkale'nin 12 ilçesini gösteren interaktif SVG harita.
 * Gerçek jeodezik sınırlar değil; taninabilir SEMATİK bir Çanakkale'dir:
 * Boğaz'ın iki yakası (Gelibolu yarımadası ↔ Anadolu yakası) + Ege'deki iki
 * ada (Gökçeada, Bozcaada). Her ilçe ayrı bir <path data-district=slug>'tır.
 *
 * Hover/odakta o ilçenin dolgusu vurgulanır ve yayın sayısı rozeti belirir;
 * tıklama /ilce/[slug] hub'ına götürür. Saf CSS etkileşimi + SVG bağlantısı
 * (JS gerekmez) → sunucu bileşeni olarak render olur, reduced-motion'a saygılıdır.
 *
 * `counts` verildiğinde ilçe başına yayınlanan haber adedi rozette gösterilir;
 * `active` o an görüntülenen ilçeyi kalıcı vurgular.
 */

type Shape = {
  slug: string;
  name: string;
  /** İlçe poligonunun path verisi (viewBox 0 0 1000 700) */
  d: string;
  /** Etiket/rozet merkez noktası */
  cx: number;
  cy: number;
};

// Sematik yerleşim: Gelibolu yarımadası sol-üstte, Anadolu yakası sağ/aşağı,
// adalar sol-altta (Ege). Koordinatlar yaklaşık coğrafi konuma göre dizilmiştir.
const SHAPES: readonly Shape[] = [
  // ── Gelibolu yarımadası (Avrupa yakası) ──
  { slug: 'gelibolu', name: 'Gelibolu', d: 'M170 60 L410 50 L440 152 L300 200 L200 168 Z', cx: 300, cy: 120 },
  { slug: 'eceabat', name: 'Eceabat', d: 'M198 182 L300 208 L342 320 L228 382 L138 300 Z', cx: 244, cy: 280 },
  // ── Anadolu yakası ──
  { slug: 'lapseki', name: 'Lapseki', d: 'M472 68 L652 58 L662 190 L500 202 L458 150 Z', cx: 558, cy: 132 },
  { slug: 'biga', name: 'Biga', d: 'M682 50 L952 60 L940 232 L722 220 L680 122 Z', cx: 802, cy: 140 },
  { slug: 'merkez', name: 'Merkez', d: 'M408 220 L560 210 L576 332 L470 362 L400 300 Z', cx: 480, cy: 288 },
  { slug: 'can', name: 'Çan', d: 'M600 240 L780 230 L802 382 L640 402 L590 320 Z', cx: 692, cy: 316 },
  { slug: 'yenice', name: 'Yenice', d: 'M822 252 L960 262 L960 472 L842 462 L810 360 Z', cx: 890, cy: 362 },
  { slug: 'bayramic', name: 'Bayramiç', d: 'M560 422 L790 412 L800 560 L620 592 L560 500 Z', cx: 672, cy: 502 },
  { slug: 'ezine', name: 'Ezine', d: 'M400 382 L540 372 L552 542 L440 572 L380 470 Z', cx: 466, cy: 470 },
  { slug: 'ayvacik', name: 'Ayvacık', d: 'M300 592 L560 582 L582 690 L342 700 L280 652 Z', cx: 432, cy: 642 },
  // ── Ege adaları ──
  { slug: 'gokceada', name: 'Gökçeada', d: 'M60 380 L200 392 L212 502 L82 512 L40 452 Z', cx: 122, cy: 446 },
  { slug: 'bozcaada', name: 'Bozcaada', d: 'M92 542 L212 548 L216 626 L112 636 L70 592 Z', cx: 142, cy: 588 },
];

export default function DistrictMap({
  counts,
  active,
}: {
  counts?: Record<string, number>;
  active?: string;
}) {
  return (
    <div className={styles.map}>
      <svg
        className={styles.svg}
        viewBox="0 0 1000 700"
        role="group"
        aria-label="Çanakkale ilçe haritası — bir ilçeye giderek haberlerini görün"
      >
        {/* Boğaz'ı çağrıştıran dekoratif su şeridi — yalnız görsel */}
        <path
          className={styles.water}
          d="M360 400 C 430 300, 470 250, 560 150 L640 150 C 560 260, 500 330, 420 420 Z"
          aria-hidden="true"
        />

        {SHAPES.map((s) => {
          const n = counts?.[s.slug] ?? 0;
          const isActive = active === s.slug;
          return (
            <a
              key={s.slug}
              className={`${styles.district} ${isActive ? styles.active : ''}`}
              href={`/ilce/${s.slug}`}
              aria-label={`${s.name} — ${n.toLocaleString('tr-TR')} haber`}
              aria-current={isActive ? 'page' : undefined}
            >
              <path className={styles.shape} d={s.d} data-district={s.slug} />
              <text className={styles.label} x={s.cx} y={s.cy} textAnchor="middle">
                {s.name}
              </text>
              {/* Yayın sayısı rozeti — hover/odakta belirir */}
              <g className={styles.badge} transform={`translate(${s.cx}, ${s.cy - 36})`} aria-hidden="true">
                <rect className={styles.badgeBg} x={-48} y={-16} width={96} height={32} rx={16} />
                <text className={styles.badgeText} textAnchor="middle" y={5}>
                  {n.toLocaleString('tr-TR')} haber
                </text>
              </g>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
