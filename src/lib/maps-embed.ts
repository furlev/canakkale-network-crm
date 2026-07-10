/**
 * Google Maps embed URL güvenlik doğrulaması — hem sunucu (zod refine) hem
 * istemci (panel önizleme) tarafından kullanılır; bu yüzden BAĞIMSIZDIR
 * (prisma vb. import etmez).
 *
 * Neden: mapsEmbedUrl ayarı public /iletisim sayfasında <iframe src> olarak
 * basılıyor. Şema kısıtı olmadan "javascript:" URL'leri sayfanın origin'inde
 * script çalıştırır (stored XSS). Yalnız https + Google host'ları kabul edilir.
 */
export function isSafeMapsEmbedUrl(raw: string): boolean {
  const value = (raw || '').trim();
  if (!value) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return (
    h === 'google.com' ||
    h === 'maps.google.com' ||
    h === 'www.google.com' ||
    h.endsWith('.google.com')
  );
}
