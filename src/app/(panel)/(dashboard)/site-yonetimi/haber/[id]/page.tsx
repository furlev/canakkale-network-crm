'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DISTRICTS } from '@/lib/districts';

/* NOT: slugifyTr, src/lib/site.ts'te de var; o dosya prisma import ettiği için
   client bundle'a alınamaz — aynı kural burada yerel kopya olarak durur. */
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

type Category = { slug: string; name: string };

type FormState = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  categorySlug: string;
  district: string;          // ilçe slug'ı ('' = ilçe seçilmedi)
  tags: string;              // virgülle ayrılmış kullanıcı girişi
  imageUrl: string;
  imageAlt: string;
  imageIsAi: boolean;
  videoUrl: string;
  authorName: string;
  status: string;            // draft | published | archived
  newsType: string;          // breaking | daily | weekly | manual
  isBreaking: boolean;
  isFeatured: boolean;
  isEditorPick: boolean;
  seoTitle: string;
  metaDescription: string;
  publishedAt: string | null;
  correctionNote: string;    // yayın sonrası düzeltme metni
  correctedAt: string | null; // sunucu damgası (salt-okunur gösterim)
  retractionNote: string;    // geri çekme gerekçesi
  retractedAt: string | null; // sunucu damgası (salt-okunur gösterim)
};

const EMPTY: FormState = {
  title: '', slug: '', summary: '', body: '', categorySlug: '', district: '', tags: '',
  imageUrl: '', imageAlt: '', imageIsAi: false, videoUrl: '', authorName: '',
  status: 'draft', newsType: 'manual', isBreaking: false, isFeatured: false,
  isEditorPick: false, seoTitle: '', metaDescription: '', publishedAt: null,
  correctionNote: '', correctedAt: null, retractionNote: '', retractedAt: null,
};

/** API yanıtındaki makaleyi form state'ine çevirir. */
function toForm(a: Record<string, unknown>): FormState {
  let tags = '';
  try {
    const parsed = JSON.parse((a.tags as string) || '[]');
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string').join(', ');
  } catch { /* bozuk JSON → boş */ }
  return {
    title: (a.title as string) || '',
    slug: (a.slug as string) || '',
    summary: (a.summary as string) || '',
    body: (a.body as string) || '',
    categorySlug: (a.categorySlug as string) || '',
    district: (a.district as string) || '',
    tags,
    imageUrl: (a.imageUrl as string) || '',
    imageAlt: (a.imageAlt as string) || '',
    imageIsAi: !!a.imageIsAi,
    videoUrl: (a.videoUrl as string) || '',
    authorName: (a.authorName as string) || '',
    status: (a.status as string) || 'draft',
    newsType: (a.newsType as string) || 'manual',
    isBreaking: !!a.isBreaking,
    isFeatured: !!a.isFeatured,
    isEditorPick: !!a.isEditorPick,
    seoTitle: (a.seoTitle as string) || '',
    metaDescription: (a.metaDescription as string) || '',
    publishedAt: (a.publishedAt as string) || null,
    correctionNote: (a.correctionNote as string) || '',
    correctedAt: (a.correctedAt as string) || null,
    retractionNote: (a.retractionNote as string) || '',
    retractedAt: (a.retractedAt as string) || null,
  };
}

