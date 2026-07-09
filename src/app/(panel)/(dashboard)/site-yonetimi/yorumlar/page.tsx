'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* API sözleşmesi: /api/site-admin/comments (bkz. src/app/api/site-admin/comments) */
type CommentItem = {
  id: string;
  articleId: string;
  article: { id: string; title: string; slug: string } | null;
  name: string;
  email: string | null;
  body: string;
  status: string; // pending | approved | rejected | spam
  aiScore: number | null;
  createdAt: string;
};

type StatusKey = 'pending' | 'approved' | 'rejected' | 'spam';

const TABS: { key: StatusKey; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylı' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'spam', label: 'Spam' },
];

/** aiScore (0-1) → renkli risk rozeti. null ise "AI yok" nötr gösterim. */
function AiBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="badge" style={{ color: 'var(--text-muted)' }} title="AI ön-moderasyon yapılmadı">AI —</span>;
  }
  const pct = Math.round(score * 100);
  const cls = score >= 0.6 ? 'badge-error' : score >= 0.3 ? 'badge-warning' : 'badge-success';
  return <span className={`badge ${cls}`} title="AI toksisite/spam ön-skoru">AI %{pct}</span>;
}

export default function YorumModerasyonPage() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0, spam: 0 });
  const [tab, setTab] = useState<StatusKey>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchComments = useCallback(async (status: StatusKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/site-admin/comments?status=${status}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCounts(data.counts || {});
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments(tab);
  }, [tab, fetchComments]);

  const moderate = async (id: string, status: StatusKey) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/site-admin/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await fetchComments(tab);
      else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'İşlem başarısız oldu.');
      }
    } catch {
      alert('Sunucuya ulaşılamadı.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c: CommentItem) => {
    if (!confirm('Bu yorum kalıcı olarak silinsin mi?')) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/site-admin/comments/${c.id}`, { method: 'DELETE' });
      if (res.ok) await fetchComments(tab);
      else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Silme başarısız oldu.');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💬 Yorum Moderasyonu</h1>
          <p className="page-subtitle">Okuyucu yorumlarını onayla, reddet veya spam olarak işaretle</p>
        </div>
        <div className="page-header-actions">
          <Link href="/site-yonetimi" className="btn btn-ghost">← Site Yönetimi</Link>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Yorum listesi */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Bu durumda yorum bulunmuyor.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Yorum</th>
                <th>Haber</th>
                <th>AI</th>
                <th>Tarih</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} style={{ opacity: busyId === c.id ? 0.5 : 1 }}>
                  <td style={{ maxWidth: 420 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {c.name}
                      {c.email && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: 'var(--text-xs)' }}>
                          · {c.email}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 4 }}>
                      {c.body}
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', maxWidth: 200 }}>
                    {c.article ? (
                      <Link href={`/site-yonetimi/haber/${c.article.id}`} title={c.article.title}>
                        <span style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                          {c.article.title}
                        </span>
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td><AiBadge score={c.aiScore} /></td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(c.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {c.status !== 'approved' && (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => moderate(c.id, 'approved')}>
                          ✓ Onayla
                        </button>
                      )}
                      {c.status !== 'rejected' && (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => moderate(c.id, 'rejected')}>
                          ✕ Reddet
                        </button>
                      )}
                      {c.status !== 'spam' && (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => moderate(c.id, 'spam')}>
                          🚫 Spam
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => handleDelete(c)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
