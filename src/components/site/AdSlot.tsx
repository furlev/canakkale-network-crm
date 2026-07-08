import prisma from '@/lib/prisma';
import styles from './AdSlot.module.css';

/**
 * Reklam yuvası (SUNUCU bileşeni). Yayın penceresindeki aktif AdCampaign'lerden
 * `placement`e uyanları çeker, ilçe hedeflemesini uygular ve `weight`e göre birini
 * rastgele seçer. "Sponsorlu" rozetiyle render eder; ENVANTER YOKSA hiç görünmez
 * (null döner).
 *
 * - Tık: creative bir `<a href="/api/site/ad/{id}/click">` — uç nokta sayar ve
 *   hedefe 302 yönlendirir.
 * - Gösterim: inline beacon script'i `/api/site/ad/impression`e sendBeacon atar
 *   (layout'taki tema script'iyle aynı desen). Not: bu script tam sayfa yüklemede
 *   ve ISR-cache'li sayfalarda çalışır; yumuşak (client) gezinmede gösterim atlanabilir.
 *
 * Not: seçim, sayfanın cache penceresi (revalidate) boyunca sabittir — rotasyon
 * her yeniden-üretimde döner. Bu, basit ağırlıklı envanter için kabul edilebilir.
 */

type Placement = 'banner' | 'sidebar' | 'native';

/** JSON ilçe-hedefleme dizisini güvenle ayrıştırır. */
function parseDistricts(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((d): d is string => typeof d === 'string' && d.trim() !== '') : [];
  } catch {
    return [];
  }
}

export default async function AdSlot({
  placement,
  district,
  className,
}: {
  placement: Placement;
  /** Sayfa/haber ilçesi — ilçe-hedefli kampanya eşleşmesi için. */
  district?: string | null;
  className?: string;
}) {
  const now = new Date();

  let campaigns: {
    id: string;
    name: string;
    creativeUrl: string | null;
    weight: number;
    districts: string | null;
  }[];
  try {
    campaigns = await prisma.adCampaign.findMany({
      where: {
        placement,
        status: 'active',
        creativeUrl: { not: null },
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      select: { id: true, name: true, creativeUrl: true, weight: true, districts: true },
    });
  } catch {
    return null; // envanter sorgusu düşerse reklam alanı hiç görünmez
  }

  // İlçe hedefleme: districts dolu ise yalnız eşleşen ilçede yayınlanır (hedefsiz = her yerde).
  const eligible = campaigns.filter(c => {
    const targets = parseDistricts(c.districts);
    if (targets.length === 0) return true;
    return district ? targets.includes(district) : false;
  });
  if (eligible.length === 0) return null; // envanter yok → görünmez

  // Ağırlıklı rastgele seçim (weight >= 1)
  const total = eligible.reduce((s, c) => s + Math.max(1, c.weight || 1), 0);
  let r = Math.random() * total;
  let ad = eligible[0];
  for (const c of eligible) {
    r -= Math.max(1, c.weight || 1);
    if (r <= 0) {
      ad = c;
      break;
    }
  }

  // Gösterim beacon'ı (id JSON'lanarak enjeksiyon güvenli)
  const impressionScript =
    `(function(){try{var p=JSON.stringify({campaignId:${JSON.stringify(ad.id)}});` +
    `if(!(navigator.sendBeacon&&navigator.sendBeacon('/api/site/ad/impression',` +
    `new Blob([p],{type:'application/json'})))){` +
    `fetch('/api/site/ad/impression',{method:'POST',headers:{'Content-Type':'application/json'},body:p,keepalive:true}).catch(function(){});}}catch(e){}})();`;

  return (
    <aside className={`${styles.slot} ${styles[placement]} ${className || ''}`} aria-label="Sponsorlu içerik">
      <a
        className={styles.link}
        href={`/api/site/ad/${ad.id}/click`}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
      >
        <span className={styles.badge}>Sponsorlu</span>
        {/* creative harici URL veya data-URI olabilir — optimize etmeden servis edilir */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.creative} src={ad.creativeUrl!} alt={ad.name} loading="lazy" decoding="async" />
      </a>
      <script dangerouslySetInnerHTML={{ __html: impressionScript }} />
    </aside>
  );
}
