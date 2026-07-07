import prisma from '@/lib/prisma';
import { handleApiError, requireLevel } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/stream — SSE bildirim akışı.
 * Bağlantı süresince 10 sn'de bir yeni (son gönderilenden sonra oluşan)
 * bildirimleri `data: {json}` olarak iletir; 25 sn'de bir heartbeat yorumu
 * gönderir. İstek iptal edilince (request.signal) temiz kapanır.
 */
export async function GET(request: Request) {
  try {
    await requireLevel('C');
  } catch (error) {
    return handleApiError(error, 'Bildirim akışı açılamadı');
  }

  const encoder = new TextEncoder();
  let lastSent = new Date();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stopTimers = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  };

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;
        stopTimers();
        try { controller.close(); } catch { /* zaten kapalı */ }
      };

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      // İstemciye yeniden bağlanma aralığını bildir
      send('retry: 5000\n\n');

      pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const items = await prisma.notification.findMany({
            where: { createdAt: { gt: lastSent } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });
          for (const n of items) {
            send(`data: ${JSON.stringify(n)}\n\n`);
            if (n.createdAt > lastSent) lastSent = n.createdAt;
          }
        } catch {
          /* geçici DB hatası — bir sonraki turda yeniden denenir */
        }
      }, 10_000);

      heartbeatTimer = setInterval(() => send(': ping\n\n'), 25_000);

      request.signal.addEventListener('abort', cleanup);
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      closed = true;
      stopTimers();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
