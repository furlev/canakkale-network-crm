import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';

const WEEKS = 6;
const WEEK_MS = 7 * 86400000;

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
    const userIds = users.map((u) => u.id);

    const sinceTrend = new Date(Date.now() - WEEKS * WEEK_MS);

    const [
      tasksDone,
      tasksTotal,
      newsByAuthor,
      tipsByReporter,
      siteByAuthor,
      breakingByAuthor,
      draftsByReviewer,
      recentArticles,
    ] = await Promise.all([
      prisma.task.groupBy({ by: ['assigneeId'], where: { status: 'done' }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ['assigneeId'], _count: { _all: true } }),
      prisma.news.groupBy({ by: ['author'], _count: { _all: true }, _sum: { views: true } }),
      prisma.tip.groupBy({ by: ['reporterId'], where: { status: 'converted' }, _count: { _all: true } }),
      // Site haberleri: yayınlanan makale sayısı + toplam okunma (yazar bazlı)
      prisma.siteArticle.groupBy({
        by: ['authorId'],
        where: { deletedAt: null, status: 'published', authorId: { in: userIds } },
        _count: { _all: true },
        _sum: { views: true },
      }),
      // Son dakika (isBreaking) yayın sayısı
      prisma.siteArticle.groupBy({
        by: ['authorId'],
        where: { deletedAt: null, status: 'published', isBreaking: true, authorId: { in: userIds } },
        _count: { _all: true },
      }),
      // AI taslak onayları (reviewerId): onaylanmış/yayınlanmış
      prisma.aiDraft.groupBy({
        by: ['reviewerId'],
        where: { status: { in: ['approved', 'published'] }, reviewerId: { in: userIds } },
        _count: { _all: true },
      }),
      // Haftalık trend için son 6 haftanın yayınları (JS'te haftalık kovalanır)
      prisma.siteArticle.findMany({
        where: { deletedAt: null, status: 'published', authorId: { in: userIds }, publishedAt: { gte: sinceTrend } },
        select: { authorId: true, publishedAt: true },
      }),
    ]);

    // Yazar bazlı haftalık kovalar: index 0 = en eski hafta, WEEKS-1 = bu hafta
    const trend: Record<string, number[]> = {};
    for (const a of recentArticles) {
      if (!a.authorId || !a.publishedAt) continue;
      let idx = Math.floor((a.publishedAt.getTime() - sinceTrend.getTime()) / WEEK_MS);
      if (idx < 0) idx = 0;
      if (idx > WEEKS - 1) idx = WEEKS - 1;
      (trend[a.authorId] ??= new Array(WEEKS).fill(0))[idx]++;
    }

    const perf = users.map((u) => {
      const done = tasksDone.find((t) => t.assigneeId === u.id)?._count._all || 0;
      const total = tasksTotal.find((t) => t.assigneeId === u.id)?._count._all || 0;
      const news = newsByAuthor.find((n) => n.author === u.name);
      const tips = tipsByReporter.find((t) => t.reporterId === u.id)?._count._all || 0;
      const site = siteByAuthor.find((s) => s.authorId === u.id);
      const breaking = breakingByAuthor.find((s) => s.authorId === u.id)?._count._all || 0;
      const drafts = draftsByReviewer.find((d) => d.reviewerId === u.id)?._count._all || 0;

      const newsViews = news?._sum.views || 0;
      const siteViews = site?._sum.views || 0;

      return {
        id: u.id,
        name: u.name,
        title: u.title,
        role: u.role,
        department: u.department,
        tasksDone: done,
        tasksTotal: total,
        newsCount: news?._count._all || 0,
        newsViews,
        tipsConverted: tips,
        // ── Site metrikleri (gerçek) ──
        siteArticles: site?._count._all || 0,
        siteViews,
        breakingCount: breaking,
        draftsApproved: drafts,
        totalReads: newsViews + siteViews,
        weeklyTrend: trend[u.id] ?? new Array(WEEKS).fill(0),
      };
    });

    return NextResponse.json(perf);
  } catch (error) {
    return handleApiError(error, 'Verimlilik verileri alınamadı');
  }
}
