'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * <SetupChecklist> — dashboard üstünde eksik entegrasyonları gösteren onboarding
 * kartı. Hepsi tamamsa VEYA kullanıcı admin (A) değilse hiçbir şey render etmez.
 * Sır göstermez; yalnızca /api/setup/status'un boolean sonucunu listeler.
 */

type Item = { key: string; label: string; done: boolean; icon: string; link: string; hint: string };

const DISMISS_KEY = 'crm-setup-dismissed-v1';

export default function SetupChecklist() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true); } catch { /* */ }

    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => { if (u?.role === 'admin') setIsAdmin(true); })
      .catch(() => {});

    fetch('/api/setup/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.items)) setItems(d.items); })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* */ }
  };

  if (!isAdmin || dismissed || !items) return null;
  const missing = items.filter((i) => !i.done);
  if (missing.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '3px solid var(--warning)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>🚀 Kurulumu tamamlayın</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
            {items.length - missing.length}/{items.length} entegrasyon bağlı — kalan {missing.length} adımı Ayarlar'dan tamamlayın.
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={dismiss} title="Bu oturumda gizle">✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((it) => (
          <div
            key={it.key}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--border-radius)', background: it.done ? 'transparent' : 'var(--surface-2)', opacity: it.done ? 0.6 : 1 }}
          >
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{it.done ? '✅' : it.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</div>
              {!it.done && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{it.hint}</div>}
            </div>
            {!it.done && <Link href={it.link} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Ayarla →</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
