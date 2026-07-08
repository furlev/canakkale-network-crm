import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import prisma from '@/lib/prisma';

/**
 * Kurumsal fatura PDF üretici (pdf-lib, harici bağımlılık yok).
 *
 * NOT — Türkçe karakterler: pdf-lib'in gömülü StandardFonts'u WinAnsi (CP1252)
 * kodlaması kullanır. ç/ö/ü desteklenir; ş/ğ/ı/İ ve ₺ DESTEKLENMEZ ve
 * kodlanmaya çalışılırsa çalışma-zamanı hatası verir. Prod ortamında
 * @pdf-lib/fontkit + TTF gömme yok, bu yüzden `safe()` ile desteklenmeyen
 * glifleri en yakın ASCII karşılığına çevirip çökmeyi kesin olarak önlüyoruz.
 */

export type InvoiceItemLike = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type CompanyInfo = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNo?: string;
};

export type InvoicePdfData = {
  invoiceNo: string;
  currency: string;
  status: string;
  createdAt: Date;
  dueDate?: Date | null;
  amount: number;
  subtotal?: number | null;
  vatTotal?: number | null;
  discount?: number | null;
  notes?: string | null;
  client?: { companyName?: string | null; contactName?: string | null; email?: string | null; phone?: string | null } | null;
  items: InvoiceItemLike[];
  company: CompanyInfo;
};

const CURRENCY_SYMBOL: Record<string, string> = { TRY: 'TL', USD: '$', EUR: '€', GBP: '£' };
const STATUS_LABEL: Record<string, string> = {
  unpaid: 'Bekliyor',
  paid: 'Odendi',
  overdue: 'Gecikmis',
  cancelled: 'Iptal',
};

/** WinAnsi-güvenli metin: desteklenmeyen Türkçe glifleri çevirir, kalanları kırpar. */
function safe(input: string | null | undefined): string {
  return (input ?? '')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/₺/g, 'TL')
    // Yaygın tipografik noktalama → ASCII (aksi halde >0xFF olduğu için '?' olurdu)
    .replace(/[‒-―]/g, '-') // tire çeşitleri
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/ /g, ' ')
    // WinAnsi'de tanımsız kod noktaları + Latin-1 dışı her şey → '?'
    // (€ = U+20AC WinAnsi'de 0x80'e eşlenir → korunur, EUR sembolü için gerekli)
    .replace(/[\x81\x8D\x8F\x90\x9D]/g, '?')
    .replace(/[^\x09\x0A\x0D\x20-\xFF€]/g, '?');
}

