import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { nextNumber } from '@/lib/notify';
import { audit } from '@/lib/audit';
import { computeInvoiceTotals, type InvoiceItemLike } from '@/lib/invoice-pdf';

/**
 * ZAMAN → FATURA
 * Bir projenin faturalanmamış (invoiceId = null) billable TimeEntry'lerini
 * InvoiceItem'a dönüştürüp taslak (unpaid) Invoice oluşturur. Çift faturalamayı
 * önlemek için oluşturulan faturanın id'si ilgili TimeEntry'lere işlenir.
 *
 * Kalemler görev bazında gruplanır: aynı (taskId, rate) birleşir → miktar = saat.
 * Saatlik ücret girilmemişse rate 0 kabul edilir (editör faturada düzeltebilir).
 */

/** GET — faturalanabilir bekleyen zaman kaydı olan projelerin özeti (modal için). */
export async function GET() {
  try {
    await requireLevel('B');
    const entries = await prisma.timeEntry.findMany({
      where: { billable: true, invoiceId: null, projectId: { not: null } },
      select: { projectId: true, minutes: true, rate: true },
    });
    if (entries.length === 0) return NextResponse.json([]);

    // Proje bazında topla
    const byProject = new Map<string, { entries: number; minutes: number; amount: number }>();
    for (const e of entries) {
      const pid = e.projectId as string;
      const b = byProject.get(pid) || { entries: 0, minutes: 0, amount: 0 };
      b.entries += 1;
      b.minutes += e.minutes || 0;
      b.amount += ((e.minutes || 0) / 60) * (e.rate || 0);
      byProject.set(pid, b);
    }

    const projects = await prisma.project.findMany({
      where: { id: { in: [...byProject.keys()] }, deletedAt: null },
      select: { id: true, name: true, clientId: true, client: { select: { companyName: true } } },
    });

    const rows = projects.map((p) => {
      const b = byProject.get(p.id)!;
      return {
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        clientName: p.client?.companyName || null,
        entries: b.entries,
        hours: Math.round((b.minutes / 60) * 100) / 100,
        estimatedAmount: Math.round(b.amount * 100) / 100,
      };
    });
    // Tutarı yüksek olan üstte
    rows.sort((a, b) => b.estimatedAmount - a.estimatedAmount);
    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, 'Faturalanabilir zaman kayıtları alınamadı');
  }
}

const fromTimeSchema = z.object({
  projectId: z.string().min(1),
  clientId: z.string().min(1).optional().nullable(),
  currency: z.string().min(1).max(8).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, fromTimeSchema);

    const project = await prisma.project.findFirst({
      where: { id: body.projectId, deletedAt: null },
      select: { id: true, name: true, clientId: true },
    });
    if (!project) throw new ApiError(404, 'Proje bulunamadı');

    // Faturalanmamış billable kayıtlar
    const entries = await prisma.timeEntry.findMany({
      where: { projectId: project.id, billable: true, invoiceId: null },
      select: { id: true, minutes: true, rate: true, taskId: true },
    });
    if (entries.length === 0) {
      throw new ApiError(400, 'Bu proje için faturalanmamış billable zaman kaydı bulunmuyor.');
    }

    // Görev başlıkları (kalem açıklaması için)
    const taskIds = [...new Set(entries.map((e) => e.taskId).filter((t): t is string => !!t))];
    const tasks = taskIds.length
      ? await prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true } })
      : [];
    const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));

    // (taskId, rate) bazında grupla → miktar = toplam saat
    type Group = { minutes: number; rate: number; taskId: string | null };
    const groups = new Map<string, Group>();
    for (const e of entries) {
      const rate = e.rate || 0;
      const key = `${e.taskId || ''}|${rate}`;
      const g = groups.get(key) || { minutes: 0, rate, taskId: e.taskId || null };
      g.minutes += e.minutes || 0;
      groups.set(key, g);
    }

    const items: InvoiceItemLike[] = [...groups.values()].map((g) => {
      const hours = Math.round((g.minutes / 60) * 100) / 100;
      const label = g.taskId ? (taskTitle.get(g.taskId) || 'Görev') : 'Proje zamanı';
      return {
        description: `${project.name} — ${label} (${hours} saat)`,
        quantity: hours,
        unitPrice: g.rate,
        vatRate: 20,
      };
    });

    const t = computeInvoiceTotals(items, 0);

    const [last, count] = await Promise.all([
      prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNo: true } }),
      prisma.invoice.count(),
    ]);
    const invoiceNo = nextNumber(last?.invoiceNo, 'INV', 4, count);

    const clientId = body.clientId ?? project.clientId ?? null;

    const data: Prisma.InvoiceUncheckedCreateInput = {
      invoiceNo,
      amount: t.amount,
      currency: body.currency || 'TRY',
      subtotal: t.subtotal,
      vatTotal: t.vatTotal,
      status: 'unpaid',
      clientId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? `Zaman kayıtlarından oluşturuldu (${entries.length} kayıt).`,
      items: {
        create: items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
          order: i,
        })),
      },
    };

    const created = await prisma.invoice.create({
      data,
      include: { client: true, items: { orderBy: { order: 'asc' } } },
    });

    // Çift faturalamayı önle: kayıtları bu faturaya bağla
    await prisma.timeEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { invoiceId: created.id },
    });

    await audit(
      session,
      'created',
      'invoice',
      created.id,
      `Zamandan fatura: ${created.invoiceNo} — ${project.name} (${entries.length} kayıt, ${t.amount.toLocaleString('tr-TR')})`,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Zamandan fatura oluşturulamadı');
  }
}
