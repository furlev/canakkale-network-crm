'use client';
import { useState, useEffect } from 'react';

type Note = {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  shared: boolean;
  favorite: boolean;
  updatedAt: string;
};

const categoryColors: Record<string, string> = {
  'İş': '#6c5ce7',
  'Finans': '#00cec9',
  'Proje': '#00b894',
  'Teknik': '#fdcb6e',
  'Pazarlama': '#74b9ff',
  'Müşteri': '#ff7675',
  'Genel': '#a29bfe',
};

const emptyForm = { title: '', content: '', category: 'Genel', shared: false };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'personal' | 'shared' | 'fav'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (n: Note) => {
    setEditingId(n.id);
    setForm({ title: n.title, content: n.content, category: n.category, shared: n.shared });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    const payload = { ...form, color: categoryColors[form.category] || categoryColors['Genel'] };
    try {
      const res = editingId
        ? await fetch(`/api/notes/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setNotes(editingId ? notes.map(n => (n.id === editingId ? saved : n)) : [saved, ...notes]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const toggleFavorite = async (n: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notes/${n.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !n.favorite }),
      });
      if (res.ok) setNotes(notes.map(x => (x.id === n.id ? { ...x, favorite: !n.favorite } : x)));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) setNotes(notes.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const filtered = notes.filter(n => {
    if (tab === 'personal') return !n.shared;
    if (tab === 'shared') return n.shared;
    if (tab === 'fav') return n.favorite;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📝 Notlar</h1>
          <p className="page-subtitle">Kişisel ve paylaşılan notlar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Not</button>
        </div>
      </div>

      <div className="tabs">
        {[{ k: 'all' as const, l: 'Tümü' }, { k: 'personal' as const, l: 'Kişisel' }, { k: 'shared' as const, l: 'Paylaşılan' }, { k: 'fav' as const, l: 'Favoriler' }].map(t => (
          <button key={t.k} className={`tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">Not bulunamadı</div>
          <div className="empty-state-desc">{notes.length === 0 ? 'İlk notunuzu oluşturarak başlayın.' : 'Bu filtrede gösterilecek not yok.'}</div>
          {notes.length === 0 && <button className="btn btn-primary" onClick={openAdd}>+ Yeni Not</button>}
        </div>
      ) : (
        <div className="grid-3 stagger-children">
          {filtered.map(n => (
            <div key={n.id} className="card" style={{ borderTop: `3px solid ${n.color}`, cursor: 'pointer' }} onClick={() => openEdit(n)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className="badge" style={{ background: `${n.color}22`, color: n.color }}>{n.category}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  {n.shared && <span style={{ fontSize: 'var(--text-xs)' }} title="Paylaşılan">👥</span>}
                  <span style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }} onClick={e => toggleFavorite(n, e)} title="Favori">{n.favorite ? '⭐' : '☆'}</span>
                  <span style={{ fontSize: 'var(--text-xs)', cursor: 'pointer' }} onClick={e => handleDelete(n.id, e)} title="Sil">🗑️</span>
                </div>
              </div>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{n.title}</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', marginBottom: 'var(--space-3)', whiteSpace: 'pre-line' }}>{n.content}</p>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>📅 {new Date(n.updatedAt).toLocaleDateString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Notu Düzenle' : 'Yeni Not'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">İçerik</label>
                <textarea className="form-textarea" rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {Object.keys(categoryColors).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Görünürlük</label>
                  <select className="form-select" value={form.shared ? 'shared' : 'personal'} onChange={e => setForm({ ...form, shared: e.target.value === 'shared' })}>
                    <option value="personal">Kişisel</option>
                    <option value="shared">Paylaşılan</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
