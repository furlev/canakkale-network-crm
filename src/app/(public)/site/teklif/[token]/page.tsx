import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import OnayForm from './OnayForm';
import '@/app/(public)/pages.css';

/**
 * Halka açık teklif / sözleşme onay + e-imza sayfası (canakkale.network/teklif/<token>).
 * publicToken ile Estimate / Contract / Proposal kaydını çözer, müşteriye özet gösterir;
 * durumu nihai değilse kabul/ret + basit e-imza formu (OnayForm) sunar.
 */

export const dynamic = 'force-dynamic';

type Kind = 'estimate' | 'contract' | 'proposal';

type View = {
  kind: Kind;
  id: string;
  subtype: string;
  heading: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  clientName: string | null;
  dates: { label: string; value: string }[];
};

const CURRENCY_SYMBOL: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
const money = (n: number, c: string) =>
  `${CURRENCY_SYMBOL[c] || c}${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  accepted: 'Kabul Edildi',
  rejected: 'Reddedildi',
  active: 'Yürürlükte',
  expired: 'Süresi Doldu',
  approved: 'Onaylandı',
};

async function resolve(token: string): Promise<View | null> {
  const estimate = await prisma.estimate.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: { client: true },
  });
  if (estimate) {
    return {
      kind: 'estimate',
      id: estimate.id,
      subtype: 'Teklif',
      heading: `Teklif ${estimate.estimateNo}`,
      description: null,
      amount: estimate.amount,
      currency: 'TRY',
      status: estimate.status,
      clientName: estimate.client?.companyName || estimate.client?.contactName || null,
      dates: [{ label: 'Geçerlilik', value: fmtDate(estimate.validUntil) }],
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: { client: true },
  });
  if (contract) {
    return {
      kind: 'contract',
      id: contract.id,
      subtype: 'Sözleşme',
      heading: contract.title,
      description: null,
      amount: contract.value,
      currency: 'TRY',
      status: contract.status,
      clientName: contract.client?.companyName || contract.client?.contactName || null,
      dates: [
        { label: 'Başlangıç', value: fmtDate(contract.startDate) },
        { label: 'Bitiş', value: fmtDate(contract.endDate) },
      ],
    };
  }

  const proposal = await prisma.proposal.findFirst({
    where: { publicToken: token, deletedAt: null },
    include: { client: true },
  });
  if (proposal) {
    return {
      kind: 'proposal',
      id: proposal.id,
      subtype: 'Teklifname',
      heading: proposal.title,
      description: proposal.description,
      amount: proposal.value,
      currency: 'TRY',
      status: proposal.status,
      clientName: proposal.client?.companyName || proposal.client?.contactName || null,
      dates: [],
    };
  }

  return null;
}

export default async function TeklifOnayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await resolve(token);
  if (!view) notFound();

  const signature = await prisma.signature.findFirst({
    where: { entity: view.kind, entityId: view.id },
    orderBy: { signedAt: 'desc' },
  });

  const finalStates = new Set(['accepted', 'active', 'approved', 'rejected', 'expired']);
  const responded = finalStates.has(view.status) || !!signature;

  return (
    <div>
      <header className="p-join-hero">
        <div className="s-container">
          <span className="s-kicker">{view.subtype} Onayı</span>
          <h1 className="p-join-title">
            {view.heading}
            <span className="tick">.</span>
          </h1>
          <p className="p-page-sub">
            Aşağıdaki {view.subtype.toLowerCase()} özetini inceleyip onaylayabilir veya
            reddedebilirsiniz. Onaylamanız durumunda dijital imzanız kayıt altına alınır.
          </p>
        </div>
      </header>

      <section className="s-section">
        <div className="s-container" style={{ maxWidth: 720 }}>
          {/* Özet kartı */}
          <div
            style={{
              border: '1px solid var(--ink-line, rgba(0,0,0,.12))',
              borderRadius: 16,
              padding: '1.5rem',
              marginBottom: '1.5rem',
              background: 'var(--surface, rgba(255,255,255,.03))',
            }}
          >
            <dl style={{ display: 'grid', gap: '.75rem', margin: 0 }}>
              {view.clientName && (
                <Row label="Müşteri" value={view.clientName} />
              )}
              <Row label="Tutar" value={money(view.amount, view.currency)} strong />
              {view.dates.map((d) => (
                <Row key={d.label} label={d.label} value={d.value} />
              ))}
              <Row label="Durum" value={STATUS_LABEL[view.status] || view.status} />
            </dl>
            {view.description && (
              <p style={{ marginTop: '1rem', color: 'var(--ink-faint)', whiteSpace: 'pre-wrap' }}>
                {view.description}
              </p>
            )}
          </div>

          {responded ? (
            <div className="p-success" role="status" aria-live="polite">
              <span className="glyph" aria-hidden="true">
                {view.status === 'rejected' ? '✕' : '✓'}
              </span>
              <h2>
                {view.status === 'rejected'
                  ? 'Bu belge reddedilmiş.'
                  : 'Bu belge onaylanmış.'}
              </h2>
              <p>
                {signature
                  ? `${signature.name} tarafından ${new Date(signature.signedAt).toLocaleString('tr-TR')} tarihinde imzalandı.`
                  : `Güncel durum: ${STATUS_LABEL[view.status] || view.status}.`}
              </p>
            </div>
          ) : (
            <OnayForm token={token} subtype={view.subtype} />
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <dt style={{ color: 'var(--ink-faint)' }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: strong ? 700 : 500, textAlign: 'right' }}>{value}</dd>
    </div>
  );
}
