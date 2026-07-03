import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { summarizeText, AiNotConfiguredError } from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { isLeaderOrAdmin } from '@/lib/permissions';

// Son yayınlanan haberlerden AI ile bülten giriş paragrafı üretir.
export async function POST() {
  try {
    if (!isLeaderOrAdmin(await getSession())) throw new ApiError(403, 'Bu işlem için ekip lideri/yönetici yetkisi gerekli');
    const news = await prisma.news.findMany({
      where: { status: 'published' },
      orderBy: { publishDate: 'desc' },
      take: 8,
      select: { title: true, category: true },
    });
    if (news.length === 0) {
      return NextResponse.json({ error: 'Özetlenecek yayınlanmış haber yok' }, { status: 400 });
    }
    const list = news.map((n, i) => `${i + 1}. [${n.category}] ${n.title}`).join('\n');
    const intro = await summarizeText(
      `Aşağıdaki bu haftanın öne çıkan Çanakkale haberlerinden, bültenin başına konacak 2-3 cümlelik sıcak, davetkâr bir giriş paragrafı yaz. Haber başlıklarını tek tek sıralama, genel bir çerçeve çiz.\n\n${list}`,
      'Sen Çanakkale Network haber bülteninin editörüsün. Kısa, akıcı, Türkçe yazarsın.'
    );
    return NextResponse.json({ intro, basedOn: news.length });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'Bülten girişi üretilemedi');
  }
}
