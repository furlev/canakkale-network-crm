import { NextResponse } from 'next/server';
import { ZodTypeAny, z } from 'zod';
import { getSession, type Session } from '@/lib/auth';
import { hasLevel, type AccessLevel } from '@/lib/permissions';

/** Error carrying an HTTP status, thrown by helpers and converted in handleApiError. */
export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

/**
 * Oturum + asgari seviye guard'ı (defense-in-depth: proxy'den bağımsız).
 * Oturum yoksa 401, seviye yetmiyorsa 403 fırlatır; geçerse session'ı döndürür.
 */
export async function requireLevel(min: AccessLevel = 'C'): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ApiError(401, 'Oturum gerekli');
  if (!hasLevel(session, min)) throw new ApiError(403, 'Bu işlem için yetkiniz yok');
  return session;
}

/** Parse + validate a JSON request body against a zod schema. Throws ApiError(400). */
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError(400, 'Geçersiz JSON gövdesi');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError(400, 'Doğrulama hatası', result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

/** Uniform error response: ApiError → its status; anything else → logged 500. */
export function handleApiError(error: unknown, context: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, issues: error.issues },
      { status: error.status }
    );
  }
  // Prisma known errors worth a friendly status
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') {
    return NextResponse.json({ error: 'Bu kayıt zaten mevcut (benzersiz alan çakışması)' }, { status: 409 });
  }
  if (code === 'P2025') {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  }
  console.error(`[api] ${context}:`, error);
  return NextResponse.json({ error: context }, { status: 500 });
}

/**
 * Optional pagination: returns Prisma skip/take if ?page= or ?limit= present.
 * Backward compatible — without params, lists return everything as before.
 */
export function getPagination(request: Request): { skip: number; take: number } | undefined {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get('page');
  const limitParam = url.searchParams.get('limit');
  if (!pageParam && !limitParam) return undefined;

  const take = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200);
  const page = Math.max(parseInt(pageParam || '1', 10) || 1, 1);
  return { skip: (page - 1) * take, take };
}

/** JSON list response; adds X-Total-Count when the request was paginated. */
export function listResponse(items: unknown[], total?: number) {
  const res = NextResponse.json(items);
  if (total !== undefined) res.headers.set('X-Total-Count', String(total));
  return res;
}
