'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './CookieConsent.module.css';

/**
 * KVKK / ePrivacy uyumlu çerez rıza banner'ı — "privacy-first".
 *
 * Tasarım ilkesi: varsayılan/vurgulu eylem "Yalnızca gerekli"dir; analitik ve
 * reklam çerezleri KULLANICI AÇIKÇA ONAYLAMADAN çalışmaz (KVKK m.5 açık rıza).
 * Rıza kararı localStorage('cn-cookie-consent') içinde 1 yıl saklanır; süre
 * dolunca banner yeniden gösterilir (rıza yenileme).
 *
 * Diğer script'ler (analitik/reklam) rıza durumunu iki yoldan öğrenebilir:
 *   - flag:  window.cn.consent  → { necessary, analytics, marketing }
 *   - event: window.addEventListener('cn:consent', (e) => e.detail)  (her karar/yüklemede yayınlanır)
 */

const STORAGE_KEY = 'cn-cookie-consent';
const CONSENT_VERSION = 1;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type ConsentCategories = {
  necessary: true; // her zaman açık, kapatılamaz
  analytics: boolean;
  marketing: boolean;
};

type StoredConsent = {
  v: number;
  categories: ConsentCategories;
  decidedAt: number; // epoch ms
  expiresAt: number; // epoch ms
};

// window üzerindeki rıza flag'i (diğer script'ler okuyabilsin diye)
declare global {
  interface Window {
    cn?: { consent?: ConsentCategories } & Record<string, unknown>;
  }
}

function readStored(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (
      !parsed ||
      parsed.v !== CONSENT_VERSION ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.categories
    ) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) return null; // süresi dolmuş → yeniden sor
    return parsed as StoredConsent;
  } catch {
    return null; // gizli mod / bozuk kayıt
  }
}

/** Rıza durumunu window'a yayınlar (flag + event). Analitik/reklam yalnızca burada duyurulan izne göre çalışır. */
function broadcast(categories: ConsentCategories) {
  if (typeof window === 'undefined') return;
  window.cn = { ...(window.cn ?? {}), consent: categories };
  try {
    window.dispatchEvent(new CustomEvent<ConsentCategories>('cn:consent', { detail: categories }));
  } catch {
    /* CustomEvent desteklenmiyorsa flag yine de set edildi */
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Mount: kayıtlı rıza varsa uygula ve banner'ı gösterme; yoksa banner'ı aç.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      broadcast(stored.categories);
      setAnalytics(stored.categories.analytics);
      setMarketing(stored.categories.marketing);
    } else {
      setVisible(true);
    }
  }, []);

  const persist = useCallback((categories: ConsentCategories) => {
    const now = Date.now();
    const record: StoredConsent = {
      v: CONSENT_VERSION,
      categories,
      decidedAt: now,
      expiresAt: now + ONE_YEAR_MS,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* gizli mod: kalıcı saklanamasa da oturum için rızayı yay */
    }
    broadcast(categories);
    setVisible(false);
    setShowSettings(false);
  }, []);

  const acceptNecessary = useCallback(() => {
    persist({ necessary: true, analytics: false, marketing: false });
  }, [persist]);

  const acceptAll = useCallback(() => {
    persist({ necessary: true, analytics: true, marketing: true });
  }, [persist]);

  const saveChoice = useCallback(() => {
    persist({ necessary: true, analytics, marketing });
  }, [persist, analytics, marketing]);

  // Esc → privacy-first varsayılan: yalnızca gerekli
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') acceptNecessary();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, acceptNecessary]);

  if (!visible) return null;

  return (
    <div className={styles.wrap}>
      <section
        className={styles.card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="cn-consent-title"
        aria-describedby="cn-consent-desc"
      >
        <h2 id="cn-consent-title" className={styles.title}>
          Çerez tercihlerin
        </h2>
        <p id="cn-consent-desc" className={styles.text}>
          Sitenin çalışması için gerekli çerezleri kullanıyoruz. Ziyaret istatistikleri (analitik) ve
          reklam çerezleri ise yalnızca <strong>senin açık rızanla</strong> devreye girer. Ayrıntılar
          için <a href="/cerez-politikasi">Çerez Politikası</a> ve{' '}
          <a href="/kvkk-aydinlatma">KVKK Aydınlatma Metni</a> sayfalarımıza göz atabilirsin.
        </p>

        {showSettings && (
          <div className={styles.settings}>
            <div className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>Gerekli çerezler</span>
                <span className={styles.rowDesc}>
                  Oturum, güvenlik ve temel işlevler için zorunludur; kapatılamaz.
                </span>
              </div>
              <span className={styles.always}>Her zaman açık</span>
            </div>

            <div className={styles.row}>
              <div className={styles.rowMain}>
                <label className={styles.rowTitle} htmlFor="cn-consent-analytics">
                  Analitik çerezler
                </label>
                <span className={styles.rowDesc}>
                  Hangi haberlerin okunduğunu anonim olarak ölçmemize yardımcı olur.
                </span>
              </div>
              <span className={styles.switch}>
                <input
                  id="cn-consent-analytics"
                  type="checkbox"
                  checked={analytics}
                  onChange={e => setAnalytics(e.target.checked)}
                />
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.thumb} />
                </span>
              </span>
            </div>

            <div className={styles.row}>
              <div className={styles.rowMain}>
                <label className={styles.rowTitle} htmlFor="cn-consent-marketing">
                  Reklam çerezleri
                </label>
                <span className={styles.rowDesc}>
                  İlgi alanına uygun reklamların gösterilmesinde kullanılır.
                </span>
              </div>
              <span className={styles.switch}>
                <input
                  id="cn-consent-marketing"
                  type="checkbox"
                  checked={marketing}
                  onChange={e => setMarketing(e.target.checked)}
                />
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.thumb} />
                </span>
              </span>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {showSettings ? (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveChoice}>
              Seçimi kaydet
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={acceptNecessary}
            >
              Yalnızca gerekli
            </button>
          )}

          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={acceptAll}
          >
            Tümünü kabul
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnLink}`}
            onClick={() => setShowSettings(s => !s)}
            aria-expanded={showSettings}
          >
            {showSettings ? 'Ayarları gizle' : 'Ayarlar'}
          </button>
        </div>
      </section>
    </div>
  );
}
