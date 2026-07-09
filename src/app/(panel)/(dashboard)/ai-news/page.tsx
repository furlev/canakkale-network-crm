'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { districtName, DISTRICTS } from '@/lib/districts';
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
  titleVariants?: string | null;   // JSON: A/B başlık varyantları (dizi) veya {options, altTitle}
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

/** titleVariants JSON'unu çöz: dizi (varyantlar) veya {options, altTitle}. */
function parseTitleVariants(raw: string | null | undefined): { options: string[]; altTitle: string } {
  if (!raw) return { options: [], altTitle: '' };
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return { options: v.filter((x): x is string => typeof x === 'string'), altTitle: '' };
    }
    if (v && typeof v === 'object') {
      const opts = Array.isArray(v.options) ? v.options.filter((x: unknown): x is string => typeof x === 'string') : [];
      return { options: opts, altTitle: typeof v.altTitle === 'string' ? v.altTitle : '' };
    }
  } catch {
    /* bozuk JSON → boş */
  }
  return { options: [], altTitle: '' };
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

/** Verilen hafta ofsetine göre Pazartesi 00:00'ı döndürür (0 = bu hafta). */
function startOfWeek(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - day + offset * 7);
  return d;
}

const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** İki tarih aynı takvim gününde mi? */
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
  district: string;        // ilçe slug'ı ('' = belirtilmemiş); PUT ile kaydedilir
  editorNote: string;      // redaksiyon notu (bulk 'note' ile kaydedilir)
  scheduledAt: string;     // datetime-local (bulk 'schedule'/'note' ile kaydedilir)
  variantOptions: string[]; // A/B başlık alternatifleri (AI önerileri)
  altTitle: string;        // seçilen alt başlık ('' = yok) → SiteArticle.altTitle
};

