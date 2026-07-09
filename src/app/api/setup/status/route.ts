import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireLevel, handleApiError } from '@/lib/api';
import { isDriveConfigured } from '@/lib/drive';
import { isStorageConfigured } from '@/lib/storage';

/**
 * Entegrasyon kurulum durumu — onboarding checklist için.
 * SADECE boolean döner (bağlı/bağlı değil); hiçbir sır/anahtar/değer sızmaz.
 * SMTP DB'deki Setting'e, AI/Drive/Spaces env'e bakar.
 */
async function settingHas(key: string, fields: string[]): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  if (!row) return false;
  try {
    const v = JSON.parse(row.value);
    return fields.every((f) => typeof v?.[f] === 'string' && v[f].trim().length > 0);
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    await requireLevel('B');

    const [emailSetting, aiSetting] = await Promise.all([
      settingHas('email', ['smtpServer', 'smtpUser']),
      settingHas('ai', ['apiKey']),
    ]);

    // SMTP: ayar + parola env değişkeni birlikte gerekli
    const smtp = emailSetting && Boolean(process.env.SMTP_PASSWORD);
    // AI: Vertex projesi VEYA GEMINI_API_KEY env VEYA Ayarlar'daki anahtar
    const ai = Boolean(
      process.env.GOOGLE_VERTEX_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GEMINI_API_KEY ||
      aiSetting
    );
    const drive = isDriveConfigured();
    const spaces = isStorageConfigured();

    const items = [
      { key: 'ai', label: 'AI Haber Motoru', done: ai, icon: '🤖', link: '/settings', hint: 'Vertex / Gemini anahtarı ile taslak üretimi.' },
      { key: 'smtp', label: 'E-posta (SMTP)', done: smtp, icon: '📧', link: '/settings', hint: 'Fatura / bülten gönderimi.' },
      { key: 'drive', label: 'Google Drive (Depo)', done: drive, icon: '📂', link: '/settings', hint: 'Dosya deposu entegrasyonu.' },
      { key: 'spaces', label: 'Object Storage (Spaces)', done: spaces, icon: '🗄️', link: '/settings', hint: 'Görselleri CDN üzerinden servis eder.' },
    ];

    const missing = items.filter((i) => !i.done).length;
    return NextResponse.json({ items, missing, total: items.length });
  } catch (error) {
    return handleApiError(error, 'Kurulum durumu alınamadı');
  }
}
