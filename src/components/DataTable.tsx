'use client';

/**
 * <DataTable> — genel amaçlı, bağımlılıksız veri tablosu.
 *
 * Özellikler: başlıktan sıralama · hızlı arama + sütun filtresi ·
 * sütun göster/gizle · sayfalama · satır seçimi + toplu işlem · CSV indir.
 *
 * İstemci-taraflı çalışır (tüm satırlar prop olarak verilir). Sunucu-taraflı
 * sayfalama için API `getPagination` (src/lib/api.ts) ile uyumludur — sayfa
 * başına satırları çekip `rows` olarak verin ve `manualPagination` kullanın.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import EmptyState from './EmptyState';
import { SkeletonTable } from './Skeleton';

export type CellValue = string | number | boolean | null | undefined;

export interface Column<T> {
  key: string;
  header: string;
  /** Sıralama / filtre / arama / CSV için ham değer (varsayılan: row[key]). */
  accessor?: (row: T) => CellValue;
  /** Hücre görünümü (varsayılan: accessor değeri). */
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  numeric?: boolean;
  defaultHidden?: boolean;
  hideable?: boolean;
  csv?: boolean;
}

export interface BulkAction<T> {
  label: string;
  icon?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  onClick: (rows: T[]) => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  searchPlaceholder?: string;
  searchable?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  onRowClick?: (row: T) => void;
  csvFileName?: string;
  /** Araç çubuğu sağına ek düğmeler (ör. görünüm değiştir, +Yeni). */
  toolbarExtra?: React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Sunucu sayfalaması dışarıda yapıldığında istemci sayfalamasını kapat. */
  manualPagination?: boolean;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function defaultAccessor<T>(col: Column<T>, row: T): CellValue {
  if (col.accessor) return col.accessor(row);
  return (row as Record<string, unknown>)[col.key] as CellValue;
}

function toText(v: CellValue): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function trLower(s: string): string {
  return s.toLocaleLowerCase('tr');
}

function csvCell(v: CellValue): string {
  const s = toText(v).replace(/"/g, '""');
  return `"${s}"`;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  searchPlaceholder = 'Ara...',
  searchable = true,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  selectable = false,
  bulkActions = [],
  onRowClick,
  csvFileName = 'tablo',
  toolbarExtra,
  initialSort,
  manualPagination = false,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const visibleCols = columns.filter((c) => !hidden.has(c.key));
  const anyFilterable = columns.some((c) => c.filterable);

  /* Filtreleme + arama */
  const filtered = useMemo(() => {
    const q = trLower(query.trim());
    return rows.filter((row) => {
      if (q) {
        const hay = columns.map((c) => trLower(toText(defaultAccessor(c, row)))).join(' ');
        if (!hay.includes(q)) return false;
      }
      for (const [key, val] of Object.entries(colFilters)) {
        if (!val) continue;
        const col = columns.find((c) => c.key === key);
        if (!col) continue;
        const cell = trLower(toText(defaultAccessor(col, row)));
        if (!cell.includes(trLower(val))) return false;
      }
      return true;
    });
  }, [rows, columns, query, colFilters]);

  /* Sıralama */
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = defaultAccessor(col, a);
      const bv = defaultAccessor(col, b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return toText(av).localeCompare(toText(bv), 'tr', { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  /* Sayfalama */
  const totalPages = manualPagination ? 1 : Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = manualPagination
    ? sorted
    : sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => {
    setPage(1);
  }, [query, colFilters, perPage]);

  /* Seçim */
  const pageKeys = paged.map(rowKey);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  };
  const toggleRow = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  const handleSort = (col: Column<T>) => {
    if (col.sortable === false) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null;
    });
  };

  const exportCsv = () => {
    const cols = columns.filter((c) => c.csv !== false && !hidden.has(c.key));
    const header = cols.map((c) => csvCell(c.header)).join(';');
    const lines = sorted.map((row) => cols.map((c) => csvCell(defaultAccessor(c, row))).join(';'));
    const csv = '﻿' + [header, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${csvFileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const colSpan = visibleCols.length + (selectable ? 1 : 0);

  return (
    <div className="dt">
      {/* Araç çubuğu */}
      <div className="dt-toolbar">
        <div className="dt-toolbar-left">
          {searchable && (
            <div className="dt-search">
              <span className="dt-search-icon" aria-hidden>🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Tabloda ara"
              />
              {query && (
                <button className="dt-search-clear" onClick={() => setQuery('')} aria-label="Aramayı temizle">✕</button>
              )}
            </div>
          )}
          {anyFilterable && (
            <button
              className={`btn btn-ghost btn-sm${showFilters ? ' dt-btn-active' : ''}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              ⚡ Filtreler
            </button>
          )}
        </div>

        <div className="dt-toolbar-right">
          {toolbarExtra}
          <div className="dt-colmenu" ref={colMenuRef}>
            <button className="btn btn-ghost btn-sm" onClick={() => setColMenuOpen((v) => !v)}>
              ⚙ Sütunlar
            </button>
            {colMenuOpen && (
              <div className="dt-colmenu-panel">
                <div className="dt-colmenu-title">Sütunları göster</div>
                {columns.map((c) =>
                  c.hideable === false ? null : (
                    <label key={c.key} className="dt-colmenu-item">
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.key)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                      />
                      {c.header}
                    </label>
                  ),
                )}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={sorted.length === 0}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Toplu işlem çubuğu */}
      {selectable && someSelected && bulkActions.length > 0 && (
        <div className="dt-bulkbar">
          <span className="dt-bulkbar-count">{selected.size} kayıt seçildi</span>
          <div className="dt-bulkbar-actions">
            {bulkActions.map((a, i) => (
              <button
                key={i}
                className={`btn btn-sm btn-${a.variant || 'ghost'}`}
                onClick={() => a.onClick(selectedRows)}
              >
                {a.icon && <span>{a.icon}</span>} {a.label}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Seçimi bırak</button>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div className="data-table-container dt-container">
        {loading ? (
          <SkeletonTable rows={perPage > 8 ? 8 : perPage} cols={colSpan} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {selectable && (
                  <th className="dt-check-col">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll} aria-label="Tümünü seç" />
                  </th>
                )}
                {visibleCols.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c)}
                      style={{
                        width: c.width,
                        textAlign: c.align || (c.numeric ? 'right' : 'left'),
                        cursor: c.sortable === false ? 'default' : 'pointer',
                      }}
                    >
                      <span className="dt-th-inner">
                        {c.header}
                        {c.sortable !== false && (
                          <span className={`dt-sort${active ? ' active' : ''}`}>
                            {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
              {showFilters && anyFilterable && (
                <tr className="dt-filter-row">
                  {selectable && <th />}
                  {visibleCols.map((c) => (
                    <th key={c.key}>
                      {c.filterable ? (
                        <input
                          className="dt-filter-input"
                          value={colFilters[c.key] || ''}
                          onChange={(e) => setColFilters((prev) => ({ ...prev, [c.key]: e.target.value }))}
                          placeholder="Filtrele"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ padding: 0 }}>
                    {emptyState ?? (
                      <EmptyState
                        icon="🔍"
                        title={rows.length === 0 ? 'Kayıt yok' : 'Sonuç bulunamadı'}
                        description={
                          rows.length === 0
                            ? 'Henüz görüntülenecek veri yok.'
                            : 'Arama veya filtre ölçütlerinizle eşleşen kayıt yok.'
                        }
                      />
                    )}
                  </td>
                </tr>
              ) : (
                paged.map((row) => {
                  const k = rowKey(row);
                  const isSel = selected.has(k);
                  return (
                    <tr
                      key={k}
                      className={isSel ? 'dt-row-selected' : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      style={{ cursor: onRowClick ? 'pointer' : undefined }}
                    >
                      {selectable && (
                        <td className="dt-check-col" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleRow(k)} aria-label="Satırı seç" />
                        </td>
                      )}
                      {visibleCols.map((c) => (
                        <td
                          key={c.key}
                          data-label={c.header}
                          style={{ textAlign: c.align || (c.numeric ? 'right' : 'left') }}
                          className={c.numeric ? 'dt-num' : undefined}
                        >
                          {c.render ? c.render(row) : toText(defaultAccessor(c, row))}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Alt bilgi / sayfalama */}
        {!loading && !manualPagination && sorted.length > 0 && (
          <div className="data-table-footer">
            <div className="dt-footer-left">
              <span>
                {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, sorted.length)} / {sorted.length}
              </span>
              <select
                className="dt-perpage"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                aria-label="Sayfa başına kayıt"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n}/sayfa</option>
                ))}
              </select>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setPage(1)}>«</button>
                <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                <span className="dt-page-indicator">{currentPage} / {totalPages}</span>
                <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
