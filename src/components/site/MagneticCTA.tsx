'use client';

import Link from 'next/link';
import type { RefObject } from 'react';
import { useMagnetic } from '@/hooks/useMagnetic';
import styles from './MagneticCTA.module.css';

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  /** Manyetik çekim gücü (0..1). Varsayılan 0.35. */
  strength?: number;
  ariaLabel?: string;
};

type Props = CommonProps &
  (
    | { href: string; onClick?: never; type?: never }
    | { href?: undefined; onClick?: () => void; type?: 'button' | 'submit' }
  );

/**
 * Manyetik buton/bağlantı: işaretçi yaklaştıkça öğe imlece doğru hafifçe kayar, iç
 * etiket bir tık daha fazla kayarak derinlik verir. Etkileşim yalnız pointer:fine +
 * motion tier full iken çalışır (useMagnetic içeride koşulları uygular); aksi halde
 * tamamen normal bir buton gibi davranır.
 *
 * Stil className ile taşınır (ör. "s-btn s-btn-primary"); modül yalnız manyetik
 * dönüşüm davranışını ekler.
 */
export default function MagneticCTA({
  children,
  className = '',
  strength = 0.35,
  ariaLabel,
  href,
  onClick,
  type = 'button',
}: Props) {
  // Hook koşulsuz tek çağrı (Rules of Hooks); ref uygun eleman tipine cast edilir.
  const ref = useMagnetic<HTMLElement>({ strength });
  const cls = `${styles.magnetic} ${className}`.trim();
  const inner = <span className={styles.label}>{children}</span>;

  if (href) {
    if (/^https?:\/\//i.test(href)) {
      return (
        <a
          ref={ref as RefObject<HTMLAnchorElement>}
          href={href}
          className={cls}
          aria-label={ariaLabel}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link ref={ref as RefObject<HTMLAnchorElement>} href={href} className={cls} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      ref={ref as RefObject<HTMLButtonElement>}
      type={type}
      className={cls}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}
