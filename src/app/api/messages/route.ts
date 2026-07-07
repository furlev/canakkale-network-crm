import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, getPagination, requireLevel } from '@/lib/api';
import { messageCreate } from '@/lib/schemas';

// Gerçek kişiden-kişiye mesajlaşma. "conversationId" = karşı tarafın kullanıcı id'si;
// "ben" tarafı oturumdan gelir, yanıtlar fromMe alanıyla normalize edilir.

// GET /api/messages                      -> konuşma listesi (diğer kullanıcılar + son mesaj + okunmamış)
// GET /api/messages?conversationId=xxx   -> o kişiyle mesajlaşma (gelenleri okundu işaretler)
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const me = session.sub;

    const { searchParams } = new URL(request.url);
    const other = searchParams.get('conversationId');
    // İsteğe bağlı sayfalama (?page=&limit=); yoksa makul bir üst sınır uygulanır.
    const pagination = getPagination(request);

    if (other) {
      await prisma.message.updateMany({
        where: { senderId: other, recipientId: me, read: false },
        data: { read: true },
      });
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: me, recipientId: other },
            { senderId: other, recipientId: me },
          ],
        },
        orderBy: { createdAt: 'asc' },
        ...(pagination ?? { skip: 0, take: 500 }),
      });
      return NextResponse.json(messages.map(m => ({
        id: m.id,
        conversationId: other,
        fromMe: m.senderId === me,
        content: m.content,
        createdAt: m.createdAt,
      })));
    }

    const [users, messages] = await Promise.all([
      prisma.user.findMany({
        where: { id: { not: me } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, role: true, department: true, status: true },
      }),
      prisma.message.findMany({
        where: { OR: [{ senderId: me }, { recipientId: me }] },
        orderBy: { createdAt: 'desc' },
        ...(pagination ?? { skip: 0, take: 500 }),
      }),
    ]);

    const conversations = users.map(user => {
      const between = messages.filter(m =>
        (m.senderId === me && m.recipientId === user.id) ||
        (m.senderId === user.id && m.recipientId === me)
      );
      const lastMessage = between[0] || null;
      const unread = between.filter(m => m.senderId === user.id && m.recipientId === me && !m.read).length;
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
    return handleApiError(error, 'Mesajlar alınamadı');
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireLevel('C');

    const body = await parseBody(request, messageCreate);
    if (body.conversationId === session.sub) throw new ApiError(400, 'Kendinize mesaj gönderemezsiniz');

    const recipient = await prisma.user.findUnique({ where: { id: body.conversationId }, select: { id: true } });
    if (!recipient) throw new ApiError(404, 'Alıcı bulunamadı');

    const created = await prisma.message.create({
      data: {
        senderId: session.sub,
        recipientId: body.conversationId,
        content: body.content,
        read: false,
      },
    });
    return NextResponse.json({
      id: created.id,
      conversationId: body.conversationId,
      fromMe: true,
      content: created.content,
      createdAt: created.createdAt,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Mesaj gönderilemedi');
  }
}
