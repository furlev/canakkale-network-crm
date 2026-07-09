import prisma from '@/lib/prisma';

/** Ayarlar → Bildirimler listesindeki toggle sırasıyla eşleşir. */
const TYPE_TO_TOGGLE_INDEX: Record<string, number> = {
  tip: 0,                // Yeni ihbar geldiğinde
  invoice_paid: 1,       // Fatura ödendiğinde
  project_completed: 2,  // Proje tamamlandığında
  client: 3,             // Yeni müşteri eklendiğinde
  task: 4,               // Görev atandığında
  news: 5,               // WordPress'te yeni haber yayınlandığında
  contract: 6,           // Sözleşme süresi dolmak üzereyken
};

/**
 * type → filtre kategorisi (bildirim merkezi filtreleri: fatura/ihbar/ai/gorev/site...).
 * Notification.category boşsa GET tarafında bu haritayla türetilir; böylece eski
 * (kategorisiz) kayıtlar da filtrelenebilir. Buradaki değerler UI ile paylaşılır.
 */
export const CATEGORY_OF_TYPE: Record<string, string> = {
  tip: 'tip',
  invoice_paid: 'invoice',
  contract: 'invoice',
  estimate: 'invoice',
  payment: 'invoice',
  project_completed: 'task',
  task: 'task',
  news: 'site',
  site: 'site',
  ai: 'ai',
  client: 'client',
  info: 'other',
};

/** Bir bildirimin efektif kategorisi (kayıtlı category > type'tan türetme > 'other'). */
export function categoryOf(type: string, category?: string | null): string {
  return category || CATEGORY_OF_TYPE[type] || 'other';
}

/** notify() için opsiyonel hedef/kategori bilgisi (geriye-uyumlu). */
export type NotifyOptions = {
  /** Hedef kullanıcı id'si; verilmezse global bildirim (userId = null). */
  userId?: string | null;
  /** Filtre kategorisi; verilmezse GET tarafında type'tan türetilir. */
  category?: string | null;
};

/**
 * Bildirim oluşturur. Ayarlardaki ilgili toggle kapalıysa sessizce atlar;
 * hata durumunda asıl işlemi asla bozmaz.
 *
 * Geriye-uyum: `notify(type, title, link)` mevcut çağrılar aynen çalışır.
 * Opsiyonel 4. argümanla belirli bir kullanıcıya ve/veya kategoriye yazılır.
 */
export async function notify(type: string, title: string, link?: string, opts?: NotifyOptions): Promise<void> {
  try {
    const idx = TYPE_TO_TOGGLE_INDEX[type];
    if (idx !== undefined) {
      const row = await prisma.setting.findUnique({ where: { key: 'notifications' } });
      if (row) {
        try {
          const toggles = JSON.parse(row.value);
          if (Array.isArray(toggles) && toggles[idx] === false) return;
        } catch { /* bozuk ayar = varsayılan açık */ }
      }
    }
    await prisma.notification.create({
      data: {
        type,
        title,
        link: link || null,
        userId: opts?.userId ?? null,
        category: opts?.category ?? CATEGORY_OF_TYPE[type] ?? null,
      },
    });
  } catch (error) {
    console.error('[notify]', error);
  }
}

/**
 * Aynı bildirimi birden çok kullanıcıya yazar (ör. AI taslağı → tüm B/A yöneticiler).
 * Geriye-uyum gerektiren yeni bir yardımcı; mevcut notify() davranışını değiştirmez.
 */
export async function notifyMany(userIds: string[], type: string, title: string, link?: string, category?: string | null): Promise<void> {
  const targets = Array.from(new Set(userIds.filter(Boolean)));
  if (targets.length === 0) return;
  await Promise.all(targets.map((userId) => notify(type, title, link, { userId, category })));
}

/** "PREFIX-001" biçimindeki son numaradan bir sonrakini üretir (silmelere dayanıklı). */
export function nextNumber(lastValue: string | null | undefined, prefix: string, pad: number, fallback: number): string {
  const parsed = lastValue ? parseInt(lastValue.replace(/\D/g, ''), 10) : NaN;
  const next = (isNaN(parsed) ? fallback : Math.max(parsed, fallback)) + 1;
  return `${prefix}-${String(next).padStart(pad, '0')}`;
}
