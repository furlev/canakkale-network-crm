'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/**
 * Görüntülenme Takviyesi — GLOBAL ayar sayfası (B/A).
 *
 * Sitede gösterilen görüntülenme sayısına eklenen deterministik "sanal" takviyeyi
 * yönetir (hesap: src/lib/view-boost.ts, API: /api/site-admin/view-boost).
 * Takviye YALNIZ sitede gösterilen sayıyı etkiler; gerçek ölçüm (SiteArticle.views)
 * CRM analitiğinde değişmeden durur. Habere özel istisnalar haber editöründedir.
 */

type BoostSettings = { enabled: boolean; dailyMin: number; dailyMax: number };
type BoostSample = {
  id: string;
  title: string;
  realViews: number;
  boostedViews: number;
  publishedAt: string | null;
} | null;

export default function GoruntulenmePage() {
  const [settings, setSettings] = useState<BoostSettings | null>(null);
  const [sample, setSample] = useState<BoostSample>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/site-admin/view-boost')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings as BoostSettings);
          setSample((data.sample as BoostSample) ?? null);
        } else {
          setMsg({ kind: 'error', text: 'Ayarlar yüklenemedi (bu sayfa için Ekip Lideri/Yönetici yetkisi gerekir).' });
        }
      })
      .catch(() => setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' }))
      .finally(() => setLoading(false));
  }, []);

  const setField = <K extends keyof BoostSettings>(key: K, value: BoostSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  /** Başka bir yayınlanmış haberden yeni örnek çek (ayar kaydetmeden). */
  const refreshSample = useCallback(async () => {
    setSampling(true);
    try {
      const res = await fetch('/api/site-admin/view-boost');
      const data = await res.json().catch(() => null);
      if (res.ok && data) setSample((data.sample as BoostSample) ?? null);
    } catch { /* örnek eski kalır */ } finally {
      setSampling(false);
    }
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    if (settings.dailyMax < settings.dailyMin) {
      setMsg({ kind: 'error', text: 'Günlük üst sınır alt sınırdan küçük olamaz.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/site-admin/view-boost', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız oldu.' });
        return;
      }
      if (data?.settings) setSettings(data.settings as BoostSettings);
      setSample((data?.sample as BoostSample) ?? null);
      setMsg({ kind: 'success', text: 'Görüntülenme takviyesi ayarları kaydedildi ✓' });
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👁️ Görüntülenme Takviyesi</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {' '}· sitede gösterilen görüntülenme sayısının takviyesi
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" disabled={saving || !settings} onClick={handleSave}>
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {msg.text}
        </div>
      )}

      {settings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* ── Ayarlar ── */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>⚙️ Genel Ayar</div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              <input type="checkbox" checked={settings.enabled} onChange={(e) => setField('enabled', e.target.checked)} />
              Takviye aktif (tüm yayınlanmış haberlerde)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label">Günlük en az</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  value={settings.dailyMin}
                  onChange={(e) => setField('dailyMin', Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Günlük en çok</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  value={settings.dailyMax}
                  onChange={(e) => setField('dailyMax', Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 var(--space-2)' }}>
                <strong>Takviye yalnız sitede gösterilen sayıyı etkiler; gerçek ölçüm CRM
                analitiğinde ayrı durur.</strong>
              </p>
              <p style={{ margin: '0 0 var(--space-2)' }}>
                Her haber, yayın tarihinden itibaren her gün bu aralıktan deterministik bir artış
                alır: yeni haber hızlı (ilk günler ×1.6), eski haber yavaş (30+ gün ×0.12) büyür;
                gün içinde sayı 09-23 saatleri arasında hızlı, gece yavaş akar. Aynı haber için
                herkes aynı sayıyı görür ve sayı asla azalmaz — cron/veritabanı yazımı yoktur.
              </p>
              <p style={{ margin: 0 }}>
                Habere özel istisna (kapalı / özel aralık) haber editöründeki
                “Görüntülenme Takviyesi” bölümünden ayarlanır.
              </p>
            </div>
          </div>

          {/* ── Örnek önizleme ── */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ fontWeight: 600 }}>🔍 Örnek Önizleme</div>
              <button className="btn btn-ghost btn-sm" disabled={sampling} onClick={refreshSample}>
                {sampling ? 'Yükleniyor...' : '🎲 Başka haber'}
              </button>
            </div>

            {sample ? (
              <>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  {sample.title}
                </div>
                {sample.publishedAt && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                    Yayın: {new Date(sample.publishedAt).toLocaleString('tr-TR')}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Gerçek (CRM analitiği)</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{sample.realViews.toLocaleString('tr-TR')}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: 'rgba(0,184,148,0.10)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Takviyeli (sitede görünen)</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--success)' }}>{sample.boostedViews.toLocaleString('tr-TR')}</div>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                  Önizleme, kayıtlı genel aralıkla “takviye açık olsaydı” değerini gösterir
                  (haberin kendi istisnası dikkate alınmaz). Ayar kapalıyken sitede gerçek sayı görünür.
                </p>
              </>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                Önizleme için yayınlanmış haber bulunamadı.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