export default function HaberEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id || 'yeni';
  const isNew = id === 'yeni';

  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bodyTab, setBodyTab] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/site-admin/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/site-admin/articles/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setForm(toForm(data));
          setSlugTouched(true); // mevcut haberde slug'a dokunma (elle değiştirilebilir)
        } else {
          setMsg({ kind: 'error', text: 'Haber bulunamadı.' });
        }
      })
      .catch(() => setMsg({ kind: 'error', text: 'Haber yüklenemedi.' }))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* Başlık yazıldıkça slug otomatik üretilir (elle düzenlenmediyse) */
  const handleTitle = (title: string) => {
    setForm((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : slugifyTr(title) }));
  };

  const save = async (opts?: { publish?: boolean }) => {
    if (!form.title.trim()) { setMsg({ kind: 'error', text: 'Başlık zorunlu.' }); return; }
    if (!form.body.trim()) { setMsg({ kind: 'error', text: 'Haber gövdesi boş olamaz.' }); return; }
    setSaving(true);
    setMsg(null);

    const status = opts?.publish ? 'published' : form.status;
    const payload = {
      title: form.title,
      slug: form.slug || slugifyTr(form.title),
      summary: form.summary || null,
      body: form.body,
      categorySlug: form.categorySlug || null,
      district: form.district || null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      imageUrl: form.imageUrl || null,
      imageAlt: form.imageAlt || null,
      imageIsAi: form.imageIsAi,
      videoUrl: form.videoUrl || null,
      authorName: form.authorName || null,
      status,
      newsType: form.newsType,
      isBreaking: form.isBreaking,
      isFeatured: form.isFeatured,
      isEditorPick: form.isEditorPick,
      seoTitle: form.seoTitle || null,
      metaDescription: form.metaDescription || null,
      correctionNote: form.correctionNote || null,
      retractionNote: form.retractionNote || null,
    };

    try {
      const res = await fetch(isNew ? '/api/site-admin/articles' : `/api/site-admin/articles/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      setForm(toForm(data));
      setSlugTouched(true);
      setMsg({ kind: 'success', text: opts?.publish ? 'Kaydedildi ve yayınlandı ✓' : 'Kaydedildi ✓' });
      if (isNew && data?.id) router.replace(`/site-yonetimi/haber/${data.id}`);
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  const liveUrl = form.slug ? `https://canakkale.network/haber/${form.slug}` : null;

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{isNew ? '➕ Yeni Haber' : '✏️ Haberi Düzenle'}</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" disabled={saving} onClick={() => save()}>
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={() => save({ publish: true })}>
            🌐 Kaydet ve Yayınla
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* ── Sol: içerik ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div className="form-group">
            <label className="form-label">Başlık *</label>
            <input className="form-input" value={form.title} onChange={(e) => handleTitle(e.target.value)} placeholder="Haber başlığı" />
          </div>

          <div className="form-group">
            <label className="form-label">Slug (URL)</label>
            <input
              className="form-input"
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); setField('slug', slugifyTr(e.target.value) || e.target.value); }}
              placeholder="haber-basligi"
            />
            {liveUrl && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                canakkale.network/haber/{form.slug}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Spot / Özet</label>
            <textarea className="form-textarea" rows={2} value={form.summary} onChange={(e) => setField('summary', e.target.value)} placeholder="Kısa özet (boş bırakılırsa gövdeden üretilir)" />
          </div>

          {/* Gövde: düzenle / önizleme sekmeleri */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Gövde (HTML) *</label>
              <div className="tabs" style={{ marginBottom: 'var(--space-2)' }}>
                <button type="button" className={`tab ${bodyTab === 'edit' ? 'active' : ''}`} onClick={() => setBodyTab('edit')}>Düzenle</button>
                <button type="button" className={`tab ${bodyTab === 'preview' ? 'active' : ''}`} onClick={() => setBodyTab('preview')}>Önizleme</button>
              </div>
            </div>
            {bodyTab === 'edit' ? (
              <textarea
                className="form-textarea"
                rows={18}
                style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}
                value={form.body}
                onChange={(e) => setField('body', e.target.value)}
                placeholder="<p>Haber metni...</p>"
              />
            ) : (
              <div
                className="card"
                style={{ padding: 'var(--space-4)', minHeight: 200, maxHeight: 480, overflowY: 'auto', lineHeight: 1.7 }}
                // Basit editör önizlemesi — içerik B+ editörlerin kendi girdisidir
                dangerouslySetInnerHTML={{ __html: form.body || '<em>Önizlenecek içerik yok</em>' }}
              />
            )}
          </div>

          {/* SEO */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>🔎 SEO</div>
            <div className="form-group">
              <label className="form-label">
                SEO Başlığı{' '}
                <span style={{ color: form.seoTitle.length > 60 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 400 }}>
                  ({form.seoTitle.length}/60)
                </span>
              </label>
              <input className="form-input" value={form.seoTitle} onChange={(e) => setField('seoTitle', e.target.value)} placeholder="Boşsa haber başlığı kullanılır" />
            </div>
            <div className="form-group">
              <label className="form-label">
                Meta Açıklama{' '}
                <span style={{ color: form.metaDescription.length > 160 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 400 }}>
                  ({form.metaDescription.length}/160)
                </span>
              </label>
              <textarea className="form-textarea" rows={2} value={form.metaDescription} onChange={(e) => setField('metaDescription', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Sağ: yayın ayarları ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>📌 Yayın</div>
            <div className="form-group">
              <label className="form-label">Durum</label>
              <select className="form-select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="draft">Taslak</option>
                <option value="published">Yayında</option>
                <option value="archived">Arşiv</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tür</label>
              <select className="form-select" value={form.newsType} onChange={(e) => setField('newsType', e.target.value)}>
                <option value="manual">Manuel</option>
                <option value="breaking">Son Dakika</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={form.categorySlug} onChange={(e) => setField('categorySlug', e.target.value)}>
                <option value="">Kategorisiz</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">İlçe</label>
              <select className="form-select" value={form.district} onChange={(e) => setField('district', e.target.value)}>
                <option value="">İlçe seçilmedi</option>
                {DISTRICTS.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Etiketler (virgülle ayırın)</label>
              <input className="form-input" value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="çanakkale, üniversite" />
            </div>
            <div className="form-group">
              <label className="form-label">Yazar Adı</label>
              <input className="form-input" value={form.authorName} onChange={(e) => setField('authorName', e.target.value)} placeholder="Boşsa oturum kullanıcısı" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isBreaking} onChange={(e) => setField('isBreaking', e.target.checked)} />
                🔴 Son Dakika şeridinde göster
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setField('isFeatured', e.target.checked)} />
                ⭐ Öne Çıkan (manşet)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isEditorPick} onChange={(e) => setField('isEditorPick', e.target.checked)} />
                ✒️ Editör Seçimi
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>🖼️ Medya</div>
            <div className="form-group">
              <label className="form-label">Kapak Görsel URL</label>
              <input className="form-input" value={form.imageUrl} onChange={(e) => setField('imageUrl', e.target.value)} placeholder="https://... veya data:image/..." />
            </div>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 'var(--border-radius)', marginBottom: 'var(--space-3)' }} />
            )}
            <div className="form-group">
              <label className="form-label">Görsel Alt Metni</label>
              <input className="form-input" value={form.imageAlt} onChange={(e) => setField('imageAlt', e.target.value)} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
              <input type="checkbox" checked={form.imageIsAi} onChange={(e) => setField('imageIsAi', e.target.checked)} />
              ✨ Temsili görsel (AI) rozeti göster
            </label>
            <div className="form-group">
              <label className="form-label">Video URL (YouTube vb.)</label>
              <input className="form-input" value={form.videoUrl} onChange={(e) => setField('videoUrl', e.target.value)} placeholder="https://youtube.com/..." />
            </div>
          </div>

          {/* Düzeltme & Geri Çekme (basın hukuku) — kaydedince tarih damgalanır */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>⚖️ Düzeltme &amp; Geri Çekme</div>

            <div className="form-group">
              <label className="form-label">Düzeltme Notu (tekzip / düzeltme)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.correctionNote}
                onChange={(e) => setField('correctionNote', e.target.value)}
                placeholder="Yayınlanan haberde yapılan düzeltmenin açıklaması (okurlara gösterilir)"
              />
              {form.correctedAt && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Düzeltme yayınlandı: {new Date(form.correctedAt).toLocaleString('tr-TR')}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Geri Çekme Notu (retraction)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.retractionNote}
                onChange={(e) => setField('retractionNote', e.target.value)}
                placeholder="Haber neden geri çekildi? (boş bırakılırsa geri çekme kaldırılır)"
              />
              {form.retractedAt && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', marginTop: 4 }}>
                  🚫 Geri çekildi: {new Date(form.retractedAt).toLocaleString('tr-TR')}
                </div>
              )}
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Not kaydedildiğinde tarih otomatik damgalanır; notu boşaltıp kaydetmek damgayı kaldırır.
            </p>
          </div>

          {/* Canlı site linki */}
          {!isNew && liveUrl && form.status === 'published' && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>🔗 Canlı Site</div>
              <a href={liveUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>
                {liveUrl} ↗
              </a>
              {form.publishedAt && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                  Yayın: {new Date(form.publishedAt).toLocaleString('tr-TR')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
