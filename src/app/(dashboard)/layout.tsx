'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPath } from '@/lib/permissions';

/* ── Navigation data ─────────────────────────────────── */
interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'ANA MENÜ',
    items: [
      { label: 'Dashboard', href: '/', icon: '📊' },
      { label: 'Bildirimler', href: '/notifications', icon: '🛎️' },
      { label: 'Kişiler', href: '/contacts', icon: '👥' },
      { label: 'Müşteriler', href: '/clients', icon: '🏢' },
      { label: 'Leads', href: '/leads', icon: '🎯' },
    ],
  },
  {
    title: 'PROJELER',
    items: [
      { label: 'Projeler', href: '/projects', icon: '📁' },
      { label: 'Görevler', href: '/tasks', icon: '✅' },
      { label: 'Takvim', href: '/calendar', icon: '📅' },
    ],
  },
  {
    title: 'FİNANS',
    items: [
      { label: 'Faturalar', href: '/invoices', icon: '📄' },
      { label: 'Teklifler', href: '/estimates', icon: '📋' },
      { label: 'Giderler', href: '/expenses', icon: '💰' },
      { label: 'Sözleşmeler', href: '/contracts', icon: '📝' },
      { label: 'Teklifnameler', href: '/proposals', icon: '📑' },
      { label: 'Ödemeler & Maaş', href: '/payments', icon: '💳' },
    ],
  },
  {
    title: 'HABERLER',
    items: [
      { label: 'Haberler', href: '/news', icon: '📰' },
      { label: 'Haber İhbarı', href: '/tips', icon: '🔔' },
      { label: 'Reklam Verenler', href: '/advertisers', icon: '📢' },
      { label: 'Reklam Kampanyaları', href: '/campaigns', icon: '🎬' },
      { label: 'Aboneler', href: '/subscribers', icon: '👤' },
      { label: 'Bülten', href: '/newsletters', icon: '📧' },
    ],
  },
  {
    title: 'EKİP & İLETİŞİM',
    items: [
      { label: 'Mesajlar', href: '/messages', icon: '💬' },
      { label: 'Ekip', href: '/team', icon: '👨‍💼' },
      { label: 'Editör Verimlilik', href: '/editor-performance', icon: '📊' },
      { label: 'Destek', href: '/support', icon: '🎫' },
      { label: 'Dokümanlar', href: '/documents', icon: '📂' },
      { label: 'Bilgi Tabanı', href: '/knowledge-base', icon: '📖' },
      { label: 'Duyurular', href: '/announcements', icon: '📣' },
      { label: 'Notlar', href: '/notes', icon: '📝' },
    ],
  },
  {
    title: 'ANALİZ',
    items: [
      { label: 'Raporlar', href: '/reports', icon: '📈' },
      { label: 'Ayarlar', href: '/settings', icon: '⚙️' },
    ],
  },
];

/* Topbar "Hızlı Ekle" (＋) menüsü — ilgili sayfaya götürür */
const quickLinks: NavItem[] = [
  { label: 'Yeni Görev', href: '/tasks', icon: '✅' },
  { label: 'Yeni Kişi', href: '/contacts', icon: '👥' },
  { label: 'Yeni İhbar', href: '/tips', icon: '🔔' },
  { label: 'Yeni Not', href: '/notes', icon: '📝' },
  { label: 'Yeni Etkinlik', href: '/calendar', icon: '📅' },
  { label: 'Yeni Fatura', href: '/invoices', icon: '📄' },
];

/* ── Helper: decide if link is "active" ──────────────── */
function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

