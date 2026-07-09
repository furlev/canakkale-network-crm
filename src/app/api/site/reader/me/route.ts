import { NextResponse } from 'next/server';
import { getCurrentReader } from '@/lib/reader-auth';

/**
 * Geçerli okuyucuyu (plan/premium) döndürür — halka açık okuma.
 * Oturum yoksa 200 + { reader: null } (istemci kolayca kontrol etsin).
 */
export async function GET() {
  const reader = await getCurrentReader();
  if (!reader) return NextResponse.json({ reader: null });
  return NextResponse.json({
    reader: {
      email: reader.email,
      name: reader.name,
      plan: reader.plan,
      isPremium: reader.isPremium,
      premiumUntil: reader.premiumUntil,
    },
  });
}
