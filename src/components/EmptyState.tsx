'use client';

/**
 * <EmptyState> — ortak boş-durum bloğu. Sayfalardaki tekrar eden
 * "Henüz kayıt yok / Sonuç bulunamadı" satır içi bloklarının yerine geçer.
 */

import Link from 'next/link';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  /** Birincil eylem: iç yönlendirme (href) veya tıklama (onClick). */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Daha küçük, satır-içi kart varyantı. */
  compact?: boolean;
  className?: string;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
  className,
}: EmptyStateProps) {
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref} className="btn btn-primary btn-sm">{actionLabel}</Link>
    ) : (
      <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>
    )
  ) : null;

  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''} ${className || ''}`}>
      <div className="empty-state-icon" aria-hidden>{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  );
}
