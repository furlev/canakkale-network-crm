'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { districtName } from '@/lib/districts';
import InstagramStudio from '@/components/InstagramStudio';

/* API sözleşmesi: /api/ai/drafts GET/PUT/DELETE + /publish + /bulk + /[id]/instagram */
type AiDraft = {
  id: string;
  topic: string;
  title: string | null;
  body: string | null;
  category: string | null;
  tags: string | null;             // JSON string dizi
  seoTitle: string | null;
  metaDescription: string | null;
  socialPost: string | null;
  imageUrl?: string | null;        // yalnızca tekil PUT/publish yanıtlarında gelir (listede taşınmaz)
  hasImage?: boolean;              // liste yanıtı: görsel var mı? (görsel /api/ai/drafts/:id/image'dan yüklenir)
  sources: string | null;          // JSON string dizi (linkler)
  confidence: number | null;       // 0-1
  status: string;                  // pending | approved | rejected | published
  reviewerId: string | null;
  reviewerName: string | null;
  wpId: number | null;
  articleId?: string | null;       // sitede yayınlanınca SiteArticle id (publish yanıtında gelir)
  // ── editoryal v2 alanları (liste yanıtı içermiyorsa güvenle yoksayılır) ──
  qualityScore?: number | null;    // 0-100
  hasContradiction?: boolean;      // kaynaklar arası çelişki bayrağı
  district?: string | null;        // ilçe slug'ı
  editorNote?: string | null;      // redaksiyon notu
  scheduledAt?: string | null;     // planlı yayın (ISO)
  createdAt: string;
  updatedAt: string;
};

type StatusKey = 'pending' | 'approved' | 'published' | 'rejected' | 'all';

const TABS: { key: StatusKey; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylı' },
  { key: 'published', label: 'Yayınlandı' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'badge-warning', label: 'Bekliyor' },
  approved: { cls: 'badge-info', label: 'Onaylı' },
  published: { cls: 'badge-success', label: 'Yayında' },
  rejected: { cls: 'badge-error', label: 'Reddedildi' },
};

/** JSON string diziyi güvenle çöz (bozuksa boş dizi). */
function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Güven skoru rozeti: yeşil >=0.7, sarı 0.5-0.7, kırmızı <0.5. */
function confidenceBadge(confidence: number | null): { cls: string; text: string } | null {
  if (confidence === null || confidence === undefined) return null;
  const pct = `%${Math.round(confidence * 100)}`;
  if (confidence >= 0.7) return { cls: 'badge-success', text: `Güven ${pct}` };
  if (confidence >= 0.5) return { cls: 'badge-warning', text: `Güven ${pct}` };
  return { cls: 'badge-error', text: `Güven ${pct}` };
}

/** Kalite skoru rozeti (0-100): düşükse kırmızı. */
function qualityBadge(score: number | null | undefined): { cls: string; text: string } | null {
  if (score === null || score === undefined) return null;
  const r = Math.round(score);
  if (score >= 70) return { cls: 'badge-success', text: `Kalite ${r}` };
  if (score >= 50) return { cls: 'badge-warning', text: `Kalite ${r}` };
  return { cls: 'badge-error', text: `Kalite ${r}` };
}

/** ISO → datetime-local input değeri (yerel saat). */
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Düzenlenebilir alanlar — modal state'i */
type EditState = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string;            // virgülle ayrılmış (kullanıcı girişi)
  seoTitle: string;
  metaDescription: string;
  editorNote: string;      // redaksiyon notu (bulk 'note' ile kaydedilir)
  scheduledAt: string;     // datetime-local (bulk 'schedule'/'note' ile kaydedilir)
};

