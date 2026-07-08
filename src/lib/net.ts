/**
 * İstemci IP'sini güvenilir-proxy sayısına göre X-Forwarded-For'un SAĞINDAN okur.
 *
 * `x-forwarded-for` istemci tarafından soldan enjekte edilebilir; en soldaki
 * parçaya güvenmek (eski `split(',')[0]`) rate-limit atlatma ve hedefli 429
 * (griefing) sağlıyordu. Güvenilir ters proxy (DigitalOcean ingress) gerçek
 * istemci IP'sini en sağa ekler; bu yüzden sondan `TRUSTED_PROXY_HOPS` (varsayılan
 * 1) kadar geri gelen parçayı alırız. En-kötü durumda bile saldırgan yalnızca
 * kendi solundaki değerleri kontrol edebilir.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS || '1') || 1);
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const idx = Math.max(0, parts.length - hops);
      return parts[idx];
    }
  }
  return headers.get('x-real-ip') || 'unknown';
}
