import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const tips = await prisma.tip.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reporter: true }
    });
    return NextResponse.json(tips);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tips' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Generate a tip number like TIP-001
    const count = await prisma.tip.count();
    const tipNumber = `TIP-${String(count + 1).padStart(3, '0')}`;

    const newTip = await prisma.tip.create({
      data: {
        tipNumber,
        subject: body.subject,
        content: body.content,
        source: body.source || 'Anonim',
        sourceType: body.sourceType || 'email',
        priority: body.priority || 'normal',
        status: body.status || 'new',
      }
    });

    return NextResponse.json(newTip, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create tip' }, { status: 500 });
  }
}
