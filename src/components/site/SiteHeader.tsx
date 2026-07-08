'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';

export type NavCategory = { slug: string; name: string };

/**
 * Yapışkan site başlığı: scroll'da küçülür ve buzlu cam arka plana geçer.
 * Tam ekran arama overlay'i ve mobil menü de burada yaşar.
 */
export default function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Scroll'da başlığı sıkılaştır
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Overlay açıkken sayfa kaydırmayı kilitle, Esc ile kapat
  useEffect(() => {
    const anyOpen = searchOpen || menuOpen;
    document.documentElement.style.overflow = anyOpen ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [searchOpen, menuOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchInputRef.current?.value.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/haberler?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="s-container site-header-inner">
        <Link href="/" className="site-logo" aria-label="Çanakkale Network — anasayfa">
          {/* İki logo da basılır; hangisinin görüneceğine data-site-theme üzerinden CSS karar verir */}
          <img src="/site/logo-dark.png" alt="Çanakkale Network" className="only-network" />
          <img src="/site/logo-light.png" alt="Çanakkale Network" className="only-truva" />
        </Link>

        <nav className="site-nav" aria-label="Ana menü">
          {/* Masaüstünde ilk 6 kategori; tamamı hamburger menüde */}
          {categories.slice(0, 6).map(c => (
            <Link key={c.slug} href={`/kategori/${c.slug}`} className="site-nav-link">
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link href="/ekibimize-katil" className="site-nav-join">
            Ekibimize Katıl
          </Link>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Haber ara"
            aria-haspopup="dialog"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
          </button>
          <ThemeToggle />
          <button
            type="button"
            className="header-icon-btn nav-burger"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={menuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? (
                <>
                  <path d="M5 5l14 14" />
                  <path d="M19 5 5 19" />
                </>
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M7 12h14" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Haber arama">
          <button
            type="button"
            className="overlay-close"
            onClick={() => setSearchOpen(false)}
            aria-label="Aramayı kapat"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14" />
              <path d="M19 5 5 19" />
            </svg>
          </button>
          <form className="search-form" onSubmit={submitSearch} role="search">
            <label htmlFor="site-search" className="search-label">
              Ne arıyorsun?
            </label>
            <input
              id="site-search"
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder="Haber, konu, kişi…"
              autoComplete="off"
              className="search-input"
            />
            <p className="search-hint">
              <kbd>Enter</kbd> ile ara · <kbd>Esc</kbd> ile kapat
            </p>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Mobil menü">
          <nav className="mobile-nav" aria-label="Mobil ana menü">
            {categories.map((c, i) => (
              <Link
                key={c.slug}
                href={`/kategori/${c.slug}`}
                className="mobile-nav-link"
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => setMenuOpen(false)}
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/ekibimize-katil"
              className="mobile-nav-link mobile-nav-join"
              style={{ '--i': categories.length } as React.CSSProperties}
              onClick={() => setMenuOpen(false)}
            >
              Ekibimize Katıl →
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
