import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    const value = JSON.stringify(body.value ?? {});
    const saved = await prisma.setting.upsert({
      where: { key: body.key },
      update: { value },
      create: { key: body.key, value },
    });
    return NextResponse.json({ key: saved.key, value: JSON.parse(saved.value) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
