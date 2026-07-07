import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import prisma from '@/lib/prisma';
import { safeEqual } from '@/lib/secure';

/**
 * ICS takvim aboneliği — OTURUMSUZ (proxy PUBLIC_PREFIXES'te).
 * Kendini HMAC imzalı kişisel token ile korur: ?u=<userId>&t=<token>,
 * token = HMAC-SHA256("ics:<userId>", AUTH_SECRET). Sabit-zamanlı karşılaştırma.
 *
 * İçerik: tüm Event kayıtları + kullanıcıya atanmış, son teslim tarihi olan
 * görevler (tüm gün VEVENT — Google/Apple uyumluluğu için VTODO yerine).
 */

/** ICS metin kaçışı: \ ; , ve satır sonları (RFC 5545 §3.3.11) */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTC zaman damgası: 20260707T091500Z */
function toUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Tüm gün tarih: 20260707 */
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** RFC 5545 satır katlama: 75 oktet sınırı, devam satırı boşlukla başlar (UTF-8 güvenli). */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const max = first ? 75 : 74; // devam satırlarında baştaki boşluk 1 oktet yer
    let end = Math.min(start + max, bytes.length);
    // Çok baytlı UTF-8 karakteri ortadan bölme: devam baytı (10xxxxxx) görürsen geri çekil
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push((first ? '' : ' ') + bytes.subarray(start, end).toString('utf8'));
    start = end;
    first = false;
  }
  return parts.join('\r\n');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t') || '';

  const secret = process.env.AUTH_SECRET;
  if (!secret || !userId || !token) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 401 });
  }
  const expected = createHmac('sha256', secret).update(`ics:${userId}`).digest('hex');
  if (!safeEqual(token, expected)) {
    return NextResponse.json({ error: 'Geçersiz takvim anahtarı' }, { status: 401 });
  }

  try {
    const [events, tasks] = await Promise.all([
      prisma.event.findMany({ orderBy: { date: 'asc' } }),
      prisma.task.findMany({
        where: { assigneeId: userId, deletedAt: null, dueDate: { not: null } },
        orderBy: { dueDate: 'asc' },
        select: { id: true, title: true, description: true, dueDate: true, status: true, updatedAt: true },
      }),
    ]);

    const now = toUtcStamp(new Date());
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Canakkale Network CRM//TR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Çanakkale Network CRM',
      'X-WR-TIMEZONE:Europe/Istanbul',
    ];

    const typeLabel: Record<string, string> = { meeting: 'Toplantı', deadline: 'Teslim Tarihi', event: 'Etkinlik' };

    for (const event of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:event-${event.id}@panel.canakkale.network`,
        `DTSTAMP:${now}`,
        `DTSTART:${toUtcStamp(event.date)}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `CATEGORIES:${escapeIcs(typeLabel[event.type] || event.type)}`,
      );
      if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
      lines.push('END:VEVENT');
    }

    for (const task of tasks) {
      const due = task.dueDate!;
      lines.push(
        'BEGIN:VEVENT',
        `UID:task-${task.id}@panel.canakkale.network`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${toDateOnly(due)}`,
        `SUMMARY:${escapeIcs(`Görev: ${task.title}`)}`,
        'CATEGORIES:Görev',
      );
      if (task.description) lines.push(`DESCRIPTION:${escapeIcs(task.description)}`);
      if (task.status === 'done') lines.push('STATUS:CANCELLED'); // tamamlanan görevler takvimde sönük görünsün
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const body = lines.map(foldLine).join('\r\n') + '\r\n';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="canakkale-network-crm.ics"',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[api] ICS takvimi üretilemedi:', error);
    return NextResponse.json({ error: 'Takvim üretilemedi' }, { status: 500 });
  }
}
