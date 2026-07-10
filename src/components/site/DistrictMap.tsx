import type { CSSProperties } from 'react';
import styles from './DistrictMap.module.css';

/**
 * Çanakkale'nin 12 ilçesini GERÇEK idari sınırlarıyla gösteren interaktif SVG harita.
 * Sınır koordinatları açık veri setinden (coskunomer/Turkish-Cities-Geojson-Dataset, MIT)
 * alınıp Douglas-Peucker ile basitleştirildi ve 1000×906 viewBox'a gömüldü — çalışma
 * anında dış bağımlılık/istek yok. Gelibolu yarımadası, Boğaz, Biga yarımadası,
 * Gökçeada ve Bozcaada gerçek coğrafi konumlarındadır.
 *
 * Her ilçe /ilce/[slug] hub'ına giden bir SVG bağlantısıdır; hover/klavye odağında
 * ilçe yükselir, parlar ve yayın sayısı rozeti belirir. `counts` verildiğinde ilçe
 * dolgusu haber yoğunluğuna göre hafifçe koyulaşır (choropleth). Saf CSS etkileşimi
 * (JS yok) → sunucu bileşeni; reduced-motion'a saygılıdır. Dar ekranda (≤640px)
 * harita yerine aynı bağlantıları taşıyan ilçe çipleri gösterilir.
 *
 * `active` o an görüntülenen ilçeyi (ör. /ilce/[slug] sayfasında) kalıcı vurgular.
 */

type Shape = {
  slug: string;
  name: string;
  /** İlçenin gerçek sınır poligonu (viewBox 0 0 1000 906) */
  d: string;
  /** Etiket/rozet çapa noktası (poligonun en iç noktası) */
  cx: number;
  cy: number;
  /** Küçük yüzölçümlü ilçelerde (ada) etiket ufaltılır */
  sm?: boolean;
};

const VIEW_W = 1000;
const VIEW_H = 906;

