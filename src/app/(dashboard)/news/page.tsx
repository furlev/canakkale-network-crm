'use client';
import { useState } from 'react';

const newsData = [
  {id:1,title:'Çanakkale\'de Turizm Sezonu Erken Başladı',excerpt:'Bu yıl sıcakların erken gelmesiyle birlikte Çanakkale\'de turizm sezonu beklenenden önce başladı. Otellerde doluluk oranları yüzde 80\'e ulaştı.',category:'Gündem',author:'Ahmet Yılmaz',date:'2 saat önce',views:1200,color:'#6c5ce7'},
  {id:2,title:'Belediye Yeni Projeleri Açıkladı',excerpt:'Çanakkale Belediyesi yeni dönem projelerini tanıttı. Ulaşım, çevre ve kültür alanlarında önemli yatırımlar planlanıyor.',category:'Siyaset',author:'Zeynep Kaya',date:'5 saat önce',views:890,color:'#00cec9'},
  {id:3,title:'Tarım Sektöründe Rekor Üretim',excerpt:'Çanakkale bölgesinde bu yılki tarım üretimi rekor seviyelere ulaştı. Özellikle zeytin ve domates üretiminde artış yaşandı.',category:'Ekonomi',author:'Mehmet Demir',date:'8 saat önce',views:654,color:'#00b894'},
  {id:4,title:'Eğitimde Dijital Dönüşüm',excerpt:'İl Milli Eğitim Müdürlüğü, tüm okullarda dijital dönüşüm projesi başlattı. Akıllı tahta ve tablet dağıtımı devam ediyor.',category:'Gündem',author:'Ayşe Yıldız',date:'12 saat önce',views:432,color:'#6c5ce7'},
  {id:5,title:'Spor Tesisleri Yenileniyor',excerpt:'Çanakkale\'deki spor tesisleri kapsamlı bir renovasyon sürecine girdi. Olimpik yüzme havuzu da planlar arasında.',category:'Spor',author:'Can Özkan',date:'1 gün önce',views:321,color:'#e17055'},
  {id:6,title:'Troya Antik Kenti\'nde Yeni Keşifler',excerpt:'UNESCO Dünya Mirası listesindeki Troya\'da yapılan kazılarda yeni buluntulara rastlandı. Arkeologlar heyecan içinde.',category:'Kültür',author:'Elif Acar',date:'1 gün önce',views:1580,color:'#fdcb6e'},
  {id:7,title:'Deniz Ulaşımında Yeni Hatlar',excerpt:'Çanakkale-İstanbul arası deniz ulaşımında yeni hat açılıyor. Hızlı feribot seferleri gelecek ay başlayacak.',category:'Gündem',author:'Burak Şahin',date:'2 gün önce',views:756,color:'#6c5ce7'},
  {id:8,title:'Teknoloji Festivali Hazırlıkları',excerpt:'Çanakkale Teknoloji Festivali\'nin hazırlıkları tamamlandı. Yerli ve yabancı 50 konuşmacı katılacak.',category:'Kültür',author:'Selin Arslan',date:'2 gün önce',views:445,color:'#fdcb6e'},
];

const categories = ['Tümü','Gündem','Siyaset','Ekonomi','Kültür','Spor'];

export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [search, setSearch] = useState('');
  const filtered = newsData.filter(n => (activeCategory === 'Tümü' || n.category === activeCategory) && n.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📰 Haberler</h1>
          <p className="page-subtitle">WordPress sitesindeki haberler • <span style={{color:'var(--success)'}}>● Bağlı</span> canakkale.network</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">🔄 Senkronize Et</button>
          <button className="btn btn-primary">+ Yeni Haber</button>
        </div>
      </div>

      <div className="stats-grid">
        {[{l:'Toplam Haber',v:'2,450',i:'📰',c:'primary'},{l:'Bugün',v:'8',i:'📅',c:'accent'},{l:'Bu Hafta',v:'42',i:'📊',c:'success'},{l:'Görüntülenme',v:'124K',i:'👁️',c:'info'}].map((s,i)=>(
          <div key={i} className={`stat-card ${s.c}`}>
            <div className="stat-card-top"><div className={`stat-card-icon`}>{s.i}</div></div>
            <div className="stat-card-value">{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:'var(--space-4)',marginBottom:'var(--space-6)',flexWrap:'wrap',alignItems:'center'}}>
        <div className="tabs" style={{marginBottom:0}}>
          {categories.map(c=>(
            <button key={c} className={`tab ${activeCategory===c?'active':''}`} onClick={()=>setActiveCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="data-table-search" style={{marginLeft:'auto'}}>
          <span>🔍</span>
          <input placeholder="Haber ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
        {filtered.map((news,i)=>(
          <div key={news.id} className="card" style={{animationDelay:`${i*0.05}s`}}>
            <div style={{height:160,borderRadius:'var(--border-radius)',background:`linear-gradient(135deg, ${news.color}33, ${news.color}11)`,marginBottom:'var(--space-4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'3rem'}}>
              📰
            </div>
            <div style={{display:'flex',gap:'var(--space-2)',marginBottom:'var(--space-3)'}}>
              <span className="badge badge-primary">{news.category}</span>
              <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',marginLeft:'auto'}}>{news.date}</span>
            </div>
            <h3 style={{fontSize:'var(--text-md)',fontWeight:600,marginBottom:'var(--space-2)',lineHeight:1.4}}>{news.title}</h3>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',marginBottom:'var(--space-4)',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const,overflow:'hidden'}}>{news.excerpt}</p>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                <div className="avatar avatar-sm" style={{background:`${news.color}33`,color:news.color}}>{news.author[0]}</div>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text-secondary)'}}>{news.author}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-4)'}}>
                <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>👁️ {news.views.toLocaleString()}</span>
                <button className="btn btn-ghost btn-sm">Düzenle</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
