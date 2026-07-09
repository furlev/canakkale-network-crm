'use client';

import { useEffect, useState } from 'react';

/**
 * <ShortcutHelp> — "?" tuşuna basınca açılan klavye kısayolları modalı.
 * Kendi global keydown dinleyicisini kurar; input/textarea/contenteditable
 * içinde yazarken tetiklenmez. Panel modal sınıflarını kullanır.
 */

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [mod, 'K'], label: 'Komut paleti / global arama' },
  { keys: ['?'], label: 'Bu kısayol yardımını aç' },
  { keys: ['Esc'], label: 'Açık panel / modalı kapat' },
  { keys: ['↑', '↓'], label: 'Palet sonuçlarında gezin' },
  { keys: ['↵'], label: 'Seçili sonucu aç' },
];

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '90%', maxWidth: 440, background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--border-radius-xl)',
          boxShadow: 'var(--shadow-lg)', zIndex: 'var(--z-modal)' as unknown as number, overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>⌨️ Klavye Kısayolları</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Esc</button>
        </div>
        <div style={{ padding: 'var(--space-3) var(--space-5)' }}>
          {SHORTCUTS.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{s.label}</span>
              <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {s.keys.map((k) => (
                  <kbd key={k} className="topbar-search-shortcut" style={{ minWidth: 24, textAlign: 'center' }}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          İpucu: Herhangi bir sayfada <kbd className="topbar-search-shortcut">{mod}</kbd> + <kbd className="topbar-search-shortcut">K</kbd> ile hızlıca gezin.
        </div>
      </div>
    </>
  );
}
