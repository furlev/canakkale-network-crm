import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/messages              -> conversation list (team members + last message + unread count)
// GET /api/messages?conversationId=xxx -> messages of one conversation (marks incoming as read)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      await prisma.message.updateMany({
        where: { conversationId, fromMe: false, read: false },
        data: { read: true }
      });
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' }
      });
      return NextResponse.json(messages);
    }

    const [users, messages] = await Promise.all([
      prisma.user.findMany({ orderBy: { name: 'asc' } }),
      prisma.message.findMany({ orderBy: { createdAt: 'desc' } })
    ]);

    const conversations = users.map(user => {
      const userMessages = messages.filter(m => m.conversationId === user.id);
      const lastMessage = userMessages[0] || null;
      const unread = userMessages.filter(m => !m.fromMe && !m.read).length;
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        status: user.status,
        lastMessage: lastMessage ? lastMessage.content : null,
        lastMessageAt: lastMessage ? lastMessage.createdAt : null,
        unread,
      };
    });

    conversations.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return NextResponse.json(conversations);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newMessage = await prisma.message.create({
      data: {
        conversationId: body.conversationId,
        content: body.content,
        fromMe: body.fromMe !== undefined ? body.fromMe : true,
        read: body.fromMe === false ? false : true,
      }
    });
    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
