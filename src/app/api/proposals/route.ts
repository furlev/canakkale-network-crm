import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const proposals = await prisma.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    return NextResponse.json(proposals);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newProposal = await prisma.proposal.create({
      data: {
        title: body.title,
        description: body.description || null,
        value: body.value || 0,
        status: body.status || 'draft',
        clientId: body.clientId || null,
      },
      include: { client: true }
    });
    return NextResponse.json(newProposal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
