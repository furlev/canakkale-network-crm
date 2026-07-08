import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, getPagination, listResponse, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Tekrarlayan fatura şablonları (retainer) — B+ CRUD.
 * items JSON string olarak saklanır; sunucuda daima array'e/JSON'a normalize edilir.
 * Materyalizasyon (Invoice üretimi) /api/cron/recurring-invoices tarafından yapılır.
 * Şema src/lib/schemas.ts'e dokunulmadan burada tanımlıdır (modül-yerel).
 */

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

const recurringCreate = z.object({
  title: z.string().min(1),
  clientId: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, 'En az bir kalem gerekli'),
  currency: z.enum(['TRY', 'USD', 'EUR', 'GBP']).optional(),
  interval: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  nextRunAt: dateStr.optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

/** items alanını (JSON string) güvenle array'e çevirir. */
function parseItems(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const pagination = getPagination(request);
    const [items, total] = await Promise.all([
      prisma.recurringInvoice.findMany({ orderBy: { createdAt: 'desc' }, ...(pagination ?? {}) }),
      pagination ? prisma.recurringInvoice.count() : Promise.resolve(undefined),
    ]);
    // items alanını çağıran için parse edip döndür
    const shaped = items.map((r) => ({ ...r, items: parseItems(r.items) }));
    return listResponse(shaped, total);
  } catch (error) {
    return handleApiError(error, 'Tekrarlayan faturalar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, recurringCreate);

    const created = await prisma.recurringInvoice.create({
      data: {
        title: body.title,
        clientId: body.clientId || null,
        items: JSON.stringify(body.items),
        currency: body.currency || 'TRY',
        interval: body.interval || 'monthly',
        // Verilmezse ilk çalıştırma için "şimdi" (bir sonraki cron turunda üretilir)
        nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : new Date(),
        active: body.active ?? true,
        notes: body.notes ?? null,
      },
    });
    await audit(session, 'created', 'recurringInvoice', created.id, `Tekrarlayan fatura: ${created.title} (${created.interval})`);
    return NextResponse.json({ ...created, items: parseItems(created.items) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Tekrarlayan fatura oluşturulamadı');
  }
}
