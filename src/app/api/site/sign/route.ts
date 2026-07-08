import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { parseBody, handleApiError, ApiError } from '@/lib/api';
import { clientIp } from '@/lib/net';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

/**
 * Halka açık teklif/sözleşme onayı + basit e-imza (proxy'de public + IP rate-limitli).
 * site/tip savunma desenini izler: honeypot + IP saatlik limit + gövde sınırı.
 *
 * action=accept → Signature kaydı (ad, ip, içerik-hash) + kayıt durumu güncellenir.
 * action=reject → yalnız durum 'rejected' olur (imza yok).
 */

const MAX_BODY_BYTES = 8 * 1024;

const signSchema = z.object({
  token: z.string().trim().min(8).max(200),
  action: z.enum(['accept', 'reject']),
  name: z.string().trim().max(120).optional(),
  website: z.string().max(200).optional(), // honeypot
});

// ── IP başına saatlik limit ──
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();
function allowIp(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 2000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

type EntityKind = 'estimate' | 'contract' | 'proposal';

/** Token'a sahip kaydı üç modelde arar. */
async function resolveByToken(token: string): Promise<
  | { kind: EntityKind; id: string; status: string; label: string }
  | null
> {
  const estimate = await prisma.estimate.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { id: true, status: true, estimateNo: true },
  });
  if (estimate) return { kind: 'estimate', id: estimate.id, status: estimate.status, label: estimate.estimateNo };

  const contract = await prisma.contract.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { id: true, status: true, title: true },
  });
  if (contract) return { kind: 'contract', id: contract.id, status: contract.status, label: contract.title };

  const proposal = await prisma.proposal.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: { id: true, status: true, title: true },
  });
  if (proposal) return { kind: 'proposal', id: proposal.id, status: proposal.status, label: proposal.title };

  return null;
}

/** Kabul edildiğinde kaydın alacağı durum. */
const ACCEPT_STATUS: Record<EntityKind, string> = {
  estimate: 'accepted',
  contract: 'active',
  proposal: 'approved',
};

async function setStatus(kind: EntityKind, id: string, status: string): Promise<void> {
  if (kind === 'estimate') await prisma.estimate.update({ where: { id }, data: { status } });
  else if (kind === 'contract') await prisma.contract.update({ where: { id }, data: { status } });
  else await prisma.proposal.update({ where: { id }, data: { status } });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'Gönderilen veri çok büyük.');

    const body = await parseBody(request, signSchema);

    // Honeypot dolu → bot. Sahte başarı döndür.
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ ok: true, message: 'Yanıtınız alındı. Teşekkür ederiz.' });
    }

    const ip = clientIp(request.headers);
    if (!allowIp(ip)) {
      throw new ApiError(429, 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.');
    }

    const entity = await resolveByToken(body.token);
    if (!entity) throw new ApiError(404, 'Bağlantı geçersiz veya süresi dolmuş.');

    // Zaten sonuçlanmışsa idempotent yanıt
    const finalStates = new Set(['accepted', 'active', 'approved', 'rejected', 'expired']);
    if (finalStates.has(entity.status)) {
      return NextResponse.json({ ok: true, alreadyResponded: true, status: entity.status });
    }

    if (body.action === 'reject') {
      await setStatus(entity.kind, entity.id, 'rejected');
      await audit(null, 'rejected', entity.kind, entity.id, `Müşteri reddetti (IP: ${ip})`);
      await notify('info', `${entity.label} müşteri tarafından reddedildi`, entity.kind === 'contract' ? '/contracts' : entity.kind === 'proposal' ? '/proposals' : '/estimates');
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    // action === 'accept' → e-imza kaydı gerekir
    const name = (body.name || '').trim();
    if (name.length < 2) throw new ApiError(400, 'İmza için ad soyad gerekli.');

    const hash = createHash('sha256')
      .update(`${entity.kind}:${entity.id}:${name}:${Date.now()}`)
      .digest('hex');

    await prisma.signature.create({
      data: { entity: entity.kind, entityId: entity.id, name, ip, hash },
    });
    await setStatus(entity.kind, entity.id, ACCEPT_STATUS[entity.kind]);

    await audit(null, 'signed', entity.kind, entity.id, `E-imza: ${name} onayladı (IP: ${ip})`);
    await notify(
      'info',
      `${entity.label} müşteri tarafından imzalandı/onaylandı`,
      entity.kind === 'contract' ? '/contracts' : entity.kind === 'proposal' ? '/proposals' : '/estimates'
    );

    return NextResponse.json({ ok: true, status: ACCEPT_STATUS[entity.kind], signedBy: name });
  } catch (error) {
    return handleApiError(error, 'İşlem tamamlanamadı');
  }
}
