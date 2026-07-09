/**
 * RBAC — A/B/C erişim modeli.
 *
 *   A = admin  → Baş Yönetici (root): her şeye erişir.
 *   B = editor → Ekip Lideri / Muhasebe: sistem ayarları hariç geniş erişim.
 *   C = user   → Ekip Üyesi: günlük araçlar (görev, mesaj, not, haber, ödeme...).
 *
 * `role` alanı kaynak-doğrudur; A/B/C yalnızca onun etiketidir. Böylece mevcut
 * `role === 'admin'` kontrolleri bozulmadan çalışmaya devam eder.
 */

export type AccessLevel = 'A' | 'B' | 'C';

export type MiniSession = { role?: string | null; title?: string | null } | null | undefined;

/** role → A/B/C seviyesi. */
export function levelOf(role?: string | null): AccessLevel {
  if (role === 'admin') return 'A';
  if (role === 'editor') return 'B';
  return 'C';
}

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  A: 'Baş Yönetici',
  B: 'Ekip Lideri / Muhasebe',
  C: 'Ekip Üyesi',
};

export const LEVEL_BADGE: Record<AccessLevel, string> = {
  A: 'badge-error',
  B: 'badge-warning',
  C: 'badge-info',
};

/** Sadece A (admin) erişebilir. */
const A_ONLY = new Set<string>(['/settings']);

/** C (üye) seviyesinin erişebildiği yollar (allowlist). Gerisi C'ye kapalı. */
const C_ALLOWED = new Set<string>([
  '/', '/notifications', '/tasks', '/calendar', '/messages', '/notes',
  '/payments', '/knowledge-base', '/announcements', '/news', '/tips', '/profile',
  // Site editörlüğü: C sınırlı site-editörü olabilir (haber yazar/düzenler) ama
  // YAYINLAYAMAZ — yayın onayı B/A'da. Kişi bazlı kısıtlama dinamik AccessRule
  // (access.ts) ile yapılır; proxy statik kontrolü buraya dayanır.
  '/site-yonetimi',
]);

/** Yalnızca A veya (herhangi bir) B görebilir — editör verimlilik paneli. */
const LEADER_ONLY = new Set<string>(['/editor-performance']);

/** Bir yolun ilk segmentini döndürür: "/tasks/5" → "/tasks". */
function topSegment(path: string): string {
  const seg = path.split('?')[0].split('/')[1] || '';
  return '/' + seg;
}

/** Kullanıcı verilen sayfa yoluna erişebilir mi? */
export function canAccessPath(session: MiniSession, path: string): boolean {
  if (!session) return false;
  const level = levelOf(session.role);
  const base = topSegment(path);
  if (level === 'A') return true;

  if (A_ONLY.has(base)) return false;              // yalnız A
  if (LEADER_ONLY.has(base)) return level === 'B'; // A (üstte true döndü) veya B

  if (level === 'B') return true;                  // B: settings hariç her şey
  return C_ALLOWED.has(base);                        // C: allowlist
}

/** API tarafı: yetki yoksa true→devam, false→çağıran 403 döndürür. */
export function hasLevel(session: MiniSession, min: AccessLevel): boolean {
  const order: Record<AccessLevel, number> = { C: 0, B: 1, A: 2 };
  return order[levelOf(session?.role)] >= order[min];
}

export const isAdmin = (s: MiniSession) => levelOf(s?.role) === 'A';
export const isLeaderOrAdmin = (s: MiniSession) => hasLevel(s, 'B');
