'use client';
import { useState } from 'react';

const revenueData = [{m:'Oca',v:42},{m:'Şub',v:38},{m:'Mar',v:55},{m:'Nis',v:48},{m:'May',v:62},{m:'Haz',v:58}];
const maxRev = Math.max(...revenueData.map(r=>r.v));
const topClients = [
  {name:'Çanakkale Turizm A.Ş.',revenue:145000,projects:5},
  {name:'Çan Belediyesi',revenue:98000,projects:3},
  {name:'Gelibolu Otel',revenue:72000,projects:2},
  {name:'Dardanel A.Ş.',revenue:65000,projects:4},
  {name:'ABC Medya Ltd.',revenue:48000,projects:2},
];

export default function ReportsPage() {
  const [tab, setTab] = useState('overview');
  const tabs = [{k:'overview',l:'Genel Bakış'},{k:'revenue',l:'Gelir'},{k:'client',l:'Müşteri'},{k:'project',l:'Proje'},{k:'tips',l:'İhbar'}];

  const projectStatus = [{l:'Aktif',v:18,c:'#6c5ce7'},{l:'Tamamlanan',v:4,c:'#00b894'},{l:'Bekleyen',v:2,c:'#fdcb6e'}];
  const totalProj = projectStatus.reduce((s,p)=>s+p.v,0);
  let cumulativePct = 0;
  const conicStr = projectStatus.map(p=>{const start=cumulativePct; cumulativePct+=(p.v/totalProj)*100; return `${p.c} ${start}% ${cumulativePct}%`;}).join(', ');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📈 Raporlar</h1>
          <p className="page-subtitle">Detaylı analizler ve raporlar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">📤 Dışa Aktar</button>
          <button className="btn btn-primary">📊 Özel Rapor</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t=><button key={t.k} className={`tab ${tab===t.k?'active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            {[{l:'Toplam Gelir',v:'₺1.2M',c:'primary',i:'💰',ch:'+18%'},{l:'Aktif Müşteri',v:'142',c:'accent',i:'👥',ch:'+8%'},{l:'Tamamlanan Proje',v:'4',c:'success',i:'✅',ch:'+33%'},{l:'İhbar Dönüşüm',v:'%68',c:'warning',i:'📰',ch:'+5%'}].map((s,i)=>(
              <div key={i} className={`stat-card ${s.c}`}>
                <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div><span className="stat-card-change up">{s.ch}</span></div>
                <div className="stat-card-value">{s.v}</div>
                <div className="stat-card-label">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Aylık Gelir (₺1000)</h3>
              <div className="chart-bar-group" style={{height:180}}>
                {revenueData.map((r,i)=>(
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-bar primary" style={{height:`${(r.v/maxRev)*100}%`,animationDelay:`${i*0.1}s`}} />
                    <span className="chart-bar-label">{r.m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Proje Durumu</h3>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-6)'}}>
                <div style={{width:140,height:140,borderRadius:'50%',background:`conic-gradient(${conicStr})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <div style={{width:90,height:90,borderRadius:'50%',background:'var(--bg-secondary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--text-xl)',fontWeight:700,fontFamily:'var(--font-mono)'}}>{totalProj}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
                  {projectStatus.map((p,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                      <div style={{width:12,height:12,borderRadius:3,background:p.c}} />
                      <span style={{fontSize:'var(--text-sm)'}}>{p.l}: <strong>{p.v}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{marginTop:'var(--space-6)'}}>
            <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>En İyi 5 Müşteri (Gelire Göre)</h3>
            <table className="data-table">
              <thead><tr><th>#</th><th>Müşteri</th><th>Gelir</th><th>Projeler</th><th>Oran</th></tr></thead>
              <tbody>
                {topClients.map((c,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:700,color:'var(--primary-light)'}}>{i+1}</td>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td><span className="font-mono" style={{color:'var(--primary-light)'}}>₺{c.revenue.toLocaleString()}</span></td>
                    <td>{c.projects} proje</td>
                    <td style={{width:200}}>
                      <div className="progress-bar"><div className="progress-bar-fill primary" style={{width:`${(c.revenue/145000)*100}%`}} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab !== 'overview' && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">{tabs.find(t=>t.k===tab)?.l} Raporu</div>
          <div className="empty-state-desc">Bu rapor modülü yakında aktif olacak. Genel Bakış sekmesinden detaylı verileri görüntüleyebilirsiniz.</div>
          <button className="btn btn-primary">Genel Bakışa Dön</button>
        </div>
      )}
    </div>
  );
}
