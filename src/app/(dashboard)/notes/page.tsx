'use client';
import { useState } from 'react';

const notesData = [
  {id:1,title:'İhbar Kaynakları Listesi',content:'Güvenilir kaynaklar: Belediye sözcüsü, Valilik basın, İl Sağlık Müd...',date:'23.05.2026',color:'var(--primary)',cat:'İş',shared:false,fav:true},
  {id:2,title:'Reklam Fiyat Listesi',content:'Banner: ₺5,000/ay, Native: ₺3,000/hafta, Video pre-roll: ₺8,000/ay...',date:'22.05.2026',color:'var(--accent)',cat:'Finans',shared:true,fav:false},
  {id:3,title:'Toplantı Notları - Sprint',content:'Sprint hedefleri: CRM dashboard tamamlama, ihbar modülü test, WP entegrasyon...',date:'21.05.2026',color:'var(--success)',cat:'Proje',shared:true,fav:true},
  {id:4,title:'WordPress Plugin TODO',content:'1. Webhook endpoint ekle ✅\n2. Post meta alanları ✅\n3. Kategori sync ⬜...',date:'20.05.2026',color:'var(--warning)',cat:'Teknik',shared:false,fav:false},
  {id:5,title:'SEO Stratejisi',content:'Anahtar kelimeler: çanakkale haberleri, çanakkale gündem, boğaz...',date:'19.05.2026',color:'var(--info)',cat:'Pazarlama',shared:true,fav:false},
  {id:6,title:'Müşteri Geri Bildirimleri',content:'ABC Medya: Raporlama özelliği harika. Turizm Derneği: Daha fazla grafik...',date:'18.05.2026',color:'var(--error)',cat:'Müşteri',shared:false,fav:true},
];

export default function NotesPage() {
  const [tab, setTab] = useState<'all'|'personal'|'shared'|'fav'>('all');
  const filtered = notesData.filter(n => {
    if(tab==='personal') return !n.shared;
    if(tab==='shared') return n.shared;
    if(tab==='fav') return n.fav;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📝 Notlar</h1>
          <p className="page-subtitle">Kişisel ve paylaşılan notlar</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Not</button>
        </div>
      </div>

      <div className="tabs">
        {[{k:'all' as const,l:'Tümü'},{k:'personal' as const,l:'Kişisel'},{k:'shared' as const,l:'Paylaşılan'},{k:'fav' as const,l:'Favoriler'}].map(t=>(
          <button key={t.k} className={`tab ${tab===t.k?'active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      <div className="grid-3 stagger-children">
        {filtered.map(n=>(
          <div key={n.id} className="card" style={{borderTop:`3px solid ${n.color}`,cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'var(--space-3)'}}>
              <span className="badge" style={{background:`${n.color}22`,color:n.color}}>{n.cat}</span>
              <div style={{display:'flex',gap:'var(--space-2)'}}>
                {n.shared && <span style={{fontSize:'var(--text-xs)'}}>👥</span>}
                <span style={{fontSize:'var(--text-xs)',cursor:'pointer'}}>{n.fav?'⭐':'☆'}</span>
              </div>
            </div>
            <h3 style={{fontSize:'var(--text-md)',fontWeight:600,marginBottom:'var(--space-2)'}}>{n.title}</h3>
            <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical' as const,overflow:'hidden',marginBottom:'var(--space-3)'}}>{n.content}</p>
            <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>📅 {n.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
