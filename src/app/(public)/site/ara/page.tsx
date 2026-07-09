import { redirect } from 'next/navigation';

/**
 * /ara — arama girişi. Arşiv sayfası (/haberler) zaten arama + facet (ilçe/kategori)
 * içerdiğinden, /ara kanonik olarak oraya yönlendirir; q korunur. Ayrı bir arama
 * yüzeyi gerekirse ileride burada zenginleştirilebilir (opsiyonel sayfa).
 */

export const dynamic = 'force-dynamic';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || '';
}

export default async function SearchPage(context: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await context.searchParams;
  const q = first(sp.q).trim().slice(0, 120);
  const target = q ? `/haberler?q=${encodeURIComponent(q)}` : '/haberler';
  redirect(target);
}
