import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api';
import { getTransport } from '@/lib/mailer';
import { notify } from '@/lib/notify';

export const maxDuration = 120;

function buildHtml(subject: string, intro: string | null, content: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paras = content.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px;line-height:1.6;color:#16263f;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#16263f;padding:22px 28px;"><span style="color:#fff;font-size:20px;font-weight:800;">Çanakkale <span style="color:#c8202f;">Network</span></span></div>
    <div style="padding:28px;">
      <h1 style="font-size:22px;color:#16263f;margin:0 0 16px;">${esc(subject)}</h1>
      ${intro ? `<p style="font-size:15px;color:#44536d;line-height:1.6;margin:0 0 18px;font-style:italic;">${esc(intro)}</p>` : ''}
      ${paras}
    </div>
    <div style="padding:18px 28px;background:#efece4;font-size:12px;color:#8b96a8;">
      Bu e-postayı Çanakkale Network bültenine abone olduğunuz için aldınız.
    </div>
  </div></body></html>`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const newsletter = await prisma.newsletter.findUnique({ where: { id: params.id } });
    if (!newsletter) throw new ApiError(404, 'Bülten bulunamadı');
    if (newsletter.status === 'sent') throw new ApiError(400, 'Bu bülten zaten gönderildi');

    const subscribers = await prisma.subscriber.findMany({ where: { status: 'active' }, select: { email: true } });
    if (subscribers.length === 0) throw new ApiError(400, 'Aktif abone yok');

    const { transport, from } = await getTransport();
    const html = buildHtml(newsletter.subject, newsletter.intro, newsletter.content);

    let sent = 0;
    const errors: string[] = [];
    // BCC ile gruplar halinde gönder (alıcılar birbirini görmesin)
    const batchSize = 40;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize).map(s => s.email);
      try {
        await transport.sendMail({
          from: `Çanakkale Network <${from}>`,
          to: from,
          bcc: batch,
          subject: newsletter.subject,
          html,
        });
        sent += batch.length;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'gönderim hatası');
      }
    }

    const updated = await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { status: 'sent', recipients: sent, sentAt: new Date() },
    });
    await notify('info', `Bülten gönderildi: ${newsletter.subject} (${sent} alıcı)`, '/newsletters');

    return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined, newsletter: updated });
  } catch (error) {
    return handleApiError(error, 'Bülten gönderilemedi');
  }
}
