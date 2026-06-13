'use client';
import { useState, useEffect } from 'react';

const sections = [
  { key: 'account', icon: '👤', label: 'Hesap' },
  { key: 'general', icon: '⚙️', label: 'Genel' },
  { key: 'company', icon: '🏢', label: 'Şirket Bilgileri' },
  { key: 'wordpress', icon: '🔗', label: 'WordPress' },
  { key: 'email', icon: '📧', label: 'E-posta' },
  { key: 'notifications', icon: '🔔', label: 'Bildirimler' },
  { key: 'api', icon: '🔑', label: 'API' },
  { key: 'appearance', icon: '🎨', label: 'Görünüm' },
];

const NOTIFICATION_ITEMS = [
  'Yeni ihbar geldiğinde',
  'Fatura ödendiğinde',
  'Proje tamamlandığında',
  'Yeni müşteri eklendiğinde',
  'Görev atandığında',
  "WordPress'te yeni haber yayınlandığında",
  'Sözleşme süresi dolmak üzereyken',
];

const defaults = {
  general: {
    siteName: 'Çanakkale Network CRM',
    siteUrl: 'https://crm.canakkale.network',
    language: 'Türkçe',
    timezone: 'Europe/Istanbul (UTC+3)',
    currency: 'TRY (₺)',
  },
  company: {
    name: 'Çanakkale Network Medya Ltd.',
    address: 'Çanakkale Merkez, İstiklal Cad. No:42',
    phone: '+90 286 111 2233',
    email: 'info@canakkale.network',
    taxNo: '1234567890',
  },
  wordpress: {
    url: 'https://canakkale.network',
    endpoint: '/wp-json/cn-crm/v1',
    apiKey: '',
    autoFetch: true,
    newPostNotify: true,
  },
  email: {
    tipEmail: 'ihbar@canakkale.network',
    imapServer: 'mail.canakkale.network',
    imapPort: '993',
    encryption: 'SSL/TLS',
    checkInterval: 'Her 5 dakika',
    smtpServer: 'smtp.canakkale.network',
    smtpPort: '587',
    smtpUser: 'crm@canakkale.network',
  },
  notifications: [true, true, true, true, true, false, false],
  ai: {
    apiKey: '',
  },
};

