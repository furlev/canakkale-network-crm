/**
 * Çanakkale ilçeleri — ilçe filtreleme, harita, hava durumu, nöbetçi eczane ve
 * ilçe-hedefli reklam/bülten için ORTAK eksen. Saf veri (prisma import etmez) →
 * hem server hem client bileşenleri güvenle içe aktarır.
 */

export type District = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
};

// Merkez ilk sırada (varsayılan). Koordinatlar hava durumu API'si (Open-Meteo) içindir.
export const DISTRICTS: readonly District[] = [
  { slug: 'merkez', name: 'Merkez', lat: 40.1553, lng: 26.4142 },
  { slug: 'ayvacik', name: 'Ayvacık', lat: 39.6011, lng: 26.4053 },
  { slug: 'bayramic', name: 'Bayramiç', lat: 39.8117, lng: 26.6100 },
  { slug: 'biga', name: 'Biga', lat: 40.2283, lng: 27.2428 },
  { slug: 'bozcaada', name: 'Bozcaada', lat: 39.8283, lng: 26.0653 },
  { slug: 'can', name: 'Çan', lat: 40.0303, lng: 27.0525 },
  { slug: 'eceabat', name: 'Eceabat', lat: 40.1856, lng: 26.3564 },
  { slug: 'ezine', name: 'Ezine', lat: 39.7906, lng: 26.3378 },
  { slug: 'gelibolu', name: 'Gelibolu', lat: 40.4083, lng: 26.6706 },
  { slug: 'gokceada', name: 'Gökçeada', lat: 40.1969, lng: 25.9033 },
  { slug: 'lapseki', name: 'Lapseki', lat: 40.3453, lng: 26.6858 },
  { slug: 'yenice', name: 'Yenice', lat: 39.9247, lng: 27.2578 },
];

export const DISTRICT_SLUGS: readonly string[] = DISTRICTS.map((d) => d.slug);
export const DISTRICT_NAMES: readonly string[] = DISTRICTS.map((d) => d.name);

const BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d]));

export function getDistrict(slug: string | null | undefined): District | null {
  if (!slug) return null;
  return BY_SLUG.get(slug.toLocaleLowerCase('tr-TR')) ?? null;
}

export function districtName(slug: string | null | undefined): string | null {
  return getDistrict(slug)?.name ?? null;
}

/** Türkçe karakterleri ASCII slug köküne indirger (yalnızca ilçe eşlemesi için). */
function asciiFold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/i̇/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '');
}

const FOLD_TO_SLUG = new Map(DISTRICTS.map((d) => [asciiFold(d.name), d.slug]));

/**
 * Serbest metinden (ilçe adı, slug, "Çan'da" gibi çekimli) kanonik ilçe slug'ı çıkarır.
 * Bulamazsa null. AI/sözlük tabanlı ilçe tespitinde ve query normalizasyonunda kullanılır.
 */
export function normalizeDistrict(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (BY_SLUG.has(raw.toLocaleLowerCase('tr-TR'))) return raw.toLocaleLowerCase('tr-TR');
  const folded = asciiFold(raw);
  if (FOLD_TO_SLUG.has(folded)) return FOLD_TO_SLUG.get(folded)!;
  // Çekimli/gömülü: "biga'da", "çanakkale merkez" → ilçe kökünü ara
  for (const d of DISTRICTS) {
    const f = asciiFold(d.name);
    if (f.length >= 3 && folded.includes(f)) return d.slug;
  }
  return null;
}
