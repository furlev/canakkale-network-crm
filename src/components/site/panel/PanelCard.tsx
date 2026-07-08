'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMotionTier } from '@/components/site/motion/MotionProvider';
import styles from './PanelCard.module.css';

/**
 * ŞEHİR PANOSU cam-yüzeyli kart kabuğu. Piyasa/Hava/Eczane kartlarının ortak çerçevesi.
 * Tema-duyarlı (site.css tokenları: --surface/--ink/--line/--accent). Animasyonlar
 * MotionProvider tier'ına ve prefers-reduced-motion'a saygılıdır.
 */
export type PanelCardProps = {
  title: string;
  icon?: ReactNode;
  kicker?: string;
  href?: string; // verilirse başlık tıklanabilir (detay sayfasına)
  accent?: string; // vurgu rengi (CSS değişkenini ezer)
  stale?: boolean; // veri gecikmeli rozeti
  updatedLabel?: string | null; // "12:30 güncellendi" gibi
  action?: ReactNode; // sağ üst: sekmeler/butonlar
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
};

export default function PanelCard({
  title,
  icon,
  kicker,
  href,
  accent,
  stale,
  updatedLabel,
  action,
  footnote,
  className,
  children,
}: PanelCardProps) {
  const tier = useMotionTier();
  const anim = tier !== 'off';

  const titleNode = href ? (
    <Link href={href} className={styles.titleLink}>
      {title}
    </Link>
  ) : (
    title
  );

  return (
    <section
      className={`${styles.card} ${anim ? styles.animate : ''} ${className || ''}`}
      style={accent ? ({ '--panel-accent': accent } as React.CSSProperties) : undefined}
    >
      <header className={styles.head}>
        <div className={styles.headMain}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          <div className={styles.titles}>
            {kicker && <span className={styles.kicker}>{kicker}</span>}
            <h2 className={styles.title}>{titleNode}</h2>
          </div>
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </header>

      {(stale || updatedLabel) && (
        <div className={styles.meta}>
          {stale && (
            <span className={styles.stale} title="Veri kaynağı gecikmeli olabilir">
              ● Veri gecikmeli
            </span>
          )}
          {updatedLabel && <span className={styles.updated}>{updatedLabel}</span>}
        </div>
      )}

      <div className={styles.body}>{children}</div>

      {footnote && <footer className={styles.foot}>{footnote}</footer>}
    </section>
  );
}
