'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { SiteSettings, SiteStatItem, SiteTeam } from '@/lib/site'; // yalnızca tip — derlemede silinir
import { isSafeMapsEmbedUrl } from '@/lib/maps-embed'; // saf yardımcı — istemcide güvenle çalışır

type Category = {
  slug: string;
  name: string;
  color: string | null;
  order: number;
  showInNav: boolean;
  articleCount: number;
};

type SocialKey = keyof SiteSettings['social'];

const SOCIAL_FIELDS: { key: SocialKey; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
];

/** Logo alanı canlı önizlemesi — logo hedef zeminde (koyu/açık) gösterilir. */
function LogoPreview({ src, dark }: { src: string; dark: boolean }) {
  if (!src.trim()) return null;
  return (
    <div
      style={{
        marginTop: 6,
        padding: '8px 12px',
        borderRadius: 8,
        display: 'inline-block',
        background: dark ? '#101726' : '#f5f1e8',
        border: '1px solid var(--border)',
      }}
    >
      {/* Kırık URL'de gizle; URL değişince key ile yeniden dene */}
      <img
        key={src}
        src={src}
        alt="Logo önizleme"
        style={{ maxHeight: 40, maxWidth: 220, display: 'block' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

export default function SiteAyarlarPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const [newCat, setNewCat] = useState({ name: '', color: '#5c6b82' });
  const [catBusy, setCatBusy] = useState<string | null>(null);
  const [catMsg, setCatMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  // Ekip vitrini (Setting 'siteTeam') — ayrı uçtan okunur/yazılır
  const [team, setTeam] = useState<SiteTeam>({ groups: [] });
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamMsg, setTeamMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  // Künye sayfası (SitePage slug='kunye') durumu
  const [kunyeStatus, setKunyeStatus] = useState<'loading' | 'exists' | 'missing'>('loading');
  const [kunyeBusy, setKunyeBusy] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/site-admin/categories');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCategories(data);
    } catch { /* liste eski kalır */ }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/site-admin/settings').then((res) => (res.ok ? res.json() : null)),
      fetchCategories(),
      fetch('/api/site-admin/team').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/site-admin/pages').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([s, , t, pages]) => {
        if (s) setSettings(s);
        if (t && Array.isArray(t.groups)) setTeam(t);
        if (Array.isArray(pages)) {
          setKunyeStatus(pages.some((p: { slug: string }) => p.slug === 'kunye') ? 'exists' : 'missing');
        } else {
          // Liste alınamadıysa yanlışlıkla kopya oluşturmamak için linki göster
          setKunyeStatus('exists');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchCategories]);

  const setField = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      // Manuel istatistik satırlarını temizle: boş etiketli satırlar kaydedilmez
      const payload: SiteSettings = {
        ...settings,
        statsManual: settings.statsManual
          .filter((s) => s.label.trim())
          .map((s) => ({
            label: s.label.trim(),
            value: Number.isFinite(s.value) ? s.value : 0,
            ...(s.suffix?.trim() ? { suffix: s.suffix.trim() } : {}),
            ...(s.format ? { format: s.format } : {}),
          })),
      };
      const res = await fetch('/api/site-admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      setSettings(data || payload);
      setMsg({ kind: 'success', text: 'Site ayarları kaydedildi ✓' });
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Manuel istatistik bandı satırları ── */
  const patchStat = (i: number, patch: Partial<SiteStatItem>) => {
    setSettings((prev) => (prev ? {
      ...prev,
      statsManual: prev.statsManual.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    } : prev));
  };

  const moveStat = (i: number, dir: -1 | 1) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.statsManual.length) return prev;
      const arr = [...prev.statsManual];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, statsManual: arr };
    });
  };

  const removeStat = (i: number) => {
    setSettings((prev) => (prev ? { ...prev, statsManual: prev.statsManual.filter((_, idx) => idx !== i) } : prev));
  };

  const addStat = () => {
    setSettings((prev) => (prev ? { ...prev, statsManual: [...prev.statsManual, { label: '', value: 0 }] } : prev));
  };

  /* ── Ekip vitrini işlemleri ── */
  const patchGroup = (gi: number, patch: Partial<SiteTeam['groups'][number]>) => {
    setTeam((prev) => ({ groups: prev.groups.map((g, idx) => (idx === gi ? { ...g, ...patch } : g)) }));
  };

  const moveGroup = (gi: number, dir: -1 | 1) => {
    setTeam((prev) => {
      const j = gi + dir;
      if (j < 0 || j >= prev.groups.length) return prev;
      const arr = [...prev.groups];
      [arr[gi], arr[j]] = [arr[j], arr[gi]];
      return { groups: arr };
    });
  };

  const patchMember = (gi: number, mi: number, patch: Partial<SiteTeam['groups'][number]['members'][number]>) => {
    setTeam((prev) => ({
      groups: prev.groups.map((g, idx) => (idx === gi ? {
        ...g,
        members: g.members.map((m, midx) => (midx === mi ? { ...m, ...patch } : m)),
      } : g)),
    }));
  };

  const moveMember = (gi: number, mi: number, dir: -1 | 1) => {
    setTeam((prev) => ({
      groups: prev.groups.map((g, idx) => {
        if (idx !== gi) return g;
        const j = mi + dir;
        if (j < 0 || j >= g.members.length) return g;
        const arr = [...g.members];
        [arr[mi], arr[j]] = [arr[j], arr[mi]];
        return { ...g, members: arr };
      }),
    }));
  };

  const handleSaveTeam = async () => {
    setTeamSaving(true);
    setTeamMsg(null);
    try {
      // Boş isimli üyeler ve boş başlıklı gruplar kaydedilmez
      const payload: SiteTeam = {
        groups: team.groups
          .map((g) => ({
            title: g.title.trim(),
            members: g.members
              .filter((m) => m.name.trim())
              .map((m) => ({
                name: m.name.trim(),
                role: m.role.trim(),
                ...(m.photoUrl?.trim() ? { photoUrl: m.photoUrl.trim() } : {}),
              })),
          }))
          .filter((g) => g.title),
      };
      const res = await fetch('/api/site-admin/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTeamMsg({ kind: 'error', text: data?.error || 'Ekip kaydedilemedi.' });
        return;
      }
      setTeam(data || payload);
      setTeamMsg({ kind: 'success', text: 'Ekip vitrini kaydedildi ✓' });
    } catch {
      setTeamMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setTeamSaving(false);
    }
  };

  /* ── Künye sayfası oluştur ── */
  const createKunyePage = async () => {
    setKunyeBusy(true);
    try {
      // Yarışta kopya (kunye-2) oluşmasın: önce tekrar kontrol et
      const check = await fetch('/api/site-admin/pages');
      const list = await check.json().catch(() => null);
      if (check.ok && Array.isArray(list) && list.some((p: { slug: string }) => p.slug === 'kunye')) {
        setKunyeStatus('exists');
        return;
      }
      const res = await fetch('/api/site-admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Künye',
          slug: 'kunye',
          content: '<h2>Künye</h2><p>İmtiyaz sahibi, sorumlu yazı işleri müdürü ve yayın ekibi bilgilerini buradan düzenleyin.</p>',
          status: 'published',
        }),
      });
      if (res.ok) {
        setKunyeStatus('exists');
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Künye sayfası oluşturulamadı.');
      }
    } catch {
      alert('Sunucuya ulaşılamadı.');
    } finally {
      setKunyeBusy(false);
    }
  };

  /* ── Kategori işlemleri ── */
  const patchCategory = (slug: string, patch: Partial<Category>) => {
    setCategories((prev) => prev.map((c) => (c.slug === slug ? { ...c, ...patch } : c)));
  };

  const saveCategory = async (c: Category) => {
    setCatBusy(c.slug);
    setCatMsg(null);
    try {
      const res = await fetch(`/api/site-admin/categories/${c.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, color: c.color, order: c.order, showInNav: c.showInNav }),
      });
      if (res.ok) {
        setCatMsg({ kind: 'success', text: `"${c.name}" kaydedildi ✓` });
        await fetchCategories();
      } else {
        const data = await res.json().catch(() => null);
        setCatMsg({ kind: 'error', text: data?.error || 'Kategori kaydedilemedi.' });
      }
    } catch {
      setCatMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setCatBusy(null);
    }
  };

  const deleteCategory = async (c: Category) => {
    if (!confirm(`"${c.name}" kategorisi silinsin mi?\n\nBu kategorideki ${c.articleCount} makale SİLİNMEZ, kategorisiz kalır.`)) return;
    setCatBusy(c.slug);
    setCatMsg(null);
    try {
      const res = await fetch(`/api/site-admin/categories/${c.slug}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCategories();
        setCatMsg({ kind: 'success', text: `"${c.name}" silindi.` });
      } else {
        const data = await res.json().catch(() => null);
        setCatMsg({ kind: 'error', text: data?.error || 'Kategori silinemedi.' });
      }
    } finally {
      setCatBusy(null);
    }
  };

  const addCategory = async () => {
    if (!newCat.name.trim()) return;
    setCatBusy('new');
    setCatMsg(null);
    try {
      const res = await fetch('/api/site-admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCat.name.trim(), color: newCat.color, order: categories.length }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setNewCat({ name: '', color: '#5c6b82' });
        await fetchCategories();
      } else {
        setCatMsg({ kind: 'error', text: data?.error || 'Kategori eklenemedi.' });
      }
    } catch {
      setCatMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setCatBusy(null);
    }
  };

  if (loading || !settings) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
      {loading ? 'Yükleniyor...' : 'Ayarlar yüklenemedi.'}
    </div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">⚙️ Site Ayarları</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· canakkale.network genel ayarları ve kategorileri
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" disabled={saving} onClick={handleSaveSettings}>
            {saving ? 'Kaydediliyor...' : '💾 Ayarları Kaydet'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', alignItems: 'start', marginBottom: 'var(--space-6)' }}>
        {/* ── Genel ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>🏷️ Genel</div>
          <div className="form-group">
            <label className="form-label">Site Başlığı</label>
            <input className="form-input" value={settings.title} onChange={(e) => setField('title', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Slogan</label>
            <input className="form-input" value={settings.slogan} onChange={(e) => setField('slogan', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Açıklama (SEO)</label>
            <textarea className="form-textarea" rows={3} value={settings.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Adres</label>
            <input className="form-input" value={settings.address} onChange={(e) => setField('address', e.target.value)} />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            <input type="checkbox" checked={settings.tickerEnabled} onChange={(e) => setField('tickerEnabled', e.target.checked)} />
            🔴 Son dakika şeridi (ticker) aktif
          </label>
          <div className="form-group">
            <label className="form-label">Reklam Bilgilendirme Metni</label>
            <textarea className="form-textarea" rows={2} value={settings.adsNotice} onChange={(e) => setField('adsNotice', e.target.value)} />
          </div>
        </div>

        {/* ── İletişim + sosyal ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>📮 İletişim</div>
          <div className="form-group">
            <label className="form-label">İletişim E-postası</label>
            <input className="form-input" type="email" value={settings.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Webmaster E-postası</label>
            <input className="form-input" type="email" value={settings.webmasterEmail} onChange={(e) => setField('webmasterEmail', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tekzip E-postası</label>
            <input className="form-input" type="email" value={settings.tekzipEmail} onChange={(e) => setField('tekzipEmail', e.target.value)} />
          </div>

          <div style={{ fontWeight: 600, margin: 'var(--space-4) 0' }}>🔗 Sosyal Medya</div>
          {SOCIAL_FIELDS.map(({ key, label }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input
                className="form-input"
                value={settings.social[key] || ''}
                onChange={(e) => setField('social', { ...settings.social, [key]: e.target.value })}
                placeholder={`https://${key === 'x' ? 'x.com' : `${key}.com`}/...`}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', alignItems: 'start', marginBottom: 'var(--space-6)' }}>
        {/* ── Marka & logolar ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>🎨 Marka & Logolar</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            URL ya da <code>/site/...</code> yolu girilebilir. Önizleme, logonun sitede görüneceği zeminde gösterilir.
          </p>
          <div className="form-group">
            <label className="form-label">Header Logosu — Koyu Tema (Network)</label>
            <input className="form-input" value={settings.logoHeaderDark} onChange={(e) => setField('logoHeaderDark', e.target.value)} placeholder="/site/logo-dark.png" />
            <LogoPreview src={settings.logoHeaderDark} dark />
          </div>
          <div className="form-group">
            <label className="form-label">Header Logosu — Açık Tema (Truva)</label>
            <input className="form-input" value={settings.logoHeaderLight} onChange={(e) => setField('logoHeaderLight', e.target.value)} placeholder="/site/logo-light.png" />
            <LogoPreview src={settings.logoHeaderLight} dark={false} />
          </div>
          <div className="form-group">
            <label className="form-label">Footer Logosu</label>
            <input className="form-input" value={settings.logoFooter} onChange={(e) => setField('logoFooter', e.target.value)} placeholder="/site/logo-dark.png" />
            <LogoPreview src={settings.logoFooter} dark />
          </div>
        </div>

        {/* ── Footer & telif + harita ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>⚖️ Footer & Telif</div>
          <div className="form-group">
            <label className="form-label">Telif Metni</label>
            <input
              className="form-input"
              value={settings.copyrightText}
              onChange={(e) => setField('copyrightText', e.target.value)}
              placeholder={`Boş bırak = otomatik "© ${new Date().getFullYear()} Çanakkale Network — Tüm hakları saklıdır."`}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Boş bırakılırsa yıl her sene otomatik güncellenir.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Footer Alt Satırı (Credit)</label>
            <input
              className="form-input"
              value={settings.footerCredit}
              onChange={(e) => setField('footerCredit', e.target.value)}
              placeholder="Bir Condia Media yapımıdır."
            />
          </div>

          <div style={{ fontWeight: 600, margin: 'var(--space-4) 0' }}>🗺️ Harita (İletişim Sayfası)</div>
          <div className="form-group">
            <label className="form-label">Google Maps Embed URL</label>
            <input
              className="form-input"
              value={settings.mapsEmbedUrl}
              onChange={(e) => setField('mapsEmbedUrl', e.target.value)}
              placeholder="https://maps.google.com/maps?q=...&output=embed"
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              Google Maps &gt; Paylaş &gt; Harita yerleştir&apos;deki iframe <code>src</code> adresi.
            </p>
          </div>
          {/* GÜVENLİK: önizleme de yalnız doğrulanmış Google Maps URL'iyle render edilir */}
          {isSafeMapsEmbedUrl(settings.mapsEmbedUrl) && (
            <iframe
              src={settings.mapsEmbedUrl}
              title="Harita önizleme"
              loading="lazy"
              style={{ width: '100%', height: 160, border: '1px solid var(--border)', borderRadius: 'var(--border-radius)' }}
            />
          )}
        </div>

        {/* ── Anasayfa istatistik bandı ── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>📊 Anasayfa İstatistik Bandı</div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            Anasayfadaki sayaç şeridi. Otomatik modda değerler veritabanından hesaplanır.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              <input type="radio" name="statsMode" checked={settings.statsMode === 'auto'} onChange={() => setField('statsMode', 'auto')} />
              Otomatik
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              <input type="radio" name="statsMode" checked={settings.statsMode === 'manual'} onChange={() => setField('statsMode', 'manual')} />
              Manuel
            </label>
          </div>

          {settings.statsMode === 'manual' && (
            <div>
              {settings.statsManual.length === 0 && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  Henüz satır yok — &quot;Satır Ekle&quot; ile başlayın.
                </p>
              )}
              {settings.statsManual.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="Etiket (ör. Aylık Okuyucu)"
                    value={s.label}
                    onChange={(e) => patchStat(i, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 96 }}
                    placeholder="Değer"
                    value={Number.isFinite(s.value) ? s.value : 0}
                    onChange={(e) => patchStat(i, { value: parseFloat(e.target.value) || 0 })}
                  />
                  <input
                    className="form-input"
                    style={{ width: 64 }}
                    placeholder="+, K..."
                    title="Ek (ör. +, K, bin)"
                    value={s.suffix || ''}
                    onChange={(e) => patchStat(i, { suffix: e.target.value })}
                  />
                  <button className="btn btn-ghost btn-sm" title="Yukarı taşı" disabled={i === 0} onClick={() => moveStat(i, -1)}>↑</button>
                  <button className="btn btn-ghost btn-sm" title="Aşağı taşı" disabled={i === settings.statsManual.length - 1} onClick={() => moveStat(i, 1)}>↓</button>
                  <button className="btn btn-ghost btn-sm" title="Satırı sil" onClick={() => removeStat(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={addStat} disabled={settings.statsManual.length >= 12}>
                ➕ Satır Ekle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Künye & ekip vitrini ── */}
      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <div style={{ fontWeight: 600 }}>📇 Künye & Ekip Vitrini</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {kunyeStatus === 'exists' && (
              <Link href="/site-yonetimi/sayfalar" className="btn btn-ghost btn-sm">📄 Künye içeriğini düzenle</Link>
            )}
            {kunyeStatus === 'missing' && (
              <button className="btn btn-primary btn-sm" disabled={kunyeBusy} onClick={createKunyePage}>
                {kunyeBusy ? 'Oluşturuluyor...' : '➕ Künye sayfası oluştur'}
              </button>
            )}
            <button className="btn btn-primary btn-sm" disabled={teamSaving} onClick={handleSaveTeam}>
              {teamSaving ? 'Kaydediliyor...' : '💾 Ekibi Kaydet'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          Künye metni <Link href="/site-yonetimi/sayfalar" style={{ color: 'var(--primary-light)' }}>Sayfalar</Link> editöründeki
          {' '}<code>kunye</code> sayfasından düzenlenir. Aşağıdaki ekip listesi ise Hakkımızda sayfasındaki ekip bölümünü besler
          ve ayrı kaydedilir (&quot;Ekibi Kaydet&quot;).
        </p>

        {teamMsg && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: teamMsg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: teamMsg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            {teamMsg.text}
          </div>
        )}

        {team.groups.length === 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            Henüz grup yok — &quot;Grup Ekle&quot; ile başlayın (ör. &quot;Yönetim&quot;, &quot;Muhabirler&quot;).
          </p>
        )}

        {team.groups.map((g, gi) => (
          <div key={gi} className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)', background: 'var(--bg-secondary, transparent)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <input
                className="form-input"
                style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                placeholder="Grup başlığı (ör. Yönetim)"
                value={g.title}
                onChange={(e) => patchGroup(gi, { title: e.target.value })}
              />
              <button className="btn btn-ghost btn-sm" title="Yukarı taşı" disabled={gi === 0} onClick={() => moveGroup(gi, -1)}>↑</button>
              <button className="btn btn-ghost btn-sm" title="Aşağı taşı" disabled={gi === team.groups.length - 1} onClick={() => moveGroup(gi, 1)}>↓</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (g.members.length === 0 || confirm(`"${g.title || 'Adsız grup'}" ve ${g.members.length} üyesi silinsin mi?`)) {
                    setTeam((prev) => ({ groups: prev.groups.filter((_, idx) => idx !== gi) }));
                  }
                }}
              >
                Grubu Sil
              </button>
            </div>

            {g.members.map((m, mi) => (
              <div key={mi} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Ad Soyad"
                  value={m.name}
                  onChange={(e) => patchMember(gi, mi, { name: e.target.value })}
                />
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Görev (ör. Genel Yayın Yönetmeni)"
                  value={m.role}
                  onChange={(e) => patchMember(gi, mi, { role: e.target.value })}
                />
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Fotoğraf URL (opsiyonel)"
                  value={m.photoUrl || ''}
                  onChange={(e) => patchMember(gi, mi, { photoUrl: e.target.value })}
                />
                <button className="btn btn-ghost btn-sm" title="Yukarı taşı" disabled={mi === 0} onClick={() => moveMember(gi, mi, -1)}>↑</button>
                <button className="btn btn-ghost btn-sm" title="Aşağı taşı" disabled={mi === g.members.length - 1} onClick={() => moveMember(gi, mi, 1)}>↓</button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Üyeyi sil"
                  onClick={() => patchGroup(gi, { members: g.members.filter((_, idx) => idx !== mi) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => patchGroup(gi, { members: [...g.members, { name: '', role: '' }] })}
            >
              ➕ Üye Ekle
            </button>
          </div>
        ))}

        <button
          className="btn btn-ghost btn-sm"
          disabled={team.groups.length >= 30}
          onClick={() => setTeam((prev) => ({ groups: [...prev.groups, { title: '', members: [] }] }))}
        >
          ➕ Grup Ekle
        </button>
      </div>

      {/* ── Kategoriler ── */}
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>🗂️ Kategoriler</div>

        {catMsg && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: catMsg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: catMsg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
            {catMsg.text}
          </div>
        )}

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Ad</th>
                <th>Renk</th>
                <th>Sıra</th>
                <th>Nav&apos;da</th>
                <th>Makale</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.slug} style={{ opacity: catBusy === c.slug ? 0.5 : 1 }}>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{c.slug}</td>
                  <td>
                    <input className="form-input" style={{ minWidth: 140 }} value={c.name} onChange={(e) => patchCategory(c.slug, { name: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="color"
                      value={c.color || '#5c6b82'}
                      onChange={(e) => patchCategory(c.slug, { color: e.target.value })}
                      style={{ width: 42, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 70 }}
                      value={c.order}
                      onChange={(e) => patchCategory(c.slug, { order: parseInt(e.target.value, 10) || 0 })}
                    />
                  </td>
                  <td>
                    <input type="checkbox" checked={c.showInNav} onChange={(e) => patchCategory(c.slug, { showInNav: e.target.checked })} />
                  </td>
                  <td>{c.articleCount}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" disabled={catBusy === c.slug} onClick={() => saveCategory(c)}>💾 Kaydet</button>
                    <button className="btn btn-ghost btn-sm" disabled={catBusy === c.slug} onClick={() => deleteCategory(c)}>Sil</button>
                  </td>
                </tr>
              ))}
              {/* Yeni kategori satırı */}
              <tr>
                <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>(otomatik)</td>
                <td>
                  <input
                    className="form-input"
                    style={{ minWidth: 140 }}
                    placeholder="Yeni kategori adı"
                    value={newCat.name}
                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    value={newCat.color}
                    onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                    style={{ width: 42, height: 30, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                </td>
                <td colSpan={3} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>sona eklenir</td>
                <td>
                  <button className="btn btn-primary btn-sm" disabled={catBusy === 'new' || !newCat.name.trim()} onClick={addCategory}>
                    ➕ Ekle
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
