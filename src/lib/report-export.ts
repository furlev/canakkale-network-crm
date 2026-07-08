import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import prisma from '@/lib/prisma';

/**
 * Rapor dışa aktarımı — exceljs ile XLSX, pdf-lib ile PDF üretir.
 * Desteklenen türler: gelir (revenue), tahsilat (collection), KDV (vat), editör (editor).
 * Veri prisma'dan çekilir; biçimlendirme jenerik bir tablo modeli üzerinden yapılır.
 */

export type ReportType = 'revenue' | 'collection' | 'vat' | 'editor';
export type ReportFormat = 'xlsx' | 'pdf';

type Column = { header: string; key: string; width: number; money?: boolean };
type Row = Record<string, string | number>;

type ReportTable = {
  title: string;
  subtitle: string;
  columns: Column[];
  rows: Row[];
  totals?: Row; // alt toplam satırı (opsiyonel)
};

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const fmtMoney = (n: number) => `${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');

/** WinAnsi-güvenli metin (pdf-lib StandardFonts; ş/ğ/ı/İ/₺ desteklenmez). */
function safe(input: string | number | null | undefined): string {
  return String(input ?? '')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/₺/g, 'TL')
    .replace(/[‒-―]/g, '-')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\xFF€]/g, '?');
}

function monthsInRange(from: Date, to: Date): { key: string; label: string; year: number; month: number }[] {
  const out: { key: string; label: string; year: number; month: number }[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  let guard = 0;
  while (cur <= end && guard < 120) {
    out.push({ key: `${cur.getFullYear()}-${cur.getMonth()}`, label: `${MONTHS_TR[cur.getMonth()]} ${cur.getFullYear()}`, year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
    guard++;
  }
  return out;
}

/* ── Veri üreticiler ── */

async function buildRevenue(from: Date, to: Date): Promise<ReportTable> {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, amount: true, status: true },
  });
  const months = monthsInRange(from, to);
  const map = new Map(months.map((m) => [m.key, { count: 0, invoiced: 0, collected: 0 }]));
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const b = map.get(k);
    if (!b) continue;
    b.count += 1;
    b.invoiced += inv.amount || 0;
    if (inv.status === 'paid') b.collected += inv.amount || 0;
  }
  const rows: Row[] = months.map((m) => {
    const b = map.get(m.key)!;
    return { month: m.label, count: b.count, invoiced: round2(b.invoiced), collected: round2(b.collected) };
  });
  const totals: Row = {
    month: 'TOPLAM',
    count: rows.reduce((s, r) => s + Number(r.count), 0),
    invoiced: round2(rows.reduce((s, r) => s + Number(r.invoiced), 0)),
    collected: round2(rows.reduce((s, r) => s + Number(r.collected), 0)),
  };
  return {
    title: 'Gelir Raporu',
    subtitle: `${fmtDate(from)} — ${fmtDate(to)}`,
    columns: [
      { header: 'Ay', key: 'month', width: 18 },
      { header: 'Fatura Sayısı', key: 'count', width: 16 },
      { header: 'Faturalanan', key: 'invoiced', width: 20, money: true },
      { header: 'Tahsil Edilen', key: 'collected', width: 20, money: true },
    ],
    rows,
    totals,
  };
}

async function buildCollection(): Promise<ReportTable> {
  const outstanding = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['unpaid', 'overdue'] } },
    include: { client: { select: { companyName: true } } },
    orderBy: { dueDate: 'asc' },
  });
  const now = Date.now();
  const rows: Row[] = outstanding.map((inv) => {
    const days = inv.dueDate ? Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000) : -1;
    return {
      invoiceNo: inv.invoiceNo,
      client: inv.client?.companyName || 'Belirtilmemiş',
      amount: round2(inv.amount || 0),
      dueDate: fmtDate(inv.dueDate),
      overdue: days < 0 ? 'Vade gelmedi' : `${days} gün`,
    };
  });
  const totals: Row = {
    invoiceNo: 'TOPLAM',
    client: '',
    amount: round2(outstanding.reduce((s, i) => s + (i.amount || 0), 0)),
    dueDate: '',
    overdue: `${rows.length} fatura`,
  };
  return {
    title: 'Tahsilat (Acik Alacaklar) Raporu',
    subtitle: `Rapor tarihi: ${fmtDate(new Date())}`,
    columns: [
      { header: 'Fatura No', key: 'invoiceNo', width: 16 },
      { header: 'Müşteri', key: 'client', width: 28 },
      { header: 'Tutar', key: 'amount', width: 18, money: true },
      { header: 'Vade', key: 'dueDate', width: 14 },
      { header: 'Gecikme', key: 'overdue', width: 14 },
    ],
    rows,
    totals,
  };
}

async function buildVat(from: Date, to: Date): Promise<ReportTable> {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { not: 'cancelled' }, createdAt: { gte: from, lte: to } },
    select: { createdAt: true, subtotal: true, vatTotal: true, amount: true },
  });
  const months = monthsInRange(from, to);
  const map = new Map(months.map((m) => [m.key, { subtotal: 0, vat: 0, total: 0 }]));
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    const b = map.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!b) continue;
    // Kalemsiz faturalarda subtotal/vatTotal null olabilir → tutarı ana toplama yaz
    b.subtotal += inv.subtotal ?? inv.amount ?? 0;
    b.vat += inv.vatTotal ?? 0;
    b.total += inv.amount ?? 0;
  }
  const rows: Row[] = months.map((m) => {
    const b = map.get(m.key)!;
    return { month: m.label, subtotal: round2(b.subtotal), vat: round2(b.vat), total: round2(b.total) };
  });
  const totals: Row = {
    month: 'TOPLAM',
    subtotal: round2(rows.reduce((s, r) => s + Number(r.subtotal), 0)),
    vat: round2(rows.reduce((s, r) => s + Number(r.vat), 0)),
    total: round2(rows.reduce((s, r) => s + Number(r.total), 0)),
  };
  return {
    title: 'KDV Raporu',
    subtitle: `${fmtDate(from)} — ${fmtDate(to)}`,
    columns: [
      { header: 'Ay', key: 'month', width: 18 },
      { header: 'Matrah (KDV Haric)', key: 'subtotal', width: 22, money: true },
      { header: 'KDV', key: 'vat', width: 18, money: true },
      { header: 'Genel Toplam', key: 'total', width: 20, money: true },
    ],
    rows,
    totals,
  };
}

async function buildEditor(from: Date, to: Date): Promise<ReportTable> {
  const groups = await prisma.siteArticle.groupBy({
    by: ['authorName'],
    where: { status: 'published', deletedAt: null, publishedAt: { gte: from, lte: to } },
    _count: { _all: true },
    _sum: { views: true },
  });
  const rows: Row[] = groups
    .map((g) => ({
      author: g.authorName || 'Bilinmiyor',
      articles: g._count._all,
      views: g._sum.views || 0,
    }))
    .sort((a, b) => Number(b.articles) - Number(a.articles));
  const totals: Row = {
    author: 'TOPLAM',
    articles: rows.reduce((s, r) => s + Number(r.articles), 0),
    views: rows.reduce((s, r) => s + Number(r.views), 0),
  };
  return {
    title: 'Editör / Yazar Performans Raporu',
    subtitle: `${fmtDate(from)} — ${fmtDate(to)} (yayınlanan haberler)`,
    columns: [
      { header: 'Editör / Yazar', key: 'author', width: 30 },
      { header: 'Haber Sayısı', key: 'articles', width: 16 },
      { header: 'Toplam Görüntülenme', key: 'views', width: 22 },
    ],
    rows,
    totals,
  };
}

async function buildTable(type: ReportType, from: Date, to: Date): Promise<ReportTable> {
  switch (type) {
    case 'revenue': return buildRevenue(from, to);
    case 'collection': return buildCollection();
    case 'vat': return buildVat(from, to);
    case 'editor': return buildEditor(from, to);
  }
}

/* ── Biçimlendirme ── */

async function renderXlsx(table: ReportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Çanakkale Network CRM';
  wb.created = new Date();
  const ws = wb.addWorksheet('Rapor');
  const colCount = table.columns.length;

  // Başlık + alt başlık
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = table.title;
  titleCell.font = { size: 15, bold: true, color: { argb: 'FF1D4E9E' } };

  ws.mergeCells(2, 1, 2, colCount);
  const subCell = ws.getCell(2, 1);
  subCell.value = table.subtitle;
  subCell.font = { size: 10, color: { argb: 'FF6B7280' } };

  // Sütun başlıkları (satır 4)
  const headerRow = ws.getRow(4);
  table.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4E9E' } };
    cell.alignment = { vertical: 'middle', horizontal: c.money ? 'right' : 'left' };
  });

  // Genişlikler
  table.columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  // Veri satırları
  let r = 5;
  for (const row of table.rows) {
    const wr = ws.getRow(r);
    table.columns.forEach((c, i) => {
      const cell = wr.getCell(i + 1);
      const val = row[c.key];
      cell.value = val;
      if (c.money) {
        cell.numFmt = '#,##0.00 "TL"';
        cell.alignment = { horizontal: 'right' };
      }
    });
    r++;
  }

  // Toplam satırı
  if (table.totals) {
    const tr = ws.getRow(r);
    table.columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1);
      cell.value = table.totals![c.key];
      cell.font = { bold: true };
      if (c.money) { cell.numFmt = '#,##0.00 "TL"'; cell.alignment = { horizontal: 'right' }; }
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as unknown as ArrayBuffer);
}

async function renderPdf(table: ReportTable): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(table.title));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, MARGIN = 40;
  const contentW = W - MARGIN * 2;
  const totalWidthUnits = table.columns.reduce((s, c) => s + c.width, 0);
  // Sütun x sınırları
  const colX: number[] = [];
  let acc = MARGIN;
  for (const c of table.columns) {
    colX.push(acc);
    acc += (c.width / totalWidthUnits) * contentW;
  }
  colX.push(W - MARGIN);

  const INK = rgb(0.13, 0.13, 0.16);
  const MUTED = rgb(0.42, 0.45, 0.5);
  const ACCENT = rgb(0.11, 0.32, 0.62);
  const ZEBRA = rgb(0.96, 0.97, 0.98);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - MARGIN;

  const drawText = (s: string, x: number, yy: number, size: number, f: PDFFont, color = INK, rightEdge?: number) => {
    const str = safe(s);
    if (rightEdge !== undefined) {
      const w = f.widthOfTextAtSize(str, size);
      page.drawText(str, { x: rightEdge - w, y: yy, size, font: f, color });
    } else {
      page.drawText(str, { x, y: yy, size, font: f, color });
    }
  };

  // Başlık
  drawText(table.title, MARGIN, y, 18, bold, ACCENT);
  y -= 18;
  drawText(table.subtitle, MARGIN, y, 9, font, MUTED);
  y -= 20;

  const drawHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: contentW, height: 18, color: ACCENT });
    table.columns.forEach((c, i) => {
      const pad = 4;
      if (c.money) drawText(c.header, 0, y, 8, bold, rgb(1, 1, 1), colX[i + 1] - pad);
      else drawText(c.header, colX[i] + pad, y, 8, bold, rgb(1, 1, 1));
    });
    y -= 20;
  };
  drawHeader();

  const drawRow = (row: Row, isTotal = false, zebra = false) => {
    if (y < MARGIN + 40) {
      page = doc.addPage([W, H]);
      y = H - MARGIN;
      drawHeader();
    }
    if (zebra && !isTotal) {
      page.drawRectangle({ x: MARGIN, y: y - 4, width: contentW, height: 16, color: ZEBRA });
    }
    const f = isTotal ? bold : font;
    table.columns.forEach((c, i) => {
      const pad = 4;
      const raw = row[c.key];
      const text = c.money ? fmtMoney(Number(raw)) : String(raw ?? '');
      if (c.money) drawText(text, 0, y, 8, f, INK, colX[i + 1] - pad);
      else {
        // Uzun metni sütun genişliğine kırp
        let t = safe(text);
        const maxW = colX[i + 1] - colX[i] - pad * 2;
        while (t.length > 3 && f.widthOfTextAtSize(t, 8) > maxW) t = t.slice(0, -2);
        drawText(t, colX[i] + pad, y, 8, f);
      }
    });
    y -= 16;
  };

  table.rows.forEach((row, i) => drawRow(row, false, i % 2 === 1));

  if (table.totals) {
    y -= 2;
    page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: W - MARGIN, y: y + 12 }, thickness: 1, color: rgb(0.82, 0.84, 0.88) });
    drawRow(table.totals, true);
  }

  // Alt bilgi
  drawText('Çanakkale Network Medya — Bu belge elektronik olarak olusturulmustur.', MARGIN, MARGIN - 15, 8, font, MUTED);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/* ── Genel giriş noktası ── */

const CONTENT_TYPE: Record<ReportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/**
 * Rapor üretir. Varsayılan tarih aralığı son 6 ay (tahsilat türü tarih bağımsızdır).
 */
export async function generateReport(
  type: ReportType,
  format: ReportFormat,
  opts?: { from?: string | null; to?: string | null }
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const now = new Date();
  const to = opts?.to && !Number.isNaN(new Date(opts.to).getTime()) ? new Date(opts.to) : now;
  const from = opts?.from && !Number.isNaN(new Date(opts.from).getTime())
    ? new Date(opts.from)
    : new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const table = await buildTable(type, from, to);
  const buffer = format === 'xlsx' ? await renderXlsx(table) : await renderPdf(table);
  const stamp = now.toISOString().slice(0, 10);
  return {
    buffer,
    filename: `rapor-${type}-${stamp}.${format}`,
    contentType: CONTENT_TYPE[format],
  };
}
