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
 * Bildirim oluşturur. Ayarlardaki ilgili toggle kapalıysa sessizce atlar;
 * hata durumunda asıl işlemi asla bozmaz.
 */
export async function notify(type: string, title: string, link?: string): Promise<void> {
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
    await prisma.notification.create({ data: { type, title, link: link || null } });
  } catch (error) {
    console.error('[notify]', error);
  }
}

/** "PREFIX-001" biçimindeki son numaradan bir sonrakini üretir (silmelere dayanıklı). */
export function nextNumber(lastValue: string | null | undefined, prefix: string, pad: number, fallback: number): string {
  const parsed = lastValue ? parseInt(lastValue.replace(/\D/g, ''), 10) : NaN;
  const next = (isNaN(parsed) ? fallback : Math.max(parsed, fallback)) + 1;
  return `${prefix}-${String(next).padStart(pad, '0')}`;
}
