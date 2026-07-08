import { NextResponse } from 'next/server';
import { handleApiError, requireLevel, ApiError } from '@/lib/api';
import { generateReport, type ReportType, type ReportFormat } from '@/lib/report-export';

export const maxDuration = 60;

const TYPES: ReportType[] = ['revenue', 'collection', 'vat', 'editor'];
const FORMATS: ReportFormat[] = ['xlsx', 'pdf'];

/** RFC 5987 uyumlu Content-Disposition (Türkçe/özel karakter güvenli). */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/reports/export?type=revenue|collection|vat|editor&format=xlsx|pdf&from=&to= — B/A.
 * Finansal/operasyonel raporu XLSX veya PDF olarak indirir.
 */
export async function GET(request: Request) {
  try {
    await requireLevel('B');
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'revenue') as ReportType;
    const format = (url.searchParams.get('format') || 'xlsx') as ReportFormat;
    if (!TYPES.includes(type)) throw new ApiError(400, 'Geçersiz rapor türü');
    if (!FORMATS.includes(format)) throw new ApiError(400, 'Geçersiz dışa aktarma biçimi');

    const { buffer, filename, contentType } = await generateReport(type, format, {
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition(filename),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Rapor dışa aktarılamadı');
  }
}
