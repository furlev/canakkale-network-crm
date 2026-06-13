import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/api';

type EmailSettings = {
  smtpServer?: string;
  smtpPort?: string;
  smtpUser?: string;
};

/**
 * Ayarlar'daki SMTP yapılandırması + SMTP_PASSWORD ortam değişkeniyle bir
 * nodemailer taşıyıcısı kurar. Eksikse ApiError(400) fırlatır.
 */
export async function getTransport() {
  const row = await prisma.setting.findUnique({ where: { key: 'email' } });
  let settings: EmailSettings = {};
  try {
    settings = row ? JSON.parse(row.value) : {};
  } catch { /* boş ayar */ }

  const host = settings.smtpServer;
  const user = settings.smtpUser;
  const pass = process.env.SMTP_PASSWORD;
  const port = parseInt(settings.smtpPort || '587', 10) || 587;

  if (!host || !user) {
    throw new ApiError(400, 'SMTP ayarları eksik. Ayarlar → E-posta bölümünü doldurun.');
  }
  if (!pass) {
    throw new ApiError(400, 'SMTP_PASSWORD ortam değişkeni ayarlanmamış. Giden mail şifresini sunucu ortamına ekleyin.');
  }

  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from: user,
  };
}
