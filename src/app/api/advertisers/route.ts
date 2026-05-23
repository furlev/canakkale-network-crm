import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const advertisers = await prisma.advertiser.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(advertisers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch advertisers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newAdvertiser = await prisma.advertiser.create({
      data: {
        company: body.company,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        activeAds: body.activeAds || 0,
        totalSpent: body.totalSpent || 0,
        status: body.status || 'active',
      }
    });
    return NextResponse.json(newAdvertiser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create advertiser' }, { status: 500 });
  }
}
