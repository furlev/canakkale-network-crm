import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export async function GET() {
  try {
    const [
      paidInvoices,
      activeClients,
      activeProjects,
      tips,
      latestNews,
      upcomingTasks,
      recentTips,
      recentInvoices,
      recentClients,
      recentProjects,
      recentTasks,
    ] = await Promise.all([
      prisma.invoice.findMany({ where: { status: 'paid' } }),
      prisma.client.count({ where: { status: 'active' } }),
      prisma.project.count({ where: { status: 'active' } }),
      prisma.tip.findMany(),
      prisma.news.findMany({ where: { status: 'published' }, orderBy: { publishDate: 'desc' }, take: 5 }),
      prisma.task.findMany({ where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' }, take: 4, include: { project: true } }),
      prisma.tip.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
      prisma.invoice.findMany({ orderBy: { updatedAt: 'desc' }, take: 3, include: { client: true } }),
      prisma.client.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
      prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 3 }),
      prisma.task.findMany({ where: { status: 'done' }, orderBy: { updatedAt: 'desc' }, take: 3 }),
    ]);

    // Revenue grouped into the last 12 months
    const now = new Date();
    const revenueByMonth: { month: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const total = paidInvoices
        .filter(inv => {
          const c = new Date(inv.createdAt);
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
        })
        .reduce((sum, inv) => sum + inv.amount, 0);
      revenueByMonth.push({ month: MONTHS_TR[d.getMonth()], value: total });
    }

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const tipStats = {
      new: tips.filter(t => t.status === 'new').length,
      investigating: tips.filter(t => t.status === 'investigating').length,
      completed: tips.filter(t => ['verified', 'converted', 'rejected'].includes(t.status)).length,
    };

    // Merge recent records into a single activity feed
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
        totalRevenue,
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
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
