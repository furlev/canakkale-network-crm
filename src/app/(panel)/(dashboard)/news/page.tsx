'use client';
import { useState, useEffect } from 'react';
import { isLeaderOrAdmin } from '@/lib/permissions';

type News = {
  id: string;
  title: string;
  category: string;
  author: string;
  status: string;
  views: number;
  publishDate?: string;
  createdAt: string;
  wpId?: number | null;
  url?: string | null;
};

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [editErr, setEditErr] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [newArticle, setNewArticle] = useState({ title: '', category: 'Gündem', author: 'Editör', status: 'draft' });
  const [me, setMe] = useState<{ role: string } | null>(null);
  const canManage = isLeaderOrAdmin(me); // B+ (yükleme bitene dek gizli)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => { if (u) setMe(u); })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/wordpress/sync', { method: 'POST' });
      const data = await res.json();
      setSyncMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error || 'Senkronizasyon başarısız'}`);
      if (res.ok) fetchNews();
    } catch {
      setSyncMsg('❌ Sunucuya ulaşılamadı');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNews(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNews = async () => {
    if (!newArticle.title) return;
    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArticle),
      });
      if (res.ok) {
        const created = await res.json();
        setNews([created, ...news]);
        setIsAdding(false);
        setNewArticle({ title: '', category: 'Gündem', author: 'Editör', status: 'draft' });
      }
    } catch (error) {
      console.error('Error creating news:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setNews(news.map(n => n.id === id ? { ...n, status, publishDate: status === 'published' ? new Date().toISOString() : n.publishDate } : n));
      }
    } catch (error) {
      console.error('Error updating news:', error);
    }
  };

  const handleUpdateNews = async () => {
    if (!editing || !editing.title) return;
    setEditErr('');
    try {
      const res = await fetch(`/api/news/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editing.title, category: editing.category, author: editing.author, status: editing.status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNews(news.map(n => n.id === editing.id ? { ...n, ...updated } : n));
        setEditing(null);
      } else {
        setEditErr('Güncelleme başarısız oldu.');
      }
    } catch (error) {
      console.error('Error updating news:', error);
      setEditErr('Sunucuya ulaşılamadı.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu haberi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNews(news.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Error deleting news:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📰 Haberler (WordPress)</h1>
          <p className="page-subtitle">Sitedeki haber içeriklerinin yönetimi</p>
        </div>
        <div className="page-header-actions">
          {canManage && (
            <>
              <button className="btn btn-ghost" disabled={syncing} onClick={handleSync}>
                🔄 {syncing ? 'Senkronize ediliyor...' : "WordPress'ten Çek"}
              </button>
              <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Haber</button>
            </>
          )}
        </div>
      </div>

      {syncMsg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: syncMsg.startsWith('✅') ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: syncMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {syncMsg}
        </div>
      )}

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Yayındaki Haberler</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>{loading ? '-' : news.filter(n => n.status === 'published').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Taslaklar</div>
          <div className="stat-card-value">{loading ? '-' : news.filter(n => n.status === 'draft').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Okunma</div>
          <div className="stat-card-value" style={{color:'var(--accent)'}}>{loading ? '-' : news.reduce((acc, curr) => acc + curr.views, 0).toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : news.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Henüz haber eklenmemiş.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Haber Başlığı</th>
                <th>Kategori</th>
                <th>Yazar</th>
                <th>Okunma</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {news.map((item) => (
                <tr key={item.id}>
                  <td style={{fontWeight:500, maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" style={{color:'inherit', textDecoration:'none'}} title="Sitede aç ↗">
                        {item.wpId ? '🔗 ' : ''}{item.title}
                      </a>
                    ) : item.title}
                  </td>
                  <td><span className="badge badge-info">{item.category}</span></td>
                  <td style={{color:'var(--text-muted)'}}>{item.author}</td>
                  <td>{item.views.toLocaleString('tr-TR')}</td>
                  <td style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>
                    {item.publishDate ? new Date(item.publishDate).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)'}} 
                      value={item.status} 
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                    >
                      <option value="draft">Taslak</option>
                      <option value="published">Yayında</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditErr(''); setEditing(item); }}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Haber Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={newArticle.title} onChange={e=>setNewArticle({...newArticle, title: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={newArticle.category} onChange={e=>setNewArticle({...newArticle, category: e.target.value})}>
                    <option value="Gündem">Gündem</option>
                    <option value="Siyaset">Siyaset</option>
                    <option value="Spor">Spor</option>
                    <option value="Ekonomi">Ekonomi</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={newArticle.status} onChange={e=>setNewArticle({...newArticle, status: e.target.value})}>
                    <option value="draft">Taslak</option>
                    <option value="published">Hemen Yayınla</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateNews}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <>
          <div className="modal-backdrop" onClick={() => setEditing(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Haberi Düzenle</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editErr && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(255,118,117,0.12)', color: 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                  {editErr}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={editing.category} onChange={e=>setEditing({...editing, category: e.target.value})}>
                    <option value="Gündem">Gündem</option>
                    <option value="Siyaset">Siyaset</option>
                    <option value="Spor">Spor</option>
                    <option value="Ekonomi">Ekonomi</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Yazar</label>
                  <input className="form-input" value={editing.author} onChange={e=>setEditing({...editing, author: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={editing.status} onChange={e=>setEditing({...editing, status: e.target.value})}>
                  <option value="draft">Taslak</option>
                  <option value="published">Yayında</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateNews}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
