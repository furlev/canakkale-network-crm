'use client';

const contracts = [
  {id:1,title:'Web Geliştirme Sözleşmesi',client:'ABC Medya Ltd.',startDate:'01.01.2026',endDate:'31.12.2026',value:120000,status:'active',progress:45},
  {id:2,title:'Reklam Yayın Sözleşmesi',client:'Çanakkale Belediyesi',startDate:'01.03.2026',endDate:'01.09.2026',value:85000,status:'active',progress:30},
  {id:3,title:'İçerik Üretim Anlaşması',client:'Turizm Derneği',startDate:'15.01.2026',endDate:'15.07.2026',value:45000,status:'active',progress:65},
  {id:4,title:'SEO Danışmanlık Sözleşmesi',client:'Gelibolu Otel',startDate:'01.06.2025',endDate:'01.06.2026',value:36000,status:'expired',progress:100},
];

const statusMap: Record<string,{label:string;cls:string}> = {
  active:{label:'Aktif',cls:'badge-success'},
  expired:{label:'Süresi Dolmuş',cls:'badge-error'},
  draft:{label:'Taslak',cls:'badge-warning'},
};

export default function ContractsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📝 Sözleşmeler</h1>
          <p className="page-subtitle">Sözleşme yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Sözleşme</button>
        </div>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{l:'Aktif Sözleşme',v:'3',c:'success',i:'📋'},{l:'Toplam Değer',v:'₺286,000',c:'primary',i:'💰'},{l:'Süresi Dolan',v:'1',c:'error',i:'⚠️'}].map((s,i)=>(
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
            <div className="stat-card-value" style={{fontSize:'var(--text-2xl)'}}>{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {contracts.map(c=>(
          <div key={c.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
              <h3 style={{fontSize:'var(--text-md)',fontWeight:600}}>{c.title}</h3>
              <span className={`badge ${statusMap[c.status].cls}`}>{statusMap[c.status].label}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-3)',marginBottom:'var(--space-4)'}}>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Müşteri</span><div style={{fontSize:'var(--text-sm)',fontWeight:500}}>{c.client}</div></div>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Değer</span><div style={{fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--font-mono)',color:'var(--primary-light)'}}>₺{c.value.toLocaleString()}</div></div>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Başlangıç</span><div style={{fontSize:'var(--text-sm)'}}>{c.startDate}</div></div>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Bitiş</span><div style={{fontSize:'var(--text-sm)'}}>{c.endDate}</div></div>
            </div>
            <div style={{marginBottom:'var(--space-2)',display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>İlerleme</span>
              <span style={{fontSize:'var(--text-xs)',fontFamily:'var(--font-mono)',color:'var(--text-secondary)'}}>{c.progress}%</span>
            </div>
            <div className="progress-bar"><div className={`progress-bar-fill ${c.status==='expired'?'warning':'primary'}`} style={{width:`${c.progress}%`}} /></div>
            <div style={{display:'flex',gap:'var(--space-2)',marginTop:'var(--space-4)'}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>Görüntüle</button>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>Düzenle</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
