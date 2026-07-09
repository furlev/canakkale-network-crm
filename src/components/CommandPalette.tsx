'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { levelOf, type AccessLevel } from '@/lib/permissions';

export type AccessInfo = {
  paths: string[];
  managed: { path: string; label: string }[];
};

type SearchResult = { type: string; icon: string; title: string; subtitle?: string; link: string };

type PaletteItem = {
  icon: string;
  title: string;
  subtitle?: string;
  link?: string;
  /** Eylem komutları için: link yerine çalışacak fonksiyon. */
  run?: () => void;
};

type PaletteGroup = { title: string; items: PaletteItem[] };

/* ── Komut kayıt sistemi ─────────────────────────────────
 * Rol-farkında komutlar: perm (min seviye) + href veya run.
 * href komutları ayrıca dinamik erişimle (AccessInfo) süzülür. */
type Command = {
  id: string;
  label: string;
  icon: string;
  perm: AccessLevel; // C = herkes, B = lider+, A = yalnız admin
  keywords?: string;
  href?: string;
  /** run: ctx ile eylem (yönlendirme/POST/toast). */
  run?: (ctx: CommandCtx) => void;
};

type CommandCtx = {
  router: ReturnType<typeof useRouter>;
  close: () => void;
  toast: (msg: string) => void;
};

const COMMANDS: Command[] = [
  { id: 'new-invoice', label: 'Yeni Fatura', icon: '📄', perm: 'B', href: '/invoices?new', keywords: 'fatura ekle oluştur' },
  { id: 'new-client', label: 'Yeni Müşteri', icon: '🏢', perm: 'B', href: '/clients?new', keywords: 'müşteri ekle firma' },
  { id: 'new-lead', label: 'Yeni Aday (Lead)', icon: '🎯', perm: 'B', href: '/leads?new', keywords: 'aday potansiyel lead ekle' },
  { id: 'new-task', label: 'Yeni Görev', icon: '✅', perm: 'C', href: '/tasks?new', keywords: 'görev ekle todo' },
  { id: 'new-tip', label: 'Yeni İhbar', icon: '🔔', perm: 'C', href: '/tips?new', keywords: 'ihbar haber kaynağı ekle' },
  { id: 'new-note', label: 'Yeni Not', icon: '📝', perm: 'C', href: '/notes?new', keywords: 'not ekle' },
  { id: 'new-article', label: 'Yeni Haber', icon: '📰', perm: 'C', href: '/site-yonetimi?new', keywords: 'haber makale yazı ekle site' },
  {
    id: 'gen-drafts', label: 'AI Taslak Üret', icon: '🤖', perm: 'B', keywords: 'ai yapay zeka taslak üret haber',
    run: (ctx) => {
      ctx.close();
      ctx.toast('🤖 AI taslak üretimi başlatıldı… (birkaç dakika sürebilir)');
      fetch('/api/ai/generate-drafts', { method: 'POST' })
        .then((r) => r.json().catch(() => ({})).then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (ok) ctx.toast(`✅ AI taslak üretimi tamam${typeof d?.created === 'number' ? ` (${d.created} taslak)` : ''}. /ai-news kuyruğuna bakın.`);
          else ctx.toast(`⚠️ AI taslak üretilemedi: ${d?.error || 'bilinmeyen hata'}`);
        })
        .catch(() => ctx.toast('⚠️ AI taslak isteği gönderilemedi.'));
    },
  },
  { id: 'reports', label: 'Rapor İndir / Görüntüle', icon: '📈', perm: 'B', href: '/reports', keywords: 'rapor indir excel finans' },
  {
    id: 'mark-all-read', label: 'Bildirimleri Okundu İşaretle', icon: '✓', perm: 'C', keywords: 'bildirim okundu temizle',
    run: (ctx) => {
      ctx.close();
      fetch('/api/notifications/read-all', { method: 'PUT' })
        .then((r) => ctx.toast(r.ok ? '✓ Tüm bildirimler okundu işaretlendi.' : '⚠️ İşlem başarısız.'))
        .catch(() => ctx.toast('⚠️ İşlem başarısız.'));
    },
  },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️', perm: 'A', href: '/settings', keywords: 'ayar entegrasyon smtp' },
];

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