// Kuzeyden güneye kabaca sıralı — komşu ilçeler gerçek sınırlarını paylaşır.
const SHAPES: readonly Shape[] = [
  { slug: 'gelibolu', name: 'Gelibolu', d: 'M419 335.3L412.7 290L390.1 267.3L389.3 260.1L396.6 246.1L414.8 224.7L429.8 214.9L452.8 207.1L497.5 176.1L516.9 168.3L525.7 171.8L555.4 167.9L560.2 159.3L561 150.2L572.4 143.6L576.9 136.1L579.2 143.7L591.3 144.4L606.2 136.1L623.8 116.7L624.2 108.4L628.7 102.2L621.8 102.6L622.9 97.8L617 81.9L602.7 66.7L589.5 66.1L583.6 50.2L585.8 41.3L604.5 21.1L629.8 14.5L666.4 14.1L696.2 20L711.1 30.7L717.9 40.8L719.6 52.6L707.2 73.3L696 101.5L651.7 156.3L616.6 177.3L573.4 192.8L561.3 207.1L549.8 211.6L548.8 226.8L551.9 231.3L543.3 236.3L539.7 244.6L530.8 242L515 254L513.2 257.1L517.3 272L509.7 284.9L497.4 294.5L494.1 301.7L487.7 302L478.8 312.3L459.4 320L445.7 330.1L443.3 339L432.8 349.1Z', cx: 461, cy: 260 },
  { slug: 'eceabat', name: 'Eceabat', d: 'M396.6 246.1L389.3 260.1L390.1 267.3L412.7 290L417.5 331L429.3 354L409.7 364.5L408.2 369.8L391 374.9L382.8 381.7L374.7 381.1L375.8 398.2L386 422.1L368.2 434.3L358.4 448.2L350.2 452.2L341.5 462.7L308.5 479.5L302.7 487.1L295.2 484.3L285.2 492.7L278.6 491.4L273.7 484.2L296.4 450.1L310.2 415.1L328.2 388.9L326.6 379.6L332.5 372.8L332.5 347.2L322.4 334.5L307.3 323.6L316.1 315.4L315.4 309.7L311.8 305.1L301.4 302.6L324.6 284.3L341.2 280.3L350.2 270.1L360.4 272.3L368.2 261.6L397.2 240.1Z', cx: 348, cy: 340 },
  { slug: 'lapseki', name: 'Lapseki', d: 'M716.6 258.1L713.3 280.2L720.3 307.2L717.4 315.4L705.7 332.6L681.9 348.5L670.9 380.2L658.8 397.8L656.1 415.9L643.7 414.6L614.2 423L602 430.9L600.6 435.9L556.4 434.6L535.4 423.3L502.8 388.4L475 375.4L463.3 365.4L471.7 359.6L470.1 354.6L479.6 339.5L491.7 334.2L483 332.5L484.6 329.7L505.4 324.9L513.8 317L526.1 296.9L548.4 279.4L547.8 268.4L563.6 258.8L572.7 251.2L569.7 251L572.2 246.9L578.9 243.6L595.5 241.7L609.8 243.8L616 247.8L632.1 244.6L649 248.9L657.1 241.3L663.6 240.3L687.9 257.5L697.9 253.2L703.6 255.7L712.4 254.2Z', cx: 596, cy: 345 },
  { slug: 'biga', name: 'Biga', d: 'M907.1 436.1L870.9 440.9L856.8 446.5L830.2 467.4L821.5 462.4L797.6 456.7L793 453.4L790.6 443.3L752.6 431L730.9 415.6L706.9 413L656.1 415.9L658.8 397.8L670.9 380.2L681.9 348.5L705.7 332.6L717.4 315.4L720.3 307.2L713.3 280.2L715.1 253.2L728.2 249.3L738.7 238.4L740.4 227L747.1 225.5L755.2 218L787 211.5L807 223.1L813.2 222.5L819 216.6L845.4 203.6L852 196.1L857 195.5L861.7 205.1L871.5 214.6L879.1 239.1L868 247.1L876.3 264.4L920.4 291.8L952.6 306.2L973.8 311.2L970.1 325.1L971.4 344.7L953.8 363.8L952.6 375.5L948.1 380.9L923.4 396.6L914.4 413.4L913.1 430.4Z', cx: 815, cy: 345 },
  { slug: 'gokceada', name: 'Gökçeada', d: 'M73.3 452.8L62.2 452.7L50.8 458.3L46.3 456.5L42.8 447.2L15.3 434.2L18.2 413.1L27 410.3L40.4 395.7L75.9 372.7L106.5 372.7L125.4 359.8L148.3 353.4L157.4 355.2L159.9 351.8L162.7 363.5L176.1 368.7L175.9 389.8L171.6 395.6L173.8 399L170.2 408.2L172.2 416.3L178.3 420.4L194.5 406.4L196.4 412L183.9 430.1L165.1 436.5L153.1 433.7L102.3 452.4L82.3 449.4L78.6 455Z', cx: 96, cy: 410 },
  { slug: 'merkez', name: 'Merkez', d: 'M466 366.9L475 375.4L502.8 388.4L535.4 423.3L553 433.6L600.6 435.9L599.4 460.4L594 484.5L596 527.6L588.8 518.2L575.4 513.1L561.6 511.4L548 518L526.7 512.7L518.6 502.5L504.2 498.7L500.5 508.8L505.6 530.2L503.7 534.4L491.8 535.9L475.1 531.2L468.8 532.9L464.2 546.3L448.4 565.4L430.9 574.3L424.9 585.8L415.4 581.5L358.2 583.7L350.3 580.2L309.1 575.9L270.2 559.4L279.4 527.4L290.3 514.3L297.5 512.7L308.2 516.6L308.3 519.4L328.7 518.8L358.7 503.8L369.1 487.2L377.9 462.4L376 458.3L378.6 450L382.8 447.1L395.5 446.6L400 437.5L394.5 422.8L400.5 415L397.6 409.4L400.6 386.1L398.2 384.8L404.2 382.4L417.7 386L425.5 382.9L432 384.4L435.3 381L439.9 382.9L450.6 373.6Z', cx: 480, cy: 460 },
  { slug: 'can', name: 'Çan', d: 'M595.9 525.1L594 484.5L602 430.9L632 416.8L691.5 413.2L730.9 415.6L752.6 431L790.6 443.3L793 453.4L797.6 456.7L821.5 462.4L830.2 467.4L767.7 530.9L745.5 594L720.7 615L690 622.9L675.8 624.9L669.2 611L657.5 601.2L608.9 592.5L604.5 584.3L606.8 564.5L602.7 540.2Z', cx: 685, cy: 505 },
  { slug: 'yenice', name: 'Yenice', d: 'M675.4 670.4L678.4 629.5L675.8 624.9L720.7 615L745.5 594L767.7 530.9L847.2 452.2L870.9 440.9L907.1 436.1L917 439.1L926.3 455.1L955.1 483.9L960.7 500.9L958.4 525L980.9 544.8L986 557.6L981.3 602L968.7 638.7L967 659.3L955.9 671.7L905.6 701L894.3 711.5L855.4 727.7L832.7 722L798.7 694.3L736.5 695.7L699.8 676.4L685.7 679.4L681 684.5Z', cx: 867, cy: 591 },
  { slug: 'ezine', name: 'Ezine', d: 'M278.1 562.7L309.1 575.9L350.3 580.2L358.2 583.7L415.4 581.5L424.9 585.8L411.8 635.5L410.2 681.4L422 707.4L428.4 737.5L403.6 743.7L369.1 736.8L363.8 741.6L369.5 752.8L364.1 757.3L325.5 758.1L299.7 755.3L268.1 764.2L270.4 733.1L259.9 685.1L266.8 673.9L268.5 640.2L259.1 628.7L262 611.5L268.6 597.8L269 589L264.2 579.3L268.9 569.1Z', cx: 341, cy: 653 },
  { slug: 'bayramic', name: 'Bayramiç', d: 'M534.6 737.4L508.6 732.2L479.6 737L466.3 742.5L428.4 737.5L422 707.4L410.2 681.4L411.8 635.5L427.9 579.3L430.9 574.3L448.4 565.4L464.2 546.3L468.8 532.9L475.1 531.2L491.8 535.9L503.7 534.4L505.6 530.2L500.5 508.8L504.2 498.7L518.6 502.5L526.7 512.7L548 518L561.6 511.4L588.8 518.2L602.7 540.2L606.8 564.5L604.5 584.3L608.9 592.5L657.5 601.2L669.2 611L678.4 629.5L674.7 664.6L678 688.8L671.3 696.9L655 703.4L633.6 722.6L626 725.8L609.5 727.1L577.7 714.2L565.2 717.6L553.3 732.6Z', cx: 518, cy: 633 },
  { slug: 'bozcaada', name: 'Bozcaada', d: 'M229.5 657.9L222.1 663.3L213.5 664.8L211.2 659.2L184.8 642.6L180.5 643.7L174.1 639.6L169.2 627.1L214.3 622.8L226.6 634.3L228.8 641.1L225.5 647.8Z', cx: 200, cy: 644, sm: true },
  { slug: 'ayvacik', name: 'Ayvacık', d: 'M277.5 762.4L299.7 755.3L325.5 758.1L364.1 757.3L369.5 752.8L363.8 741.6L373.2 736.3L378.2 739.6L403.6 743.7L429.8 737L466.3 742.5L500.4 732.4L549.9 737.9L543.6 747.8L534.8 784.1L529.8 825L518.2 822.9L509 828.6L485.5 835.1L459.4 838.3L450.1 842.2L442.7 841.1L420.4 847.7L404.9 859.2L384.1 862.3L378.9 872.8L372.3 868.4L358.4 872.6L338.2 869.6L325.3 871.3L320.1 874L313.7 884.1L309.7 882.9L307 877.3L297.3 880.6L293.9 886.2L266 887.9L259 891.6L249.1 890.6L223.6 878.4L220 867.6L223.8 856.7L228.7 852.3L228.2 845.3L241.2 800.1L253.9 792.4Z', cx: 380, cy: 810 },
];

