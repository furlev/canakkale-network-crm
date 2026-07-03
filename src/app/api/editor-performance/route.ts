import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';

/** Editör/muhabir verimlilik özeti — yalnızca lider (B) ve yönetici (A). */
export async function GET() {
  try {
    const session = await getSession();
    if (!isLeaderOrAdmin(session)) throw new ApiError(403, 'Bu panel yalnızca ekip liderleri ve yöneticiler içindir');

    const users = await prisma.user.findMany({
      where: { role: { in: ['editor', 'user'] } },
      select: { id: true, name: true, title: true, role: true, department: true },
      orderBy: { name: 'asc' },
    });

    const [tasksDone, tasksTotal, newsByAuthor, tipsByReporter] = await Promise.all([
      prisma.task.groupBy({ by: ['assigneeId'], where: { status: 'done' }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ['assigneeId'], _count: { _all: true } }),
      prisma.news.groupBy({ by: ['author'], _count: { _all: true }, _sum: { views: true } }),
      prisma.tip.groupBy({ by: ['reporterId'], where: { status: 'converted' }, _count: { _all: true } }),
    ]);

    const perf = users.map((u) => {
      const done = tasksDone.find((t) => t.assigneeId === u.id)?._count._all || 0;
      const total = tasksTotal.find((t) => t.assigneeId === u.id)?._count._all || 0;
      const news = newsByAuthor.find((n) => n.author === u.name);
      const tips = tipsByReporter.find((t) => t.reporterId === u.id)?._count._all || 0;
      return {
        id: u.id,
        name: u.name,
        title: u.title,
        role: u.role,
        department: u.department,
        tasksDone: done,
        tasksTotal: total,
        newsCount: news?._count._all || 0,
        newsViews: news?._sum.views || 0,
        tipsConverted: tips,
      };
    });

    return NextResponse.json(perf);
  } catch (error) {
    return handleApiError(error, 'Verimlilik verileri alınamadı');
  }
}
