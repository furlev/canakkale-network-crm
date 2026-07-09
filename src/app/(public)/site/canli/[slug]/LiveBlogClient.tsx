'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './LiveBlogClient.module.css';

export type LiveEntry = {
  id: string;
  body: string;
  important: boolean;
  authorName: string | null;
  createdAt: string; // ISO
};

type PollResponse = {
  status?: string;
  serverTime?: string;
  entries?: LiveEntry[];
};

const POLL_MS = 12_000;

/** Türkçe göreli zaman (istemci tarafı — canlı tazelenir). */
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

/** Saat:dakika (sabit zaman etiketi). */
function clockTr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Canlı blog akışı — istemci polling ile en yeni girişler en üstte.
 * Sunucudan gelen initialEntries ile başlar; POLL_MS'de bir yalnız yeni
 * girişleri çeker (?since=), id'ye göre dedup eder. status='ended' olunca
 * polling durur ve "sona erdi" rozeti gösterilir.
 */
export default function LiveBlogClient({
  slug,
  initialStatus,
  initialEntries,
}: {
  slug: string;
  initialStatus: string;
  initialEntries: LiveEntry[];
}) {
  const [entries, setEntries] = useState<LiveEntry[]>(initialEntries);
  const [status, setStatus] = useState<string>(initialStatus);
  const [now, setNow] = useState<number>(() => Date.now());
  const [newCount, setNewCount] = useState(0);
  const idsRef = useRef<Set<string>>(new Set(initialEntries.map((e) => e.id)));

  // En yeni bilinen createdAt (poll cursor)
  const newestAt = entries.length
    ? entries.reduce((m, e) => (e.createdAt > m ? e.createdAt : m), entries[0].createdAt)
    : '';

  const poll = useCallback(async () => {
    try {
      const qs = newestAt ? `?since=${encodeURIComponent(newestAt)}` : '';
      const res = await fetch(`/api/site/liveblog/${encodeURIComponent(slug)}${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data: PollResponse = await res.json();
      if (data.status) setStatus(data.status);
      const incoming = (data.entries || []).filter((e) => e && e.id && !idsRef.current.has(e.id));
      if (incoming.length) {
        for (const e of incoming) idsRef.current.add(e.id);
        setEntries((prev) => {
          const merged = [...incoming, ...prev];
          merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
          return merged;
        });
        setNewCount((c) => c + incoming.length);
      }
    } catch {
      /* ağ hatası — bir sonraki tur dener */
    }
  }, [slug, newestAt]);

  // Polling (yalnız yayın aktifse)
  useEffect(() => {
    if (status === 'ended') return;
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [poll, status]);

  // Göreli zamanları canlı tut (30 sn)
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  // now kullanımını tetikle (relatif zaman yeniden hesaplansın)
  void now;

  const live = status === 'active';

  return (
    <div className={styles.wrap}>
      <div className={styles.statusBar}>
        {live ? (
          <span className={styles.liveBadge}>
            <span className={styles.dot} aria-hidden="true" />
            CANLI
          </span>
        ) : (
          <span className={styles.endedBadge}>Yayın sona erdi</span>
        )}
        {live && newCount > 0 && (
          <button
            type="button"
            className={styles.newPill}
            onClick={() => {
              setNewCount(0);
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {newCount} yeni giriş
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <span aria-hidden="true">📡</span>
          <p>Henüz giriş yok. İlk gelişme düştüğünde burada görünecek.</p>
        </div>
      ) : (
        <ol className={styles.feed} aria-live="polite">
          {entries.map((e) => (
            <li key={e.id} className={`${styles.item} ${e.important ? styles.important : ''}`}>
              <div className={styles.rail} aria-hidden="true">
                <span className={styles.node} />
              </div>
              <div className={styles.card}>
                <div className={styles.meta}>
                  <time dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString('tr-TR')}>
                    {clockTr(e.createdAt)}
                  </time>
                  <span className={styles.rel}>{timeAgo(e.createdAt)}</span>
                  {e.important && <span className={styles.tag}>Önemli</span>}
                </div>
                <div className={styles.body}>{e.body}</div>
                {e.authorName && <div className={styles.author}>{e.authorName}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
