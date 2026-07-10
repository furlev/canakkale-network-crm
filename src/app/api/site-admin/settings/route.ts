import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getSiteSettings } from '@/lib/site';
import { isSafeMapsEmbedUrl } from '@/lib/maps-embed';

// Boş bırakılabilen ama doluysa geçerli olması gereken e-posta / URL.
const emailOpt = z.string().trim().email('Geçerli bir e-posta gir').or(z.literal(''));
const urlOpt = z.string().trim().url('Geçerli bir URL gir').or(z.literal('')).optional();
// Logo alanları: tam URL ya da /site/... gibi kök-göreli yol olabilir → serbest metin.
const pathOrUrl = z.string().trim().max(500);

/** Manuel istatistik bandı satırı (SiteStatItem). */
const statItemSchema = z.object({
  label: z.string().trim().min(1, 'Etiket zorunlu').max(60),
  value: z.number().finite(),
  suffix: z.string().trim().max(10).optional(),
  format: z.literal('plain').optional(),
});

const siteSettingsSchema = z.object({
  title: z.string().min(1),
  slogan: z.string(),
  description: z.string(),
  contactEmail: emailOpt,
  webmasterEmail: emailOpt,
  tekzipEmail: emailOpt,
  address: z.string(),
  social: z.object({
    facebook: urlOpt,
    x: urlOpt,
    instagram: urlOpt,
    youtube: urlOpt,
    tiktok: urlOpt,
  }),
  tickerEnabled: z.boolean(),
  adsNotice: z.string(),
  // ── Marka / kabuk ──
  logoHeaderDark: pathOrUrl.default(''),
  logoHeaderLight: pathOrUrl.default(''),
  logoFooter: pathOrUrl.default(''),
  copyrightText: z.string().max(200).default(''),
  footerCredit: z.string().max(200).default(''),
  // ── Anasayfa istatistik bandı ──
  statsMode: z.enum(['auto', 'manual']).default('auto'),
  statsManual: z.array(statItemSchema).max(12).default([]),
  // ── İletişim sayfası haritası ──
  // GÜVENLİK: public sayfada <iframe src> olarak basılıyor — yalnız https +
  // Google host'ları kabul edilir (javascript:/veri URL'leriyle stored XSS engeli).
  mapsEmbedUrl: z
    .string()
    .trim()
    .refine(v => v === '' || isSafeMapsEmbedUrl(v), 'Yalnız https ile başlayan Google Maps embed URL kabul edilir')
    .default(''),
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
