import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { handleApiError, requireLevel } from '@/lib/api';

/**
 * Kişisel ICS abonelik adresi üretir (her oturum seviyesi).
 * Token = HMAC-SHA256("ics:<userId>", AUTH_SECRET) — /api/calendar/ics bunu doğrular.
 */
export async function GET(request: Request) {
  try {
    const session = await requireLevel('C');
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET tanımlı değil');
    const token = createHmac('sha256', secret).update(`ics:${session.sub}`).digest('hex');
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      url: `${origin}/api/calendar/ics?u=${encodeURIComponent(session.sub)}&t=${token}`,
    });
  } catch (error) {
    return handleApiError(error, 'Takvim bağlantısı oluşturulamadı');
  }
}
