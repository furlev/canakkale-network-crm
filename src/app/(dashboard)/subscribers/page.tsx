'use client';

const subscribers = [
  {id:1,email:'ahmet.yilmaz@gmail.com',name:'Ahmet Yılmaz',date:'22.05.2026',status:'active',segment:'VIP',source:'Web'},
  {id:2,email:'zeynep@outlook.com',name:'Zeynep Kaya',date:'21.05.2026',status:'active',segment:'Regular',source:'Sosyal Medya'},
  {id:3,email:'can.demir@hotmail.com',name:'Can Demir',date:'20.05.2026',status:'active',segment:'New',source:'Referans'},
  {id:4,email:'elif@gmail.com',name:'Elif Arslan',date:'19.05.2026',status:'active',segment:'VIP',source:'Web'},
  {id:5,email:'burak@yahoo.com',name:'Burak Şahin',date:'18.05.2026',status:'inactive',segment:'Regular',source:'Web'},
  {id:6,email:'selin@gmail.com',name:'Selin Yıldız',date:'17.05.2026',status:'active',segment:'New',source:'Sosyal Medya'},
  {id:7,email:'mert@outlook.com',name:'Mert Koç',date:'16.05.2026',status:'active',segment:'Regular',source:'Web'},
  {id:8,email:'ayse@hotmail.com',name:'Ayşe Öztürk',date:'15.05.2026',status:'inactive',segment:'Regular',source:'Referans'},
];

const segMap: Record<string,string> = {VIP:'badge-warning',Regular:'badge-primary',New:'badge-accent'};
const srcMap: Record<string,string> = {Web:'badge-info','Sosyal Medya':'badge-accent',Referans:'badge-success'};
const growthData = [18,22,15,28,20,32,24];
const growthDays = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const maxGrowth = Math.max(...growthData);

export default function SubscribersPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👤 Aboneler</h1>
          <p className="page-subtitle">Newsletter ve abonelik yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">📤 Dışa Aktar</button>
          <button className="btn btn-primary">+ Abone Ekle</button>
        </div>
      </div>

      <div className="stats-grid">
        {[{l:'Toplam Abone',v:'8,420',c:'primary',i:'👥',ch:'+12%'},{l:'Aktif',v:'7,650',c:'success',i:'✅',ch:'+8%'},{l:'Bugün',v:'+24',c:'accent',i:'📈',ch:'+15%'},{l:'Çıkan',v:'45',c:'error',i:'📉',ch:'-3%'}].map((s,i)=>(
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top">
              <div className="stat-card-icon">{s.i}</div>
              <span className={`stat-card-change ${s.ch.startsWith('+')?'up':'down'}`}>{s.ch}</span>
            </div>
            <div className="stat-card-value">{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:'var(--space-6)'}}>
        <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Haftalık Büyüme</h3>
        <div className="chart-bar-group">
          {growthData.map((v,i) => (
            <div key={i} className="chart-bar-wrapper">
              <div className="chart-bar primary" style={{height:`${(v/maxGrowth)*100}%`, animationDelay:`${i*0.1}s`}} />
              <span className="chart-bar-label">{growthDays[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <h3 className="card-title">Abone Listesi</h3>
          <div className="data-table-search"><span>🔍</span><input placeholder="E-posta ara..." /></div>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>E-posta</th><th>Ad</th><th>Abone Tarihi</th><th>Durum</th><th>Segment</th><th>Kaynak</th></tr>
          </thead>
          <tbody>
            {subscribers.map(s=>(
              <tr key={s.id}>
                <td>{s.email}</td>
                <td style={{fontWeight:500}}>{s.name}</td>
                <td style={{fontSize:'var(--text-xs)'}}>{s.date}</td>
                <td><span className={`badge ${s.status==='active'?'badge-success':'badge-error'}`}>{s.status==='active'?'Aktif':'Pasif'}</span></td>
                <td><span className={`badge ${segMap[s.segment]}`}>{s.segment}</span></td>
                <td><span className={`badge ${srcMap[s.source]}`}>{s.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="data-table-footer"><span>1-8 / 8,420 abone</span><div className="pagination">{[1,2,3,'...',842].map((p,i)=><button key={i} className={`pagination-btn ${p===1?'active':''}`}>{p}</button>)}</div></div>
      </div>
    </div>
  );
}