type Settings = typeof defaults;

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 48, height: 24, borderRadius: 12, background: on ? 'var(--success)' : 'var(--surface-3)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 26 : 2, transition: 'left 0.2s' }} />
    </div>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState('general');
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [wpBusy, setWpBusy] = useState(false);
  const [wpStatus, setWpStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async () => {
    setPwStatus(null);
    if (pwForm.newPassword.length < 8) {
      setPwStatus({ ok: false, text: '❌ Yeni şifre en az 8 karakter olmalı' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwStatus({ ok: false, text: '❌ Yeni şifreler eşleşmiyor' });
      return;
    }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwStatus({ ok: true, text: '✅ Şifreniz güncellendi' });
        setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      } else {
        setPwStatus({ ok: false, text: `❌ ${data.error || 'Şifre değiştirilemedi'}` });
      }
    } catch {
      setPwStatus({ ok: false, text: '❌ Sunucuya ulaşılamadı' });
    }
  };

  const testWordPress = async () => {
    setWpBusy(true);
    setWpStatus(null);
    try {
      // Kaydedilmemiş alanlarla test etmemek için önce mevcut formu kaydet
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'wordpress', value: settings.wordpress }),
      });
      const res = await fetch('/api/wordpress/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const extra = data.stats ? ` — ${data.stats.total_published} yayında, ${data.stats.this_week} bu hafta` : '';
        setWpStatus({ ok: true, text: `✅ ${data.message}: ${data.site}${extra}` });
      } else {
        setWpStatus({ ok: false, text: `❌ ${data.error || 'Bağlantı kurulamadı'}` });
      }
    } catch {
      setWpStatus({ ok: false, text: '❌ Sunucuya ulaşılamadı' });
    } finally {
      setWpBusy(false);
    }
  };

  const syncWordPress = async () => {
    setWpBusy(true);
    setWpStatus(null);
    try {
      const res = await fetch('/api/wordpress/sync', { method: 'POST' });
      const data = await res.json();
      setWpStatus(res.ok
        ? { ok: true, text: `✅ ${data.message}` }
        : { ok: false, text: `❌ ${data.error || 'Senkronizasyon başarısız'}` });
    } catch {
      setWpStatus({ ok: false, text: '❌ Sunucuya ulaşılamadı' });
    } finally {
      setWpBusy(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({
          general: { ...defaults.general, ...(data.general || {}) },
          company: { ...defaults.company, ...(data.company || {}) },
          wordpress: { ...defaults.wordpress, ...(data.wordpress || {}) },
          email: { ...defaults.email, ...(data.email || {}) },
          notifications: Array.isArray(data.notifications) ? data.notifications : defaults.notifications,
          ai: { ...defaults.ai, ...(data.ai || {}) },
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching settings:', err);
        setLoading(false);
      });
  }, []);

  const saveSection = async (key: keyof Settings) => {
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: settings[key] }),
      });
      if (res.ok) {
        setSavedMsg('✅ Kaydedildi');
        setTimeout(() => setSavedMsg(''), 2500);
      } else {
        setSavedMsg('❌ Kaydedilemedi');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSavedMsg('❌ Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Settings>(section: K, value: Settings[K]) =>
    setSettings({ ...settings, [section]: value });

  const SaveBtn = ({ section }: { section: keyof Settings }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <button className="btn btn-primary" disabled={saving} onClick={() => saveSection(section)}>
        💾 {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
      {savedMsg && <span style={{ fontSize: 'var(--text-sm)' }}>{savedMsg}</span>}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">⚙️ Ayarlar</h1>
          <p className="page-subtitle">Sistem ayarlarını yönetin</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-3)', height: 'fit-content' }}>
          {sections.map(s => (
            <div key={s.key} onClick={() => { setActive(s.key); setSavedMsg(''); }} className="sidebar-link" style={{ cursor: 'pointer' }} data-active={active === s.key ? 'true' : undefined}>
              <span className="sidebar-link-icon">{s.icon}</span>
              <span className="sidebar-link-text">{s.label}</span>
              {active === s.key && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: '60%', background: 'var(--primary-gradient)', borderRadius: '0 4px 4px 0' }} />}
            </div>
          ))}
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
          ) : (
            <>
              {active === 'account' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Hesap — Şifre Değiştir</h3>
                  <div className="form-group">
                    <label className="form-label">Mevcut Şifre</label>
                    <input type="password" className="form-input" autoComplete="current-password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Yeni Şifre</label>
                      <input type="password" className="form-input" autoComplete="new-password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Yeni Şifre (Tekrar)</label>
                      <input type="password" className="form-input" autoComplete="new-password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                    </div>
                  </div>
                  {pwStatus && (
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: pwStatus.ok ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: pwStatus.ok ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                      {pwStatus.text}
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={changePassword}>🔑 Şifreyi Güncelle</button>
                </>
              )}

              {active === 'general' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Genel Ayarlar</h3>
                  <div className="form-group"><label className="form-label">Site Adı</label><input className="form-input" value={settings.general.siteName} onChange={e => set('general', { ...settings.general, siteName: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Site URL</label><input className="form-input" value={settings.general.siteUrl} onChange={e => set('general', { ...settings.general, siteUrl: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Dil</label>
                    <select className="form-select" value={settings.general.language} onChange={e => set('general', { ...settings.general, language: e.target.value })}>
                      <option>Türkçe</option><option>English</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Saat Dilimi</label>
                    <select className="form-select" value={settings.general.timezone} onChange={e => set('general', { ...settings.general, timezone: e.target.value })}>
                      <option>Europe/Istanbul (UTC+3)</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Para Birimi</label>
                    <select className="form-select" value={settings.general.currency} onChange={e => set('general', { ...settings.general, currency: e.target.value })}>
                      <option>TRY (₺)</option><option>USD ($)</option><option>EUR (€)</option>
                    </select>
                  </div>
                  <SaveBtn section="general" />
                </>
              )}

              {active === 'company' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Şirket Bilgileri</h3>
                  <div className="form-group"><label className="form-label">Şirket Adı</label><input className="form-input" value={settings.company.name} onChange={e => set('company', { ...settings.company, name: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Adres</label><textarea className="form-textarea" rows={2} value={settings.company.address} onChange={e => set('company', { ...settings.company, address: e.target.value })} /></div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={settings.company.phone} onChange={e => set('company', { ...settings.company, phone: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">E-posta</label><input className="form-input" value={settings.company.email} onChange={e => set('company', { ...settings.company, email: e.target.value })} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Vergi No</label><input className="form-input" value={settings.company.taxNo} onChange={e => set('company', { ...settings.company, taxNo: e.target.value })} /></div>
                  <SaveBtn section="company" />
                </>
              )}

              {active === 'wordpress' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>WordPress Entegrasyonu</h3>
                  <div className="form-group"><label className="form-label">WordPress URL</label><input className="form-input" value={settings.wordpress.url} onChange={e => set('wordpress', { ...settings.wordpress, url: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">API Endpoint</label><input className="form-input" value={settings.wordpress.endpoint} onChange={e => set('wordpress', { ...settings.wordpress, endpoint: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">API Anahtarı</label><input className="form-input" type="password" placeholder="API anahtarınızı girin..." value={settings.wordpress.apiKey} onChange={e => set('wordpress', { ...settings.wordpress, apiKey: e.target.value })} /></div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <button className="btn btn-ghost" disabled={wpBusy} onClick={testWordPress}>🔄 {wpBusy ? 'Bekleyin...' : 'Bağlantıyı Test Et'}</button>
                    <button className="btn btn-ghost" disabled={wpBusy} onClick={syncWordPress}>📥 Haberleri Senkronize Et</button>
                  </div>
                  {wpStatus && (
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: wpStatus.ok ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: wpStatus.ok ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                      {wpStatus.text}
                    </div>
                  )}
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Senkronizasyon Ayarları</h4>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>Otomatik haber çekme</span>
                    <Toggle on={settings.wordpress.autoFetch} onToggle={() => set('wordpress', { ...settings.wordpress, autoFetch: !settings.wordpress.autoFetch })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>Yeni haber bildirimi</span>
                    <Toggle on={settings.wordpress.newPostNotify} onToggle={() => set('wordpress', { ...settings.wordpress, newPostNotify: !settings.wordpress.newPostNotify })} />
                  </div>
                  <SaveBtn section="wordpress" />
                </>
              )}

              {active === 'email' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>E-posta Ayarları</h3>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--primary-light)' }}>İhbar Mail Konfigürasyonu</h4>
                  <div className="form-group"><label className="form-label">İhbar E-posta</label><input className="form-input" value={settings.email.tipEmail} onChange={e => set('email', { ...settings.email, tipEmail: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">IMAP Sunucu</label><input className="form-input" value={settings.email.imapServer} onChange={e => set('email', { ...settings.email, imapServer: e.target.value })} /></div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Port</label><input className="form-input" value={settings.email.imapPort} onChange={e => set('email', { ...settings.email, imapPort: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Şifreleme</label>
                      <select className="form-select" value={settings.email.encryption} onChange={e => set('email', { ...settings.email, encryption: e.target.value })}>
                        <option>SSL/TLS</option><option>STARTTLS</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Kontrol Sıklığı</label>
                    <select className="form-select" value={settings.email.checkInterval} onChange={e => set('email', { ...settings.email, checkInterval: e.target.value })}>
                      <option>Her 5 dakika</option><option>Her 15 dakika</option><option>Her 30 dakika</option><option>Her saat</option>
                    </select>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-6) 0' }} />
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--primary-light)' }}>SMTP Ayarları (Giden Mail)</h4>
                  <div className="form-group"><label className="form-label">SMTP Sunucu</label><input className="form-input" value={settings.email.smtpServer} onChange={e => set('email', { ...settings.email, smtpServer: e.target.value })} /></div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Port</label><input className="form-input" value={settings.email.smtpPort} onChange={e => set('email', { ...settings.email, smtpPort: e.target.value })} /></div>
                    <div className="form-group"><label className="form-label">Kullanıcı</label><input className="form-input" value={settings.email.smtpUser} onChange={e => set('email', { ...settings.email, smtpUser: e.target.value })} /></div>
                  </div>
                  <SaveBtn section="email" />
                </>
              )}

              {active === 'notifications' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Bildirim Ayarları</h3>
                  {NOTIFICATION_ITEMS.map((item, i) => (
                    <div key={i} className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 'var(--text-sm)' }}>{item}</span>
                      <Toggle
                        on={settings.notifications[i] ?? false}
                        onToggle={() => {
                          const next = [...settings.notifications];
                          next[i] = !next[i];
                          set('notifications', next);
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <SaveBtn section="notifications" />
                  </div>
                </>
              )}

              {active === 'api' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>API & Entegrasyonlar</h3>
                  <div className="form-group">
                    <label className="form-label">CRM API Anahtarı</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input className="form-input" readOnly value="crm_sk_xxxxxxxxxxxxxxxxxxxxxxxxx" type={showApiKey ? 'text' : 'password'} style={{ flex: 1, fontFamily: 'var(--font-mono)' }} />
                      <button className="btn btn-ghost" onClick={() => setShowApiKey(!showApiKey)}>👁️</button>
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-6) 0' }} />
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--primary-light)' }}>🤖 AI Entegrasyonu (Gemini)</h4>
                  <div style={{ padding: 'var(--space-4)', background: 'var(--surface-2)', borderRadius: 'var(--border-radius)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-lg)' }}>🧠</span>
                      <span style={{ fontWeight: 600 }}>Google Gemini 3.5 Flash</span>
                      <span className="badge badge-success">Aktif</span>
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>API anahtarını girince ihbar analizi, otomatik önceliklendirme ve haber taslağı üretimi aktifleşir. Anahtar <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)' }}>aistudio.google.com</a> üzerinden alınır.</p>
                  </div>
                  <div className="form-group"><label className="form-label">AI Provider</label>
                    <select className="form-select" disabled>
                      <option>Google Gemini (3.5 Flash)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gemini API Anahtarı</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="AIzaSy..."
                      value={settings.ai.apiKey}
                      onChange={e => set('ai', { ...settings.ai, apiKey: e.target.value })}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>Sunucu ortamında <code>GEMINI_API_KEY</code> tanımlıysa o öncelikli kullanılır; bu alanı boş bırakabilirsiniz.</p>
                  </div>
                  <SaveBtn section="ai" />
                </>
              )}

              {active === 'appearance' && (
                <>
                  <h3 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>Görünüm Ayarları</h3>
                  <div className="form-group">
                    <label className="form-label">Tema</label>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <div style={{ flex: 1, padding: 'var(--space-4)', background: 'var(--surface-3)', borderRadius: 'var(--border-radius)', border: '2px solid var(--primary)', cursor: 'pointer', textAlign: 'center' }}>
                        <span style={{ fontSize: 'var(--text-xl)' }}>🌙</span><div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>Koyu Tema</div>
                      </div>
                      <div style={{ flex: 1, padding: 'var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-subtle)', textAlign: 'center', opacity: 0.5 }}>
                        <span style={{ fontSize: 'var(--text-xl)' }}>☀️</span><div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>Açık Tema (Yakında)</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
