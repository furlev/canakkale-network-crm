import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export async function GET() {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      invoiceGroups,
      revenueRows,
      expenseRows,
      expenseAgg,
      topClientGroups,
      clientCounts,
      projectGroups,
      projects,
      tipGroups,
      leadGroups,
      pipelineAgg,
      expenseCatGroups,
    ] = await Promise.all([
      prisma.invoice.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
      prisma.$queryRaw<{ m: Date; total: number }[]>`
        SELECT date_trunc('month', "createdAt") AS m, SUM(amount)::float AS total
        FROM "Invoice"
        WHERE status = 'paid' AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY 1
      `,
      prisma.$queryRaw<{ m: Date; total: number }[]>`
        SELECT date_trunc('month', "date") AS m, SUM(amount)::float AS total
        FROM "Expense"
        WHERE "date" >= ${sixMonthsAgo}
        GROUP BY 1
      `,
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: { status: 'paid', clientId: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      prisma.client.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.project.findMany({
        select: { id: true, name: true, status: true, progress: true, deadline: true, client: { select: { companyName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.tip.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.lead.aggregate({ _sum: { value: true }, where: { status: { notIn: ['won', 'lost'] } } }),
      prisma.expense.groupBy({ by: ['category'], _sum: { amount: true } }),
    ]);

    const invByStatus = Object.fromEntries(invoiceGroups.map(g => [g.status, g]));
    const totalRevenue = invByStatus['paid']?._sum.amount || 0;
    const unpaidTotal = (invByStatus['unpaid']?._sum.amount || 0) + (invByStatus['overdue']?._sum.amount || 0);
    const totalExpenses = expenseAgg._sum.amount || 0;

    // Monthly revenue + expense series (last 6 months)
    const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const revMap = new Map(revenueRows.map(r => [keyOf(new Date(r.m)), r.total]));
    const expMap = new Map(expenseRows.map(r => [keyOf(new Date(r.m)), r.total]));
    const monthly: { month: string; revenue: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({
        month: MONTHS_TR[d.getMonth()],
        revenue: revMap.get(keyOf(d)) || 0,
        expense: expMap.get(keyOf(d)) || 0,
      });
    }

    // Top clients: resolve names + project counts for the grouped ids
    const topIds = topClientGroups.map(g => g.clientId).filter((id): id is string => !!id);
    const topClientRecords = topIds.length
      ? await prisma.client.findMany({
          where: { id: { in: topIds } },
          select: { id: true, companyName: true, satisfaction: true, _count: { select: { projects: true } } },
        })
      : [];
    const clientById = new Map(topClientRecords.map(c => [c.id, c]));
    const topClients = topClientGroups
      .map(g => {
        const c = g.clientId ? clientById.get(g.clientId) : undefined;
        return c ? {
          name: c.companyName,
          revenue: g._sum.amount || 0,
          projects: c._count.projects,
          satisfaction: c.satisfaction,
        } : null;
      })
      .filter(Boolean);

    const projByStatus = Object.fromEntries(projectGroups.map(g => [g.status, g._count._all]));
    const tipByStatus = Object.fromEntries(tipGroups.map(g => [g.status, g._count._all]));
    const leadByStatus = Object.fromEntries(leadGroups.map(g => [g.status, g._count._all]));
    const clientByStatus = Object.fromEntries(clientCounts.map(g => [g.status, g._count._all]));

    const totalTips = Object.values(tipByStatus).reduce((s, n) => s + n, 0);
    const tipConversion = totalTips > 0 ? Math.round(((tipByStatus['converted'] || 0) / totalTips) * 100) : 0;

    const expensesByCategory: Record<string, number> = {};
    for (const g of expenseCatGroups) {
      expensesByCategory[g.category] = g._sum.amount || 0;
    }

    return NextResponse.json({
      summary: {
        totalRevenue,
        unpaidTotal,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        activeClients: clientByStatus['active'] || 0,
        totalClients: Object.values(clientByStatus).reduce((s, n) => s + n, 0),
        completedProjects: projByStatus['completed'] || 0,
        tipConversion,
      },
      monthly,
      topClients,
      projectStatus: {
        active: projByStatus['active'] || 0,
        completed: projByStatus['completed'] || 0,
        on_hold: projByStatus['on_hold'] || 0,
      },
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        progress: p.progress,
        client: p.client?.companyName || null,
        deadline: p.deadline,
      })),
      tipStatus: {
        new: tipByStatus['new'] || 0,
        investigating: tipByStatus['investigating'] || 0,
        verified: tipByStatus['verified'] || 0,
        converted: tipByStatus['converted'] || 0,
        rejected: tipByStatus['rejected'] || 0,
      },
      totalTips,
      leadStatus: {
        new: leadByStatus['new'] || 0,
        contacted: leadByStatus['contacted'] || 0,
        proposal: leadByStatus['proposal'] || 0,
        won: leadByStatus['won'] || 0,
        lost: leadByStatus['lost'] || 0,
      },
      pipelineValue: pipelineAgg._sum.value || 0,
      expensesByCategory,
      invoiceStatus: {
        paid: invByStatus['paid']?._count._all || 0,
        unpaid: invByStatus['unpaid']?._count._all || 0,
        overdue: invByStatus['overdue']?._count._all || 0,
        cancelled: invByStatus['cancelled']?._count._all || 0,
      },
    });
  } catch (error) {
    console.error('[api] reports:', error);
    return NextResponse.json({ error: 'Rapor verisi alınamadı' }, { status: 500 });
  }
}
