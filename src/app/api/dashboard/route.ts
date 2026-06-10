import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export async function GET() {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      revenueAgg,
      activeClients,
      activeProjects,
      tipGroups,
      monthlyRows,
      latestNews,
      upcomingTasks,
      recentTips,
      recentInvoices,
      recentClients,
      recentProjects,
      recentTasks,
    ] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
      prisma.client.count({ where: { status: 'active' } }),
      prisma.project.count({ where: { status: 'active' } }),
      prisma.tip.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.$queryRaw<{ m: Date; total: number }[]>`
        SELECT date_trunc('month', "createdAt") AS m, SUM(amount)::float AS total
        FROM "Invoice"
        WHERE status = 'paid' AND "createdAt" >= ${twelveMonthsAgo}
        GROUP BY 1
      `,
      prisma.news.findMany({ where: { status: 'published' }, orderBy: { publishDate: 'desc' }, take: 5 }),
      prisma.task.findMany({ where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' }, take: 4, include: { project: { select: { name: true } } } }),
      prisma.tip.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { subject: true, createdAt: true } }),
      prisma.invoice.findMany({ orderBy: { updatedAt: 'desc' }, take: 3, select: { invoiceNo: true, amount: true, status: true, updatedAt: true } }),
      prisma.client.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { companyName: true, createdAt: true } }),
      prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 3, select: { name: true, updatedAt: true } }),
      prisma.task.findMany({ where: { status: 'done' }, orderBy: { updatedAt: 'desc' }, take: 3, select: { title: true, updatedAt: true } }),
    ]);

    // Last 12 months series from the grouped rows
    const byMonthKey = new Map<string, number>();
    for (const row of monthlyRows) {
      const d = new Date(row.m);
      byMonthKey.set(`${d.getFullYear()}-${d.getMonth()}`, row.total);
    }
    const revenueByMonth: { month: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      revenueByMonth.push({
        month: MONTHS_TR[d.getMonth()],
        value: byMonthKey.get(`${d.getFullYear()}-${d.getMonth()}`) || 0,
      });
    }

    const tipCountByStatus = Object.fromEntries(tipGroups.map(g => [g.status, g._count._all]));
    const tipStats = {
      new: tipCountByStatus['new'] || 0,
      investigating: tipCountByStatus['investigating'] || 0,
      completed: (tipCountByStatus['verified'] || 0) + (tipCountByStatus['converted'] || 0) + (tipCountByStatus['rejected'] || 0),
    };

    type Activity = { text: string; date: Date; dot: string; emoji: string };
    const activities: Activity[] = [
      ...recentTips.map(t => ({ text: `Yeni ihbar alındı — ${t.subject}`, date: t.createdAt, dot: 'warning', emoji: '🔔' })),
      ...recentInvoices.map(i => ({
        text: i.status === 'paid'
          ? `Fatura ${i.invoiceNo} ödendi — ₺${i.amount.toLocaleString('tr-TR')}`
          : `Fatura ${i.invoiceNo} oluşturuldu — ₺${i.amount.toLocaleString('tr-TR')}`,
        date: i.updatedAt, dot: i.status === 'paid' ? 'success' : 'primary', emoji: i.status === 'paid' ? '✅' : '📄'
      })),
      ...recentClients.map(c => ({ text: `Yeni müşteri eklendi — ${c.companyName}`, date: c.createdAt, dot: 'accent', emoji: '🤝' })),
      ...recentProjects.map(p => ({ text: `Proje güncellendi — ${p.name}`, date: p.updatedAt, dot: 'primary', emoji: '📝' })),
      ...recentTasks.map(t => ({ text: `Görev tamamlandı — ${t.title}`, date: t.updatedAt, dot: 'success', emoji: '✅' })),
    ];
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      stats: {
        totalRevenue: revenueAgg._sum.amount || 0,
        activeClients,
        activeProjects,
        newTips: tipStats.new,
      },
      revenueByMonth,
      tipStats,
      activities: activities.slice(0, 5),
      upcomingTasks: upcomingTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        project: t.project?.name || null,
      })),
      latestNews: latestNews.map(n => ({
        id: n.id,
        title: n.title,
        views: n.views,
        publishDate: n.publishDate,
      })),
    });
  } catch (error) {
    console.error('[api] dashboard:', error);
    return NextResponse.json({ error: 'Dashboard verisi alınamadı' }, { status: 500 });
  }
}
