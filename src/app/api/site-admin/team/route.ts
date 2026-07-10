import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getSiteTeam } from '@/lib/site';

// Ekip vitrini (Setting key: 'siteTeam') — hakkımızda sayfasındaki ekip bölümünü besler.

const memberSchema = z.object({
  name: z.string().trim().min(1, 'İsim zorunlu').max(80),
  role: z.string().trim().max(80),
  // Fotoğraf: tam URL ya da /site/... yolu olabilir → serbest metin.
  photoUrl: z.string().trim().max(500).optional(),
});

const groupSchema = z.object({
  title: z.string().trim().min(1, 'Grup başlığı zorunlu').max(80),
  members: z.array(memberSchema).max(100),
});

const teamSchema = z.object({
  groups: z.array(groupSchema).max(30),
});

/** GET — ekip vitrini (Setting 'siteTeam' || boş). */
export async function GET() {
  try {
    await requireLevel('B');
    const team = await getSiteTeam();
    return NextResponse.json(team);
  } catch (error) {
    return handleApiError(error, 'Ekip vitrini alınamadı');
  }
}

/** PUT — ekip vitrinini doğrula ve Setting('siteTeam') olarak kaydet. */
export async function PUT(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, teamSchema);

    const value = JSON.stringify(body);
    await prisma.setting.upsert({
      where: { key: 'siteTeam' },
      update: { value },
      create: { key: 'siteTeam', value },
    });

    const memberCount = body.groups.reduce((sum, g) => sum + g.members.length, 0);
    await audit(session, 'updated', 'setting', 'siteTeam', `Ekip vitrini güncellendi: ${body.groups.length} grup, ${memberCount} üye`);
    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error, 'Ekip vitrini kaydedilemedi');
  }
}
