'use client';

const advertisers = [
  {id:1,company:'Çanakkale Turizm A.Ş.',contact:'Ali Vural',campaign:'Yaz Sezonu Kampanyası',budget:45000,start:'01.06.2026',end:'31.08.2026',status:'active'},
  {id:2,company:'Gelibolu Otel Grubu',contact:'Selin Yıldız',campaign:'Konaklama Tanıtımı',budget:28000,start:'15.05.2026',end:'15.09.2026',status:'active'},
  {id:3,company:'Biga Zeytin A.Ş.',contact:'Hasan Kılıç',campaign:'Hasat Festivali Sponsoru',budget:15000,start:'01.10.2026',end:'31.10.2026',status:'pending'},
  {id:4,company:'Çan Belediyesi',contact:'Merve Aksoy',campaign:'Kültür Etkinlikleri',budget:35000,start:'01.04.2026',end:'30.06.2026',status:'active'},
  {id:5,company:'Dardanel A.Ş.',contact:'Kemal Öztürk',campaign:'Ürün Lansmanı',budget:52000,start:'01.03.2026',end:'30.04.2026',status:'completed'},
  {id:6,company:'Troya Tur',contact:'Derya Koç',campaign:'Tur Paketi Tanıtımı',budget:12000,start:'01.07.2026',end:'31.07.2026',status:'pending'},
];

const statusMap: Record<string,{l:string;c:string}> = {active:{l:'Aktif',c:'badge-success'},pending:{l:'Beklemede',c:'badge-warning'},completed:{l:'Tamamlandı',c:'badge-info'}};

export default function AdvertisersPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📢 Reklam Verenler</h1>
          <p className="page-subtitle">Reklam müşterilerinizi yönetin</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Reklam Veren</button>
        </div>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{l:'Toplam Gelir',v:'₺185K',c:'primary',i:'💰'},{l:'Aktif Kampanya',v:'12',c:'success',i:'📊'},{l:'Bekleyen Teklif',v:'5',c:'warning',i:'⏳'}].map((s,i)=>(
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
            <div className="stat-card-value" style={{fontSize:'var(--text-2xl)'}}>{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <h3 className="card-title">Reklam Verenler</h3>
          <div className="data-table-search"><span>🔍</span><input placeholder="Ara..." /></div>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Şirket</th><th>İletişim</th><th>Kampanya</th><th>Bütçe</th><th>Başlangıç</th><th>Bitiş</th><th>Durum</th><th>İşlemler</th></tr>
          </thead>
          <tbody>
            {advertisers.map(a=>(
              <tr key={a.id}>
                <td style={{fontWeight:600}}>{a.company}</td>
                <td>{a.contact}</td>
                <td>{a.campaign}</td>
                <td><span className="font-mono" style={{color:'var(--primary-light)',fontWeight:600}}>₺{a.budget.toLocaleString()}</span></td>
                <td style={{fontSize:'var(--text-xs)'}}>{a.start}</td>
                <td style={{fontSize:'var(--text-xs)'}}>{a.end}</td>
                <td><span className={`badge ${statusMap[a.status].c}`}>{statusMap[a.status].l}</span></td>
                <td><button className="btn btn-ghost btn-sm">Detay</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
