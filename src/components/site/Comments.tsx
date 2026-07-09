'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './Comments.module.css';

/**
 * Halka açık okuyucu yorumları (W1-D). Haber detayında mount edilir.
 *  - Onaylanmış yorumları listeler (GET /api/site/comment?articleId=...)
 *  - Yeni yorum formu (POST /api/site/comment) — honeypot + sunucu IP rate-limit
 *  - Başarıda nötr "moderasyon sonrası yayınlanacak" mesajı (bilgi sızdırmaz).
 * Yeni yorum anında listeye eklenmez; önce moderasyondan geçer.
 */

type Comment = { id: string; name: string; body: string; createdAt: string };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Comments({ articleId }: { articleId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/site/comment?articleId=${encodeURIComponent(articleId)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.items)) setComments(data.items);
    } catch {
      /* sessiz — yorumlar yüklenemezse form yine çalışır */
    } finally {
      setLoaded(true);
    }
  }, [articleId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/site/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, name, email: email || undefined, body: text, website }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDone(true);
        setName('');
        setEmail('');
        setText('');
      } else {
        setError(data?.error || 'Yorum gönderilemedi. Lütfen daha sonra tekrar dene.');
      }
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.wrap} aria-label="Yorumlar">
      <h2 className={styles.title}>
        Yorumlar<span className={styles.tint}>.</span>
        {loaded && comments.length > 0 && <span className={styles.count}> ({comments.length})</span>}
      </h2>

      {/* ── Yorum listesi ── */}
      {loaded && comments.length === 0 ? (
        <p className={styles.empty}>İlk yorumu sen yaz.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map(c => (
            <li key={c.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemName}>{c.name}</span>
                <time className={styles.itemDate} dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
              </div>
              <p className={styles.itemBody}>{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ── Yeni yorum formu ── */}
      {done ? (
        <div className={styles.success} role="status">
          Yorumun bize ulaştı. Moderasyon sonrası yayınlanacak — teşekkürler!
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <h3 className={styles.formTitle}>Yorum yaz</h3>

          {/* Honeypot — insanlar görmez, botlar doldurur */}
          <div className={styles.hp} aria-hidden="true">
            <label htmlFor="cm-website">Web sitesi (boş bırak)</label>
            <input
              id="cm-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={e => setWebsite(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cm-name">Ad</label>
              <input
                id="cm-name"
                className={styles.input}
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Adın"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cm-email">E-posta (yayınlanmaz)</label>
              <input
                id="cm-email"
                className={styles.input}
                type="email"
                maxLength={160}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@eposta.com"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cm-body">Yorumun</label>
            <textarea
              id="cm-body"
              className={styles.textarea}
              required
              minLength={3}
              maxLength={2000}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Düşüncelerini paylaş…"
            />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className="s-btn s-btn-primary" disabled={busy}>
              {busy ? 'Gönderiliyor…' : 'Yorumu Gönder'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
