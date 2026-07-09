'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './SearchSuggest.module.css';

type Suggestion = { slug: string; title: string; categoryName: string | null };

/**
 * Arama kutusu + canlı öneri (autocomplete). Sunucu formunun içinde bir client
 * ada olarak çalışır: `name` input'u form gönderimini (Ara → /haberler?q=) korur;
 * öneri seçilince doğrudan /haber/{slug}'a gider.
 *
 * Öneriler /api/site/search-suggest'ten debounce ile çekilir (min 2 karakter).
 * Klavye: ↓/↑ gezinme, Enter seçim, Esc kapatma. JS yoksa düz input olarak çalışır.
 */
export default function SearchSuggest({
  name = 'q',
  defaultValue = '',
  placeholder,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // Debounce'lu öneri çekimi (min 2 karakter). İstek yarışlarını cancelled ile yut.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/site/search-suggest?q=${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('suggest'))))
        .then((d: { items?: Suggestion[] }) => {
          if (cancelled) return;
          setItems(d.items ?? []);
          setOpen((d.items ?? []).length > 0);
          setActive(-1);
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
            setOpen(false);
          }
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  // Dışarı tıklama → kapat.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function goTo(slug: string) {
    setOpen(false);
    router.push(`/haber/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && active < items.length) {
        e.preventDefault();
        goTo(items[active].slug);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={boxRef}>
      <input
        type="search"
        name={name}
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Haberlerde ara"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul className={styles.list} id={listId} role="listbox">
          {items.map((s, i) => (
            <li key={s.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`${styles.item} ${i === active ? styles.itemActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => goTo(s.slug)}
              >
                <span className={styles.title}>{s.title}</span>
                {s.categoryName && <span className={styles.cat}>{s.categoryName}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
