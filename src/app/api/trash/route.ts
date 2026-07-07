import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Çöp kutusu: yumuşak silinen kayıtları listeler (B+), geri alır (B+)
 * ve kalıcı olarak siler (yalnız A).
 *
 * GÜVENLİK: model adı SABİT allowlist üzerinden çözülür — istekten gelen
 * ham string ile asla dinamik property erişimi yapılmaz.
 */

type TrashRow = { model: string; id: string; label: string; deletedAt: Date };

const DELETED = { deletedAt: { not: null } } as const;
const LIST_ARGS = { orderBy: { deletedAt: 'desc' as const }, take: 200 };

/** model → { Türkçe etiket, listele, geri al, kalıcı sil } — sabit allowlist */
const TRASH_MODELS = {
  client: {
    title: 'Müşteri',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.client.findMany({ where: DELETED, select: { id: true, companyName: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'client', id: r.id, label: r.companyName, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.client.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.client.delete({ where: { id } }),
  },
  project: {
    title: 'Proje',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.project.findMany({ where: DELETED, select: { id: true, name: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'project', id: r.id, label: r.name, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.project.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.project.delete({ where: { id } }),
  },
  task: {
    title: 'Görev',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.task.findMany({ where: DELETED, select: { id: true, title: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'task', id: r.id, label: r.title, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.task.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.task.delete({ where: { id } }),
  },
  lead: {
    title: 'Lead',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.lead.findMany({ where: DELETED, select: { id: true, name: true, company: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'lead', id: r.id, label: r.company ? `${r.name} (${r.company})` : r.name, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.lead.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.lead.delete({ where: { id } }),
  },
  invoice: {
    title: 'Fatura',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.invoice.findMany({ where: DELETED, select: { id: true, invoiceNo: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'invoice', id: r.id, label: r.invoiceNo, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.invoice.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.invoice.delete({ where: { id } }),
  },
  estimate: {
    title: 'Teklif',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.estimate.findMany({ where: DELETED, select: { id: true, estimateNo: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'estimate', id: r.id, label: r.estimateNo, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.estimate.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.estimate.delete({ where: { id } }),
  },
  expense: {
    title: 'Gider',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.expense.findMany({ where: DELETED, select: { id: true, category: true, amount: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'expense', id: r.id, label: `${r.category} — ₺${r.amount.toLocaleString('tr-TR')}`, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.expense.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.expense.delete({ where: { id } }),
  },
  contract: {
    title: 'Sözleşme',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.contract.findMany({ where: DELETED, select: { id: true, title: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'contract', id: r.id, label: r.title, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.contract.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.contract.delete({ where: { id } }),
  },
  proposal: {
    title: 'Teklifname',
    list: async (): Promise<TrashRow[]> =>
      (await prisma.proposal.findMany({ where: DELETED, select: { id: true, title: true, deletedAt: true }, ...LIST_ARGS }))
        .map(r => ({ model: 'proposal', id: r.id, label: r.title, deletedAt: r.deletedAt! })),
    restore: (id: string) => prisma.proposal.update({ where: { id }, data: { deletedAt: null } }),
    hardDelete: (id: string) => prisma.proposal.delete({ where: { id } }),
  },
} as const;

const MODEL_KEYS = Object.keys(TRASH_MODELS) as [keyof typeof TRASH_MODELS, ...(keyof typeof TRASH_MODELS)[]];

const restoreSchema = z.object({
  model: z.enum(MODEL_KEYS),
  id: z.string().min(1),
  action: z.literal('restore'),
});

const hardDeleteSchema = z.object({
  model: z.enum(MODEL_KEYS),
  id: z.string().min(1),
});

/** Son 200 yumuşak silinmiş kayıt (tüm modellerden, silinme tarihine göre) — B+ */
export async function GET() {
  try {
    await requireLevel('B');
    const lists = await Promise.all(Object.values(TRASH_MODELS).map(m => m.list()));
    const rows = lists
      .flat()
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
      .slice(0, 200);
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, 'Çöp kutusu alınamadı');
  }
}

/** Geri al: deletedAt = null — B+ */
export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, restoreSchema);
    const config = TRASH_MODELS[body.model];
    await config.restore(body.id);
    await audit(session, 'restored', body.model, body.id, `${config.title} çöp kutusundan geri alındı`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Kayıt geri alınamadı');
  }
}

/** Kalıcı silme — YALNIZ A (geri alınamaz) */
export async function DELETE(request: Request) {
  try {
    const session = await requireLevel('A');
    const body = await parseBody(request, hardDeleteSchema);
    const config = TRASH_MODELS[body.model];
    try {
      await config.hardDelete(body.id);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2003') {
        throw new ApiError(409, 'Bu kayda bağlı başka kayıtlar var — önce ilişkili kayıtları silin');
      }
      throw error;
    }
    await audit(session, 'hard_deleted', body.model, body.id, `${config.title} kalıcı olarak silindi`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Kayıt kalıcı olarak silinemedi');
  }
}
