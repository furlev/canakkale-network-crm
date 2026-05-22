'use client';

const proposals = [
  {id:1,title:'Web Portal Yenileme Teklifi',client:'Çanakkale Belediyesi',date:'15.05.2026',value:180000,status:'sent',desc:'Belediye web portalının tamamen yenilenmesi, mobil uyumlu tasarım.'},
  {id:2,title:'Dijital Pazarlama Paketi',client:'Turizm Derneği',date:'10.05.2026',value:65000,status:'approved',desc:'6 aylık dijital pazarlama, sosyal medya ve SEO çalışması.'},
  {id:3,title:'Haber Portalı Geliştirme',client:'ABC Medya Ltd.',date:'05.05.2026',value:95000,status:'rejected',desc:'Kurumsal haber portalı tasarım ve geliştirme projesi.'},
  {id:4,title:'Kurumsal Kimlik Çalışması',client:'Gelibolu Otel',date:'01.05.2026',value:28000,status:'draft',desc:'Logo, kartvizit, broşür ve kurumsal kimlik seti tasarımı.'},
];

const statusMap: Record<string,{l:string;c:string}> = {
  sent:{l:'Gönderildi',c:'badge-info'},
  approved:{l:'Onaylandı',c:'badge-success'},
  rejected:{l:'Reddedildi',c:'badge-error'},
  draft:{l:'Taslak',c:'badge-warning'},
};

export default function ProposalsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📑 Teklifnameler</h1>
          <p className="page-subtitle">Profesyonel teklifnameler oluşturun</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Teklifname</button>
        </div>
      </div>

      <div className="grid-2">
        {proposals.map(p=>(
          <div key={p.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'var(--space-3)'}}>
              <h3 style={{fontSize:'var(--text-md)',fontWeight:600}}>{p.title}</h3>
              <span className={`badge ${statusMap[p.status].c}`}>{statusMap[p.status].l}</span>
            </div>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',marginBottom:'var(--space-4)',lineHeight:1.5}}>{p.desc}</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-3)',marginBottom:'var(--space-4)'}}>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Müşteri</span><div style={{fontSize:'var(--text-sm)',fontWeight:500}}>{p.client}</div></div>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Tutar</span><div style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--primary-light)'}}>₺{p.value.toLocaleString()}</div></div>
              <div><span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>Tarih</span><div style={{fontSize:'var(--text-sm)'}}>{p.date}</div></div>
            </div>
            <div style={{display:'flex',gap:'var(--space-2)'}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>📄 PDF</button>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>✏️ Düzenle</button>
              {p.status === 'approved' && <button className="btn btn-accent btn-sm" style={{flex:1}}>🔄 Faturaya Dönüştür</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
