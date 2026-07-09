import prisma from '@/lib/prisma';

/**
 * Son dakika SSE akışı (Server-Sent Events). Proxy'de `/api/site/` altında olduğu
 * için oturum gerekmez ve IP bazlı okuma hız sınırına tabidir (bkz. src/proxy.ts).
 *
 * GET /api/site/breaking-stream?since=<ISO>
 *  - Bağlantı açık kaldığı sürece 15 sn'de bir DB yoklanır; `publishedAt > since`
 *    olan yeni son dakika haberleri `data:` olayı olarak akıtılır.
 *  - Yanıt gövdesi: aynı /api/site/breaking şekli → { now, items:[...] }.
 *  - İstemci hata alırsa (SSE kesilirse) 60 sn'lik polling'e düşer (BreakingTicker).
 *
 * Body ve görsel (imageUrl, data-URI olabilir) ASLA seçilmez — satırlar hafif kalır.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_MS = 15_000;
const HEARTBEAT_MS = 25_000; // proxy/LB timeout'larına karşı yorum satırı ping
const MAX_ITEMS = 12;

type StreamItem = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string | null;
  categoryName: string | null;
  color: string | null;
  publishedAt: Date | null;
};

async function fetchSince(since: Date): Promise<StreamItem[]> {
  const rows = await prisma.siteArticle.findMany({
    where: {
      status: 'published',
      deletedAt: null,
      isBreaking: true,
      publishedAt: { gt: since },
    },
    orderBy: { publishedAt: 'desc' },
    take: MAX_ITEMS,
    select: {
      id: true,
      slug: true,
      title: true,
      categorySlug: true,
      publishedAt: true,
      category: { select: { name: true, color: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    categorySlug: r.categorySlug,
    categoryName: r.category?.name ?? null,
    color: r.category?.color ?? null,
    publishedAt: r.publishedAt,
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get('since');
  let cursor = new Date();
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (!Number.isNaN(d.getTime())) cursor = d;
  }

  const encoder = new TextEncoder();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let beatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (beatTimer) clearInterval(beatTimer);
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      };

      // İstemci bağlantıyı kapatınca (unmount / sekme) temizle.
      request.signal.addEventListener('abort', cleanup);

      // Açılış yorumu — bazı proxy'ler ilk byte'a kadar tamponlar.
      safeEnqueue(': connected\n\n');

      const poll = async () => {
        if (closed) return;
        try {
          const items = await fetchSince(cursor);
          const now = new Date();
          cursor = now; // saat kayması güvenli: bir sonraki tur sunucu saatinden ilerler
          if (items.length > 0) {
            safeEnqueue(`data: ${JSON.stringify({ now: now.toISOString(), items })}\n\n`);
          }
        } catch {
          /* DB hatası — bu turu atla, bağlantı açık kalsın (istemci polling'i de var) */
        }
      };

      pollTimer = setInterval(poll, POLL_MS);
      beatTimer = setInterval(() => safeEnqueue(': ping\n\n'), HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (beatTimer) clearInterval(beatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx tamponlamasını kapat (anlık teslim)
    },
  });
}
