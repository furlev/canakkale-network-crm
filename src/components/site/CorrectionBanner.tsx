import { formatDateTr } from '@/lib/site';
import styles from './CorrectionBanner.module.css';

/**
 * Haber düzeltme / geri çekme bilgi kutusu (basın hukuku).
 *
 * Server component — haber detay sayfasında `SiteArticle` alanlarıyla beslenir.
 * İki durum destekler (ikisi birden gösterilebilir; geri çekme her zaman önce):
 *   - retractedAt (+ retractionNote): "Bu haber geri çekilmiştir".
 *   - correctionNote (+ correctedAt): yayın sonrası düzeltme metni.
 *
 * Hiçbir alan dolu değilse hiçbir şey render edilmez (null).
 *
 * NOT metinleri yetkili editör tarafından girildiğinden düz metin olarak basılır
 * (React otomatik escape) — HTML enjeksiyonu için ekstra sanitize gerekmez.
 */
export default function CorrectionBanner({
  correctionNote,
  correctedAt,
  retractedAt,
  retractionNote,
}: {
  correctionNote?: string | null;
  correctedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  retractionNote?: string | null;
}) {
  const isRetracted = Boolean(retractedAt);
  const hasCorrection = Boolean(correctionNote && correctionNote.trim());

  if (!isRetracted && !hasCorrection) return null;

  return (
    <div className={styles.stack}>
      {isRetracted && (
        <aside
          className={`${styles.box} ${styles.retracted}`}
          role="note"
          aria-label="Geri çekme bildirimi"
        >
          <div className={styles.head}>
            <span className={styles.icon} aria-hidden="true">
              ⛔
            </span>
            Bu haber geri çekilmiştir
          </div>
          <p className={styles.note}>
            {retractionNote && retractionNote.trim()
              ? retractionNote
              : 'Bu haber yayından kaldırılmış olup içeriği artık geçerli değildir.'}
          </p>
          {retractedAt && (
            <time className={styles.date} dateTime={new Date(retractedAt).toISOString()}>
              Geri çekme tarihi: {formatDateTr(retractedAt)}
            </time>
          )}
        </aside>
      )}

      {hasCorrection && (
        <aside
          className={`${styles.box} ${styles.correction}`}
          role="note"
          aria-label="Düzeltme notu"
        >
          <div className={styles.head}>
            <span className={styles.icon} aria-hidden="true">
              ✎
            </span>
            Düzeltme
          </div>
          <p className={styles.note}>{correctionNote}</p>
          {correctedAt && (
            <time className={styles.date} dateTime={new Date(correctedAt).toISOString()}>
              Düzeltme tarihi: {formatDateTr(correctedAt)}
            </time>
          )}
        </aside>
      )}
    </div>
  );
}
