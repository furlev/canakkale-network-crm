/**
 * Küçük, bağımlılıksız HTML temizleyici (haber gövdesi + statik sayfalar için).
 * script/style/object/embed etiketlerini, YouTube dışı iframe'leri,
 * on* olay attribute'larını ve javascript: URL'lerini söker.
 * Not: Tam bir DOM sanitizer değildir — içerik zaten CRM'deki yetkili
 * editörlerden gelir; bu katman savunma derinliği içindir.
 */

const YOUTUBE_SRC = /^https?:\/\/(www\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let out = html;

  // script/style blokları (içerikleriyle birlikte)
  out = out
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');

  // tehlikeli gömme/etiketler
  out = out
    .replace(/<(object|embed|base|meta|link|form)\b[^>]*>/gi, '')
    .replace(/<\/(object|form)\s*>/gi, '');

  // iframe: yalnızca YouTube kaynaklılar kalır
  out = out.replace(
    /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>|<iframe\b[^>]*\/?>/gi,
    match => {
      const src = match.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] || '';
      return YOUTUBE_SRC.test(src) ? match : '';
    }
  );

  // on* olay attribute'ları (çift/tek tırnaklı ve tırnaksız)
  out = out
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '');

  // javascript: / data:text URL'leri
  out = out.replace(
    /\s(href|src)\s*=\s*["']\s*(javascript|data:text)[^"']*["']/gi,
    ''
  );

  return out;
}

/**
 * YouTube linkinden gizlilik dostu embed URL'i üretir (watch / youtu.be /
 * shorts / live / embed biçimlerini tanır). Tanınmazsa null döner.
 */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/i
  );
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
