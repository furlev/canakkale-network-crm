'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Paywall.module.css';

/**
 * Premium paywall (W2-B). Premium haberin gövdesi kırpıldığında altında gösterilir.
 *  - Oturumsuz okuyucuya giriş/üye-ol CTA'ları (?next ile haberi hedefler).
 *  - Premium yükseltme: ödeme sağlayıcı env-gated STUB. PAYMENT_PROVIDER yoksa
 *    'yakında' mesajı + iletişim yönlendirmesi (premium'a elle panelden yükseltilir).
 */
export default function Paywall({
  authenticated,
  paymentEnabled,
  slug,
}: {
  authenticated: boolean;
  paymentEnabled: boolean;
  slug: string;
}) {
  const [showNote, setShowNote] = useState(false);
  const next = encodeURIComponent(`/haber/${slug}`);

  return (
    <aside className={styles.wrap} aria-label="Premium içerik">
      <div className={styles.badge}>★ Premium</div>
      <h2 className={styles.title}>Bu haberin devamı üyelere özel</h2>
      <p className={styles.text}>
        {authenticated
          ? 'Bu içeriğin tamamını okumak için premium üyeliğe geçmen gerekiyor.'
          : 'Devamını okumak için giriş yap ya da ücretsiz üye ol; premium haberler premium üyelere açıktır.'}
      </p>

      {!authenticated && (
        <div className={styles.actions}>
          <Link href={`/uye/giris?next=${next}`} className="s-btn s-btn-primary">
            Giriş Yap
          </Link>
          <Link href={`/uye/kayit?next=${next}`} className="s-btn">
            Ücretsiz Üye Ol
          </Link>
        </div>
      )}

      <div className={styles.premium}>
        <button type="button" className="s-btn s-btn-primary" onClick={() => setShowNote(true)}>
          ★ Premium’a Yüksel
        </button>
        {showNote && (
          <p className={styles.note} role="status">
            {paymentEnabled
              ? 'Ödeme adımına yönlendiriliyorsun — bu özellik çok yakında aktif olacak.'
              : (
                <>
                  Online ödeme çok yakında. Premium üyelik için bizimle{' '}
                  <Link href="/iletisim">iletişime geç</Link> — hesabını hemen yükseltelim.
                </>
              )}
          </p>
        )}
      </div>
    </aside>
  );
}
