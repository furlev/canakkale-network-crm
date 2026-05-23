import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true, assignee: true }
    });
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const count = await prisma.ticket.count();
    const ticketNo = body.ticketNo || `TKT-${String(count + 1).padStart(4, '0')}`;

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNo,
        subject: body.subject,
        description: body.description,
        status: body.status || 'open',
        priority: body.priority || 'normal',
        clientId: body.clientId || null,
        assigneeId: body.assigneeId || null,
      }
    });
    return NextResponse.json(newTicket, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