function fmt(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] || currency;
  const num = (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${num} ${sym}`;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Kalemlerden fatura toplamlarını hesaplar (KDV hariç ara toplam, toplam KDV,
 * indirim düşülmüş genel toplam). İndirim, KDV dahil genel toplamdan düşülür.
 */
export function computeInvoiceTotals(items: InvoiceItemLike[], discount = 0) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    subtotal += line;
    vatTotal += line * ((Number(it.vatRate) || 0) / 100);
  }
  const disc = Math.max(0, Number(discount) || 0);
  const amount = Math.max(0, subtotal + vatTotal - disc);
  return { subtotal: round2(subtotal), vatTotal: round2(vatTotal), discount: round2(disc), amount: round2(amount) };
}

/** Ayarlar'daki 'company' kaydından şirket bilgisini yükler (yoksa makul varsayılan). */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  const row = await prisma.setting.findUnique({ where: { key: 'company' } });
  let c: Record<string, string> = {};
  try {
    c = row ? JSON.parse(row.value) : {};
  } catch { /* bozuk ayar = varsayılan */ }
  return {
    name: c.name || 'Çanakkale Network Medya',
    address: c.address || '',
    phone: c.phone || '',
    email: c.email || '',
    taxNo: c.taxNo || '',
  };
}

const INK = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.11, 0.32, 0.62);
const LINE = rgb(0.82, 0.84, 0.88);
const ZEBRA = rgb(0.96, 0.97, 0.98);

/** Faturayı kurumsal bir PDF olarak üretir; Buffer döndürür. */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Fatura ${safe(data.invoiceNo)}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const MARGIN = 50;
  const contentRight = W - MARGIN;

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - MARGIN;

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });

  const textRight = (s: string, xRight: number, yy: number, size: number, f: PDFFont = font, color = INK) => {
    const str = safe(s);
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: xRight - w, y: yy, size, font: f, color });
  };

  const currency = data.currency || 'TRY';

  // ── Başlık: şirket (sol) + FATURA (sağ) ──
  text(data.company.name, MARGIN, y, 20, bold, ACCENT);
  textRight('FATURA', contentRight, y, 24, bold, INK);
  y -= 20;

  const companyLines = [data.company.address, data.company.phone, data.company.email, data.company.taxNo ? `Vergi No: ${data.company.taxNo}` : '']
    .filter(Boolean) as string[];
  let cy = y;
  for (const ln of companyLines) {
    text(ln, MARGIN, cy, 9, font, MUTED);
    cy -= 12;
  }

  // Sağ meta bloğu
  let my = y;
  const metaRows: [string, string][] = [
    ['Fatura No', data.invoiceNo],
    ['Tarih', data.createdAt.toLocaleDateString('tr-TR')],
    ['Vade', data.dueDate ? data.dueDate.toLocaleDateString('tr-TR') : '-'],
    ['Durum', STATUS_LABEL[data.status] || data.status],
  ];
  for (const [k, v] of metaRows) {
    textRight(`${k}:`, contentRight - 95, my, 9, bold, MUTED);
    textRight(v, contentRight, my, 9, font, INK);
    my -= 13;
  }

  y = Math.min(cy, my) - 10;

  // Ayırıcı çizgi
  page.drawLine({ start: { x: MARGIN, y }, end: { x: contentRight, y }, thickness: 1, color: LINE });
  y -= 24;

  // ── Fatura kesilen (müşteri) ──
  if (data.client) {
    text('FATURA EDILEN', MARGIN, y, 9, bold, MUTED);
    y -= 15;
    text(data.client.companyName || data.client.contactName || 'Musteri', MARGIN, y, 12, bold, INK);
    y -= 14;
    const cLines = [
      data.client.contactName && data.client.companyName ? data.client.contactName : '',
      data.client.email || '',
      data.client.phone || '',
    ].filter(Boolean) as string[];
    for (const ln of cLines) {
      text(ln, MARGIN, y, 9, font, MUTED);
      y -= 12;
    }
    y -= 12;
  }

  // ── Kalem tablosu ──
  // Sütunlar: Açıklama | Miktar | Birim Fiyat | KDV% | Tutar (KDV hariç)
  const colQtyR = 330;
  const colUnitR = 430;
  const colVatR = 480;
  const colTotalR = contentRight;

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: contentRight - MARGIN, height: 20, color: ACCENT });
    const ty = y + 2;
    text('Aciklama', MARGIN + 6, ty, 9, bold, rgb(1, 1, 1));
    textRight('Miktar', colQtyR, ty, 9, bold, rgb(1, 1, 1));
    textRight('Birim Fiyat', colUnitR, ty, 9, bold, rgb(1, 1, 1));
    textRight('KDV', colVatR, ty, 9, bold, rgb(1, 1, 1));
    textRight('Tutar', colTotalR, ty, 9, bold, rgb(1, 1, 1));
    y -= 24;
  };

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN + 60) {
      page = doc.addPage([W, H]);
      y = H - MARGIN;
      drawTableHeader();
    }
  };

  drawTableHeader();

  const hasItems = data.items && data.items.length > 0;
  const rows: InvoiceItemLike[] = hasItems
    ? data.items
    : [{ description: 'Hizmet / Urun bedeli', quantity: 1, unitPrice: data.amount, vatRate: 0 }];

  let zebra = false;
  for (const it of rows) {
    newPageIfNeeded(18);
    const line = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    if (zebra) {
      page.drawRectangle({ x: MARGIN, y: y - 4, width: contentRight - MARGIN, height: 18, color: ZEBRA });
    }
    zebra = !zebra;
    // Açıklama (gerekirse kırp)
    let desc = safe(it.description);
    const maxDescW = colQtyR - 55 - (MARGIN + 6);
    while (desc.length > 3 && font.widthOfTextAtSize(desc, 9) > maxDescW) {
      desc = desc.slice(0, -2);
    }
    text(desc, MARGIN + 6, y, 9);
    textRight(String(it.quantity), colQtyR, y, 9);
    textRight(fmt(it.unitPrice, currency), colUnitR, y, 9);
    textRight(`%${it.vatRate}`, colVatR, y, 9);
    textRight(fmt(line, currency), colTotalR, y, 9);
    y -= 18;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: contentRight, y }, thickness: 1, color: LINE });
  y -= 20;

  // ── Toplamlar (sağ blok) ──
  const subtotal = data.subtotal ?? (hasItems ? computeInvoiceTotals(data.items).subtotal : data.amount);
  const vatTotal = data.vatTotal ?? (hasItems ? computeInvoiceTotals(data.items).vatTotal : 0);
  const discount = data.discount ?? 0;
  const labelR = contentRight - 130;

  const totalRow = (label: string, value: string, strong = false, color = INK) => {
    const f = strong ? bold : font;
    textRight(label, labelR, y, strong ? 11 : 10, f, strong ? INK : MUTED);
    textRight(value, contentRight, y, strong ? 12 : 10, f, color);
    y -= strong ? 20 : 16;
  };

  // Kalemsiz (elle tutarlı) faturalarda tutar zaten nihai olduğundan yalnızca genel toplam gösterilir.
  if (hasItems) {
    totalRow('Ara Toplam', fmt(subtotal, currency));
    totalRow('KDV', fmt(vatTotal, currency));
    if (discount > 0) totalRow('Indirim', `- ${fmt(discount, currency)}`, false, rgb(0.7, 0.2, 0.2));
    page.drawLine({ start: { x: labelR, y: y + 8 }, end: { x: contentRight, y: y + 8 }, thickness: 1, color: LINE });
    y -= 4;
  }
  totalRow('GENEL TOPLAM', fmt(data.amount, currency), true, ACCENT);

  // ── Notlar ──
  if (data.notes) {
    y -= 16;
    text('Notlar', MARGIN, y, 9, bold, MUTED);
    y -= 13;
    // Basit satır sarma
    const words = safe(data.notes).split(/\s+/);
    let lineBuf = '';
    const maxW = contentRight - MARGIN;
    for (const w of words) {
      const test = lineBuf ? `${lineBuf} ${w}` : w;
      if (font.widthOfTextAtSize(test, 9) > maxW && lineBuf) {
        newPageIfNeeded(14);
        text(lineBuf, MARGIN, y, 9, font, INK);
        y -= 12;
        lineBuf = w;
      } else {
        lineBuf = test;
      }
    }
    if (lineBuf) {
      newPageIfNeeded(14);
      text(lineBuf, MARGIN, y, 9, font, INK);
    }
  }

  // ── Alt bilgi ──
  const footerY = MARGIN - 15;
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: contentRight, y: footerY + 14 }, thickness: 0.5, color: LINE });
  text(`${data.company.name} — Bu belge elektronik olarak olusturulmustur.`, MARGIN, footerY, 8, font, MUTED);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
