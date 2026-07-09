import { redirect } from 'next/navigation';

/**
 * Eski WordPress haber listesi kaldırıldı — haber yönetimi artık dahili site
 * yönetim modülünde (SiteArticle). Eski /news bağlantıları buraya yönlenir.
 */
export default function NewsRedirect() {
  redirect('/site-yonetimi');
}
