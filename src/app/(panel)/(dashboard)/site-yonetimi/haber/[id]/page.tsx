'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

/* ── Görüntülenme takviyesi — SAF hesap kopyası ──
   NOT: Aşağıdaki fonksiyonlar src/lib/view-boost.ts içindeki saf hesabın birebir
   kopyasıdır; o dosya prisma import ettiği için client bundle'a alınamaz (slugifyTr
   ile aynı desen). Algoritmayı değiştirirsen İKİ yeri birlikte güncelle. */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd01 = (seed: string): number => mulberry32(xmur3(seed)())();
const lerp = (min: number, max: number, t: number): number => min + (max - min) * t;
const easeInOut = (t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};
function ageCurve(d: number): number {
  if (d <= 1) return 1.6;
  if (d <= 3) return 1.25;
  if (d <= 7) return 1.0;
  if (d <= 14) return 0.6;
  if (d <= 30) return 0.3;
  return 0.12;
}
const HOUR_WEIGHTS = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2,
  0.5, 0.9,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.0,
];
const TOTAL_WEIGHT = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
const TR_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const trDayNumber = (t: number): number => Math.floor((t + TR_OFFSET_MS) / DAY_MS);
const trMsOfDay = (t: number): number => (((t + TR_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
function cumWeight(msOfDay: number): number {
  const hour = Math.min(23, Math.floor(msOfDay / HOUR_MS));
  let acc = 0;
  for (let h = 0; h < hour; h++) acc += HOUR_WEIGHTS[h];
  acc += HOUR_WEIGHTS[hour] * ((msOfDay - hour * HOUR_MS) / HOUR_MS);
  return acc;
}
function dailyIncrement(articleId: string, d: number, dailyMin: number, dailyMax: number): number {
  return Math.floor(lerp(dailyMin, dailyMax, rnd01(`${articleId}:${d}`)) * ageCurve(d));
}
function computeViewBoost(
  articleId: string,
  publishedAt: string | null,
  cfg: { dailyMin: number; dailyMax: number },
  now: Date = new Date()
): number {
  if (!publishedAt) return 0;
  const pubMs = new Date(publishedAt).getTime();
  if (Number.isNaN(pubMs)) return 0;
  const nowMs = now.getTime();
  if (nowMs <= pubMs) return 0;
  let min = Math.max(0, Math.floor(cfg.dailyMin));
  let max = Math.max(0, Math.floor(cfg.dailyMax));
  if (max < min) [min, max] = [max, min];
  if (max === 0) return 0;
  const dNow = trDayNumber(nowMs) - trDayNumber(pubMs);
  let total = 0;
  for (let d = 0; d < dNow; d++) total += dailyIncrement(articleId, d, min, max);
  const inc = dailyIncrement(articleId, dNow, min, max);
  const wNow = cumWeight(trMsOfDay(nowMs));
  let frac: number;
  if (dNow === 0) {
    const wPub = cumWeight(trMsOfDay(pubMs));
    const denom = TOTAL_WEIGHT - wPub;
    frac = denom > 0 ? (wNow - wPub) / denom : 1;
  } else {
    frac = wNow / TOTAL_WEIGHT;
  }
  total += Math.floor(inc * easeInOut(frac));
  return total;
}

type Category = { slug: string; name: string };
type Author = { slug: string; name: string; title?: string | null };
type ViewBoostMode = 'inherit' | 'off' | 'custom';
type GlobalBoost = { enabled: boolean; dailyMin: number; dailyMax: number };

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
  authorSlug: string;        // yazar hub bağı (Author.slug) — '' = bağsız
  status: string;            // draft | published | archived | awaiting_approval | scheduled
  scheduledAt: string | null; // planlı yayın anı (ISO) — status='scheduled' için
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
  viewBoostMode: ViewBoostMode; // görüntülenme takviyesi: genel ayarı izle / kapalı / özel
  viewBoostMin: string;      // özel aralık girişi (boş = genel değerden tamamlanır)
  viewBoostMax: string;
};

const EMPTY: FormState = {
  title: '', slug: '', summary: '', body: '', categorySlug: '', district: '', tags: '',
  imageUrl: '', imageAlt: '', imageIsAi: false, videoUrl: '', authorName: '', authorSlug: '',
  status: 'draft', scheduledAt: null, newsType: 'manual', isBreaking: false, isFeatured: false,
  isEditorPick: false, seoTitle: '', metaDescription: '', publishedAt: null,
  correctionNote: '', correctedAt: null, retractionNote: '', retractedAt: null,
  viewBoostMode: 'inherit', viewBoostMin: '', viewBoostMax: '',
};

/** Durum → Türkçe etiket + rozet sınıfı (yayın onay hiyerarşisi dahil). */
const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  awaiting_approval: 'Onay Bekliyor',
  scheduled: 'Planlandı',
  published: 'Yayında',
  archived: 'Arşiv',
};
const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-info',
  awaiting_approval: 'badge-warning',
  scheduled: 'badge-primary',
  published: 'badge-success',
  archived: 'badge-error',
};

