'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { SiteSettings } from '@/lib/site'; // yalnızca tip — derlemede silinir

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

export default function SiteAyarlarPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const [newCat, setNewCat] = useState({ name: '', color: '#5c6b82' });
  const [catBusy, setCatBusy] = useState<string | null>(null);
  const [catMsg, setCatMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

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
    ])
      .then(([s]) => { if (s) setSettings(s); })
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
      const res = await fetch('/api/site-admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      setMsg({ kind: 'success', text: 'Site ayarları kaydedildi ✓' });
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
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
