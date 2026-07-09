import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { safeParseTasks } from '../../project-templates/route';

/**
 * Şablondan proje oluşturur: ProjectTemplate → yeni Project + Task'lar.
 * Görev bağımlılık zinciri (dependsOnIndex → dependsOnId) kurulur ve
 * offsetDays, proje başlangıç tarihine (startDate) eklenerek dueDate hesaplanır.
 */
const fromTemplate = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).optional(), // verilmezse şablon adı kullanılır
  clientId: z.string().nullable().optional(),
  startDate: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' }).optional(),
  assigneeId: z.string().nullable().optional(), // tüm görevlere atanacak kişi (opsiyonel)
});

type TemplateTask = { title?: unknown; offsetDays?: unknown; dependsOnIndex?: unknown };

export async function POST(request: Request) {
  try {
    await requireLevel('B');
    const body = await parseBody(request, fromTemplate);

    const template = await prisma.projectTemplate.findUnique({ where: { id: body.templateId } });
    if (!template) throw new ApiError(404, 'Şablon bulunamadı');

    const rawTasks = safeParseTasks(template.tasks) as TemplateTask[];
    const start = body.startDate ? new Date(body.startDate) : new Date();

    const project = await prisma.project.create({
      data: {
        name: body.name || template.name,
        status: 'active',
        progress: 0,
        clientId: body.clientId || null,
      },
    });

    // Görevleri sırayla oluştur; indeks → id eşlemesiyle bağımlılıkları bağla.
    const createdIds: string[] = [];
    for (let i = 0; i < rawTasks.length; i++) {
      const t = rawTasks[i];
      const title = typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `Görev ${i + 1}`;
      const offsetDays = Number.isFinite(Number(t.offsetDays)) ? Number(t.offsetDays) : null;
      let dueDate: Date | null = null;
      if (offsetDays !== null) {
        dueDate = new Date(start);
        dueDate.setDate(dueDate.getDate() + offsetDays);
      }
      // Yalnızca daha önce oluşturulmuş bir göreve bağlanabilir (geçmişe dönük, döngüsüz).
      const depIdx = Number(t.dependsOnIndex);
      const dependsOnId =
        Number.isInteger(depIdx) && depIdx >= 0 && depIdx < i ? createdIds[depIdx] : null;

      const created = await prisma.task.create({
        data: {
          title,
          status: 'todo',
          priority: 'normal',
          projectId: project.id,
          assigneeId: body.assigneeId || null,
          dependsOnId,
          dueDate,
        },
      });
      createdIds.push(created.id);
    }

    return NextResponse.json({ project, taskCount: createdIds.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Şablondan proje oluşturulamadı');
  }
}
