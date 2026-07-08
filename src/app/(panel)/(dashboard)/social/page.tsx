'use client';
import { useState, useEffect, useMemo } from 'react';

type SocialPost = {
  id: string;
  articleId?: string | null;
  platform: string;
  text: string;
  status: string;
  postedAt?: string | null;
  createdAt: string;
};

type Draft = {
  id: string;
  title?: string | null;
  topic?: string;
  socialPost?: string | null;
  articleId?: string | null;
  status: string;
};

const PLATFORMS: { value: string; label: string; icon: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'x', label: 'X', icon: '𝕏' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Kuyrukta', cls: 'badge-warning' },
  posted: { label: 'Paylaşıldı', cls: 'badge-success' },
  skipped: { label: 'Atlandı', cls: 'badge-info' },
};

const platformMeta = (p: string) => PLATFORMS.find(x => x.value === p) || { label: p, icon: '📣' };

const emptyForm = { platform: 'instagram', text: '', articleId: '' };

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all'); // all | queued | posted | skipped
  const [msg, setMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // AI taslak besleme modalı
  const [draftModal, setDraftModal] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/site/social');
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching social posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => ({
    queued: posts.filter(p => p.status === 'queued').length,
    posted: posts.filter(p => p.status === 'posted').length,
    skipped: posts.filter(p => p.status === 'skipped').length,
  }), [posts]);

  const visible = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setMsg(''); setModalOpen(true); };
  const openEdit = (p: SocialPost) => {
    setEditingId(p.id);
    setForm({ platform: p.platform, text: p.text, articleId: p.articleId || '' });
    setMsg('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.text.trim()) return;
    const payload = { platform: form.platform, text: form.text, articleId: form.articleId || null };
    try {
      const res = editingId
        ? await fetch(`/api/site/social/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/site/social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setPosts(editingId ? posts.map(p => p.id === editingId ? saved : p) : [saved, ...posts]);
        setModalOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        setMsg(`❌ ${data?.error || 'Kaydedilemedi'}`);
      }
    } catch {
      setMsg('❌ Sunucuya ulaşılamadı');
    }
  };

  const setStatus = async (p: SocialPost, status: string) => {
    try {
      const res = await fetch(`/api/site/social/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (res.ok) {
        const saved = await res.json();
        setPosts(posts.map(x => x.id === p.id ? saved : x));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu gönderiyi silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/site/social/${id}`, { method: 'DELETE' });
    if (res.ok) setPosts(posts.filter(p => p.id !== id));
  };

  const copyText = async (p: SocialPost) => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(prev => prev === p.id ? null : prev), 1500);
    } catch {
      setMsg('❌ Panoya kopyalanamadı (tarayıcı izni gerekebilir)');
    }
  };

  // ── AI taslaklarından besleme ──
  const openDraftModal = async () => {
    setDraftModal(true);
    setDraftsLoading(true);
    try {
      const res = await fetch('/api/ai/drafts?status=all');
      const data = await res.json();
      const withSocial = (Array.isArray(data) ? data : []).filter((d: Draft) => d.socialPost && d.socialPost.trim());
      setDrafts(withSocial);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const queueFromDraft = async (d: Draft, platform: string) => {
    try {
      const res = await fetch('/api/site/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, text: d.socialPost, articleId: d.articleId || null }),
      });
      if (res.ok) {
        const saved = await res.json();
        setPosts(prev => [saved, ...prev]);
        setMsg(`✅ "${(d.title || d.topic || 'Taslak').slice(0, 40)}" kuyruğa eklendi`);
      }
    } catch {
      setMsg('❌ Eklenemedi');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📣 Sosyal Kuyruk</h1>
          <p className="page-subtitle">Çoklu-kanal metin kuyruğu — kopyala, işaretle, planla (paylaşım manüel)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={openDraftModal}>🤖 AI taslaklarından çek</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Gönderi</button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card"><div className="stat-card-label">Kuyrukta</div><div className="stat-card-value" style={{ color: 'var(--warning)' }}>{loading ? '-' : counts.queued}</div></div>
        <div className="stat-card"><div className="stat-card-label">Paylaşıldı</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{loading ? '-' : counts.posted}</div></div>
        <div className="stat-card"><div className="stat-card-label">Atlandı</div><div className="stat-card-value" style={{ color: 'var(--text-muted)' }}>{loading ? '-' : counts.skipped}</div></div>
      </div>

      {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.startsWith('✅') ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {['all', 'queued', 'posted', 'skipped'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tümü' : STATUS_LABEL[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📣</div>
          <div className="empty-state-title">Kuyrukta gönderi yok</div>
          <div className="empty-state-desc">Elle gönderi ekleyin ya da AI taslaklarının sosyal metinlerinden çekin.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Gönderi</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {visible.map(p => {
            const meta = platformMeta(p.platform);
            const st = STATUS_LABEL[p.status] || { label: p.status, cls: 'badge-info' };
            return (
              <div key={p.id} className="card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{meta.label}</span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {p.articleId && <span className="badge badge-info" title="Bağlı haber">🔗 haber</span>}
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {p.postedAt ? `Paylaşım: ${new Date(p.postedAt).toLocaleDateString('tr-TR')}` : new Date(p.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>{p.text}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyText(p)}>{copiedId === p.id ? '✓ Kopyalandı' : '📋 Kopyala'}</button>
                  {p.status !== 'posted' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(p, 'posted')}>✅ Paylaşıldı</button>}
                  {p.status !== 'skipped' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'skipped')}>⏭️ Atla</button>}
                  {p.status !== 'queued' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'queued')}>↩️ Kuyruğa al</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️ Düzenle</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Gönderiyi Düzenle' : 'Yeni Sosyal Gönderi'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Platform</label>
                <select className="form-select" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                  {PLATFORMS.map(pl => <option key={pl.value} value={pl.value}>{pl.icon} {pl.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Metin *</label>
                <textarea className="form-textarea" rows={6} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="Paylaşılacak metin (hashtag, emoji dahil)." />
              </div>
              <div className="form-group">
                <label className="form-label">Bağlı Haber ID (opsiyonel)</label>
                <input className="form-input" value={form.articleId} onChange={e => setForm({ ...form, articleId: e.target.value })} placeholder="SiteArticle id (varsa)" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* AI draft feed modal */}
      {draftModal && (
        <>
          <div className="modal-backdrop" onClick={() => setDraftModal(false)}></div>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">🤖 AI Taslaklarından Çek</h2>
              <button className="modal-close" onClick={() => setDraftModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {draftsLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>Yükleniyor...</div>
              ) : drafts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>Sosyal metni olan taslak bulunamadı.</div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {drafts.map(d => (
                    <div key={d.id} className="card" style={{ padding: 'var(--space-3)' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4 }}>{d.title || d.topic || 'Başlıksız'}</div>
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--space-2)', lineHeight: 1.5 }}>{d.socialPost}</p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PLATFORMS.map(pl => (
                          <button key={pl.value} className="btn btn-ghost btn-sm" onClick={() => queueFromDraft(d, pl.value)}>
                            {pl.icon} {pl.label}&apos;a ekle
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDraftModal(false)}>Kapat</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
