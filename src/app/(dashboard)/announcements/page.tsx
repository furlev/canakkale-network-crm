'use client';

const announcements = [
  {id:1,title:'Sistem Bakımı Duyurusu',content:'26 Mayıs Cumartesi günü saat 02:00-06:00 arası planlı sistem bakımı yapılacaktır. Bu süre zarfında CRM erişimi kısıtlı olabilir.',date:'23.05.2026',target:'Herkes',priority:'high',author:'Sistem Yönetimi'},
  {id:2,title:'Yeni İhbar Modülü Kullanıma Açıldı',content:'ihbar@canakkale.network adresine gelen ihbarları artık CRM üzerinden takip edebilirsiniz. Detaylı bilgi için Bilgi Tabanı\'nı inceleyin.',date:'20.05.2026',target:'Ekip',priority:'normal',author:'Admin'},
  {id:3,title:'Mayıs Ayı Performans Değerlendirmesi',content:'Mayıs ayı performans değerlendirme formlarını 31 Mayıs\'a kadar doldurmanız gerekmektedir.',date:'18.05.2026',target:'Ekip',priority:'normal',author:'İK Departmanı'},
  {id:4,title:'Yeni Reklam Paketleri',content:'Müşterilerimiz için hazırlanan yeni reklam paketleri satışa sunulmuştur. Detaylı fiyat listesi için satış departmanıyla iletişime geçin.',date:'15.05.2026',target:'Müşteri',priority:'low',author:'Satış Departmanı'},
];

const targetColors: Record<string,string> = {Herkes:'badge-primary',Ekip:'badge-accent','Müşteri':'badge-warning'};
const prioColors: Record<string,string> = {high:'badge-error',normal:'badge-info',low:'badge-success'};

export default function AnnouncementsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📣 Duyurular</h1>
          <p className="page-subtitle">Ekip ve müşteri duyuruları</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Duyuru</button>
        </div>
      </div>

      <div className="stagger-children" style={{display:'flex',flexDirection:'column',gap:'var(--space-4)'}}>
        {announcements.map(a=>(
          <div key={a.id} className="card" style={{borderLeft:`3px solid ${a.priority==='high'?'var(--error)':a.priority==='normal'?'var(--info)':'var(--success)'}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'var(--space-3)',flexWrap:'wrap',gap:'var(--space-2)'}}>
              <h3 style={{fontSize:'var(--text-md)',fontWeight:600}}>{a.title}</h3>
              <div style={{display:'flex',gap:'var(--space-2)'}}>
                <span className={`badge ${targetColors[a.target]}`}>{a.target}</span>
                <span className={`badge ${prioColors[a.priority]}`}>{a.priority==='high'?'Önemli':a.priority==='normal'?'Normal':'Düşük'}</span>
              </div>
            </div>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text-secondary)',lineHeight:1.6,marginBottom:'var(--space-4)'}}>{a.content}</p>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                <div className="avatar avatar-sm" style={{background:'var(--primary-gradient)',color:'white'}}>{a.author[0]}</div>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{a.author}</span>
              </div>
              <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>📅 {a.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
