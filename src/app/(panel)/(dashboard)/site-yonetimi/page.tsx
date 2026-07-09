'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* API sözleşmesi: /api/site-admin/articles (bkz. src/app/api/site-admin) */
type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  categorySlug: string | null;
  category: { name: string; color: string | null } | null;
  status: string;            // draft | published | archived
  newsType: string;          // breaking | daily | weekly | manual
  isBreaking: boolean;
  isFeatured: boolean;
  isEditorPick: boolean;
  imageIsAi: boolean;
  sourceDraftId: string | null;
  publishedAt: string | null;
  views: number;
  authorName: string;
  createdAt: string;
};

type Category = { slug: string; name: string; color: string | null; articleCount: number };

type StatusKey = 'published' | 'draft' | 'archived';

const TABS: { key: StatusKey; label: string }[] = [
  { key: 'published', label: 'Yayında' },
  { key: 'draft', label: 'Taslak' },
  { key: 'archived', label: 'Arşiv' },
];

export default function SiteYonetimiPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ published: 0, draft: 0, archived: 0 });
  const [totalViews, setTotalViews] = useState(0);
  const [todayApplications, setTodayApplications] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<StatusKey>('published');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArticles = useCallback(async (status: StatusKey, query: string, cat: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set('q', query.trim());
      if (cat) params.set('category', cat);
      const res = await fetch(`/api/site-admin/articles?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setArticles(data.items || []);
        setCounts(data.counts || {});
        setTotalViews(data.totalViews || 0);
      } else {
        setArticles([]);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(tab, q, category);
    // q debounce ayrı handler'da — burada yalnızca sekme/kategori değişimi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category]);

  useEffect(() => {
    fetch('/api/site-admin/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
    fetch('/api/site-admin/applications?status=new')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.counts) setTodayApplications(data.counts.today ?? 0); })
      .catch(() => {});
  }, []);

  const handleSearch = (value: string) => {
    setQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchArticles(tab, value, category), 350);
  };

  /** Tekil alan güncelle (toggle / durum) ve listeyi yenile. */
  const patchArticle = async (id: string, patch: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/site-admin/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) await fetchArticles(tab, q, category);
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

  const handleDelete = async (a: Article) => {
    if (!confirm(`"${a.title}" haberi silinsin mi? (Çöp kutusuna taşınır)`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/site-admin/articles/${a.id}`, { method: 'DELETE' });
      if (res.ok) await fetchArticles(tab, q, category);
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
          <h1 className="page-title">🌐 Site Yönetimi</h1>
          <p className="page-subtitle">canakkale.network haber sitesinin içerik yönetimi</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link href="/site-yonetimi/analitik" className="btn btn-ghost">📊 Analitik</Link>
          <Link href="/site-yonetimi/takvim" className="btn btn-ghost">🗓️ Takvim</Link>
          <Link href="/site-yonetimi/sayfalar" className="btn btn-ghost">📄 Sayfalar</Link>
          <Link href="/site-yonetimi/form" className="btn btn-ghost">🧩 Katılım Formu</Link>
          <Link href="/site-yonetimi/basvurular" className="btn btn-ghost">📋 Başvurular</Link>
          <Link href="/site-yonetimi/feribot" className="btn btn-ghost">⛴️ Feribot</Link>
          <Link href="/site-yonetimi/ayarlar" className="btn btn-ghost">⚙️ Site Ayarları</Link>
          <button className="btn btn-primary" onClick={() => router.push('/site-yonetimi/haber/yeni')}>➕ Yeni Haber</button>
        </div>
      </div>

      {/* Özet kartları */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Yayın</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{counts.published ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Taslak</div>
          <div className="stat-card-value">{counts.draft ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Görüntülenme</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{totalViews.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bugünkü Başvuru</div>
          <div className="stat-card-value" style={{ color: 'var(--primary-light)' }}>
            {todayApplications === null ? '-' : todayApplications}
          </div>
        </div>
      </div>

      {/* Sekmeler + filtreler */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} ({counts[t.key] ?? 0})
            </button>
          ))}
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="🔍 Başlık / özet ara..."
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select className="form-select" style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name} ({c.articleCount})</option>
          ))}
        </select>
      </div>

      {/* Haber tablosu */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : articles.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Bu durumda haber bulunmuyor.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Kategori</th>
                <th>Tür</th>
                <th>Yayın Tarihi</th>
                <th>Görüntülenme</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} style={{ opacity: busyId === a.id ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 500, maxWidth: 340 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.title}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      /{a.slug} · {a.authorName}
                    </div>
                  </td>
                  <td>
                    {a.category ? (
                      <span className="badge badge-info" style={a.category.color ? { background: `${a.category.color}22`, color: a.category.color } : undefined}>
                        {a.category.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {a.isBreaking && <span className="badge badge-error">🔴 Son Dakika</span>}
                      {(a.sourceDraftId || a.imageIsAi) && <span className="badge badge-primary">AI ✨</span>}
                      {a.isFeatured && <span className="badge badge-warning">⭐ Öne Çıkan</span>}
                      {a.isEditorPick && <span className="badge badge-success">Editör Seçimi</span>}
                      {!a.isBreaking && !a.sourceDraftId && !a.imageIsAi && !a.isFeatured && !a.isEditorPick && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {a.status === 'published' && <span className="badge badge-success" style={{ marginRight: 6 }}>Yayında</span>}
                    {a.status === 'draft' && <span className="badge badge-warning" style={{ marginRight: 6 }}>Taslak</span>}
                    {a.status === 'archived' && <span className="badge badge-primary" style={{ marginRight: 6 }}>Arşiv</span>}
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td>{a.views.toLocaleString('tr-TR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Link href={`/site-yonetimi/haber/${a.id}`} className="btn btn-ghost btn-sm">Düzenle</Link>
                      {a.status === 'published' ? (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => patchArticle(a.id, { status: 'draft' })}>
                          Yayından Kaldır
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => patchArticle(a.id, { status: 'published' })}>
                          Yayınla
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        title={a.isFeatured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                        disabled={busyId === a.id}
                        onClick={() => patchArticle(a.id, { isFeatured: !a.isFeatured })}
                        style={{ opacity: a.isFeatured ? 1 : 0.45 }}
                      >
                        ⭐
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title={a.isBreaking ? 'Son dakikadan çıkar' : 'Son dakika yap'}
                        disabled={busyId === a.id}
                        onClick={() => patchArticle(a.id, { isBreaking: !a.isBreaking })}
                        style={{ opacity: a.isBreaking ? 1 : 0.45 }}
                      >
                        🔴
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title={a.isEditorPick ? 'Editör seçiminden çıkar' : 'Editör seçimi yap'}
                        disabled={busyId === a.id}
                        onClick={() => patchArticle(a.id, { isEditorPick: !a.isEditorPick })}
                        style={{ opacity: a.isEditorPick ? 1 : 0.45 }}
                      >
                        ✒️
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => handleDelete(a)}>Sil</button>
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