export default function AiNewsPage() {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusKey>('pending');

  const [selected, setSelected] = useState<AiDraft | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ kind: 'error' | 'success'; text: string; link?: string } | null>(null);

  // Çoklu seçim + toplu işlem
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScheduleAt, setBulkScheduleAt] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  // Instagram stüdyosu
  const [igDraftId, setIgDraftId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async (status: StatusKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/drafts?status=${status}`);
      const data = await res.json();
      setDrafts(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts(tab);
    setSelectedIds(new Set()); // sekme değişince seçimi sıfırla
  }, [tab, fetchDrafts]);

  const openDraft = (d: AiDraft) => {
    setModalMsg(null);
    setSelected(d);
    setEdit({
      id: d.id,
      title: d.title || '',
      body: d.body || '',
      category: d.category || '',
      tags: parseJsonArray(d.tags).join(', '),
      seoTitle: d.seoTitle || '',
      metaDescription: d.metaDescription || '',
      editorNote: d.editorNote || '',
      scheduledAt: isoToLocalInput(d.scheduledAt),
    });
  };

  const closeModal = () => {
    if (busy) return;
    setSelected(null);
    setEdit(null);
    setModalMsg(null);
  };

  /** Modal düzenlemelerini PUT ile kaydeder. Başarılıysa güncel taslağı döndürür. */
  const saveEdits = async (extra?: { status?: string }): Promise<AiDraft | null> => {
    if (!edit) return null;
    const payload = {
      title: edit.title,
      body: edit.body,
      category: edit.category,
      // schema tags'i JSON string bekliyor
      tags: JSON.stringify(edit.tags.split(',').map(t => t.trim()).filter(Boolean)),
      seoTitle: edit.seoTitle,
      metaDescription: edit.metaDescription,
      ...(extra || {}),
    };
    const res = await fetch(`/api/ai/drafts/${edit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data && data.error) || 'Kaydetme başarısız oldu.');
    }
    return data as AiDraft;
  };

  const applyToList = (raw: AiDraft) => {
    // PUT/publish yanıtı imageUrl döndürür ama hasImage içermez → bayrağı normalize et
    const updated: AiDraft = { ...raw, hasImage: raw.hasImage ?? !!raw.imageUrl, imageUrl: undefined };
    setDrafts(prev => {
      // Aktif sekmeyle uyuşmuyorsa listeden düşür, yoksa güncelle
      const stillHere = tab === 'all' || updated.status === tab;
      if (!stillHere) return prev.filter(d => d.id !== updated.id);
      return prev.map(d => (d.id === updated.id ? updated : d));
    });
  };

  /* ✓ Onayla & Yayınla — önce düzenlemeleri kaydet, sonra hedefe yayınla.
     Varsayılan hedef SİTE (canakkale.network); 'wordpress' ikincil seçenek. */
  const handleApproveAndPublish = async (target: 'site' | 'wordpress' = 'site') => {
    if (!edit) return;
    setBusy(true);
    setModalMsg(null);
    try {
      await saveEdits(); // düzenlemeleri kalıcılaştır
      const res = await fetch(`/api/ai/drafts/${edit.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error((data && data.error) || 'Yayınlama başarısız oldu.');
      }
      if (data.draft) applyToList(data.draft as AiDraft);
      if (data.target === 'site') {
        // Site linkini göster — modal açık kalır, editör linke tıklayabilir
        setModalMsg({ kind: 'success', text: 'Siteye yayınlandı ✓', link: data.siteUrl });
        setSelected((prev) => (prev ? { ...prev, status: 'published', articleId: data.articleId } : prev));
      } else {
        setModalMsg({ kind: 'success', text: `Yayınlandı ✓ (WP #${data.wpId})` });
        setTimeout(() => { setSelected(null); setEdit(null); setModalMsg(null); }, 1200);
      }
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Yayınlama başarısız oldu.' });
    } finally {
      setBusy(false);
    }
  };

  /* Reddet — PUT status=rejected */
  const handleReject = async () => {
    if (!edit) return;
    setBusy(true);
    setModalMsg(null);
    try {
      const updated = await saveEdits({ status: 'rejected' });
      if (updated) applyToList(updated);
      setSelected(null);
      setEdit(null);
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'İşlem başarısız oldu.' });
    } finally {
      setBusy(false);
    }
  };

  /* Sil — DELETE */
  const handleDelete = async () => {
    if (!edit) return;
    if (!confirm('Bu AI taslağını silmek istediğinize emin misiniz?')) return;
    setBusy(true);
    setModalMsg(null);
    try {
      const res = await fetch(`/api/ai/drafts/${edit.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || 'Silme başarısız oldu.');
      }
      setDrafts(prev => prev.filter(d => d.id !== edit.id));
      setSelected(null);
      setEdit(null);
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Silme başarısız oldu.' });
    } finally {
      setBusy(false);
    }
  };

  /* 💾 Redaksiyon notu + planı kaydet (durum değişmez) — bulk 'note' */
  const handleSaveNote = async () => {
    if (!edit) return;
    setBusy(true);
    setModalMsg(null);
    try {
      const res = await fetch('/api/ai/drafts/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [edit.id], action: 'note', editorNote: edit.editorNote, scheduledAt: edit.scheduledAt || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error((data && data.error) || 'Kaydedilemedi.');
      setSelected(prev => prev ? { ...prev, editorNote: edit.editorNote, scheduledAt: edit.scheduledAt ? new Date(edit.scheduledAt).toISOString() : null } : prev);
      setModalMsg({ kind: 'success', text: 'Not / plan kaydedildi ✓' });
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  /* 🗓 Planla & Onayla — bulk 'schedule' (status→approved + scheduledAt) */
  const handleSchedule = async () => {
    if (!edit || !edit.scheduledAt) return;
    setBusy(true);
    setModalMsg(null);
    try {
      await saveEdits(); // içerik düzenlemelerini kalıcılaştır
      const res = await fetch('/api/ai/drafts/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [edit.id], action: 'schedule', scheduledAt: edit.scheduledAt, editorNote: edit.editorNote || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error((data && data.error) || 'Planlama başarısız oldu.');
      setModalMsg({ kind: 'success', text: `Planlandı ✓ (${new Date(edit.scheduledAt).toLocaleString('tr-TR')})` });
      // status 'approved' oldu → bekleyen/reddedilen sekmesindeyse listeden düş
      setDrafts(prev => (tab === 'pending' || tab === 'rejected') ? prev.filter(d => d.id !== edit.id) : prev.map(d => d.id === edit.id ? { ...d, status: 'approved' } : d));
      setTimeout(() => { setSelected(null); setEdit(null); setModalMsg(null); }, 1400);
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Planlama başarısız oldu.' });
    } finally {
      setBusy(false);
    }
  };

  /* ── Çoklu seçim ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = drafts.length > 0 && drafts.every(d => selectedIds.has(d.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      if (drafts.length > 0 && drafts.every(d => prev.has(d.id))) return new Set();
      return new Set(drafts.map(d => d.id));
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  /* Toplu işlem → /api/ai/drafts/bulk */
  const runBulk = async (action: 'approve' | 'reject' | 'delete' | 'schedule', scheduledAt?: string) => {
    if (selectedIds.size === 0) return;
    if (action === 'delete' && !confirm(`${selectedIds.size} taslağı silmek istediğinize emin misiniz?`)) return;
    if (action === 'schedule' && !scheduledAt) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/ai/drafts/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action, ...(scheduledAt ? { scheduledAt } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error((data && data.error) || 'Toplu işlem başarısız oldu.');
      clearSelection();
      setBulkScheduleAt('');
      fetchDrafts(tab);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Toplu işlem başarısız oldu.');
    } finally {
      setBulkBusy(false);
    }
  };

  const selectedSources = selected ? parseJsonArray(selected.sources) : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🤖 AI Haber Kuyruğu</h1>
          <p className="page-subtitle">Yapay zekânın hazırladığı haber taslaklarını inceleyip yayınlayın</p>
        </div>
        <div className="page-header-actions">
          <Link href="/ai-news/kaynaklar" className="btn btn-ghost">📡 Kaynaklar</Link>
        </div>
      </div>

      {/* Durum sekmeleri */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toplu seçim araç çubuğu */}
      {!loading && drafts.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2, rgba(255,255,255,0.02))', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-subtle)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Tümünü seç
          </label>
          {selectedIds.size > 0 && (
            <>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{selectedIds.size} seçili</span>
              <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => runBulk('approve')}>✓ Onayla</button>
              <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={() => runBulk('reject')}>Reddet</button>
              <input type="datetime-local" className="form-input" style={{ maxWidth: 210, padding: '4px 8px', fontSize: 'var(--text-xs)' }} value={bulkScheduleAt} onChange={(e) => setBulkScheduleAt(e.target.value)} />
              <button className="btn btn-ghost btn-sm" disabled={bulkBusy || !bulkScheduleAt} onClick={() => runBulk('schedule', bulkScheduleAt)}>🗓 Planla</button>
              <button className="btn btn-danger btn-sm" disabled={bulkBusy} onClick={() => runBulk('delete')}>Sil</button>
              <button className="btn btn-ghost btn-sm" disabled={bulkBusy} onClick={clearSelection}>Temizle</button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>
      ) : drafts.length === 0 ? (
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Bu durumda taslak bulunmuyor.
          </div>
        </div>
      ) : (
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {drafts.map(d => {
            const conf = confidenceBadge(d.confidence);
            const qual = qualityBadge(d.qualityScore);
            const st = STATUS_BADGE[d.status] || { cls: 'badge-primary', label: d.status };
            const sourceCount = parseJsonArray(d.sources).length;
            const dist = districtName(d.district);
            const isSel = selectedIds.has(d.id);
            return (
              <div
                key={d.id}
                className="card"
                onClick={() => openDraft(d)}
                style={{ cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)', outline: isSel ? '2px solid var(--primary)' : 'none' }}
              >
                {/* Seçim kutusu (modalı açmaz) */}
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'var(--bg-secondary, rgba(0,0,0,0.4))', borderRadius: 6, padding: '3px 5px', display: 'flex', cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(d.id)} />
                </label>

                {d.hasImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/ai/drafts/${d.id}/image`}
                    alt=""
                    style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--border-radius)' }}
                  />
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  {d.category && <span className="badge badge-info">{d.category}</span>}
                  {dist && <span className="badge badge-accent">📍 {dist}</span>}
                  {qual && <span className={`badge ${qual.cls}`}>{qual.text}</span>}
                  {conf && <span className={`badge ${conf.cls}`}>{conf.text}</span>}
                  {d.hasContradiction && <span className="badge badge-error" title="Kaynaklar arası çelişki tespit edildi">⚠ Çelişki</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>
                  {d.title || d.topic}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>📎 {sourceCount} kaynak{d.scheduledAt ? ' · 🗓 planlı' : ''}</span>
                  <span>{new Date(d.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Düzenle / inceleme modalı */}
      {selected && edit && (
        <>
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">Taslağı İncele</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: 'rgba(108,92,231,0.10)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                🤖 AI önerisi — yayından önce kontrol edin
              </div>

              {modalMsg && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: modalMsg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: modalMsg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                  {modalMsg.text}
                  {modalMsg.link && (
                    <>
                      {' '}
                      <a href={modalMsg.link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', wordBreak: 'break-all' }}>
                        {modalMsg.link} ↗
                      </a>
                    </>
                  )}
                </div>
              )}

              {/* Rozetler */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {(() => {
                  const st = STATUS_BADGE[selected.status] || { cls: 'badge-primary', label: selected.status };
                  return <span className={`badge ${st.cls}`}>{st.label}</span>;
                })()}
                {(() => {
                  const qual = qualityBadge(selected.qualityScore);
                  return qual ? <span className={`badge ${qual.cls}`}>{qual.text}</span> : null;
                })()}
                {(() => {
                  const conf = confidenceBadge(selected.confidence);
                  return conf ? <span className={`badge ${conf.cls}`}>{conf.text}</span> : null;
                })()}
                {districtName(selected.district) && <span className="badge badge-accent">📍 {districtName(selected.district)}</span>}
                {selected.hasContradiction && <span className="badge badge-error">⚠ Kaynak çelişkisi</span>}
                {selected.wpId && <span className="badge badge-success">WP #{selected.wpId}</span>}
                {selected.articleId && <span className="badge badge-success">🌐 Sitede</span>}
              </div>

              {selected.hasImage && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/ai/drafts/${selected.id}/image`} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 'var(--border-radius)' }} />
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Temsili görsel (AI)</div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Başlık</label>
                <input className="form-input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">İçerik</label>
                <textarea className="form-textarea" rows={10} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <input className="form-input" value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Etiketler (virgülle ayırın)</label>
                  <input className="form-input" value={edit.tags} onChange={e => setEdit({ ...edit, tags: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">SEO Başlığı</label>
                <input className="form-input" value={edit.seoTitle} onChange={e => setEdit({ ...edit, seoTitle: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Meta Açıklama</label>
                <textarea className="form-textarea" rows={2} value={edit.metaDescription} onChange={e => setEdit({ ...edit, metaDescription: e.target.value })} />
              </div>

              {/* Redaksiyon notu */}
              <div className="form-group">
                <label className="form-label">📝 Redaksiyon Notu (editörden editöre)</label>
                <textarea className="form-textarea" rows={2} value={edit.editorNote} onChange={e => setEdit({ ...edit, editorNote: e.target.value })} placeholder="Yayın öncesi dikkat / kaynak notu (yayına çıkmaz)" />
              </div>

              {/* Planlı yayın */}
              <div className="form-group">
                <label className="form-label">🗓 Planlı Yayın</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="datetime-local" className="form-input" style={{ maxWidth: 240 }} value={edit.scheduledAt} onChange={e => setEdit({ ...edit, scheduledAt: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" disabled={busy || !edit.scheduledAt || selected.status === 'published'} onClick={handleSchedule}>Planla & Onayla</button>
                  {selected.scheduledAt && <span className="badge badge-info">Planlı: {new Date(selected.scheduledAt).toLocaleString('tr-TR')}</span>}
                </div>
              </div>

              {selectedSources.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Kaynaklar ({selectedSources.length})</label>
                  <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
                    {selectedSources.map((src, i) => (
                      <li key={i} style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <a href={src} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)' }}>{src}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={handleDelete}>Sil</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={handleReject}>Reddet</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={handleSaveNote}>💾 Notu Kaydet</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setIgDraftId(edit.id)} title="Taslaktan Instagram postu üret">📸 Instagram</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleApproveAndPublish('wordpress')} style={{ marginLeft: 'auto' }} title="Eski WordPress sitesine yayınla">
                WP&apos;ye Yayınla
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => handleApproveAndPublish('site')}>
                {busy ? 'İşleniyor...' : '🌐 Siteye Yayınla'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Instagram Post Stüdyosu */}
      {igDraftId && <InstagramStudio draftId={igDraftId} onClose={() => setIgDraftId(null)} />}
    </div>
  );
}
