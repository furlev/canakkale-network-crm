import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { settingPut } from '@/lib/schemas';
import { getSession } from '@/lib/auth';

// Settings are stored as { key, value } rows where value is a JSON string per section.
export async function GET() {
  try {
    const rows = await prisma.setting.findMany();
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
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
    const value = JSON.stringify(body.value ?? {});
    const saved = await prisma.setting.upsert({
      where: { key: body.key },
      update: { value },
      create: { key: body.key, value },
    });
    return NextResponse.json({ key: saved.key, value: JSON.parse(saved.value) });
  } catch (error) {
    return handleApiError(error, 'Ayarlar kaydedilemedi');
  }
}
