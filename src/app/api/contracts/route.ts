import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const contracts = await prisma.contract.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    return NextResponse.json(contracts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newContract = await prisma.contract.create({
      data: {
        title: body.title,
        value: body.value || 0,
        status: body.status || 'draft',
        progress: body.progress || 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        clientId: body.clientId || null,
      },
      include: { client: true }
    });
    return NextResponse.json(newContract, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
  }
}
