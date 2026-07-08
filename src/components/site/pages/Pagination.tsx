import Link from 'next/link';

/**
 * Zarif sayfalama: 1 … c-1 [c] c+1 … N penceresi.
 * basePath kanonik kök rota (ör. /haberler), query korunan diğer parametreler.
 */
export default function Pagination({
  current,
  totalPages,
  basePath,
  query = {},
}: {
  current: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const href = (page: number) => {
    const sp = new URLSearchParams(query);
    if (page > 1) sp.set('sayfa', String(page));
    else sp.delete('sayfa');
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Sayfa penceresi: 1, current±1, son — aralara "…"
  const wanted = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages: (number | 'gap')[] = [];
  let prev = 0;
  for (let p = 1; p <= totalPages; p++) {
    if (!wanted.has(p)) continue;
    if (prev && p - prev > 1) pages.push('gap');
    pages.push(p);
    prev = p;
  }

  return (
    <nav className="p-pagination" aria-label="Sayfalar">
      {current > 1 && (
        <Link className="p-page-link" href={href(current - 1)} rel="prev" aria-label="Önceki sayfa">
          ←
        </Link>
      )}
      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="p-page-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            className="p-page-link"
            href={href(p)}
            aria-current={p === current ? 'page' : undefined}
            aria-label={`Sayfa ${p}`}
          >
            {p}
          </Link>
        )
      )}
      {current < totalPages && (
        <Link className="p-page-link" href={href(current + 1)} rel="next" aria-label="Sonraki sayfa">
          →
        </Link>
      )}
    </nav>
  );
}