/** datetime-local input değeri (yerel saat) ↔ ISO. Boşsa ''. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

/** API yanıtındaki makaleyi form state'ine çevirir. */
function toForm(a: Record<string, unknown>): FormState {
  let tags = '';
  try {
    const parsed = JSON.parse((a.tags as string) || '[]');
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string').join(', ');
  } catch { /* bozuk JSON → boş */ }
  // Görüntülenme takviyesi override'ı (Json) → form alanları
  let viewBoostMode: ViewBoostMode = 'inherit';
  let viewBoostMin = '';
  let viewBoostMax = '';
  const vb = a.viewBoost as { mode?: string; dailyMin?: number; dailyMax?: number } | null | undefined;
  if (vb && typeof vb === 'object') {
    if (vb.mode === 'off' || vb.mode === 'custom') viewBoostMode = vb.mode;
    if (typeof vb.dailyMin === 'number') viewBoostMin = String(vb.dailyMin);
    if (typeof vb.dailyMax === 'number') viewBoostMax = String(vb.dailyMax);
  }
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
    authorSlug: (a.authorSlug as string) || '',
    status: (a.status as string) || 'draft',
    scheduledAt: (a.scheduledAt as string) || null,
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
    viewBoostMode, viewBoostMin, viewBoostMax,
  };
}

