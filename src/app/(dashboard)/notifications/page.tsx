'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Notification = {
  id: string;
  type: string;
  title: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=100');
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PUT' });
      if (res.ok) {
        setItems(items.map(n => ({ ...n, read: true })));
        setUnread(0);
      }
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  const markOneRead = async (id: string) => {
    const target = items.find(n => n.id === id);
    if (!target || target.read) return;
    setItems(items.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnread(u => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'PUT' });
      if (!res.ok) {
        setItems(prev => prev.map(n => (n.id === id ? { ...n, read: false } : n)));
        setUnread(u => u + 1);
      }
    } catch (error) {
      console.error('Error marking read:', error);
      setItems(prev => prev.map(n => (n.id === id ? { ...n, read: false } : n)));
      setUnread(u => u + 1);
    }
  };

  const visible = filter === 'unread' ? items.filter(n => !n.read) : items;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🛎️ Bildirimler</h1>
          <p className="page-subtitle">Sistem olayları ve uyarılar</p>
        </div>
        <div className="page-header-actions">
          {unread > 0 && <button className="btn btn-primary" onClick={markAllRead}>✓ Tümünü Okundu İşaretle ({unread})</button>}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tümü ({items.length})</button>
        <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Okunmamış ({unread})</button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛎️</div>
          <div className="empty-state-title">{filter === 'unread' ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}</div>
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
