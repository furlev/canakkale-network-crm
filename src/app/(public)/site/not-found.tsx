import Link from 'next/link';
import '@/app/(public)/pages.css';

/** Site 404 — aranan haber/sayfa bulunamadı. */
export default function SiteNotFound() {
  return (
    <div className="p-404">
      <div>
        <div className="p-404-code" aria-hidden="true">
          404
        </div>
        <h1>Bu haber meydanda yok.</h1>
        <p>
          Aradığın sayfa taşınmış, kaldırılmış ya da hiç var olmamış olabilir. Ama meydan boş değil —
          en güncel haberler seni bekliyor.
        </p>
        <div className="p-404-actions">
          <Link href="/" className="s-btn s-btn-primary">
            Anasayfaya Dön
          </Link>
          <Link href="/haberler" className="s-btn">
            Haber Arşivi
          </Link>
        </div>
      </div>
    </div>
  );
}
