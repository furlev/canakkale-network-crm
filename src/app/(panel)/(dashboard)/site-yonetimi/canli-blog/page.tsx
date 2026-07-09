'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/* API sözleşmesi: /api/site-admin/liveblog (GET liste, POST oluştur) */
type LiveBlog = {
  id: string;
  slug: string;
  title: string;
  status: string; // active | ended
  articleId: string | null;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  lastEntryAt: string | null;
};

export default function CanliBlogPage() {
  const [blogs, setBlogs] = useState<LiveBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-admin/liveblog');
      const data = await res.json();
      setBlogs(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      alert('Başlık en az 3 karakter olmalı.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/site-admin/liveblog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: slug.trim() || undefined }),
      });
      if (res.ok) {
        setTitle('');
        setSlug('');
        await load();
      } else {
        const d = await res.json().catch(() => null);
        alert(d?.error || 'Canlı blog oluşturulamadı.');
      }
    } finally {
      setCreating(false);
    }
  };

  const endBlog = async (b: LiveBlog) => {
    if (!confirm(`"${b.title}" canlı yayını sona erdirilsin mi?`)) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/site-admin/liveblog/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });
      if (res.ok) await load();
      else alert('İşlem başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  };

  const removeBlog = async (b: LiveBlog) => {
    if (!confirm(`"${b.title}" canlı yayını ve tüm girişleri kalıcı silinsin mi?`)) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/site-admin/liveblog/${b.id}`, { method: 'DELETE' });
      if (res.ok) await load();
      else alert('Silme başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🔴 Canlı Blog</h1>
          <p className="page-subtitle">Deprem, seçim gecesi vb. için zaman damgalı canlı yayın akışı</p>
        </div>
        <div className="page-header-actions">
          <Link href="/site-yonetimi" className="btn btn-ghost">← Site Yönetimi</Link>
        </div>
      </div>

      {/* Yeni canlı yayın */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={create} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label className="form-label">Başlık</label>
            <input
              className="form-input"
              placeholder="Örn. Çanakkale Depremi — Canlı Gelişmeler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div style={{ flex: '0 1 240px' }}>
            <label className="form-label">Slug (opsiyonel)</label>
            <input
              className="form-input"
              placeholder="otomatik üretilir"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              maxLength={200}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Oluşturuluyor...' : '➕ Canlı Yayın Başlat'}
          </button>
        </form>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : blogs.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz canlı yayın yok. Yukarıdan yeni bir tane başlatın.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Durum</th>
                <th>Giriş</th>
                <th>Son Giriş</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b.id} style={{ opacity: busyId === b.id ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 500 }}>
                    {b.title}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>/canli/{b.slug}</div>
                  </td>
                  <td>
                    {b.status === 'active' ? (
                      <span className="badge badge-error">🔴 Canlı</span>
                    ) : (
                      <span className="badge badge-primary">Sona Erdi</span>
                    )}
                  </td>
                  <td>{b.entryCount}</td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {b.lastEntryAt ? new Date(b.lastEntryAt).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Link href={`/site-yonetimi/canli-blog/${b.id}`} className="btn btn-ghost btn-sm">
                        Yönet
                      </Link>
                      <a href={`/canli/${b.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                        Görüntüle
                      </a>
                      {b.status === 'active' && (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === b.id} onClick={() => endBlog(b)}>
                          Bitir
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busyId === b.id} onClick={() => removeBlog(b)}>
                        Sil
                      </button>
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
