import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError, requireLevel } from '@/lib/api';
import { settingPut } from '@/lib/schemas';
import { getSession } from '@/lib/auth';
import { clearAiKeyCache } from '@/lib/ai';
import { encryptSecret, decryptSecret } from '@/lib/secure';
import { audit } from '@/lib/audit';

// Settings are stored as { key, value } rows where value is a JSON string per section.

/** apiKey içeren bölümler — DB'de şifreli (enc:v1:) saklanır. */
const SECRET_KEYS = ['wordpress', 'ai'] as const;

/** Kayıtlı değerdeki apiKey alanını (varsa) çözerek döndürür. */
function decryptApiKeyField(key: string, value: unknown): unknown {
  if ((SECRET_KEYS as readonly string[]).includes(key) && value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.apiKey === 'string' && v.apiKey) {
      try {
        v.apiKey = decryptSecret(v.apiKey);
      } catch {
        // çözülemedi (AUTH_SECRET değişmiş olabilir) — olduğu gibi bırak, kullanıcı yeniden girer
      }
    }
  }
  return value;
}

export async function GET() {
  try {
    await requireLevel('A'); // ayarlar (API anahtarları dahil) yalnızca yöneticiye görünür

    const rows = await prisma.setting.findMany();
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = decryptApiKeyField(row.key, JSON.parse(row.value));
      } catch {
        settings[row.key] = row.value;
      }
    }
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'Ayarlar alınamadı');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new ApiError(403, 'Ayarları yalnızca yöneticiler değiştirebilir');

    const body = await parseBody(request, settingPut);

    // apiKey alanlarını kalıcılaştırmadan önce şifrele (zaten şifreliyse dokunma)
    const rawValue = body.value ?? {};
    if ((SECRET_KEYS as readonly string[]).includes(body.key) && rawValue && typeof rawValue === 'object') {
      const v = rawValue as Record<string, unknown>;
      if (typeof v.apiKey === 'string' && v.apiKey && !v.apiKey.startsWith('enc:v1:')) {
        v.apiKey = encryptSecret(v.apiKey);
      }
    }

    const value = JSON.stringify(rawValue);
    const saved = await prisma.setting.upsert({
      where: { key: body.key },
      update: { value },
      create: { key: body.key, value },
    });
    if (body.key === 'ai') clearAiKeyCache();
    await audit(session, 'updated', 'setting', body.key, `"${body.key}" ayar bölümü güncellendi`);
    // Yanıtta anahtarı çözülmüş döndür (UI ciphertext görmesin) — uç zaten admin-only
    return NextResponse.json({ key: saved.key, value: decryptApiKeyField(saved.key, JSON.parse(saved.value)) });
  } catch (error) {
    return handleApiError(error, 'Ayarlar kaydedilemedi');
  }
}
