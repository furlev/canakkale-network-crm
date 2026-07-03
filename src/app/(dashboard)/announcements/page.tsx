'use client';
import { useState, useEffect } from 'react';

type Announcement = {
  id: string;
  title: string;
  content: string;
  target: string;
  priority: string;
  author: string;
  createdAt: string;
};

const targetColors: Record<string, string> = { Herkes: 'badge-primary', Ekip: 'badge-accent', 'Müşteri': 'badge-warning' };
const prioColors: Record<string, string> = { high: 'badge-error', normal: 'badge-info', low: 'badge-success' };

const emptyForm = { title: '', content: '', target: 'Herkes', priority: 'normal', author: 'Admin' };

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(Array.isArray(data) ? data : []);
      } else {
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content, target: a.target, priority: a.priority, author: a.author });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    try {
      const res = editingId
        ? await fetch(`/api/announcements/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        const saved = await res.json();
        setAnnouncements(editingId ? announcements.map(a => (a.id === editingId ? saved : a)) : [saved, ...announcements]);
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📣 Duyurular</h1>
          <p className="page-subtitle">Ekip ve müşteri duyuruları</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Duyuru</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📣</div>
          <div className="empty-state-title">Henüz duyuru yok</div>
          <div className="empty-state-desc">İlk duyurunuzu yayınlayarak başlayın.</div>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Duyuru</button>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {announcements.map(a => (
            <div key={a.id} className="card" style={{ borderLeft: `3px solid ${a.priority === 'high' ? 'var(--error)' : a.priority === 'normal' ? 'var(--info)' : 'var(--success)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{a.title}</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <span className={`badge ${targetColors[a.target] || 'badge-primary'}`}>{a.target}</span>
                  <span className={`badge ${prioColors[a.priority] || 'badge-info'}`}>{a.priority === 'high' ? 'Önemli' : a.priority === 'normal' ? 'Normal' : 'Düşük'}</span>
                </div>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>{a.content}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div className="avatar avatar-sm" style={{ background: 'var(--primary-gradient)', color: 'white' }}>{a.author[0]}</div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{a.author}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>📅 {new Date(a.createdAt).toLocaleDateString('tr-TR')}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(a.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Duyuruyu Düzenle' : 'Yeni Duyuru'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">İçerik *</label>
                <textarea className="form-textarea" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Hedef Kitle</label>
                  <select className="form-select" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
                    <option value="Herkes">Herkes</option>
                    <option value="Ekip">Ekip</option>
                    <option value="Müşteri">Müşteri</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Önemli</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Yayınlayan</label>
                <input className="form-input" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
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
