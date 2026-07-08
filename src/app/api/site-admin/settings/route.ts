import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getSiteSettings } from '@/lib/site';

const siteSettingsSchema = z.object({
  title: z.string().min(1),
  slogan: z.string(),
  description: z.string(),
  contactEmail: z.string(),
  webmasterEmail: z.string(),
  tekzipEmail: z.string(),
  address: z.string(),
  social: z.object({
    facebook: z.string().optional(),
    x: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
  }),
  tickerEnabled: z.boolean(),
  adsNotice: z.string(),
});

/** GET — site ayarları (Setting 'site' || varsayılanlar). */
export async function GET() {
  try {
    await requireLevel('B');
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'Site ayarları alınamadı');
  }
}

/** PUT — site ayarlarını doğrula ve Setting('site') olarak kaydet. */
export async function PUT(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, siteSettingsSchema);

    const value = JSON.stringify(body);
    await prisma.setting.upsert({
      where: { key: 'site' },
      update: { value },
      create: { key: 'site', value },
    });

    await audit(session, 'updated', 'setting', 'site', `Site ayarları güncellendi: ${body.title}`);
    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error, 'Site ayarları kaydedilemedi');
  }
}
