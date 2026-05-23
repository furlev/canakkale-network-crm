import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(subscribers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newSubscriber = await prisma.subscriber.create({
      data: {
        email: body.email,
        source: body.source || 'website',
        status: body.status || 'active',
      }
    });
    return NextResponse.json(newSubscriber, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create subscriber' }, { status: 500 });
  }
}