const LEVEL_ORDER: Record<AccessLevel, number> = { C: 0, B: 1, A: 2 };

/**
 * Ctrl+K / Cmd+K global komut paleti + arama.
 * - Rol-farkında eylem komutları (Yeni Fatura, AI Taslak Üret, Rapor…) en üstte.
 * - 300 ms debounce ile /api/search sonuçlarını gruplu gösterir.
 * - Ekran adları (erişilebilir yollar) hızlı gezinme girdisi olarak listelenir.
 * - ↑↓ Enter Esc klavye navigasyonu.
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
  const [role, setRole] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  /* Rol (komut yetkileri için) — bir kez çek */
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u?.role) setRole(u.role); })
      .catch(() => {});
  }, []);

  /* Açılışta sıfırla + odaklan */
  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setSelIdx(0);
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

  /* Bir href komutu/ekranı bu kullanıcıya açık mı? (dinamik erişim > taban) */
  const pathAllowed = (link: string): boolean => {
    if (!access) return true;
    const base = topSegment(link);
    if (access.managed.some((m) => m.path === base)) return access.paths.includes(base);
    return true; // yönetilmeyen yollar (ör. /settings) rol ile süzülür
  };

  /* Yetkili + sorguya uyan komutlar */
  const commandItems = useMemo<PaletteItem[]>(() => {
    const lvl = levelOf(role);
    const query = q.trim().toLocaleLowerCase('tr-TR');
    const ctx: CommandCtx = { router, close: onClose, toast: showToast };
    return COMMANDS
      .filter((c) => LEVEL_ORDER[lvl] >= LEVEL_ORDER[c.perm])
      .filter((c) => !c.href || pathAllowed(c.href))
      .filter((c) => !query || `${c.label} ${c.keywords || ''}`.toLocaleLowerCase('tr-TR').includes(query))
      .map((c) => ({
        icon: c.icon,
        title: c.label,
        link: c.href,
        run: c.run ? () => c.run!(ctx) : undefined,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, access]);

  /* İzinli ekranlar (hızlı gezinme) */
  const allowedScreens = useMemo(() => {
    if (!access) return [];
    const allowed = new Set(access.paths);
    return access.managed.filter((m) => allowed.has(m.path));
  }, [access]);

  /* Gruplar: Komutlar + Sayfalar (hızlı gezinme) + modül sonuçları */
  const groups = useMemo<PaletteGroup[]>(() => {
    const out: PaletteGroup[] = [];
    const query = q.trim().toLocaleLowerCase('tr-TR');

    if (commandItems.length > 0) out.push({ title: 'Komutlar', items: commandItems });

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
  }, [q, results, allowedScreens, access, commandItems]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  /* Seçim listesi değişince başa dön */
  useEffect(() => {
    setSelIdx(0);
  }, [q, results, commandItems.length]);

  const activate = (item: PaletteItem) => {
    if (item.run) { item.run(); return; }
    if (item.link) { onClose(); router.push(item.link); }
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
      if (item) activate(item);
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

  let runningIdx = -1;

  return (
    <>
      {/* Toast (palet kapansa da görünür) */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 'var(--space-6)', left: '50%', transform: 'translateX(-50%)',
            maxWidth: 480, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)', zIndex: 'calc(var(--z-modal) + 10)' as unknown as number,
          }}
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      )}

      {open && (
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
                placeholder="Komut çalıştır, ara veya ekran adı yaz..."
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
                  {loading ? 'Aranıyor...' : q.trim().length >= 2 ? 'Sonuç bulunamadı' : 'Komut veya arama için yazmaya başlayın'}
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
                          onMouseDown={(e) => { e.preventDefault(); activate(item); }}
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
                          {item.run && !item.link && <span className="topbar-search-shortcut">Eylem</span>}
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
              <span>Enter çalıştır</span>
              <span>Esc kapat</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
