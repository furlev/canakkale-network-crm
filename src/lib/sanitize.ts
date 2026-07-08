/**
 * HTML temizleyici (haber gövdesi + statik sayfalar için).
 *
 * Gerçek bir HTML ayrıştırıcısı (sanitize-html / htmlparser2) üzerine kurulu
 * allowlist tabanlı temizlik. Regex tabanlı eski sürüm `<img src=x/onerror=...>`
 * gibi ayırıcı-varyantlarıyla atlatılabildiği için kaldırıldı: HTML ayrıştırıcısı
 * `/` ve boşluğu attribute sınırı sayar, regex saymazdı → tıklamasız stored XSS.
 *
 * Bu katman savunma derinliğidir: içerik yetkili editörlerden ya da AI boru
 * hattından gelse de public'e basılmadan önce mutlaka buradan geçer.
 */
import sanitizeHtmlLib from 'sanitize-html';

const YT_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
];

const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'loading', 'frameborder'],
    '*': ['class'],
  },
  // javascript:, data:, vbscript: vs. hepsi engellenir; yalnızca güvenli şemalar.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // `//evil.com` protokol-göreli URL'leri reddet (open-redirect/şema atlatma).
  allowProtocolRelative: false,
  // iframe yalnızca YouTube barındırıcılarından; diğer tüm iframe'ler düşer.
  allowedIframeHostnames: YT_HOSTS,
  allowIframeRelativeUrls: false,
  // <script>/<style> içerikleriyle birlikte atılır (yalnız etiket değil).
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  disallowedTagsMode: 'discard',
  transformTags: {
    // Dış bağlantıları yeni sekmede + reverse-tabnabbing koruması ile aç.
    a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, OPTIONS);
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
