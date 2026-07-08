import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';

/** Tekrarlayan fatura güncelle/sil (B+). */

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(20),
});

const dateStr = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' })
  .nullable();

const recurringUpdate = z.object({
  title: z.string().min(1).optional(),
  clientId: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1).optional(),
  currency: z.enum(['TRY', 'USD', 'EUR', 'GBP']).optional(),
  interval: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  nextRunAt: dateStr.optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, recurringUpdate);
    const params = await context.params;
    const existing = await prisma.recurringInvoice.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, 'Kayıt bulunamadı');

    const data: Prisma.RecurringInvoiceUncheckedUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.clientId !== undefined) data.clientId = body.clientId || null;
    if (body.items !== undefined) data.items = JSON.stringify(body.items);
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.interval !== undefined) data.interval = body.interval;
    if (body.nextRunAt !== undefined) data.nextRunAt = body.nextRunAt ? new Date(body.nextRunAt) : null;
    if (body.active !== undefined) data.active = body.active;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    const updated = await prisma.recurringInvoice.update({ where: { id: params.id }, data });
    await audit(session, 'updated', 'recurringInvoice', updated.id, `Tekrarlayan fatura güncellendi: ${updated.title}`);
    let items: unknown[] = [];
    try { items = JSON.parse(updated.items); } catch { /* bozuk JSON = boş */ }
    return NextResponse.json({ ...updated, items });
  } catch (error) {
    return handleApiError(error, 'Tekrarlayan fatura güncellenemedi');
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireLevel('B');
    const params = await context.params;
    // Şablon (soft-delete alanı yok) — kalıcı silinir; üretilmiş faturalar etkilenmez.
    const deleted = await prisma.recurringInvoice.delete({ where: { id: params.id } });
    await audit(session, 'deleted', 'recurringInvoice', deleted.id, `Tekrarlayan fatura silindi: ${deleted.title}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Tekrarlayan fatura silinemedi');
  }
}
