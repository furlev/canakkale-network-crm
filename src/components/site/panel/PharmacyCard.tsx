'use client';

import { useMemo, useState } from 'react';
import PanelCard from './PanelCard';
import styles from './PharmacyCard.module.css';
import type { PharmacyEntry } from '@/lib/citydata';

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const gun = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][d.getDay()];
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${gun}`;
}

function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  return d ? `tel:${d}` : null;
}

function EntryRow({ e }: { e: PharmacyEntry }) {
  const tel = telHref(e.phone);
  return (
    <li className={styles.entry}>
      <div className={styles.entryHead}>
        <span className={styles.pin} aria-hidden="true">
          ⚕️
        </span>
        <h3 className={styles.name}>{e.name}</h3>
        <span className={styles.dist}>{e.district}</span>
      </div>
      {e.address && <p className={styles.addr}>{e.address}</p>}
      <div className={styles.actions}>
        {tel && (
          <a className={styles.act} href={tel}>
            📞 {e.phone}
          </a>
        )}
        {e.mapsUrl && (
          <a className={styles.act} href={e.mapsUrl} target="_blank" rel="noopener noreferrer">
            📍 Haritada gör
          </a>
        )}
      </div>
    </li>
  );
}

/**
 * Nöbetçi eczane kartı: ilçe sekmeli (+ "Tümü") liste. Adres, telefon (tıkla-ara) ve
 * harita bağlantısıyla. Veri NobetciEczane tablosundan (sunucuda) prop olarak gelir.
 */
export default function PharmacyCard({
  data,
  href = '/nobetci-eczane',
  compact,
}: {
  data: { date: string | null; entries: PharmacyEntry[] };
  href?: string;
  compact?: boolean;
}) {
  const entries = data.entries ?? [];

  // İlçe sekmeleri — girişlerdeki sırayı koru (getTodayPharmacies district'e göre sıralı gelir)
  const districts = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      if (!seen.has(e.district)) {
        seen.add(e.district);
        out.push(e.district);
      }
    }
    return out;
  }, [entries]);

  const [sel, setSel] = useState<string | null>(null); // null = Tümü
  const shown = sel ? entries.filter((e) => e.district === sel) : entries;

  return (
    <PanelCard
      title="Nöbetçi Eczaneler"
      icon="⚕️"
      kicker={data.date ? formatDate(data.date) : 'Bugün'}
      href={href}
      accent="#2fb96b"
      footnote="Kaynak: Çanakkale Eczacı Odası · Nöbet saatleri için eczaneyi arayın."
    >
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Nöbetçi eczane verisi henüz hazırlanmadı ya da bugün için yayınlanmadı. Lütfen daha sonra tekrar bakın.
        </p>
      ) : (
        <>
          {!compact && districts.length > 1 && (
            <div className={styles.tabsWrap}>
              <div className={styles.tabs} role="tablist" aria-label="İlçe seç">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sel === null}
                  className={`${styles.tab} ${sel === null ? styles.tabActive : ''}`}
                  onClick={() => setSel(null)}
                >
                  Tümü
                </button>
                {districts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={sel === d}
                    className={`${styles.tab} ${sel === d ? styles.tabActive : ''}`}
                    onClick={() => setSel(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul className={styles.list}>
            {(compact ? shown.slice(0, 3) : shown).map((e, i) => (
              <EntryRow key={`${e.district}-${e.name}-${i}`} e={e} />
            ))}
          </ul>
        </>
      )}
    </PanelCard>
  );
}
