'use client';

/**
 * Rapor dışa aktarma tetikleyicisi — Raporlar sayfasındaki "Dışa Aktar" butonunun
 * yerine geçer. Tür + biçim (Excel/PDF) seçtirir, /api/reports/export'u yeni sekmede
 * indirir. Kayıtlı rapor şablonlarını (SavedReport) listeler / kaydeder / siler.
 *
 * Kullanım (reports/page.tsx içinde):
 *   import ReportExport from '@/components/ReportExport';
 *   ...
 *   <ReportExport />   // <button ...>📤 Dışa Aktar</button> yerine
 */

import { useEffect, useState } from 'react';

type SavedReport = { id: string; name: string; type: string; config: { from?: string; to?: string } };

const TYPES = [
  { k: 'revenue', l: 'Gelir' },
  { k: 'collection', l: 'Tahsilat' },
  { k: 'vat', l: 'KDV' },
  { k: 'editor', l: 'Editör' },
];
const typeLabel = (k: string) => TYPES.find((t) => t.k === k)?.l || k;

export default function ReportExport() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('revenue');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [saveName, setSaveName] = useState('');
  const [msg, setMsg] = useState('');

  const loadSaved = () => {
    fetch('/api/saved-reports')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setSaved(d))
      .catch(() => {});
  };

  useEffect(() => { loadSaved(); }, []);

  const doExport = (format: 'xlsx' | 'pdf') => {
    const qs = new URLSearchParams({ type, format });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    window.open(`/api/reports/export?${qs.toString()}`, '_blank', 'noopener');
  };

  const saveTemplate = async () => {
    const name = saveName.trim();
    if (!name) { setMsg('Şablon için bir ad girin.'); return; }
    setMsg('');
    const res = await fetch('/api/saved-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, config: { from: from || null, to: to || null } }),
    });
    if (res.ok) { setSaveName(''); loadSaved(); setMsg('Şablon kaydedildi.'); }
    else setMsg('Şablon kaydedilemedi.');
  };

  const applySaved = (r: SavedReport) => {
    setType(r.type);
    setFrom(r.config?.from || '');
    setTo(r.config?.to || '');
  };

  const deleteSaved = async (id: string) => {
    const res = await fetch(`/api/saved-reports/${id}`, { method: 'DELETE' });
    if (res.ok) loadSaved();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>📤 Dışa Aktar</button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, zIndex: 1000,
              background: 'var(--bg-secondary)', border: '1px solid var(--border-default, var(--border))',
              borderRadius: 'var(--border-radius-lg, 12px)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              padding: 'var(--space-4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>Rapor Dışa Aktar</div>

            <div className="form-group">
              <label className="form-label">Rapor Türü</label>
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Başlangıç</label>
                <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Bitiş</label>
                <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Tarih boşsa son 6 ay kullanılır. Tahsilat raporu tarih bağımsızdır.
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => doExport('xlsx')}>📊 Excel</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => doExport('pdf')}>📄 PDF</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle, var(--border))', paddingTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <input
                  className="form-input" placeholder="Şablon adı ile kaydet" value={saveName}
                  onChange={(e) => setSaveName(e.target.value)} style={{ flex: 1 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={saveTemplate}>💾 Kaydet</button>
              </div>
              {msg && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{msg}</div>}

              {saved.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {saved.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'flex-start' }} onClick={() => applySaved(r)} title="Bu şablonu yükle">
                        📁 {r.name} <span style={{ color: 'var(--text-muted)' }}>({typeLabel(r.type)})</span>
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => deleteSaved(r.id)} title="Sil">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