export default function HaberEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id || 'yeni';
  const isNew = id === 'yeni';

  const [form, setForm] = useState<FormState>(EMPTY);
  const [role, setRole] = useState<string | null>(null); // 'admin' | 'editor' | 'user' — yayın yetkisi için
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [realViews, setRealViews] = useState(0); // gerçek views (takviye önizlemesi için)
  const [globalBoost, setGlobalBoost] = useState<GlobalBoost | null>(null); // genel takviye ayarı (B/A okuyabilir)
  const [bodyTab, setBodyTab] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  // Oturum rolü: 'Yayınla' (B/A) vs 'Onaya Gönder' (C) butonunu belirler
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => { if (u && typeof u.role === 'string') setRole(u.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/site-admin/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
    fetch('/api/site-admin/authors')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (Array.isArray(data)) setAuthors(data); })
      .catch(() => {});
    // Genel takviye ayarı (yalnız B/A okuyabilir; 403 → önizleme 'kapalı' varsayar)
    fetch('/api/site-admin/view-boost')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d?.settings) setGlobalBoost(d.settings as GlobalBoost); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/site-admin/articles/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setForm(toForm(data));
          setRealViews(typeof data.views === 'number' ? data.views : 0);
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

  const canPublish = role === 'admin' || role === 'editor'; // B/A yayınlayabilir; C onaya gönderir

  /* Görüntülenme takviyesi önizlemesi: form + genel ayardan etkin aralığı çöz
     (resolveBoostRange mantığının kopyası) ve ŞU ANKİ takviyeli sayıyı hesapla. */
  const boostPreview = useMemo(() => {
    const g = globalBoost ?? { enabled: false, dailyMin: 40, dailyMax: 120 };
    const parseNum = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
    };
    let range: { dailyMin: number; dailyMax: number } | null = null;
    if (form.viewBoostMode === 'custom') {
      range = {
        dailyMin: parseNum(form.viewBoostMin) ?? g.dailyMin,
        dailyMax: parseNum(form.viewBoostMax) ?? g.dailyMax,
      };
    } else if (form.viewBoostMode === 'inherit' && g.enabled) {
      range = { dailyMin: g.dailyMin, dailyMax: g.dailyMax };
    }
    const boost = range && !isNew ? computeViewBoost(id, form.publishedAt, range) : 0;
    return { active: !!range, boost, shown: realViews + boost };
  }, [globalBoost, form.viewBoostMode, form.viewBoostMin, form.viewBoostMax, form.publishedAt, isNew, id, realViews]);

  const save = async (opts?: { publish?: boolean; submit?: boolean; schedule?: boolean }) => {
    if (!form.title.trim()) { setMsg({ kind: 'error', text: 'Başlık zorunlu.' }); return; }
    if (!form.body.trim()) { setMsg({ kind: 'error', text: 'Haber gövdesi boş olamaz.' }); return; }
    if (opts?.schedule) {
      const t = form.scheduledAt ? new Date(form.scheduledAt).getTime() : NaN;
      if (isNaN(t) || t <= Date.now()) { setMsg({ kind: 'error', text: 'Planlı yayın için ileri bir tarih/saat seçin.' }); return; }
    }

    // Görüntülenme takviyesi override'ı: 'inherit' → null (DB satırı temizlenir).
    // Özel modda geçersiz/boş uç gönderilmez (sunucu genel değerden tamamlar).
    const parseBoostNum = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = Number(t);
      return Number.isInteger(n) && n >= 0 ? n : undefined;
    };
    let viewBoost: { mode: 'off' } | { mode: 'custom'; dailyMin?: number; dailyMax?: number } | null = null;
    if (form.viewBoostMode === 'off') viewBoost = { mode: 'off' };
    else if (form.viewBoostMode === 'custom') {
      const mn = parseBoostNum(form.viewBoostMin);
      const mx = parseBoostNum(form.viewBoostMax);
      if ((form.viewBoostMin.trim() !== '' && mn === undefined) || (form.viewBoostMax.trim() !== '' && mx === undefined)) {
        setMsg({ kind: 'error', text: 'Takviye aralığı için 0 veya daha büyük tam sayılar girin.' }); return;
      }
      if (mn !== undefined && mx !== undefined && mx < mn) {
        setMsg({ kind: 'error', text: 'Takviye üst sınırı alt sınırdan küçük olamaz.' }); return;
      }
      viewBoost = { mode: 'custom', ...(mn !== undefined ? { dailyMin: mn } : {}), ...(mx !== undefined ? { dailyMax: mx } : {}) };
    }

    setSaving(true);
    setMsg(null);

    const status = opts?.publish ? 'published'
      : opts?.submit ? 'awaiting_approval'
      : opts?.schedule ? 'scheduled'
      : form.status;
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
      authorSlug: form.authorSlug || null,
      status,
      scheduledAt: status === 'scheduled' ? form.scheduledAt : null,
      newsType: form.newsType,
      isBreaking: form.isBreaking,
      isFeatured: form.isFeatured,
      isEditorPick: form.isEditorPick,
      seoTitle: form.seoTitle || null,
      metaDescription: form.metaDescription || null,
      correctionNote: form.correctionNote || null,
      retractionNote: form.retractionNote || null,
      // Yeni haber POST şeması bu alanı tanımaz (zod strip'ler); PUT'ta işlenir.
      viewBoost,
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
      const savedMsg = opts?.publish ? 'Kaydedildi ve yayınlandı ✓'
        : opts?.submit ? 'Onaya gönderildi ✓ — yöneticiler bilgilendirildi'
        : opts?.schedule ? 'Planlandı ✓ — belirtilen tarihte yayınlanacak'
        : (data?.status === 'awaiting_approval' ? 'Kaydedildi — yayın için onay bekliyor' : 'Kaydedildi ✓');
      setMsg({ kind: 'success', text: savedMsg });
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
          <h1 className="page-title">
            {isNew ? '➕ Yeni Haber' : '✏️ Haberi Düzenle'}
            {!isNew && (
              <span className={`badge ${STATUS_BADGE[form.status] || 'badge-info'}`} style={{ marginLeft: 'var(--space-3)', verticalAlign: 'middle' }}>
                {STATUS_LABEL[form.status] || form.status}
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" disabled={saving} onClick={() => save()}>
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
          {canPublish ? (
            <button className="btn btn-primary" disabled={saving} onClick={() => save({ publish: true })}>
              🌐 Kaydet ve Yayınla
            </button>
          ) : (
            // C seviyesi: doğrudan yayınlayamaz, onaya gönderir (B/A onaylar)
            <button className="btn btn-primary" disabled={saving} onClick={() => save({ submit: true })}>
              📤 Onaya Gönder
            </button>
          )}
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
                <option value="awaiting_approval">Onay Bekliyor</option>
                {canPublish && <option value="scheduled">Planlandı</option>}
                {canPublish && <option value="published">Yayında</option>}
                <option value="archived">Arşiv</option>
              </select>
              {!canPublish && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Yayın yetkiniz yok — “Onaya Gönder” ile yöneticiye iletin.
                </div>
              )}
            </div>

            {/* Planlı yayın (ileri tarih) — yalnız B/A */}
            {canPublish && (
              <div className="form-group">
                <label className="form-label">Planlı Yayın Tarihi (ileri tarih)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={toLocalInput(form.scheduledAt)}
                  onChange={(e) => setField('scheduledAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 'var(--space-2)' }}
                  disabled={saving || !form.scheduledAt}
                  onClick={() => save({ schedule: true })}
                >
                  🗓️ Planla (ileri tarih)
                </button>
                {form.status === 'scheduled' && form.scheduledAt && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-light)', marginTop: 4 }}>
                    {new Date(form.scheduledAt).toLocaleString('tr-TR')} tarihinde yayınlanacak
                  </div>
                )}
              </div>
            )}
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
            <div className="form-group">
              <label className="form-label">Yazar Hub Bağı</label>
              <select className="form-select" value={form.authorSlug} onChange={(e) => setField('authorSlug', e.target.value)}>
                <option value="">Yazar sayfası yok</option>
                {authors.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.name}{a.title ? ` — ${a.title}` : ''}</option>
                ))}
              </select>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                Seçilirse haber /yazar/{form.authorSlug || '...'} sayfasında listelenir.
              </div>
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
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
              <input type="checkbox" checked={form.imageIsAi} onChange={(e) => setField('imageIsAi', e.target.checked)} />
              ✨ Temsili görsel (AI ile üretildi)
            </label>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Kayıt amaçlı işaret — sitede rozet gösterilmez; bilgilendirme /gorsel-politikasi sayfasındadır.
            </div>
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

          {/* Görüntülenme takviyesi (habere özel) — yalnız mevcut haberde (POST bu alanı işlemez) */}
          {!isNew && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>👁️ Görüntülenme Takviyesi</div>
              <div className="form-group">
                <label className="form-label">Mod</label>
                <select
                  className="form-select"
                  value={form.viewBoostMode}
                  onChange={(e) => setField('viewBoostMode', e.target.value as ViewBoostMode)}
                >
                  <option value="inherit">Genel ayarı izle{globalBoost ? (globalBoost.enabled ? ` (açık, ${globalBoost.dailyMin}-${globalBoost.dailyMax}/gün)` : ' (kapalı)') : ''}</option>
                  <option value="off">Kapalı (yalnız gerçek sayı)</option>
                  <option value="custom">Özel aralık</option>
                </select>
              </div>
              {form.viewBoostMode === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Günlük en az</label>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      value={form.viewBoostMin}
                      onChange={(e) => setField('viewBoostMin', e.target.value)}
                      placeholder={globalBoost ? String(globalBoost.dailyMin) : '40'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Günlük en çok</label>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      value={form.viewBoostMax}
                      onChange={(e) => setField('viewBoostMax', e.target.value)}
                      placeholder={globalBoost ? String(globalBoost.dailyMax) : '120'}
                    />
                  </div>
                </div>
              )}
              {/* Anlık önizleme: gerçek + takviye = sitede görünen */}
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: 'var(--bg-secondary, rgba(255,255,255,0.04))', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                {boostPreview.active ? (
                  form.publishedAt ? (
                    <>
                      Sitede şu an görünecek sayı:{' '}
                      <strong>{boostPreview.shown.toLocaleString('tr-TR')}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}(gerçek {realViews.toLocaleString('tr-TR')} + takviye {boostPreview.boost.toLocaleString('tr-TR')})
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Takviye yayınla birlikte 0&apos;dan başlar (haber henüz yayınlanmadı).</span>
                  )
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Takviye devre dışı — sitede gerçek sayı ({realViews.toLocaleString('tr-TR')}) görünür.
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Takviye yalnız sitede gösterilen sayıyı etkiler; gerçek ölçüm CRM analitiğinde ayrı durur.
                Sayı deterministik hesaplanır ve zamanla asla azalmaz.
              </p>
            </div>
          )}

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
