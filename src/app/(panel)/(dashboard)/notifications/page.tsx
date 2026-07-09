'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Notification = {
  id: string;
  type: string;
  title: string;
  link?: string | null;
  read: boolean;
  userId?: string | null;
  category?: string | null;
  createdAt: string;
};

type Prefs = { categories: Record<string, boolean>; sound: boolean; desktop: boolean };

const typeMeta: Record<string, { icon: string; label: string; color: string }> = {
  tip: { icon: '🔔', label: 'İhbar', color: 'var(--warning)' },
  invoice_paid: { icon: '💰', label: 'Fatura', color: 'var(--success)' },
  project_completed: { icon: '✅', label: 'Proje', color: 'var(--success)' },
  client: { icon: '🤝', label: 'Müşteri', color: 'var(--accent)' },
  task: { icon: '📋', label: 'Görev', color: 'var(--primary)' },
  news: { icon: '📰', label: 'Haber', color: 'var(--info)' },
  contract: { icon: '📝', label: 'Sözleşme', color: 'var(--error)' },
  info: { icon: 'ℹ️', label: 'Bilgi', color: 'var(--text-muted)' },
};

/* Kategori filtre çipleri (efektif category ile eşleşir) */
const CATEGORY_CHIPS: { value: string; label: string; icon: string }[] = [
  { value: '', label: 'Tümü', icon: '🗂️' },
  { value: 'invoice', label: 'Fatura', icon: '💰' },
  { value: 'tip', label: 'İhbar', icon: '🔔' },
  { value: 'ai', label: 'AI', icon: '🤖' },
  { value: 'task', label: 'Görev', icon: '📋' },
  { value: 'site', label: 'Site', icon: '🌐' },
  { value: 'client', label: 'Müşteri', icon: '🤝' },
];

