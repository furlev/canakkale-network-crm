import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, requireLevel, ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { getJoinForm } from '@/lib/site';

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const joinFormSchema = z.object({
  title: z.string().min(1),
  intro: z.string(),
  fields: z.array(fieldSchema).min(1),
  successMessage: z.string(),
  enabled: z.boolean(),
});

/** GET — kayıtlı form şeması (yoksa varsayılan). */
export async function GET() {
  try {
    await requireLevel('B');
    const form = await getJoinForm();
    return NextResponse.json(form);
  } catch (error) {
    return handleApiError(error, 'Form şeması alınamadı');
  }
}

/** PUT — form şemasını doğrula ve Setting('joinForm') olarak kaydet. */
export async function PUT(request: Request) {
  try {
    const session = await requireLevel('B');
    const body = await parseBody(request, joinFormSchema);

    // Çekirdek alanlar: name ve email silinemez (başvuru kaydı bunlara bağlı)
    if (!body.fields.some((f) => f.id === 'name') || !body.fields.some((f) => f.id === 'email')) {
      throw new ApiError(400, "'Ad Soyad' (name) ve 'E-posta' (email) çekirdek alanları silinemez");
    }
    // Alan id'leri benzersiz olmalı
    const ids = body.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      throw new ApiError(400, 'Alan anahtarları (id) benzersiz olmalı');
    }
    // select alanlarında en az bir seçenek olmalı
    const badSelect = body.fields.find((f) => f.type === 'select' && (!f.options || f.options.filter(Boolean).length === 0));
    if (badSelect) {
      throw new ApiError(400, `"${badSelect.label}" seçim alanı için en az bir seçenek girin`);
    }

    const value = JSON.stringify(body);
    await prisma.setting.upsert({
      where: { key: 'joinForm' },
      update: { value },
      create: { key: 'joinForm', value },
    });

    await audit(session, 'updated', 'setting', 'joinForm', `Ekibimize Katıl formu güncellendi (${body.fields.length} alan)`);
    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error, 'Form şeması kaydedilemedi');
  }
}
