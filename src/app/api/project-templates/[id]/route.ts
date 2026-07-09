import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { safeParseTasks } from '../route';

const templateTask = z.object({
  title: z.string().min(1),
  offsetDays: z.coerce.number().int().min(0).optional(),
  dependsOnIndex: z.coerce.number().int().min(0).nullable().optional(),
});

const templateUpdate = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(1000).nullable().optional(),
  tasks: z.array(templateTask).min(1).optional(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const { id } = await context.params;
    const body = await parseBody(request, templateUpdate);
    const updated = await prisma.projectTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description !== undefined ? (body.description || null) : undefined,
        tasks: body.tasks !== undefined ? JSON.stringify(body.tasks) : undefined,
      },
    });
    return NextResponse.json({ ...updated, tasks: safeParseTasks(updated.tasks) });
  } catch (error) {
    return handleApiError(error, 'Şablon güncellenemedi');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLevel('B');
    const { id } = await context.params;
    await prisma.projectTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Şablon silinemedi');
  }
}