const PREF_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'invoice', label: 'Fatura & Finans', icon: '💰' },
  { key: 'tip', label: 'İhbarlar', icon: '🔔' },
  { key: 'ai', label: 'AI Taslakları', icon: '🤖' },
  { key: 'task', label: 'Görevler', icon: '📋' },
  { key: 'site', label: 'Site & Haber', icon: '🌐' },
  { key: 'client', label: 'Müşteriler', icon: '🤝' },
  { key: 'news', label: 'Bültenler', icon: '📰' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadMine, setUnreadMine] = useState(0);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [category, setCategory] = useState('');
  const [mine, setMine] = useState(false);

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', status });
      if (category) params.set('category', category);
      if (mine) params.set('mine', '1');
      const res = await fetch(`/api/notifications?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
      setUnreadMine(data.unreadMine || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [status, category, mine]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  /* Tercihler */
  useEffect(() => {
    fetch('/api/me/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPrefs(d); })
      .catch(() => {});
  }, []);

  const savePrefs = async (next: Prefs) => {
    setPrefs(next); // iyimser
    setPrefsSaving(true);
    try {
      await fetch('/api/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch { /* sessiz */ } finally {
      setPrefsSaving(false);
    }
  };

  const togglePrefCategory = (key: string) => {
    if (!prefs) return;
    savePrefs({ ...prefs, categories: { ...prefs.categories, [key]: !prefs.categories[key] } });
  };

  /* Geçerli filtreye göre toplu okundu işaretle */
  const markFilteredRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: category || undefined, mine: mine || undefined, all: !category && !mine }),
      });
      if (res.ok) fetchNotifications();
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  const markOneRead = async (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    if (target.userId) setUnreadMine((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'PUT' });
      if (!res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
        setUnread((u) => u + 1);
      }
    } catch (error) {
      console.error('Error marking read:', error);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      setUnread((u) => u + 1);
    }
  };

  /* Tercihte kapalı kategorileri gizle (yalnız "Tümü" görünümünde) */
  const visible = items.filter((n) => {
    if (!prefs) return true;
    const cat = n.category || 'other';
    if (category) return true; // kullanıcı açıkça o kategoriyi seçtiyse göster
    return prefs.categories[cat] !== false;
  });

  const mutedCount = prefs ? PREF_CATEGORIES.filter((c) => prefs.categories[c.key] === false).length : 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🛎️ Bildirimler</h1>
          <p className="page-subtitle">Sistem olayları ve uyarılar{mutedCount > 0 ? ` — ${mutedCount} kategori sessizde` : ''}</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={() => setPrefsOpen((v) => !v)}>⚙️ Tercihler</button>
          {unread > 0 && <button className="btn btn-primary" onClick={markFilteredRead}>✓ {category || mine ? 'Filtreyi' : 'Tümünü'} Okundu İşaretle</button>}
        </div>
      </div>

      {/* Tercih paneli */}
      {prefsOpen && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>🔔 Bildirim Tercihleri</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            Kapalı kategoriler bu liste ve zil menüsünde gizlenir.{prefsSaving ? ' Kaydediliyor…' : ''}
          </p>
          {!prefs ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Yükleniyor…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-2)' }}>
                {PREF_CATEGORIES.map((c) => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', padding: 'var(--space-2)', borderRadius: 'var(--border-radius)', background: 'var(--surface-2)' }}>
                    <input type="checkbox" checked={prefs.categories[c.key] !== false} onChange={() => togglePrefCategory(c.key)} />
                    <span>{c.icon}</span>
                    <span style={{ fontSize: 'var(--text-sm)' }}>{c.label}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={prefs.desktop} onChange={() => savePrefs({ ...prefs, desktop: !prefs.desktop })} />
                  🖥️ Masaüstü bildirimi
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={prefs.sound} onChange={() => savePrefs({ ...prefs, sound: !prefs.sound })} />
                  🔊 Sesli uyarı
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {/* Durum sekmeleri */}
      <div className="tabs">
        <button className={`tab ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>Tümü</button>
        <button className={`tab ${status === 'unread' ? 'active' : ''}`} onClick={() => setStatus('unread')}>Okunmamış ({unread})</button>
        <button className={`tab ${status === 'read' ? 'active' : ''}`} onClick={() => setStatus('read')}>Okunmuş</button>
        <button className={`tab ${mine ? 'active' : ''}`} onClick={() => setMine((v) => !v)}>👤 Bana Atanan{unreadMine > 0 ? ` (${unreadMine})` : ''}</button>
      </div>

      {/* Kategori çipleri */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
        {CATEGORY_CHIPS.map((c) => (
          <button
            key={c.value}
            className={`badge ${category === c.value ? 'badge-primary' : ''}`}
            onClick={() => setCategory(c.value)}
            style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', padding: 'var(--space-1) var(--space-3)', background: category === c.value ? undefined : 'var(--surface-2)' }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛎️</div>
          <div className="empty-state-title">{status === 'unread' ? 'Okunmamış bildirim yok' : mine ? 'Size atanan bildirim yok' : 'Henüz bildirim yok'}</div>
          <div className="empty-state-desc">Yeni ihbar, ödenen fatura, atanan görev gibi olaylar burada listelenir.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {visible.map((n, i) => {
            const meta = typeMeta[n.type] || typeMeta.info;
            const inner = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', borderBottom: i < visible.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: n.read ? 'transparent' : 'rgba(108,92,231,0.06)', cursor: n.link || !n.read ? 'pointer' : 'default', transition: 'background var(--transition-fast)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--border-radius)', background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                    <span className="badge" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color, marginRight: 'var(--space-2)' }}>{meta.label}</span>
                    {n.userId && <span className="badge" style={{ marginRight: 'var(--space-2)' }}>👤 Size</span>}
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />}
              </div>
            );
            return n.link
              ? <Link key={n.id} href={n.link} onClick={() => markOneRead(n.id)} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</Link>
              : <div key={n.id} onClick={() => markOneRead(n.id)}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
