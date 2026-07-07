import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { handleApiError, requireLevel } from '@/lib/api';

export async function GET() {
  try {
    await requireLevel('B');
    return NextResponse.json({ enabled: await aiEnabled() });
  } catch (error) {
    return handleApiError(error, 'AI durumu alınamadı');
  }
}
