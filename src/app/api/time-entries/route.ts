import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, listResponse } from '@/lib/api';
import { hasLevel } from '@/lib/permissions';

/**
 * Zaman takibi (TimeEntry) — kullanıcı kendi kayıtlarını yönetir; B/A herkesinkini görür.
 * schemas.ts paylaşımlı olduğundan doğrulama şeması bu modülde yereldir.
 */
const timeEntryCreate = z.object({
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  minutes: z.coerce.number().int().min(1, 'Süre en az 1 dakika olmalı').max(24 * 60, 'Tek kayıt en fazla 24 saat'),
  billable: z.boolean().optional(),
  rate: z.coerce.number().min(0).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  date: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' }),
});

/** yyyy-mm-dd → UTC gün başlangıcı (Prisma @db.Date ile uyumlu). */
function toDateOnly(v: string): Date {
  const d = new Date(v);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const url = new URL(request.url);
    const canSeeAll = hasLevel(session, 'B');

    const projectId = url.searchParams.get('projectId') || undefined;
    const taskId = url.searchParams.get('taskId') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    // B/A ?userId= ile tek kişiyi süzebilir; C her zaman yalnız kendini görür.
    const userFilter = url.searchParams.get('userId') || undefined;

    const where: Record<string, unknown> = {};
    if (!canSeeAll) where.userId = session.sub;
    else if (userFilter) where.userId = userFilter;
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = toDateOnly(from);
      if (to) range.lte = toDateOnly(to);
      where.date = range;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    // TimeEntry'de ilişki tanımlı değil; ad/etiketleri toplu sorgularla iliştir.
    const projectIds = [...new Set(entries.map((e) => e.projectId).filter(Boolean) as string[])];
    const taskIds = [...new Set(entries.map((e) => e.taskId).filter(Boolean) as string[])];
    const userIds = canSeeAll ? [...new Set(entries.map((e) => e.userId))] : [];

    const [projects, tasks, users] = await Promise.all([
      projectIds.length ? prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }) : [],
      taskIds.length ? prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true } }) : [],
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    ]);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const taskMap = new Map(tasks.map((t) => [t.id, t.title]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const items = entries.map((e) => ({
      ...e,
      projectName: e.projectId ? projectMap.get(e.projectId) ?? null : null,
      taskTitle: e.taskId ? taskMap.get(e.taskId) ?? null : null,
      userName: canSeeAll ? userMap.get(e.userId) ?? null : session.name,
    }));
    return listResponse(items);
  } catch (error) {
    return handleApiError(error, 'Zaman kayıtları alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');
    const body = await parseBody(request, timeEntryCreate);
    const created = await prisma.timeEntry.create({
      data: {
        userId: session.sub, // her zaman oturum sahibi — istemciden userId kabul edilmez
        projectId: body.projectId || null,
        taskId: body.taskId || null,
        minutes: body.minutes,
        billable: body.billable ?? true,
        rate: body.rate ?? null,
        note: body.note || null,
        date: toDateOnly(body.date),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Zaman kaydı oluşturulamadı');
  }
}
