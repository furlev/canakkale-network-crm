import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const estimates = await prisma.estimate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    return NextResponse.json(estimates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const count = await prisma.estimate.count();
    const estimateNo = body.estimateNo || `EST-${String(count + 1).padStart(4, '0')}`;

    const newEstimate = await prisma.estimate.create({
      data: {
        estimateNo,
        amount: body.amount,
        status: body.status || 'draft',
        clientId: body.clientId || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      }
    });
    return NextResponse.json(newEstimate, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
  }
}
