'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type SitePage = {
  slug: string;
  title: string;
  content: string;
  status: string;            // published | hidden
  seoTitle: string | null;
  metaDescription: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

type EditState = {
  originalSlug: string | null; // null = yeni sayfa
  slug: string;
  title: string;
  content: string;
  status: string;
  seoTitle: string;
  metaDescription: string;
};

const EMPTY: EditState = {
  originalSlug: null, slug: '', title: '', content: '',
  status: 'published', seoTitle: '', metaDescription: '',
};

/* Yerel slug üretici — src/lib/site.ts prisma import ettiği için client'a alınamaz */
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input.split('').map((ch) => map[ch] ?? ch).join('').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
}

export default function SayfalarPage() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-admin/pages');
      const data = await res.json();
      setPages(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const openPage = (p: SitePage) => {
    setMsg(null);
    setPreview(false);
    setSlugTouched(true);
    setEdit({
      originalSlug: p.slug,
      slug: p.slug,
      title: p.title,
      content: p.content,
      status: p.status,
      seoTitle: p.seoTitle || '',
      metaDescription: p.metaDescription || '',
    });
  };

  const openNew = () => {
    setMsg(null);
    setPreview(false);
    setSlugTouched(false);
    setEdit({ ...EMPTY });
  };

  const handleSave = async () => {
    if (!edit || !edit.title.trim()) { setMsg({ kind: 'error', text: 'Başlık zorunlu.' }); return; }
    setSaving(true);
    setMsg(null);
    const isNew = edit.originalSlug === null;
    const payload = {
      title: edit.title,
      slug: edit.slug || slugifyTr(edit.title),
      content: edit.content,
      status: edit.status,
      seoTitle: edit.seoTitle || null,
      metaDescription: edit.metaDescription || null,
    };
    try {
      const res = await fetch(isNew ? '/api/site-admin/pages' : `/api/site-admin/pages/${edit.originalSlug}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      setMsg({ kind: 'success', text: 'Kaydedildi ✓' });
      setEdit((prev) => (prev ? { ...prev, originalSlug: data.slug, slug: data.slug } : prev));
      await fetchPages();
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: SitePage) => {
    if (!confirm(`"${p.title}" sayfası kalıcı olarak silinsin mi?`)) return;
    try {
      const res = await fetch(`/api/site-admin/pages/${p.slug}`, { method: 'DELETE' });
      if (res.ok) {
        if (edit?.originalSlug === p.slug) setEdit(null);
        await fetchPages();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Silme başarısız oldu.');
      }
    } catch {
      alert('Sunucuya ulaşılamadı.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📄 Site Sayfaları</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· Hakkımızda, künye, KVKK gibi statik sayfalar
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openNew}>➕ Yeni Sayfa</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 2fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* ── Sol: sayfa listesi ── */}
        <div className="data-table-container">
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
          ) : pages.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz sayfa yok.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sayfa</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.slug} style={{ background: edit?.originalSlug === p.slug ? 'rgba(108,92,231,0.08)' : undefined }}>
                    <td style={{ fontWeight: 500 }}>
                      {p.title}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>/{p.slug}</div>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status === 'published' ? 'Yayında' : 'Gizli'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openPage(p)}>Düzenle</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Sağ: düzenleme paneli ── */}
        {edit ? (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ fontWeight: 600 }}>{edit.originalSlug === null ? 'Yeni Sayfa' : `Düzenle: ${edit.title}`}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>✕ Kapat</button>
            </div>

            {msg && (
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                {msg.text}
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input
                  className="form-input"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: slugTouched ? edit.slug : slugifyTr(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (URL)</label>
                <input
                  className="form-input"
                  value={edit.slug}
                  onChange={(e) => { setSlugTouched(true); setEdit({ ...edit, slug: slugifyTr(e.target.value) || e.target.value }); }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">İçerik (HTML)</label>
                <div className="tabs" style={{ marginBottom: 'var(--space-2)' }}>
                  <button type="button" className={`tab ${!preview ? 'active' : ''}`} onClick={() => setPreview(false)}>Düzenle</button>
                  <button type="button" className={`tab ${preview ? 'active' : ''}`} onClick={() => setPreview(true)}>Önizleme</button>
                </div>
              </div>
              {preview ? (
                <div
                  className="card"
                  style={{ padding: 'var(--space-4)', minHeight: 180, maxHeight: 420, overflowY: 'auto', lineHeight: 1.7 }}
                  // Basit editör önizlemesi — içerik B+ editörlerin kendi girdisidir
                  dangerouslySetInnerHTML={{ __html: edit.content || '<em>Önizlenecek içerik yok</em>' }}
                />
              ) : (
                <textarea
                  className="form-textarea"
                  rows={14}
                  style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}
                  value={edit.content}
                  onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                  placeholder="<h2>Başlık</h2><p>İçerik...</p>"
                />
              )}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  <option value="published">Yayında</option>
                  <option value="hidden">Gizli</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  SEO Başlığı{' '}
                  <span style={{ color: edit.seoTitle.length > 60 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 400 }}>
                    ({edit.seoTitle.length}/60)
                  </span>
                </label>
                <input className="form-input" value={edit.seoTitle} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Meta Açıklama{' '}
                <span style={{ color: edit.metaDescription.length > 160 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 400 }}>
                  ({edit.metaDescription.length}/160)
                </span>
              </label>
              <textarea className="form-textarea" rows={2} value={edit.metaDescription} onChange={(e) => setEdit({ ...edit, metaDescription: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Düzenlemek için soldan bir sayfa seçin ya da yeni sayfa ekleyin.
          </div>
        )}
      </div>
    </div>
  );
}
