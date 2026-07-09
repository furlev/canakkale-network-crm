import { getEmergency } from '@/lib/citydata';
import styles from './EmergencyBanner.module.css';

/**
 * ACİL DURUM / DEPREM BANDI (A7b, #36b) — server component.
 *
 * `Setting('emergency')` okur; active ise sitenin en üstünde SABİT kırmızı acil
 * durum bandı render eder (başlık + detay + zaman). Acil olduğundan KAPATILAMAZ.
 * active değilse (veya kayıt yok / DB hatası) hiçbir şey render edilmez → sıfır
 * görsel/erişim etkisi.
 *
 * Erişilebilirlik: role="alert" (assertive, atomic) — AT için acil bildirim
 * semantiği. reduced-motion: nabız animasyonu CSS'te @media ile kapatılır.
 * Metinler yetkili cron/feed'den geldiği için düz metin basılır (React escape).
 *
 * severity → renk yoğunluğu: info < warning < critical.
 */
export default async function EmergencyBanner() {
  const em = await getEmergency().catch(() => null);
  if (!em || !em.active) return null;

  const severity = em.severity === 'critical' || em.severity === 'warning' ? em.severity : 'info';

  let timeLabel = '';
  if (em.updatedAt) {
    const d = new Date(em.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      timeLabel = d.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return (
    <div
      className={`${styles.banner} ${styles[severity]}`}
      data-severity={severity}
      role="alert"
      aria-atomic="true"
    >
      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          ⚠
        </span>
        <span className={styles.body}>
          <strong className={styles.title}>{em.title || 'Acil Durum Uyarısı'}</strong>
          {em.detail ? <span className={styles.detail}>{em.detail}</span> : null}
        </span>
        {timeLabel ? (
          <time className={styles.time} dateTime={em.updatedAt}>
            {timeLabel}
          </time>
        ) : null}
      </div>
    </div>
  );
}