// Çip görünümü için sıra: Merkez önce, kalanı Türkçe alfabetik (districts.ts düzeni).
const CHIP_SHAPES: readonly Shape[] = [...SHAPES].sort((a, b) =>
  a.slug === 'merkez' ? -1 : b.slug === 'merkez' ? 1 : a.name.localeCompare(b.name, 'tr'),
);

export default function DistrictMap({
  counts,
  active,
}: {
  counts?: Record<string, number>;
  active?: string;
}) {
  const max = Math.max(0, ...SHAPES.map((s) => counts?.[s.slug] ?? 0));

  /** Haber yoğunluğu → dolguya karışan accent yüzdesi (0–26, karekök ölçek) */
  const heatOf = (n: number) => (max > 0 ? Math.round(Math.sqrt(n / max) * 26) : 0);

  return (
    <div className={styles.map}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="group"
        aria-label="Çanakkale ilçe haritası — bir ilçeye giderek haberlerini görün"
      >
        <defs>
          {/* Deniz degradesi — stop renkleri CSS'ten (tema-duyarlı) gelir */}
          <linearGradient id="cn-dm-sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className={styles.seaStop1} />
            <stop offset="1" className={styles.seaStop2} />
          </linearGradient>
          {/* Hafif dalga dokusu */}
          <pattern id="cn-dm-waves" width="46" height="26" patternUnits="userSpaceOnUse">
            <path d="M0 13 Q 11.5 5 23 13 T 46 13" className={styles.wave} />
          </pattern>
          {/* Boğaz orta hattı — "Çanakkale Boğazı" yazısının izlediği eğri */}
          <path id="cn-dm-strait" d="M292 528 C 356 468, 400 420, 436 350 C 462 299, 494 272, 552 244" fill="none" />
        </defs>

        {/* Su: degrade zemin + kayan dalga dokusu */}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#cn-dm-sea)" />
        <rect className={styles.waves} x={-46} width={VIEW_W + 92} height={VIEW_H} fill="url(#cn-dm-waves)" />

        {/* Su adları — yalnız görsel */}
        <text className={styles.seaLabel} x={110} y={700} textAnchor="middle" aria-hidden="true">
          Ege Denizi
        </text>

        {SHAPES.map((s) => {
          const n = counts?.[s.slug] ?? 0;
          const isActive = active === s.slug;
          return (
            <a
              key={s.slug}
              className={`${styles.district} ${isActive ? styles.active : ''}`}
              href={`/ilce/${s.slug}`}
              tabIndex={0}
              aria-label={`${s.name} — ${n.toLocaleString('tr-TR')} haber`}
              aria-current={isActive ? 'page' : undefined}
              style={{ '--dm-heat': `${heatOf(n)}%` } as CSSProperties}
            >
              <path className={styles.shape} d={s.d} data-district={s.slug} />
              <text
                className={`${styles.label} ${s.sm ? styles.labelSm : ''}`}
                x={s.cx}
                y={s.cy}
                textAnchor="middle"
              >
                {s.name}
              </text>
              {/* Yayın sayısı rozeti — hover/odakta belirir */}
              <g className={styles.badge} transform={`translate(${s.cx}, ${s.cy - 34})`} aria-hidden="true">
                <rect className={styles.badgeBg} x={-48} y={-16} width={96} height={32} rx={16} />
                <text className={styles.badgeText} textAnchor="middle" y={5}>
                  {n.toLocaleString('tr-TR')} haber
                </text>
              </g>
            </a>
          );
        })}

        {/* Boğaz adı — kanal dar olduğu için ilçelerin ÜZERİNE, eğri boyunca yazılır */}
        <text className={`${styles.seaLabel} ${styles.straitLabel}`} aria-hidden="true">
          <textPath href="#cn-dm-strait" startOffset="50%" textAnchor="middle">
            Çanakkale Boğazı
          </textPath>
        </text>
      </svg>

      <p className={styles.hint} aria-hidden="true">
        Renk koyuluğu haber yoğunluğunu gösterir
      </p>

      {/* Dar ekran: harita yerine ilçe çipleri (aynı bağlantılar) */}
      <nav className={styles.chips} aria-label="İlçe listesi">
        {CHIP_SHAPES.map((s) => {
          const n = counts?.[s.slug] ?? 0;
          const isActive = active === s.slug;
          return (
            <a
              key={s.slug}
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
              href={`/ilce/${s.slug}`}
              aria-label={`${s.name} — ${n.toLocaleString('tr-TR')} haber`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.chipName}>{s.name}</span>
              <span className={styles.chipCount}>{n.toLocaleString('tr-TR')}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
