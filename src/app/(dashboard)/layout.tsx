'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    ],
  },
  {
    title: 'HABERLER',
    items: [
      { label: 'Haberler', href: '/news', icon: '📰' },
      { label: 'Haber İhbarı', href: '/tips', icon: '🔔', badge: '3' },
      { label: 'Reklam Verenler', href: '/advertisers', icon: '📢' },
      { label: 'Aboneler', href: '/subscribers', icon: '👤' },
    ],
  },
  {
    title: 'EKİP & İLETİŞİM',
    items: [
      { label: 'Mesajlar', href: '/messages', icon: '💬' },
      { label: 'Ekip', href: '/team', icon: '👨‍💼' },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.title}>
              <div className="sidebar-section-title">{section.title}</div>

              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${isLinkActive(pathname, item.href) ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span className="sidebar-link-text">{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-link-badge">{item.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
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
            <div className="topbar-search">
              <span className="topbar-search-icon">🔍</span>
              <input type="text" placeholder="Ara..." />
              <span className="topbar-search-shortcut">Ctrl+K</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Quick add */}
            <button className="topbar-btn" title="Hızlı Ekle">
              ＋
            </button>

            {/* Notifications */}
            <button className="topbar-btn" title="Bildirimler">
              🔔
              <span className="topbar-btn-badge" />
            </button>

            {/* User */}
            <div className="topbar-user">
              <div className="topbar-avatar">AY</div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">Admin Yönetici</span>
                <span className="topbar-user-role">Yönetici</span>
              </div>
            </div>
          </div>
        </header>

        {/* ──── PAGE CONTENT ──── */}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
