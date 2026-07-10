'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type RefObject } from 'react';
import ThemeToggle from './ThemeToggle';
import DistrictPref from './DistrictPref';

export type NavCategory = { slug: string; name: string };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Açık overlay içinde odağı hapseder: açılışta ilk (ya da verilen) odaklanabilir
 * elemana odaklanır, Tab/Shift+Tab ile ilk↔son arasında döngü yapar, kapanışta
 * odağı açan elemana (restoreRef) geri verir.
 */
function useFocusTrap<
  C extends HTMLElement,
  R extends HTMLElement,
  I extends HTMLElement = HTMLElement,
>(
  active: boolean,
  containerRef: RefObject<C | null>,
  restoreRef: RefObject<R | null>,
  initialFocusRef?: RefObject<I | null>,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Açılışta: verilen hedef ya da ilk odaklanabilir eleman (yoksa konteyner).
    (initialFocusRef?.current ?? getFocusable()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Kapanışta odağı açan elemana geri ver.
      restoreRef.current?.focus();
    };
  }, [active, containerRef, restoreRef, initialFocusRef]);
}

/**
 * Yapışkan site başlığı: scroll'da küçülür ve buzlu cam arka plana geçer.
 * Tam ekran arama overlay'i ve mobil menü de burada yaşar.
 */
export default function SiteHeader({
  categories,
  logoDark = '/site/logo-dark.png',
  logoLight = '/site/logo-light.png',
}: {
  categories: NavCategory[];
  /** Koyu (network) temada gösterilen logo — CRM > Site Yönetimi > Ayarlar */
  logoDark?: string;
  /** Açık (truva) temada gösterilen logo */
  logoLight?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const burgerBtnRef = useRef<HTMLButtonElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Aktif kategori sayfasını nav'da işaretlemek için (a11y: aria-current).
  const pathname = usePathname();

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

  // Overlay açıkken odağı içeride tut; kapanışta açan butona geri ver.
  // Arama açılışında doğrudan arama girişine odaklan.
  useFocusTrap(searchOpen, searchOverlayRef, searchBtnRef, searchInputRef);
  useFocusTrap(menuOpen, menuOverlayRef, burgerBtnRef);

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
          <img src={logoDark} alt="Çanakkale Network" className="only-network" />
          <img src={logoLight} alt="Çanakkale Network" className="only-truva" />
        </Link>

        <nav className="site-nav" aria-label="Ana menü">
          {/* Masaüstünde ilk 6 kategori; tamamı hamburger menüde */}
          {categories.slice(0, 6).map(c => {
            const href = `/kategori/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={href}
                className="site-nav-link"
                aria-current={pathname === href ? 'page' : undefined}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>

        <div className="site-header-actions">
          <Link href="/ekibimize-katil" className="site-nav-join">
            Ekibimize Katıl
          </Link>
          {/* "Benim İlçem" seçici — tercih localStorage('cn-district')'e yazılır */}
          <DistrictPref className="header-district" />
          <button
            ref={searchBtnRef}
            type="button"
            className="header-icon-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Haber ara"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
          </button>
          <ThemeToggle />
          <button
            ref={burgerBtnRef}
            type="button"
            className="header-icon-btn nav-burger"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-haspopup="dialog"
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
        <div
          ref={searchOverlayRef}
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Haber arama"
          tabIndex={-1}
        >
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
        <div
          ref={menuOverlayRef}
          className="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobil menü"
          tabIndex={-1}
        >
          <nav className="mobile-nav" aria-label="Mobil ana menü">
            {categories.map((c, i) => {
              const href = `/kategori/${c.slug}`;
              return (
                <Link
                  key={c.slug}
                  href={href}
                  className="mobile-nav-link"
                  style={{ '--i': i } as React.CSSProperties}
                  aria-current={pathname === href ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {c.name}
                </Link>
              );
            })}
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
