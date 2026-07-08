import prisma from '@/lib/prisma';

/**
 * Haber sitesi (canakkale.network) ortak yardımcıları.
 * Site ayarları ve katılım formu şeması Setting tablosunda JSON olarak durur,
 * CRM'deki Site Yönetimi modülünden düzenlenir.
 */

// ─── Site ayarları (Setting key: 'site') ───

export type SiteSettings = {
  title: string;
  slogan: string;
  description: string;
  contactEmail: string;
  webmasterEmail: string;
  tekzipEmail: string;
  address: string;
  social: { facebook?: string; x?: string; instagram?: string; youtube?: string; tiktok?: string };
  tickerEnabled: boolean; // son dakika şeridi
  adsNotice: string; // reklam bilgilendirme metni
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  title: 'Çanakkale Network',
  slogan: 'Şehrin Dijital Meydanı',
  description:
    "Çanakkale'nin en güncel haber platformu: son dakika, sokak röportajları, üniversite ve etkinlik haberleri.",
  contactEmail: 'info@canakkale.network',
  webmasterEmail: 'webmaster@canakkale.network',
  tekzipEmail: 'tekzip@canakkale.network',
  address: 'Çanakkale, Türkiye',
  social: {
    facebook: 'https://facebook.com/canakkalenetwork',
    x: 'https://x.com/canakkalenet',
    instagram: 'https://instagram.com/canakkale.network',
    youtube: 'https://youtube.com/@canakkalenetwork',
    tiktok: 'https://tiktok.com/@canakkale.network',
  },
  tickerEnabled: true,
  adsNotice:
    'Web sitemiz, ziyaretçilerimize çevrimiçi reklamlar göstererek varlığını sürdürmektedir.',
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'site' } });
    if (!row) return DEFAULT_SITE_SETTINGS;
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_SITE_SETTINGS, ...parsed, social: { ...DEFAULT_SITE_SETTINGS.social, ...(parsed.social || {}) } };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

// ─── "Ekibimize Katıl" form şeması (Setting key: 'joinForm') ───

export type JoinFormField = {
  id: string; // benzersiz alan anahtarı (ör. "motivasyon")
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[]; // select için
};

export type JoinFormSchema = {
  title: string;
  intro: string;
  fields: JoinFormField[];
  successMessage: string;
  enabled: boolean;
};

export const DEFAULT_JOIN_FORM: JoinFormSchema = {
  title: 'Ekibimize Katıl',
  intro:
    "Çanakkale Network büyüyor. Muhabirlikten sosyal medyaya, kameradan tasarıma — şehrin hikâyesini birlikte anlatalım.",
  enabled: true,
  successMessage: 'Başvurun bize ulaştı! En kısa sürede seninle iletişime geçeceğiz. 🚀',
  fields: [
    { id: 'name', label: 'Ad Soyad', type: 'text', required: true, placeholder: 'Adın ve soyadın' },
    { id: 'email', label: 'E-posta', type: 'email', required: true, placeholder: 'ornek@eposta.com' },
    { id: 'phone', label: 'Telefon', type: 'tel', required: false, placeholder: '05xx xxx xx xx' },
    {
      id: 'role', label: 'İlgilendiğin Alan', type: 'select', required: true,
      options: ['Muhabir', 'Sokak Röportajı', 'Kamera / Kurgu', 'Sosyal Medya', 'Grafik Tasarım', 'Yazılım', 'Diğer'],
    },
    { id: 'experience', label: 'Deneyimin', type: 'textarea', required: false, placeholder: 'Daha önce neler yaptın? (okul kulübü, YouTube, staj...)' },
    { id: 'motivation', label: 'Neden Çanakkale Network?', type: 'textarea', required: true, placeholder: 'Seni bu ekibe katılmaya iten şey ne?' },
    { id: 'kvkk', label: 'KVKK aydınlatma metnini okudum, kabul ediyorum.', type: 'checkbox', required: true },
  ],
};

export async function getJoinForm(): Promise<JoinFormSchema> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'joinForm' } });
    if (!row) return DEFAULT_JOIN_FORM;
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_JOIN_FORM, ...parsed };
  } catch {
    return DEFAULT_JOIN_FORM;
  }
}

// ─── Kategoriler ───

export const DEFAULT_CATEGORIES: { slug: string; name: string; color: string; order: number }[] = [
  { slug: 'son-dakika', name: 'Son Dakika', color: '#c8202f', order: 0 },
  { slug: 'editorun-secimleri', name: 'Editörün Seçimleri', color: '#b98a2f', order: 1 },
  { slug: 'roportajlar', name: 'Sokak Röportajları', color: '#2f7db9', order: 2 },
  { slug: 'universite-haberleri', name: 'Üniversite Haberleri', color: '#2fb96b', order: 3 },
  { slug: 'etkinlik-haberleri', name: 'Etkinlik Haberleri', color: '#8a5cd6', order: 4 },
  { slug: 'spor-haberleri', name: 'Spor Haberleri', color: '#e0742f', order: 5 },
  { slug: 'tarih-sanat', name: 'Tarih & Sanat', color: '#a3852f', order: 6 },
  { slug: 'genel', name: 'Genel', color: '#5c6b82', order: 7 },
];

// ─── Metin yardımcıları ───

/** Türkçe karakterleri koruyarak URL dostu slug üretir. */
export function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** HTML gövdeden düz metin özet çıkarır. */
export function stripHtml(html: string, maxLen = 200): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen).replace(/\s\S*$/, '') + '…' : text;
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function formatDateTr(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
}

/** "5 dakika önce" tarzı Türkçe göreli zaman. */
export function timeAgoTr(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dakika önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return formatDateTr(date);
}

/** Ortalama okuma süresi (dk) — 200 kelime/dk. */
export function readingMinutes(html: string): number {
  const words = stripHtml(html, 1_000_000).split(' ').length;
  return Math.max(1, Math.round(words / 200));
}