export default function AiNewsPage() {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusKey>('pending');
  const [districtFilter, setDistrictFilter] = useState<string>('all'); // 'all' | slug | 'none'
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards'); // kart / haftalık takvim
  const [weekOffset, setWeekOffset] = useState(0); // takvimde görüntülenen hafta (0 = bu hafta)

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
    const tv = parseTitleVariants(d.titleVariants);
    setEdit({
      id: d.id,
      title: d.title || '',
      body: d.body || '',
      category: d.category || '',
      tags: parseJsonArray(d.tags).join(', '),
      seoTitle: d.seoTitle || '',
      metaDescription: d.metaDescription || '',
      district: d.district || '',
      editorNote: d.editorNote || '',
      scheduledAt: isoToLocalInput(d.scheduledAt),
      variantOptions: tv.options,
      altTitle: tv.altTitle,
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
    // A/B: alt başlık seçiliyse {options, altTitle}, değilse yalnız varyant dizisi
    const titleVariants = edit.altTitle.trim()
      ? JSON.stringify({ options: edit.variantOptions, altTitle: edit.altTitle.trim() })
      : (edit.variantOptions.length ? JSON.stringify(edit.variantOptions) : '');
    const payload = {
      title: edit.title,
      body: edit.body,
      category: edit.category,
      // schema tags'i JSON string bekliyor
      tags: JSON.stringify(edit.tags.split(',').map(t => t.trim()).filter(Boolean)),
      seoTitle: edit.seoTitle,
      metaDescription: edit.metaDescription,
      titleVariants,
      district: edit.district,
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

  /* ✓ Onayla & Yayınla — önce düzenlemeleri kaydet, sonra siteye (canakkale.network) yayınla. */
  const handleApproveAndPublish = async () => {
    if (!edit) return;
    setBusy(true);
    setModalMsg(null);
    try {
      await saveEdits(); // düzenlemeleri kalıcılaştır
      const res = await fetch(`/api/ai/drafts/${edit.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error((data && data.error) || 'Yayınlama başarısız oldu.');
      }
      if (data.draft) applyToList(data.draft as AiDraft);
      // Site linkini göster — modal açık kalır, editör linke tıklayabilir
      setModalMsg({ kind: 'success', text: 'Siteye yayınlandı ✓', link: data.siteUrl });
      setSelected((prev) => (prev ? { ...prev, status: 'published', articleId: data.articleId } : prev));
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

  /* 🔄 AI ile yeniden yaz — POST /api/ai/drafts/[id]/rewrite (konudan yeniden üret) */
  const handleRewrite = async () => {
    if (!edit || !selected) return;
    if (!confirm('Bu taslak AI ile konudan yeniden yazılacak (mevcut metnin üzerine). Devam edilsin mi?')) return;
    setBusy(true);
    setModalMsg(null);
    try {
      const res = await fetch(`/api/ai/drafts/${edit.id}/rewrite`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) throw new Error((data && data.error) || 'Yeniden yazma başarısız oldu.');
      const d = data as AiDraft;
      applyToList(d);
      // Modal alanlarını tazele
      const tv = parseTitleVariants(d.titleVariants);
      setEdit({
        id: d.id,
        title: d.title || '',
        body: d.body || '',
        category: d.category || '',
        tags: parseJsonArray(d.tags).join(', '),
        seoTitle: d.seoTitle || '',
        metaDescription: d.metaDescription || '',
        district: d.district || '',
        editorNote: d.editorNote || '',
        scheduledAt: isoToLocalInput(d.scheduledAt),
        variantOptions: tv.options,
        altTitle: tv.altTitle,
      });
      setSelected(prev => (prev ? { ...prev, ...d } : d));
      setModalMsg({ kind: 'success', text: 'AI ile yeniden yazıldı ✓ (durum: bekliyor)' });
    } catch (e) {
      setModalMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Yeniden yazma başarısız oldu.' });
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
  // İlçe filtresi (client tarafı): 'all' = hepsi, 'none' = ilçesiz, aksi halde slug eşleşmesi.
  const visibleDrafts = districtFilter === 'all'
    ? drafts
    : districtFilter === 'none'
      ? drafts.filter(d => !d.district)
      : drafts.filter(d => d.district === districtFilter);
  // Haftalık takvim: görüntülenen haftanın günleri + o haftaya planlanmış taslaklar
  const weekStart = startOfWeek(weekOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const scheduledInWeek = visibleDrafts.filter(d => {
    if (!d.scheduledAt) return false;
    const t = new Date(d.scheduledAt);
    return !Number.isNaN(t.getTime()) && t >= weekStart && t < weekEnd;
  });
  const allSelected = visibleDrafts.length > 0 && visibleDrafts.every(d => selectedIds.has(d.id));
  const toggleAll = () => {
    setSelectedIds(prev => {
      if (visibleDrafts.length > 0 && visibleDrafts.every(d => prev.has(d.id))) return new Set();
      return new Set(visibleDrafts.map(d => d.id));
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
          <Link href="/ai-news/maliyet" className="btn btn-ghost">💸 Maliyet</Link>
        </div>
      </div>

      {/* Durum sekmeleri + ilçe filtresi */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
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
        {/* Görünüm: kart / haftalık takvim */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginLeft: 'auto' }}>
          <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('cards')}>🗂 Kart</button>
          <button className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('calendar')}>🗓 Takvim</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <span style={{ color: 'var(--text-muted)' }}>📍 İlçe</span>
          <select
            className="form-select"
            style={{ maxWidth: 200, padding: '6px 10px', fontSize: 'var(--text-sm)' }}
            value={districtFilter}
            onChange={(e) => { setDistrictFilter(e.target.value); clearSelection(); }}
          >
            <option value="all">Tüm ilçeler</option>
            <option value="none">İlçe belirtilmemiş</option>
            {DISTRICTS.map(d => (
              <option key={d.slug} value={d.slug}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Toplu seçim araç çubuğu */}
      {!loading && visibleDrafts.length > 0 && (
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
      ) : viewMode === 'calendar' ? (
        <div>
          {/* Hafta gezinme */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(weekOffset - 1)}>← Önceki hafta</button>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – {new Date(weekEnd.getTime() - 1).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'var(--space-2)' }} onClick={() => setWeekOffset(0)}>bu hafta</button>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(weekOffset + 1)}>Sonraki hafta →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 'var(--space-2)', overflowX: 'auto' }}>
            {weekDays.map((day, di) => {
              const isToday = sameDay(day, new Date());
              const dayDrafts = scheduledInWeek
                .filter(d => sameDay(new Date(d.scheduledAt as string), day))
                .sort((a, b) => new Date(a.scheduledAt as string).getTime() - new Date(b.scheduledAt as string).getTime());
              return (
                <div key={di} style={{ minWidth: 110, minHeight: 140, border: '1px solid var(--border-subtle)', borderRadius: 'var(--border-radius)', padding: 'var(--space-2)', background: isToday ? 'rgba(108,92,231,0.08)' : 'var(--surface-2, rgba(255,255,255,0.02))' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
                    {WEEKDAYS_TR[di]} {day.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {dayDrafts.length === 0 ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.6 }}>—</span>
                    ) : dayDrafts.map(d => {
                      const st = STATUS_BADGE[d.status] || { cls: 'badge-primary', label: d.status };
                      const time = new Date(d.scheduledAt as string).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={d.id}
                          onClick={() => openDraft(d)}
                          title={d.title || d.topic}
                          style={{ textAlign: 'left', border: 'none', cursor: 'pointer', background: 'var(--bg-secondary, rgba(0,0,0,0.25))', borderRadius: 6, padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}
                        >
                          <span style={{ fontSize: '10px', color: 'var(--primary-light)', fontWeight: 700 }}>{time}</span>
                          <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {d.title || d.topic}
                          </span>
                          <span className={`badge ${st.cls}`} style={{ fontSize: '9px', alignSelf: 'flex-start' }}>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {scheduledInWeek.length === 0 && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Bu haftaya planlanmış taslak yok. (Planlı yayın tarihi olan taslaklar burada görünür.)
            </div>
          )}
        </div>
      ) : visibleDrafts.length === 0 ? (
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            {districtFilter === 'all' ? 'Bu durumda taslak bulunmuyor.' : 'Bu ilçe filtresine uyan taslak bulunmuyor.'}
          </div>
        </div>
      ) : (
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {visibleDrafts.map(d => {
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
                {districtName(edit.district) && <span className="badge badge-accent">📍 {districtName(edit.district)}</span>}
                {selected.hasContradiction && <span className="badge badge-error">⚠ Kaynak çelişkisi</span>}
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

              {/* A/B başlık — AI'ın önerdiği alternatifler: birini ana başlık, birini alt başlık yap */}
              {(edit.variantOptions.length > 0 || edit.altTitle) && (
                <div className="form-group">
                  <label className="form-label">🔀 Başlık A/B alternatifleri</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {edit.variantOptions.map((v, i) => (
                      <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ flex: 1, minWidth: 160, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{v}</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...edit, title: v })} title="Bunu ana başlık yap">Ana yap</button>
                        <button type="button" className={`btn btn-sm ${edit.altTitle === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEdit({ ...edit, altTitle: edit.altTitle === v ? '' : v })} title="Bunu alt başlık (A/B) yap">
                          {edit.altTitle === v ? '✓ Alt başlık' : 'Alt yap'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {edit.altTitle && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Alt başlık: <strong>{edit.altTitle}</strong>{' '}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...edit, altTitle: '' })}>temizle</button>
                    </div>
                  )}
                </div>
              )}

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

              {/* İlçe — düzenlenebilir (PUT ile kaydedilir; Yayınla/Reddet/Notu Kaydet öncesi saveEdits taşır) */}
              <div className="form-group">
                <label className="form-label">📍 İlçe</label>
                <select className="form-select" value={edit.district} onChange={e => setEdit({ ...edit, district: e.target.value })}>
                  <option value="">Belirtilmemiş</option>
                  {DISTRICTS.map(d => (
                    <option key={d.slug} value={d.slug}>{d.name}</option>
                  ))}
                </select>
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
              <button className="btn btn-ghost btn-sm" disabled={busy || selected.status === 'published'} onClick={handleRewrite} title="AI ile konudan yeniden üret">🔄 AI ile yeniden yaz</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setIgDraftId(edit.id)} title="Taslaktan Instagram postu üret">📸 Instagram</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => handleApproveAndPublish()} style={{ marginLeft: 'auto' }}>
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
