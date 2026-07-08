import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';
import { computeInvoiceTotals, type InvoiceItemLike } from '@/lib/invoice-pdf';

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const HORIZON = 6; // ileriye dönük ay sayısı

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function parseItems(json: string | null | undefined): InvoiceItemLike[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.map((it) => ({
      description: String(it?.description ?? ''),
      quantity: Number(it?.quantity) || 0,
      unitPrice: Number(it?.unitPrice) || 0,
      vatRate: Number(it?.vatRate) || 0,
    }));
  } catch {
    return [];
  }
}

function addInterval(d: Date, interval: string): Date {
  const n = new Date(d);
  if (interval === 'yearly') n.setFullYear(n.getFullYear() + 1);
  else if (interval === 'quarterly') n.setMonth(n.getMonth() + 3);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

/**
 * GET /api/reports/cashflow — ileriye dönük nakit akışı projeksiyonu (A/B).
 * Girdiler: tahsil edilmiş gelir (bağlam), beklenen tahsilat (unpaid/overdue vade),
 * tekrarlayan faturalar (aktif şablonların vade projeksiyonu) ve gider projeksiyonu
 * (son 3 ayın ortalaması). Sonuç aylık kırılım + özet.
 */
export async function GET() {
  try {
    await requireLevel('B');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const horizonEnd = new Date(now.getFullYear(), now.getMonth() + HORIZON, 1);

    const [paidAgg, outstanding, recurring, recentExpenses, expenseAllAgg] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { deletedAt: null, status: 'paid' } }),
      prisma.invoice.findMany({
        where: { deletedAt: null, status: { in: ['unpaid', 'overdue'] } },
        select: { amount: true, dueDate: true },
      }),
      prisma.recurringInvoice.findMany({ where: { active: true } }),
      prisma.expense.findMany({ where: { date: { gte: threeMonthsAgo } }, select: { amount: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);

    // ── Ay iskeleti (bu ay .. +HORIZON-1) ──
    type Bucket = { key: string; label: string; expectedInvoices: number; recurring: number; projectedExpense: number };
    const months: Bucket[] = [];
    const byKey = new Map<string, Bucket>();
    for (let i = 0; i < HORIZON; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const b: Bucket = {
        key: keyOf(d),
        label: `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`,
        expectedInvoices: 0,
        recurring: 0,
        projectedExpense: 0,
      };
      months.push(b);
      byKey.set(b.key, b);
    }

    // ── Gider projeksiyonu: son 3 ayın aylık ortalaması ──
    const recentExpenseTotal = recentExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const monthlyExpenseAvg = Math.round((recentExpenseTotal / 3) * 100) / 100;
    for (const b of months) b.projectedExpense = monthlyExpenseAvg;

    // ── Beklenen tahsilat: açık faturaların vadeleri ──
    // Vadesi geçmiş / vadesiz olanlar ilk aya (şimdi tahsil edilmeli) yazılır.
    let overdueNow = 0;
    for (const inv of outstanding) {
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (!due || due < startOfMonth) {
        overdueNow += inv.amount || 0;
        months[0].expectedInvoices += inv.amount || 0;
        continue;
      }
      const b = byKey.get(keyOf(due));
      if (b) b.expectedInvoices += inv.amount || 0;
      // Horizon dışındaysa yok sayılır (uzak vade)
    }

    // ── Tekrarlayan faturalar: aktif şablonların horizon içindeki vadeleri ──
    let monthlyRecurring = 0;
    for (const tpl of recurring) {
      const totals = computeInvoiceTotals(parseItems(tpl.items), 0);
      if (tpl.interval === 'monthly') monthlyRecurring += totals.amount;
      // İlk vade: nextRunAt (yoksa şimdi)
      let occ = tpl.nextRunAt ? new Date(tpl.nextRunAt) : new Date(now);
      // Geçmişteki vadeyi bu aya çek
      if (occ < startOfMonth) occ = new Date(startOfMonth);
      let guard = 0;
      while (occ < horizonEnd && guard < 240) {
        const b = byKey.get(keyOf(occ));
        if (b) b.recurring += totals.amount;
        occ = addInterval(occ, tpl.interval);
        guard++;
      }
    }

    // ── Aylık net + kümülatif ──
    let cumulative = 0;
    const horizon = months.map((b) => {
      const inflow = Math.round((b.expectedInvoices + b.recurring) * 100) / 100;
      const outflow = Math.round(b.projectedExpense * 100) / 100;
      const net = Math.round((inflow - outflow) * 100) / 100;
      cumulative = Math.round((cumulative + net) * 100) / 100;
      return {
        month: b.label,
        expectedInvoices: Math.round(b.expectedInvoices * 100) / 100,
        recurring: Math.round(b.recurring * 100) / 100,
        inflow,
        projectedExpense: outflow,
        net,
        cumulative,
      };
    });

    const projectedInflow = horizon.reduce((s, m) => s + m.inflow, 0);
    const projectedExpense = horizon.reduce((s, m) => s + m.projectedExpense, 0);

    return NextResponse.json({
      horizon,
      summary: {
        paidToDate: Math.round((paidAgg._sum.amount || 0) * 100) / 100,
        outstanding: Math.round(outstanding.reduce((s, i) => s + (i.amount || 0), 0) * 100) / 100,
        overdueNow: Math.round(overdueNow * 100) / 100,
        monthlyRecurring: Math.round(monthlyRecurring * 100) / 100,
        monthlyExpenseAvg,
        projectedInflow: Math.round(projectedInflow * 100) / 100,
        projectedExpense: Math.round(projectedExpense * 100) / 100,
        projectedNet: Math.round((projectedInflow - projectedExpense) * 100) / 100,
        totalExpenses: Math.round((expenseAllAgg._sum.amount || 0) * 100) / 100,
      },
      assumptions: {
        horizonMonths: HORIZON,
        expenseBasis: 'Son 3 ayın aylık ortalaması',
        note: 'Projeksiyon tahminidir; açık faturaların vadesine ve tekrarlayan şablonlara dayanır.',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Nakit akışı raporu alınamadı');
  }
}
