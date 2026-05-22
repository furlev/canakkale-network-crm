'use client';

const team = [
  {id:1,name:'Ahmet Yılmaz',role:'Yönetici',email:'ahmet@canakkale.network',phone:'+90 532 111 2233',status:'online',avatar:'AY',color:'var(--primary)'},
  {id:2,name:'Zeynep Kaya',role:'Editör',email:'zeynep@canakkale.network',phone:'+90 533 222 3344',status:'online',avatar:'ZK',color:'var(--accent)'},
  {id:3,name:'Mehmet Demir',role:'Muhabir',email:'mehmet@canakkale.network',phone:'+90 534 333 4455',status:'busy',avatar:'MD',color:'var(--warning)'},
  {id:4,name:'Ayşe Yıldız',role:'Muhabir',email:'ayse@canakkale.network',phone:'+90 535 444 5566',status:'online',avatar:'AY',color:'var(--success)'},
  {id:5,name:'Can Özkan',role:'Satış',email:'can@canakkale.network',phone:'+90 536 555 6677',status:'offline',avatar:'CÖ',color:'var(--info)'},
  {id:6,name:'Elif Arslan',role:'Stajyer',email:'elif@canakkale.network',phone:'+90 537 666 7788',status:'online',avatar:'EA',color:'var(--error)'},
];

const statusColors: Record<string,{color:string;label:string}> = {
  online:{color:'var(--success)',label:'Çevrimiçi'},
  offline:{color:'var(--text-muted)',label:'Çevrimdışı'},
  busy:{color:'var(--warning)',label:'Meşgul'},
};

export default function TeamPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👨‍💼 Ekip</h1>
          <p className="page-subtitle">Ekip üyelerinizi yönetin</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Üye Ekle</button>
        </div>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{l:'Toplam',v:'12',c:'primary',i:'👥'},{l:'Çevrimiçi',v:'8',c:'success',i:'🟢'},{l:'İzinde',v:'2',c:'warning',i:'🏖️'}].map((s,i)=>(
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top"><div className="stat-card-icon">{s.i}</div></div>
            <div className="stat-card-value" style={{fontSize:'var(--text-2xl)'}}>{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid-3 stagger-children">
        {team.map(m=>(
          <div key={m.id} className="card" style={{textAlign:'center'}}>
            <div style={{position:'relative',display:'inline-block',marginBottom:'var(--space-4)'}}>
              <div className="avatar avatar-xl" style={{background:`linear-gradient(135deg, ${m.color}, ${m.color}88)`,color:'white',margin:'0 auto'}}>{m.avatar}</div>
              <div style={{position:'absolute',bottom:2,right:2,width:14,height:14,borderRadius:'50%',background:statusColors[m.status].color,border:'3px solid var(--bg-primary)'}} />
            </div>
            <h3 style={{fontSize:'var(--text-md)',fontWeight:600,marginBottom:'var(--space-1)'}}>{m.name}</h3>
            <span className="badge badge-primary" style={{marginBottom:'var(--space-3)'}}>{m.role}</span>
            <div style={{fontSize:'var(--text-xs)',color:statusColors[m.status].color,marginBottom:'var(--space-4)'}}>{statusColors[m.status].label}</div>
            <div style={{display:'flex',flexDirection:'column',gap:'var(--space-2)',textAlign:'left'}}>
              <div style={{fontSize:'var(--text-sm)',color:'var(--text-secondary)',display:'flex',gap:'var(--space-2)'}}>📧 {m.email}</div>
              <div style={{fontSize:'var(--text-sm)',color:'var(--text-secondary)',display:'flex',gap:'var(--space-2)'}}>📞 {m.phone}</div>
            </div>
            <div style={{display:'flex',gap:'var(--space-2)',marginTop:'var(--space-4)'}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>💬 Mesaj</button>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>✏️ Düzenle</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
