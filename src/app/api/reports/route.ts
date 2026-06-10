import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export async function GET() {
  try {
    const [invoices, clients, projects, tips, leads, expenses] = await Promise.all([
      prisma.invoice.findMany({ include: { client: true } }),
      prisma.client.findMany({ include: { projects: true } }),
      prisma.project.findMany({ include: { client: true } }),
      prisma.tip.findMany(),
      prisma.lead.findMany(),
      prisma.expense.findMany(),
    ]);

    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.amount, 0);
    const unpaidTotal = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Monthly revenue & expenses for the last 6 months
    const now = new Date();
    const monthly: { month: string; revenue: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inMonth = (date: Date | string) => {
        const c = new Date(date);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      };
      monthly.push({
        month: MONTHS_TR[d.getMonth()],
        revenue: paidInvoices.filter(inv => inMonth(inv.createdAt)).reduce((s, inv) => s + inv.amount, 0),
        expense: expenses.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0),
      });
    }

    // Top clients by paid revenue
    const revenueByClient = new Map<string, { name: string; revenue: number; projects: number; satisfaction: number }>();
    for (const client of clients) {
      revenueByClient.set(client.id, {
        name: client.companyName,
        revenue: 0,
        projects: client.projects.length,
        satisfaction: client.satisfaction,
      });
    }
    for (const inv of paidInvoices) {
      if (inv.clientId && revenueByClient.has(inv.clientId)) {
        revenueByClient.get(inv.clientId)!.revenue += inv.amount;
      }
    }
    const topClients = Array.from(revenueByClient.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const projectStatus = {
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      on_hold: projects.filter(p => p.status === 'on_hold').length,
    };

    const tipStatus = {
      new: tips.filter(t => t.status === 'new').length,
      investigating: tips.filter(t => t.status === 'investigating').length,
      verified: tips.filter(t => t.status === 'verified').length,
      converted: tips.filter(t => t.status === 'converted').length,
      rejected: tips.filter(t => t.status === 'rejected').length,
    };
    const tipConversion = tips.length > 0
      ? Math.round((tipStatus.converted / tips.length) * 100)
      : 0;

    const leadStatus = {
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      proposal: leads.filter(l => l.status === 'proposal').length,
      won: leads.filter(l => l.status === 'won').length,
      lost: leads.filter(l => l.status === 'lost').length,
    };
    const pipelineValue = leads.filter(l => !['won', 'lost'].includes(l.status)).reduce((s, l) => s + l.value, 0);

    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    }

    return NextResponse.json({
      summary: {
        totalRevenue,
        unpaidTotal,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        activeClients: clients.filter(c => c.status === 'active').length,
        totalClients: clients.length,
        completedProjects: projectStatus.completed,
        tipConversion,
      },
      monthly,
      topClients,
      projectStatus,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        progress: p.progress,
        client: p.client?.companyName || null,
        deadline: p.deadline,
      })),
      tipStatus,
      totalTips: tips.length,
      leadStatus,
      pipelineValue,
      expensesByCategory,
      invoiceStatus: {
        paid: invoices.filter(i => i.status === 'paid').length,
        unpaid: invoices.filter(i => i.status === 'unpaid').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        cancelled: invoices.filter(i => i.status === 'cancelled').length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
