'use client';

const categories = [
  {icon:'🚀',title:'Başlangıç Kılavuzu',count:8,desc:'CRM sistemine hızlı başlangıç rehberi',color:'var(--primary)'},
  {icon:'📊',title:'CRM Kullanımı',count:15,desc:'Modüller, özellikler ve detaylı kullanım',color:'var(--accent)'},
  {icon:'🔗',title:'WordPress Entegrasyonu',count:6,desc:'WordPress bağlantısı ve haber yönetimi',color:'var(--success)'},
  {icon:'💰',title:'Fatura İşlemleri',count:10,desc:'Fatura oluşturma, ödeme takibi',color:'var(--warning)'},
  {icon:'📈',title:'Raporlama',count:7,desc:'Rapor oluşturma ve analiz araçları',color:'var(--info)'},
  {icon:'❓',title:'Sık Sorulan Sorular',count:22,desc:'En çok sorulan sorular ve cevapları',color:'var(--error)'},
];

export default function KnowledgeBasePage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📖 Bilgi Tabanı</h1>
          <p className="page-subtitle">Dokümanlar ve kılavuzlar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Makale</button>
        </div>
      </div>

      <div style={{maxWidth:500,margin:'0 auto var(--space-8)'}}>
        <div className="topbar-search" style={{width:'100%',padding:'var(--space-3) var(--space-5)'}}>
          <span className="topbar-search-icon">🔍</span>
          <input placeholder="Bilgi tabanında ara..." style={{background:'transparent',border:'none',outline:'none',color:'var(--text-primary)',fontFamily:'var(--font-sans)',fontSize:'var(--text-base)',width:'100%'}} />
        </div>
      </div>

      <div className="grid-3 stagger-children">
        {categories.map((cat,i)=>(
          <div key={i} className="card" style={{cursor:'pointer',textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:'var(--border-radius-lg)',background:`${cat.color}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',margin:'0 auto var(--space-4)'}}>{cat.icon}</div>
            <h3 style={{fontSize:'var(--text-md)',fontWeight:600,marginBottom:'var(--space-2)'}}>{cat.title}</h3>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',marginBottom:'var(--space-3)'}}>{cat.desc}</p>
            <span className="badge badge-primary">{cat.count} makale</span>
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop:'var(--space-8)'}}>
        <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>📝 Son Eklenen Makaleler</h3>
        {['CRM\'e Nasıl Giriş Yapılır?','WordPress API Bağlantısı Kurulumu','Fatura Oluşturma Rehberi','İhbar Modülü Kullanım Kılavuzu','Rapor Oluşturma ve Dışa Aktarma'].map((title,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'var(--space-3) 0',borderBottom:i<4?'1px solid var(--border-subtle)':'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:'var(--space-3)'}}>
              <span style={{color:'var(--text-muted)'}}>📄</span>
              <span style={{fontSize:'var(--text-sm)',fontWeight:500}}>{title}</span>
            </div>
            <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{i+1} gün önce</span>
          </div>
        ))}
      </div>
    </div>
  );
}
