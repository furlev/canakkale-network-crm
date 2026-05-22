'use client';
import { useState } from 'react';

const sections = [
  {key:'general',icon:'⚙️',label:'Genel'},
  {key:'company',icon:'🏢',label:'Şirket Bilgileri'},
  {key:'wordpress',icon:'🔗',label:'WordPress'},
  {key:'email',icon:'📧',label:'E-posta'},
  {key:'notifications',icon:'🔔',label:'Bildirimler'},
  {key:'api',icon:'🔑',label:'API'},
  {key:'appearance',icon:'🎨',label:'Görünüm'},
];

export default function SettingsPage() {
  const [active, setActive] = useState('general');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">⚙️ Ayarlar</h1>
          <p className="page-subtitle">Sistem ayarlarını yönetin</p>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'var(--space-6)'}}>
        <div className="card" style={{padding:'var(--space-3)',height:'fit-content'}}>
          {sections.map(s=>(
            <div key={s.key} onClick={()=>setActive(s.key)} className="sidebar-link" style={{cursor:'pointer'}} data-active={active===s.key?'true':undefined}>
              <span className="sidebar-link-icon">{s.icon}</span>
              <span className="sidebar-link-text">{s.label}</span>
              {active===s.key && <div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:'60%',background:'var(--primary-gradient)',borderRadius:'0 4px 4px 0'}} />}
            </div>
          ))}
        </div>

        <div className="card">
          {active === 'general' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>Genel Ayarlar</h3>
              <div className="form-group"><label className="form-label">Site Adı</label><input className="form-input" defaultValue="Çanakkale Network CRM" /></div>
              <div className="form-group"><label className="form-label">Site URL</label><input className="form-input" defaultValue="https://crm.canakkale.network" /></div>
              <div className="form-group"><label className="form-label">Dil</label><select className="form-select"><option>Türkçe</option><option>English</option></select></div>
              <div className="form-group"><label className="form-label">Saat Dilimi</label><select className="form-select"><option>Europe/Istanbul (UTC+3)</option></select></div>
              <div className="form-group"><label className="form-label">Para Birimi</label><select className="form-select"><option>TRY (₺)</option><option>USD ($)</option><option>EUR (€)</option></select></div>
              <button className="btn btn-primary">💾 Kaydet</button>
            </>
          )}

          {active === 'company' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>Şirket Bilgileri</h3>
              <div className="form-group"><label className="form-label">Şirket Adı</label><input className="form-input" defaultValue="Çanakkale Network Medya Ltd." /></div>
              <div className="form-group"><label className="form-label">Adres</label><textarea className="form-textarea" defaultValue="Çanakkale Merkez, İstiklal Cad. No:42" rows={2} /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" defaultValue="+90 286 111 2233" /></div>
                <div className="form-group"><label className="form-label">E-posta</label><input className="form-input" defaultValue="info@canakkale.network" /></div>
              </div>
              <div className="form-group"><label className="form-label">Vergi No</label><input className="form-input" defaultValue="1234567890" /></div>
              <button className="btn btn-primary">💾 Kaydet</button>
            </>
          )}

          {active === 'wordpress' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>WordPress Entegrasyonu</h3>
              <div style={{padding:'var(--space-4)',background:'var(--success-bg)',borderRadius:'var(--border-radius)',marginBottom:'var(--space-6)',display:'flex',alignItems:'center',gap:'var(--space-3)'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:'var(--success)'}} />
                <span style={{fontSize:'var(--text-sm)',color:'var(--success)'}}>WordPress bağlantısı aktif</span>
              </div>
              <div className="form-group"><label className="form-label">WordPress URL</label><input className="form-input" defaultValue="https://canakkale.network" /></div>
              <div className="form-group"><label className="form-label">API Endpoint</label><input className="form-input" defaultValue="/wp-json/cn-crm/v1" /></div>
              <div className="form-group"><label className="form-label">API Anahtarı</label><input className="form-input" type="password" defaultValue="sk_live_xxxxxxxxxxxxx" /></div>
              <div style={{display:'flex',gap:'var(--space-3)',marginBottom:'var(--space-6)'}}>
                <button className="btn btn-ghost">🔄 Bağlantıyı Test Et</button>
                <button className="btn btn-ghost">📥 Haberleri Senkronize Et</button>
              </div>
              <h4 style={{fontSize:'var(--text-sm)',fontWeight:600,marginBottom:'var(--space-3)'}}>Senkronizasyon Ayarları</h4>
              <div className="form-group" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'var(--text-sm)'}}>Otomatik haber çekme</span>
                <div style={{width:48,height:24,borderRadius:12,background:'var(--success)',cursor:'pointer',position:'relative'}}><div style={{width:20,height:20,borderRadius:'50%',background:'white',position:'absolute',top:2,right:2,transition:'all 0.2s'}} /></div>
              </div>
              <div className="form-group" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'var(--text-sm)'}}>Yeni haber bildirimi</span>
                <div style={{width:48,height:24,borderRadius:12,background:'var(--success)',cursor:'pointer',position:'relative'}}><div style={{width:20,height:20,borderRadius:'50%',background:'white',position:'absolute',top:2,right:2}} /></div>
              </div>
              <button className="btn btn-primary">💾 Kaydet</button>
            </>
          )}

          {active === 'email' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>E-posta Ayarları</h3>
              <h4 style={{fontSize:'var(--text-sm)',fontWeight:600,marginBottom:'var(--space-4)',color:'var(--primary-light)'}}>İhbar Mail Konfigürasyonu</h4>
              <div className="form-group"><label className="form-label">İhbar E-posta</label><input className="form-input" defaultValue="ihbar@canakkale.network" /></div>
              <div className="form-group"><label className="form-label">IMAP Sunucu</label><input className="form-input" defaultValue="mail.canakkale.network" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Port</label><input className="form-input" defaultValue="993" /></div>
                <div className="form-group"><label className="form-label">Şifreleme</label><select className="form-select"><option>SSL/TLS</option><option>STARTTLS</option></select></div>
              </div>
              <div className="form-group"><label className="form-label">Kontrol Sıklığı</label><select className="form-select"><option>Her 5 dakika</option><option>Her 15 dakika</option><option>Her 30 dakika</option><option>Her saat</option></select></div>
              <hr style={{border:'none',borderTop:'1px solid var(--border-subtle)',margin:'var(--space-6) 0'}} />
              <h4 style={{fontSize:'var(--text-sm)',fontWeight:600,marginBottom:'var(--space-4)',color:'var(--primary-light)'}}>SMTP Ayarları (Giden Mail)</h4>
              <div className="form-group"><label className="form-label">SMTP Sunucu</label><input className="form-input" defaultValue="smtp.canakkale.network" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Port</label><input className="form-input" defaultValue="587" /></div>
                <div className="form-group"><label className="form-label">Kullanıcı</label><input className="form-input" defaultValue="crm@canakkale.network" /></div>
              </div>
              <button className="btn btn-primary">💾 Kaydet</button>
            </>
          )}

          {active === 'notifications' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>Bildirim Ayarları</h3>
              {['Yeni ihbar geldiğinde','Fatura ödendiğinde','Proje tamamlandığında','Yeni müşteri eklendiğinde','Görev atandığında','WordPress\'te yeni haber yayınlandığında','Sözleşme süresi dolmak üzereyken'].map((item,i)=>(
                <div key={i} className="form-group" style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:'var(--space-3)',borderBottom:'1px solid var(--border-subtle)'}}>
                  <span style={{fontSize:'var(--text-sm)'}}>{item}</span>
                  <div style={{width:48,height:24,borderRadius:12,background:i<5?'var(--success)':'var(--surface-3)',cursor:'pointer',position:'relative'}}>
                    <div style={{width:20,height:20,borderRadius:'50%',background:'white',position:'absolute',top:2,left:i<5?'auto':2,right:i<5?2:'auto',transition:'all 0.2s'}} />
                  </div>
                </div>
              ))}
              <button className="btn btn-primary" style={{marginTop:'var(--space-4)'}}>💾 Kaydet</button>
            </>
          )}

          {active === 'api' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>API & Entegrasyonlar</h3>
              <div className="form-group">
                <label className="form-label">CRM API Anahtarı</label>
                <div style={{display:'flex',gap:'var(--space-2)'}}>
                  <input className="form-input" defaultValue="crm_sk_xxxxxxxxxxxxxxxxxxxxxxxxx" type="password" style={{flex:1,fontFamily:'var(--font-mono)'}} />
                  <button className="btn btn-ghost">👁️</button>
                  <button className="btn btn-ghost">🔄 Yenile</button>
                </div>
              </div>
              <hr style={{border:'none',borderTop:'1px solid var(--border-subtle)',margin:'var(--space-6) 0'}} />
              <h4 style={{fontSize:'var(--text-sm)',fontWeight:600,marginBottom:'var(--space-4)',color:'var(--primary-light)'}}>🤖 AI Entegrasyonu (Yakında)</h4>
              <div style={{padding:'var(--space-4)',background:'var(--surface-2)',borderRadius:'var(--border-radius)',marginBottom:'var(--space-4)'}}>
                <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)',marginBottom:'var(--space-2)'}}>
                  <span style={{fontSize:'var(--text-lg)'}}>🧠</span>
                  <span style={{fontWeight:600}}>AI Asistan</span>
                  <span className="badge badge-warning">Yakında</span>
                </div>
                <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',lineHeight:1.5}}>AI entegrasyonu ile ihbar analizi, otomatik kategorizasyon, lead skorlama ve akıllı raporlama özellikleri eklenecek.</p>
              </div>
              <div className="form-group"><label className="form-label">AI Provider</label><select className="form-select"><option>OpenAI (GPT-4)</option><option>Google Gemini</option><option>Anthropic Claude</option></select></div>
              <div className="form-group"><label className="form-label">API Key</label><input className="form-input" placeholder="AI API anahtarınızı girin..." disabled /></div>
              <button className="btn btn-primary" disabled style={{opacity:0.5}}>💾 Kaydet</button>
            </>
          )}

          {active === 'appearance' && (
            <>
              <h3 className="card-title" style={{marginBottom:'var(--space-6)'}}>Görünüm Ayarları</h3>
              <div className="form-group">
                <label className="form-label">Tema</label>
                <div style={{display:'flex',gap:'var(--space-3)'}}>
                  <div style={{flex:1,padding:'var(--space-4)',background:'var(--surface-3)',borderRadius:'var(--border-radius)',border:'2px solid var(--primary)',cursor:'pointer',textAlign:'center'}}>
                    <span style={{fontSize:'var(--text-xl)'}}>🌙</span><div style={{fontSize:'var(--text-sm)',marginTop:'var(--space-2)'}}>Koyu Tema</div>
                  </div>
                  <div style={{flex:1,padding:'var(--space-4)',background:'var(--surface-1)',borderRadius:'var(--border-radius)',border:'1px solid var(--border-subtle)',cursor:'pointer',textAlign:'center',opacity:0.5}}>
                    <span style={{fontSize:'var(--text-xl)'}}>☀️</span><div style={{fontSize:'var(--text-sm)',marginTop:'var(--space-2)'}}>Açık Tema (Yakında)</div>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Sidebar Konumu</label>
                <select className="form-select"><option>Sol</option><option>Sağ</option></select>
              </div>
              <div className="form-group">
                <label className="form-label">Dil</label>
                <select className="form-select"><option>Türkçe</option><option>English</option></select>
              </div>
              <button className="btn btn-primary">💾 Kaydet</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
