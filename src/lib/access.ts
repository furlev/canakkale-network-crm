import prisma from '@/lib/prisma';
import type { Session } from '@/lib/auth';
import { canAccessPath, levelOf } from '@/lib/permissions';

/**
 * Dinamik sayfa erişimi: taban RBAC (permissions.ts) + AccessRule istisnaları.
 * Kural önceliği: kişiye özel > rol geneli > taban RBAC. Aynı özgüllükte en yeni kural kazanır.
 * A her zaman her yere erişir; kurallar yalnızca B ve C için işler.
 */

/** Görünürlüğü yönetilebilir ekranlar (üst segment → Türkçe etiket). */
export const MANAGED_PATHS: { path: string; label: string }[] = [
  { path: '/', label: 'Ana Panel' },
  { path: '/tasks', label: 'Görevler' },
  { path: '/calendar', label: 'Takvim' },
  { path: '/messages', label: 'Mesajlar' },
  { path: '/notes', label: 'Notlar' },
  { path: '/notifications', label: 'Bildirimler' },
  { path: '/payments', label: 'Ödemeler & Maaş' },
  { path: '/knowledge-base', label: 'Bilgi Bankası' },
  { path: '/announcements', label: 'Duyurular' },
  { path: '/news', label: 'Haberler' },
  { path: '/tips', label: 'İhbarlar' },
  { path: '/ai-news', label: 'AI Haber Kuyruğu' },
  { path: '/site-yonetimi', label: 'Site Yönetimi' },
  { path: '/clients', label: 'Müşteriler' },
  { path: '/contacts', label: 'Kişiler' },
  { path: '/projects', label: 'Projeler' },
  { path: '/invoices', label: 'Faturalar' },
  { path: '/estimates', label: 'Teklifler (Ön)' },
  { path: '/proposals', label: 'Teklifler' },
  { path: '/contracts', label: 'Sözleşmeler' },
  { path: '/expenses', label: 'Giderler' },
  { path: '/leads', label: 'Potansiyeller' },
  { path: '/subscribers', label: 'Aboneler' },
  { path: '/advertisers', label: 'Reklam Verenler' },
  { path: '/campaigns', label: 'Reklam Kampanyaları' },
  { path: '/newsletters', label: 'Bültenler' },
  { path: '/documents', label: 'Depo (Belgeler)' },
  { path: '/support', label: 'Destek' },
  { path: '/reports', label: 'Raporlar' },
  { path: '/editor-performance', label: 'Editör Performansı' },
  { path: '/team', label: 'Ekip' },
];

type Rule = {
  id: string;
  path: string;
  targetRole: string | null;
  targetUserId: string | null;
  allow: boolean;
  createdAt: Date;
};

/** Bellek-içi kural önbelleği (60 sn) — her istekte DB'ye gitmemek için. */
let cache: { rules: Rule[]; expires: number } | null = null;

async function getRules(): Promise<Rule[]> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.rules;
  const rules = await prisma.accessRule.findMany({ orderBy: { createdAt: 'desc' } });
  cache = { rules, expires: now + 60_000 };
  return rules;
}

export function clearAccessCache(): void {
  cache = null;
}

function topSegment(path: string): string {
  const seg = path.split('?')[0].split('/')[1] || '';
  return '/' + seg;
}

/** Kurallar dahil erişim kararı. Sayfa gating'i (layout) ve nav filtrelemesi bunu kullanır. */
export async function canAccessPathDynamic(session: Session | null, path: string): Promise<boolean> {
  if (!session) return false;
  const level = levelOf(session.role);
  if (level === 'A') return true;

  const base = topSegment(path);
  // /settings hiçbir kuralla açılamaz (yalnız A) — taban RBAC mutlak
  if (base === '/settings') return false;

  const rules = await getRules();
  const forPath = rules.filter(r => r.path === base);
  // rules zaten createdAt DESC — find ilk (en yeni) eşleşmeyi verir
  const userRule = forPath.find(r => r.targetUserId === session.sub);
  if (userRule) return userRule.allow;
  const roleRule = forPath.find(r => !r.targetUserId && r.targetRole === level);
  if (roleRule) return roleRule.allow;

  return canAccessPath(session, path);
}

/** Kullanıcının erişebildiği ekran listesi (nav + yönetim UI için). */
export async function effectivePaths(session: Session | null): Promise<string[]> {
  if (!session) return [];
  const out: string[] = [];
  for (const { path } of MANAGED_PATHS) {
    if (await canAccessPathDynamic(session, path)) out.push(path);
  }
  return out;
}
