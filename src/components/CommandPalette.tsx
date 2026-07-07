'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type AccessInfo = {
  paths: string[];
  managed: { path: string; label: string }[];
};

type SearchResult = { type: string; icon: string; title: string; subtitle?: string; link: string };

type PaletteItem = {
  icon: string;
  title: string;
  subtitle?: string;
  link: string;
};

type PaletteGroup = { title: string; items: PaletteItem[] };

/* Arama sonucu türü → grup başlığı (çoğul) */
const TYPE_GROUP: Record<string, string> = {
  'Müşteri': 'Müşteriler',
  'Kişi': 'Kişiler',
  'Fatura': 'Faturalar',
  'Proje': 'Projeler',
  'Görev': 'Görevler',
  'Haber': 'Haberler',
  'İhbar': 'İhbarlar',
  'Not': 'Notlar',
  'Sözleşme': 'Sözleşmeler',
  'Teklifname': 'Teklifnameler',
  'Ekip': 'Ekip',
};

/* Ekran yolları için ikonlar (sidebar ile aynı) */
const PATH_ICON: Record<string, string> = {
  '/': '📊', '/notifications': '🛎️', '/contacts': '👥', '/clients': '🏢', '/leads': '🎯',
  '/projects': '📁', '/tasks': '✅', '/calendar': '📅', '/invoices': '📄', '/estimates': '📋',
  '/expenses': '💰', '/contracts': '📝', '/proposals': '📑', '/payments': '💳', '/news': '📰',
  '/tips': '🔔', '/ai-news': '🤖', '/advertisers': '📢', '/campaigns': '🎬', '/subscribers': '👤',
  '/newsletters': '📧', '/messages': '💬', '/team': '👨‍💼', '/editor-performance': '📊',
  '/support': '🎫', '/documents': '📂', '/knowledge-base': '📖', '/announcements': '📣',
  '/notes': '📝', '/reports': '📈',
};

function topSegment(path: string): string {
  return '/' + (path.split('?')[0].split('/')[1] || '');
}

/**
 * Ctrl+K / Cmd+K global arama paleti.
 * - 300 ms debounce ile /api/search sonuçlarını gruplu gösterir.
 * - Ekran adları (erişilebilir yollar) hızlı gezinme girdisi olarak listelenir.
 * - ↑↓ Enter Esc klavye navigasyonu; tıklama modül liste sayfasına götürür.
 */
export default function CommandPalette({
  open,
  onClose,
  access,
}: {
  open: boolean;
  onClose: () => void;
  access: AccessInfo | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Açılışta sıfırla + odaklan */
  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setSelIdx(0);
      // autoFocus render sonrasına kalsın
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  /* 300 ms debounce ile arama */
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setResults(data?.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q, open]);

  /* İzinli ekranlar (hızlı gezinme) */
  const allowedScreens = useMemo(() => {
    if (!access) return [];
    const allowed = new Set(access.paths);
    return access.managed.filter((m) => allowed.has(m.path));
  }, [access]);

  /* Gruplar: Sayfalar (hızlı gezinme) + modül sonuçları */
  const groups = useMemo<PaletteGroup[]>(() => {
    const out: PaletteGroup[] = [];
    const query = q.trim().toLocaleLowerCase('tr-TR');

    const screens = allowedScreens
      .filter((s) => !query || s.label.toLocaleLowerCase('tr-TR').includes(query))
      .map((s) => ({ icon: PATH_ICON[s.path] || '📄', title: s.label, subtitle: s.path, link: s.path }));
    if (screens.length > 0) out.push({ title: 'Sayfalar', items: screens });

    // Dinamik erişim kuralları ile kapatılmış modüllerin sonuçlarını gösterme
    const managedSet = access ? new Set(access.managed.map((m) => m.path)) : null;
    const allowedSet = access ? new Set(access.paths) : null;
    const visible = results.filter((r) => {
      if (!managedSet || !allowedSet) return true;
      const base = topSegment(r.link);
      return !managedSet.has(base) || allowedSet.has(base);
    });

    const byGroup = new Map<string, PaletteItem[]>();
    for (const r of visible) {
      const title = TYPE_GROUP[r.type] || r.type;
      if (!byGroup.has(title)) byGroup.set(title, []);
      byGroup.get(title)!.push({ icon: r.icon, title: r.title, subtitle: r.subtitle, link: r.link });
    }
    for (const [title, items] of byGroup) out.push({ title, items });
    return out;
  }, [q, results, allowedScreens, access]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  /* Seçim listesi değişince başa dön */
  useEffect(() => {
    setSelIdx(0);
  }, [q, results]);

  const go = (link: string) => {
    onClose();
    router.push(link);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[selIdx];
      if (item) go(item.link);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  /* Seçili öğe görünür kalsın */
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selIdx]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        style={{
          position: 'fixed',
          top: '12vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 560,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--border-radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 'var(--z-modal)' as unknown as number,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Arama girişi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--text-md)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ara veya ekran adı yaz..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-base)',
            }}
          />
          <span className="topbar-search-shortcut">Esc</span>
        </div>

        {/* Sonuçlar */}
        <div ref={listRef} style={{ maxHeight: '50vh', overflowY: 'auto', padding: 'var(--space-2)' }}>
          {flat.length === 0 ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {loading ? 'Aranıyor...' : q.trim().length >= 2 ? 'Sonuç bulunamadı' : 'Aramak için yazmaya başlayın'}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.title}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, padding: 'var(--space-2) var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {group.title}
                </div>
                {group.items.map((item, i) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  const selected = idx === selIdx;
                  return (
                    <div
                      key={`${group.title}-${i}`}
                      data-selected={selected ? 'true' : undefined}
                      onMouseDown={(e) => { e.preventDefault(); go(item.link); }}
                      onMouseEnter={() => setSelIdx(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--border-radius)',
                        cursor: 'pointer',
                        background: selected ? 'var(--surface-3)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        {item.subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{item.subtitle}</div>}
                      </div>
                      {selected && <span className="topbar-search-shortcut">↵</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Alt bilgi */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <span>↑↓ gezin</span>
          <span>Enter aç</span>
          <span>Esc kapat</span>
        </div>
      </div>
    </>
  );
}
