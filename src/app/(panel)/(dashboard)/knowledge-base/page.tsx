'use client';
import { useState, useEffect } from 'react';
import { isLeaderOrAdmin } from '@/lib/permissions';

type Article = {
  id: string;
  title: string;
  content?: string | null;
  category: string;
  views: number;
  createdAt: string;
};

const categoryMeta: Record<string, { icon: string; desc: string; color: string }> = {
  'Başlangıç Kılavuzu': { icon: '🚀', desc: 'CRM sistemine hızlı başlangıç rehberi', color: 'var(--primary)' },
  'CRM Kullanımı': { icon: '📊', desc: 'Modüller, özellikler ve detaylı kullanım', color: 'var(--accent)' },
  'WordPress Entegrasyonu': { icon: '🔗', desc: 'WordPress bağlantısı ve haber yönetimi', color: 'var(--success)' },
  'Fatura İşlemleri': { icon: '💰', desc: 'Fatura oluşturma, ödeme takibi', color: 'var(--warning)' },
  'Raporlama': { icon: '📈', desc: 'Rapor oluşturma ve analiz araçları', color: 'var(--info)' },
  'Sık Sorulan Sorular': { icon: '❓', desc: 'En çok sorulan sorular ve cevapları', color: 'var(--error)' },
  'Genel': { icon: '📄', desc: 'Genel dokümanlar', color: 'var(--text-muted)' },
};

const emptyForm = { title: '', content: '', category: 'Başlangıç Kılavuzu' };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  return `${months} ay önce`;
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewing, setViewing] = useState<Article | null>(null);
  const [me, setMe] = useState<{ role: string } | null>(null);
  const canManage = isLeaderOrAdmin(me); // B+ (makale ekle/düzenle/sil)

  useEffect(() => {
    fetchArticles();
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => { if (u) setMe(u); })
      .catch(() => {});
  }, []);

  const fetchArticles = async () => {
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : []);
      } else {
        setArticles([]);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a: Article, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content || '', category: a.category });
    setModalOpen(true);
  };

  const openView = async (a: Article) => {
    setViewing(a);
    try {
      const res = await fetch(`/api/articles/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ views: a.views + 1 }),
      });
      if (res.ok) {
        const updated: Article = await res.json();
        setArticles(prev => prev.map(x => (x.id === a.id ? updated : x)));
        setViewing(updated);
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  const handleSave = async () => {
    if (!form.title) return;
    try {
      const res = editingId
        ? await fetch(`/api/articles/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : await fetch('/api/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        const saved = await res.json();
        setArticles(editingId ? articles.map(a => (a.id === editingId ? saved : a)) : [saved, ...articles]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving article:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu makaleyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (res.ok) setArticles(articles.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  };

  const categories = Object.keys(categoryMeta).map(name => ({
    name,
    ...categoryMeta[name],
    count: articles.filter(a => a.category === name).length,
  }));

  const visibleArticles = articles.filter(a => {
    if (activeCategory && a.category !== activeCategory) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📖 Bilgi Tabanı</h1>
          <p className="page-subtitle">Dokümanlar ve kılavuzlar</p>
        </div>
        <div className="page-header-actions">
          {canManage && <button className="btn btn-primary" onClick={openAdd}>+ Yeni Makale</button>}
        </div>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto var(--space-8)' }}>
        <div className="topbar-search" style={{ width: '100%', padding: 'var(--space-3) var(--space-5)' }}>
          <span className="topbar-search-icon">🔍</span>
          <input
            placeholder="Bilgi tabanında ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', width: '100%' }}
          />
        </div>
      </div>

      <div className="grid-3 stagger-children">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="card"
            style={{ cursor: 'pointer', textAlign: 'center', outline: activeCategory === cat.name ? '2px solid var(--primary)' : 'none' }}
            onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
          >
            <div style={{ width: 64, height: 64, borderRadius: 'var(--border-radius-lg)', background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto var(--space-4)' }}>{cat.icon}</div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{cat.name}</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>{cat.desc}</p>
            <span className="badge badge-primary">{cat.count} makale</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 'var(--space-8)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
          📝 {activeCategory ? `${activeCategory} Makaleleri` : search ? 'Arama Sonuçları' : 'Son Eklenen Makaleler'}
        </h3>
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : visibleArticles.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
            {articles.length === 0 ? 'Henüz makale eklenmemiş. İlk makalenizi ekleyin.' : 'Eşleşen makale bulunamadı.'}
          </div>
        ) : (
          visibleArticles.slice(0, activeCategory || search ? undefined : 10).map((a, i, arr) => (
            <div key={a.id} onClick={() => openView(a)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{categoryMeta[a.category]?.icon || '📄'}</span>
                <div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{a.title}</span>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{a.category}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{timeAgo(a.createdAt)}</span>
                {canManage && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={e => openEdit(a, e)}>✏️ Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={e => handleDelete(a.id, e)}>🗑️</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Makaleyi Düzenle' : 'Yeni Makale'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {Object.keys(categoryMeta).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">İçerik</label>
                <textarea className="form-textarea" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <>
          <div className="modal-backdrop" onClick={() => setViewing(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{categoryMeta[viewing.category]?.icon || '📄'} {viewing.title}</h2>
              <button className="modal-close" onClick={() => setViewing(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <span className="badge badge-primary">{viewing.category}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>👁️ {viewing.views} görüntülenme</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{timeAgo(viewing.createdAt)}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {viewing.content ? viewing.content : <span style={{ color: 'var(--text-muted)' }}>Bu makalede içerik bulunmuyor.</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setViewing(null)}>Kapat</button>
              {canManage && (
                <button className="btn btn-primary" onClick={() => { const a = viewing; setViewing(null); openEdit(a); }}>✏️ Düzenle</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
