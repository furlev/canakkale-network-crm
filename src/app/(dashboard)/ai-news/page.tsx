'use client';
import { useState, useEffect, useCallback } from 'react';

/* API sözleşmesi: /api/ai/drafts GET/PUT/DELETE + /publish (bkz. src/app/api/ai/drafts) */
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

/* Düzenlenebilir alanlar — modal state'i */
type EditState = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string;            // virgülle ayrılmış (kullanıcı girişi)
  seoTitle: string;
  metaDescription: string;
};

export default function AiNewsPage() {
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusKey>('pending');

  const [selected, setSelected] = useState<AiDraft | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

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

  /* ✓ Onayla & Yayınla — önce düzenlemeleri kaydet, sonra WP'ye yayınla */
  const handleApproveAndPublish = async () => {
    if (!edit) return;
    setBusy(true);
    setModalMsg(null);
    try {
      await saveEdits(); // düzenlemeleri kalıcılaştır
      const res = await fetch(`/api/ai/drafts/${edit.id}/publish`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error((data && data.error) || 'Yayınlama başarısız oldu.');
      }
      if (data.draft) applyToList(data.draft as AiDraft);
      setModalMsg({ kind: 'success', text: `Yayınlandı ✓ (WP #${data.wpId})` });
      setTimeout(() => { setSelected(null); setEdit(null); setModalMsg(null); }, 1200);
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

  const selectedSources = selected ? parseJsonArray(selected.sources) : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🤖 AI Haber Kuyruğu</h1>
          <p className="page-subtitle">Yapay zekânın hazırladığı haber taslaklarını inceleyip yayınlayın</p>
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
            const st = STATUS_BADGE[d.status] || { cls: 'badge-primary', label: d.status };
            const sourceCount = parseJsonArray(d.sources).length;
            return (
              <div
                key={d.id}
                className="card"
                onClick={() => openDraft(d)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}
              >
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
                  {conf && <span className={`badge ${conf.cls}`}>{conf.text}</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>
                  {d.title || d.topic}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>📎 {sourceCount} kaynak</span>
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
                </div>
              )}

              {/* Rozetler */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {(() => {
                  const st = STATUS_BADGE[selected.status] || { cls: 'badge-primary', label: selected.status };
                  return <span className={`badge ${st.cls}`}>{st.label}</span>;
                })()}
                {(() => {
                  const conf = confidenceBadge(selected.confidence);
                  return conf ? <span className={`badge ${conf.cls}`}>{conf.text}</span> : null;
                })()}
                {selected.wpId && <span className="badge badge-success">WP #{selected.wpId}</span>}
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
              <button className="btn btn-ghost" disabled={busy} onClick={handleReject}>Reddet</button>
              <button className="btn btn-primary" disabled={busy} onClick={handleApproveAndPublish} style={{ marginLeft: 'auto' }}>
                {busy ? 'İşleniyor...' : '✓ Onayla & Yayınla'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
