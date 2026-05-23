import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Generate Invoice No if not provided
    const count = await prisma.invoice.count();
    const invoiceNo = body.invoiceNo || `INV-${String(count + 1).padStart(4, '0')}`;

    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        amount: body.amount,
        status: body.status || 'unpaid',
        clientId: body.clientId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }
    });
    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
