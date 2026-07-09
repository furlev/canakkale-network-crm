import { handleApiError, requireLevel, listResponse } from '@/lib/api';
import prisma from '@/lib/prisma';

/**
 * İş yükü özeti (B/A) — kişi başına açık görev, gecikmiş görev, öncelik dağılımı,
 * tahmini yük puanı ve son 7 günde kaydedilen dakika. team sayfasındaki
 * iş-yükü sekmesi/heatmap bu uçtan beslenir.
 */
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

export async function GET() {
  try {
    await requireLevel('B');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

    const [users, openTasks, timeAgg] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, title: true, role: true, avatar: true },
        orderBy: { name: 'asc' },
      }),
      prisma.task.findMany({
        where: { deletedAt: null, status: { not: 'done' }, assigneeId: { not: null } },
        select: { assigneeId: true, priority: true, dueDate: true },
      }),
      prisma.timeEntry.groupBy({
        by: ['userId'],
        where: { date: { gte: weekAgo } },
        _sum: { minutes: true },
      }),
    ]);

    const minutesByUser = new Map(timeAgg.map((r) => [r.userId, r._sum.minutes ?? 0]));

    type Agg = { open: number; overdue: number; weight: number; byPriority: Record<string, number> };
    const aggByUser = new Map<string, Agg>();
    for (const t of openTasks) {
      const uid = t.assigneeId as string;
      let a = aggByUser.get(uid);
      if (!a) { a = { open: 0, overdue: 0, weight: 0, byPriority: {} }; aggByUser.set(uid, a); }
      a.open += 1;
      a.weight += PRIORITY_WEIGHT[t.priority] ?? 2;
      a.byPriority[t.priority] = (a.byPriority[t.priority] ?? 0) + 1;
      if (t.dueDate && new Date(t.dueDate) < todayStart) a.overdue += 1;
    }

    const rows = users.map((u) => {
      const a = aggByUser.get(u.id) ?? { open: 0, overdue: 0, weight: 0, byPriority: {} };
      return {
        userId: u.id,
        name: u.name,
        title: u.title,
        role: u.role,
        avatar: u.avatar,
        openTasks: a.open,
        overdueTasks: a.overdue,
        loadScore: a.weight, // öncelik-ağırlıklı tahmini yük
        byPriority: a.byPriority,
        loggedMinutes7d: minutesByUser.get(u.id) ?? 0,
      };
    });

    // En yüklüden en aza sırala (heatmap için).
    rows.sort((x, y) => y.loadScore - x.loadScore || y.openTasks - x.openTasks);
    return listResponse(rows);
  } catch (error) {
    return handleApiError(error, 'İş yükü verisi alınamadı');
  }
}
