import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, listResponse } from '@/lib/api';

/**
 * Proje şablonu — tekrarlayan iş tipleri için görev iskeleti.
 * tasks JSON dizisi: [{ title, offsetDays?, dependsOnIndex? }]
 * dependsOnIndex: aynı dizideki önceki görevin indeksi (bağımlılık zinciri kurulur).
 */
const templateTask = z.object({
  title: z.string().min(1),
  offsetDays: z.coerce.number().int().min(0).optional(),
  dependsOnIndex: z.coerce.number().int().min(0).nullable().optional(),
});

const templateCreate = z.object({
  name: z.string().min(1),
  description: z.string().max(1000).nullable().optional(),
  tasks: z.array(templateTask).min(1, 'En az bir görev tanımlayın'),
});

export async function GET() {
  try {
    await requireLevel('B');
    const items = await prisma.projectTemplate.findMany({ orderBy: { createdAt: 'desc' } });
    // tasks alanı JSON string olarak saklanır; istemciye dizi olarak dön.
    const parsed = items.map((t) => ({
      ...t,
      tasks: safeParseTasks(t.tasks),
    }));
    return listResponse(parsed);
  } catch (error) {
    return handleApiError(error, 'Şablonlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, templateCreate);
    const created = await prisma.projectTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        tasks: JSON.stringify(body.tasks),
      },
    });
    return NextResponse.json({ ...created, tasks: safeParseTasks(created.tasks) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Şablon oluşturulamadı');
  }
}

/** Bozuk/eski JSON'a dayanıklı ayrıştırma. */
export function safeParseTasks(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
