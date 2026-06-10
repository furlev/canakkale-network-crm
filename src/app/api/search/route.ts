import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError } from '@/lib/api';

type SearchResult = {
  type: string;
  icon: string;
  title: string;
  subtitle?: string;
  link: string;
};

// GET /api/search?q=... -> modüller arası hızlı arama (her modülden en fazla 5 sonuç)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json({ results: [] });

    const contains = { contains: q, mode: 'insensitive' as const };

    const [clients, contacts, invoices, projects, tasks, news, tips, notes, contracts, proposals, users] = await Promise.all([
      prisma.client.findMany({ where: { OR: [{ companyName: contains }, { contactName: contains }, { email: contains }] }, take: 5, select: { companyName: true, contactName: true } }),
      prisma.contact.findMany({ where: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { company: contains }] }, take: 5, select: { firstName: true, lastName: true, company: true } }),
      prisma.invoice.findMany({ where: { invoiceNo: contains }, take: 5, select: { invoiceNo: true, amount: true, status: true } }),
      prisma.project.findMany({ where: { name: contains }, take: 5, select: { name: true, status: true } }),
      prisma.task.findMany({ where: { title: contains }, take: 5, select: { title: true, status: true } }),
      prisma.news.findMany({ where: { title: contains }, take: 5, select: { title: true, status: true } }),
      prisma.tip.findMany({ where: { OR: [{ subject: contains }, { tipNumber: contains }] }, take: 5, select: { subject: true, tipNumber: true } }),
      prisma.note.findMany({ where: { OR: [{ title: contains }, { content: contains }] }, take: 5, select: { title: true, category: true } }),
      prisma.contract.findMany({ where: { title: contains }, take: 5, select: { title: true, status: true } }),
      prisma.proposal.findMany({ where: { title: contains }, take: 5, select: { title: true, status: true } }),
      prisma.user.findMany({ where: { OR: [{ name: contains }, { email: contains }] }, take: 5, select: { name: true, role: true } }),
    ]);

    const results: SearchResult[] = [
      ...clients.map(c => ({ type: 'Müşteri', icon: '🏢', title: c.companyName, subtitle: c.contactName, link: '/clients' })),
      ...contacts.map(c => ({ type: 'Kişi', icon: '👥', title: `${c.firstName} ${c.lastName}`, subtitle: c.company || undefined, link: '/contacts' })),
      ...invoices.map(i => ({ type: 'Fatura', icon: '📄', title: i.invoiceNo, subtitle: `₺${i.amount.toLocaleString('tr-TR')}`, link: '/invoices' })),
      ...projects.map(p => ({ type: 'Proje', icon: '📁', title: p.name, link: '/projects' })),
      ...tasks.map(t => ({ type: 'Görev', icon: '✅', title: t.title, link: '/tasks' })),
      ...news.map(n => ({ type: 'Haber', icon: '📰', title: n.title, link: '/news' })),
      ...tips.map(t => ({ type: 'İhbar', icon: '🔔', title: t.subject, subtitle: t.tipNumber, link: '/tips' })),
      ...notes.map(n => ({ type: 'Not', icon: '📝', title: n.title, subtitle: n.category, link: '/notes' })),
      ...contracts.map(c => ({ type: 'Sözleşme', icon: '📜', title: c.title, link: '/contracts' })),
      ...proposals.map(p => ({ type: 'Teklifname', icon: '📑', title: p.title, link: '/proposals' })),
      ...users.map(u => ({ type: 'Ekip', icon: '👨‍💼', title: u.name, link: '/team' })),
    ];

    return NextResponse.json({ results: results.slice(0, 25) });
  } catch (error) {
    return handleApiError(error, 'Arama başarısız');
  }
}