/* ── Layout component ────────────────────────────────── */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newTipCount, setNewTipCount] = useState(0);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  /* Notifications (bell) */
  type NotifItem = { id: string; type: string; title: string; link?: string | null; read: boolean; createdAt: string };
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  /* Global search */
  type SearchResult = { type: string; icon: string; title: string; subtitle?: string; link: string };
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = () => {
    fetch('/api/notifications?limit=10')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setNotifications(data.items || []);
          setNotifUnread(data.unread || 0);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [pathname]);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PUT' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setNotifUnread(0);
  };

  /* Ctrl+K focuses search; Escape closes panels */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(value.trim())}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setSearchResults(data.results || []);
            setSearchOpen(true);
          }
        })
        .catch(() => {});
    }, 300);
  };

  const goToResult = (link: string) => {
    setSearchOpen(false);
    setSearchQ('');
    setSearchResults([]);
    router.push(link);
  };

  /* Current user for the topbar */
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => setUser(u))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  /* Tema (koyu/açık) — tercih localStorage'da, FOUC head script ile birlikte çalışır */
  useEffect(() => {
    try {
      if (localStorage.getItem('crm-theme') === 'light') {
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch { /* */ }
  }, []);
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('crm-theme', next); } catch { /* */ }
      return next;
    });
  };

  /* Service-worker registration */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('SW registered:', reg.scope);
        })
        .catch((err) => {
          console.log('SW registration failed:', err);
        });
    }
  }, []);

  /* Live badge: count of new tips (lightweight count endpoint) */
  useEffect(() => {
    const fetchTipCount = () => {
      fetch('/api/tips/count')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.new === 'number') setNewTipCount(data.new);
        })
        .catch(() => {});
    };
    fetchTipCount();
    const interval = setInterval(fetchTipCount, 60000);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <div className="app-layout">
      {/* ════════════ SIDEBAR ════════════ */}
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        {/* Brand header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">Ç</div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Çanakkale Network</span>
            <span className="sidebar-brand-sub">CRM Sistemi</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map((section) => {
            const items = section.items.filter((it) => !user || canAccessPath({ role: user.role }, it.href));
            if (items.length === 0) return null;
            return (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>

              {items.map((item) => {
                const badge =
                  item.href === '/tips' && newTipCount > 0
                    ? String(newTipCount)
                    : item.href === '/notifications' && notifUnread > 0
                      ? (notifUnread > 9 ? '9+' : String(notifUnread))
                      : item.badge;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link${isLinkActive(pathname, item.href) ? ' active' : ''}`}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span className="sidebar-link-text">{item.label}</span>
                    {badge && (
                      <span className="sidebar-link-badge">{badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {sidebarCollapsed ? '▶' : '◀'}
            {!sidebarCollapsed && (
              <span className="sidebar-link-text">Daralt</span>
            )}
          </button>
        </div>
      </aside>

      {/* ════════════ MAIN AREA ════════════ */}
      <div className={`main-area${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        {/* ──── TOP BAR ──── */}
        <header className={`topbar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
          <div className="topbar-left">
            {/* Search */}
            <div className="topbar-search" style={{ position: 'relative' }}>
              <span className="topbar-search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ara..."
                value={searchQ}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              />
              <span className="topbar-search-shortcut">Ctrl+K</span>

              {searchOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, minWidth: 360, maxHeight: 420, overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--border-radius-lg)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 1000, padding: 'var(--space-2)' }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      Sonuç bulunamadı
                    </div>
                  ) : (
                    searchResults.map((r, i) => (
                      <div
                        key={i}
                        onMouseDown={() => goToResult(r.link)}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--border-radius)', cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-3)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '1rem' }}>{r.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                          {r.subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.subtitle}</div>}
                        </div>
                        <span className="badge badge-primary" style={{ flexShrink: 0 }}>{r.type}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* Theme toggle */}
            <button className="topbar-btn" title="Tema değiştir" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Quick add */}
            <div style={{ position: 'relative' }}>
              <button className="topbar-btn" title="Hızlı Ekle" onClick={() => setQuickOpen((v) => !v)}>
                ＋
              </button>
              {quickOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setQuickOpen(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--border-radius-lg)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 1000, padding: 'var(--space-2)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>HIZLI EKLE</div>
                    {quickLinks
                      .filter((q) => !user || canAccessPath({ role: user.role }, q.href))
                      .map((q) => (
                        <div
                          key={q.href}
                          onClick={() => { setQuickOpen(false); router.push(q.href); }}
                          style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--border-radius)', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-3)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          <span>{q.icon}</span>
                          <span style={{ fontSize: 'var(--text-sm)' }}>{q.label}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button className="topbar-btn" title="Bildirimler" onClick={() => setNotifOpen(!notifOpen)}>
                🔔
                {notifUnread > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--error)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setNotifOpen(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 440, overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--border-radius-lg)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 1000 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>🛎️ Bildirimler</span>
                      {notifUnread > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={markAllRead}>✓ Tümünü oku</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Henüz bildirim yok
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => { setNotifOpen(false); if (n.link) router.push(n.link); }}
                          style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', cursor: n.link ? 'pointer' : 'default', background: n.read ? 'transparent' : 'rgba(108,92,231,0.06)' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: n.read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                              {new Date(n.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
                        </div>
                      ))
                    )}
                    <Link href="/notifications" onClick={() => setNotifOpen(false)} style={{ display: 'block', padding: 'var(--space-3)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--primary-light)', textDecoration: 'none' }}>
                      Tümünü görüntüle →
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* User */}
            <div className="topbar-user">
              <div className="topbar-avatar">
                {user ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '··'}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user?.name || '...'}</span>
                <span className="topbar-user-role">
                  {user?.role === 'admin' ? 'Yönetici' : user?.role === 'editor' ? 'Editör' : 'Üye'}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button className="topbar-btn" title="Çıkış Yap" onClick={handleLogout}>
              ⏻
            </button>
          </div>
        </header>

        {/* ──── PAGE CONTENT ──── */}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
