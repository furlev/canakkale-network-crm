'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/* API sözleşmesi: /api/site-admin/liveblog/[id] (+ /entries) */
type Entry = {
  id: string;
  body: string;
  important: boolean;
  authorName: string | null;
  createdAt: string;
};
type Blog = {
  id: string;
  slug: string;
  title: string;
  status: string;
  articleId: string | null;
  entries: Entry[];
};

export default function CanliBlogManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyEntry, setBusyEntry] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/site-admin/liveblog/${id}`);
      const data = await res.json();
      setBlog(res.ok ? data : null);
    } catch {
      setBlog(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 1) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/site-admin/liveblog/${id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), important }),
      });
      if (res.ok) {
        setBody('');
        setImportant(false);
        await load();
      } else {
        const d = await res.json().catch(() => null);
        alert(d?.error || 'Giriş eklenemedi.');
      }
    } finally {
      setPosting(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!confirm('Bu giriş silinsin mi?')) return;
    setBusyEntry(entryId);
    try {
      const res = await fetch(`/api/site-admin/liveblog/${id}/entries?entryId=${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
      });
      if (res.ok) await load();
      else alert('Silme başarısız oldu.');
    } finally {
      setBusyEntry(null);
    }
  };

  const endBlog = async () => {
    if (!confirm('Canlı yayın sona erdirilsin mi?')) return;
    try {
      const res = await fetch(`/api/site-admin/liveblog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      if (res.ok) await load();
      else alert('İşlem başarısız oldu.');
    } catch {
      alert('Sunucuya ulaşılamadı.');
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>;
  }
  if (!blog) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
        Canlı blog bulunamadı.{' '}
        <Link href="/site-yonetimi/canli-blog" className="btn btn-ghost btn-sm">
          Listeye dön
        </Link>
      </div>
    );
  }

  const active = blog.status === 'active';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            {active ? '🔴 ' : ''}
            {blog.title}
          </h1>
          <p className="page-subtitle">
            /canli/{blog.slug} · {active ? 'Canlı yayında' : 'Yayın sona erdi'}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link href="/site-yonetimi/canli-blog" className="btn btn-ghost">← Liste</Link>
          <a href={`/canli/${blog.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Görüntüle</a>
          {active && <button className="btn btn-ghost" onClick={endBlog}>Yayını Bitir</button>}
        </div>
      </div>

      {/* Hızlı giriş ekleme */}
      {active ? (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <form onSubmit={addEntry}>
            <label className="form-label">Yeni giriş</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Gelişmeyi buraya yazın..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
            />
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
                <span>Önemli (vurgulanır + push bildirimi tetikler)</span>
              </label>
              <button className="btn btn-primary" type="submit" disabled={posting || body.trim().length < 1} style={{ marginLeft: 'auto' }}>
                {posting ? 'Ekleniyor...' : 'Girişi Yayınla'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 'var(--space-6)', color: 'var(--text-muted)' }}>
          Bu yayın sona erdi. Yeni giriş eklenemez (arşiv olarak okunabilir).
        </div>
      )}

      {/* Girişler */}
      <div className="data-table-container">
        {blog.entries.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz giriş yok.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>Zaman</th>
                <th>Giriş</th>
                <th style={{ width: 90 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {blog.entries.map((e) => (
                <tr key={e.id} style={{ opacity: busyEntry === e.id ? 0.5 : 1 }}>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', verticalAlign: 'top' }}>
                    {new Date(e.createdAt).toLocaleString('tr-TR')}
                    {e.authorName && <div>{e.authorName}</div>}
                  </td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>
                    {e.important && <span className="badge badge-error" style={{ marginRight: 6 }}>Önemli</span>}
                    {e.body}
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <button className="btn btn-ghost btn-sm" disabled={busyEntry === e.id} onClick={() => deleteEntry(e.id)}>
                      Sil
                    </button>
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
