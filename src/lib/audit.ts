import prisma from '@/lib/prisma';
import type { Session } from '@/lib/auth';

/**
 * Denetim kaydı yazar (fire-and-forget güvenli: audit hatası asıl işlemi asla bozmaz).
 * Hassas işlemlerde çağrılır: ödeme, ayar, ekip, uyarı, fatura durumu, AI yayın...
 */
export async function audit(
  session: Session | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session?.sub ?? null,
        userName: session?.name || session?.email || null,
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] kayıt yazılamadı:', error);
  }
}
