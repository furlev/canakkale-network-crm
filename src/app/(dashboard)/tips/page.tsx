'use client';
import { useState } from 'react';

const tipData = [
  {id:'TIP-001',subject:'Çanakkale Boğazı\'nda Gemi Trafiği Durdu',source:'Anonim',sourceType:'email',priority:'urgent',status:'new',reporter:null,date:'2026-05-23 01:45',content:'Boğazda büyük bir gemi arızası nedeniyle trafik durdu. Yaklaşık 20 gemi bekliyor.'},
  {id:'TIP-002',subject:'Belediye Başkanı İstifa Edecek İddiaları',source:'Güvenilir Kaynak',sourceType:'phone',priority:'high',status:'new',reporter:null,date:'2026-05-23 00:30',content:'Belediye başkanının önümüzdeki hafta istifa edeceği iddia ediliyor.'},
  {id:'TIP-003',subject:'Tarım Alanlarında Kaçak Yapılaşma',source:'Vatandaş İhbarı',sourceType:'email',priority:'high',status:'investigating',reporter:'Mehmet K.',date:'2026-05-22 18:20',content:'Merkeze bağlı köyde tarım arazileri üzerine kaçak yapılar inşa ediliyor.'},
  {id:'TIP-004',subject:'Okulda Gıda Zehirlenmesi Şüphesi',source:'Veli İhbarı',sourceType:'phone',priority:'urgent',status:'new',reporter:null,date:'2026-05-22 16:45',content:'İlköğretim okulunda 15 öğrenci yemekten sonra hastaneye kaldırıldı.'},
  {id:'TIP-005',subject:'Sahilde Petrol Sızıntısı',source:'Çevreci Grup',sourceType:'email',priority:'high',status:'investigating',reporter:'Ayşe T.',date:'2026-05-22 14:00',content:'Kepez sahilinde denize petrol sızıntısı tespit edildi.'},
  {id:'TIP-006',subject:'Festival Tarihleri Değişti',source:'Belediye Kaynağı',sourceType:'email',priority:'normal',status:'verified',reporter:'Ali R.',date:'2026-05-22 12:30',content:'Troya festivali tarihleri 2 hafta öne alındı.'},
  {id:'TIP-007',subject:'Yeni Alışveriş Merkezi Açılıyor',source:'Basın Bülteni',sourceType:'email',priority:'low',status:'verified',reporter:'Zeynep M.',date:'2026-05-22 10:00',content:'Şehir merkezinde yeni AVM gelecek ay açılacak.'},
  {id:'TIP-008',subject:'Su Kesintisi Planlanıyor',source:'Kurum Kaynağı',sourceType:'email',priority:'normal',status:'investigating',reporter:'Can D.',date:'2026-05-21 16:00',content:'Hafta sonu boyunca planlı su kesintisi uygulanacak.'},
  {id:'TIP-009',subject:'Arkeolojik Kazıda Önemli Buluş',source:'Akademik Kaynak',sourceType:'phone',priority:'high',status:'converted',reporter:'Elif Y.',date:'2026-05-21 14:30',content:'Troya kazılarında yeni bir katman keşfedildi.'},
  {id:'TIP-010',subject:'Trafik Kazasında Yaşanan Sorunlar',source:'Görgü Tanığı',sourceType:'phone',priority:'urgent',status:'new',reporter:null,date:'2026-05-21 09:00',content:'Ana yolda zincirleme kaza, ambulans ulaşamıyor.'},
  {id:'TIP-011',subject:'Orman Yangını Riski Uyarısı',source:'Meteoroloji',sourceType:'email',priority:'high',status:'converted',reporter:'Burak S.',date:'2026-05-20 15:00',content:'Sıcaklar nedeniyle bölgede yangın riski çok yüksek.'},
  {id:'TIP-012',subject:'Gençlik Festivali Hazırlıkları',source:'Organizatör',sourceType:'email',priority:'low',status:'rejected',reporter:null,date:'2026-05-20 11:00',content:'Gençlik festivali için hazırlıklar tamamlandı. Reklam amaçlı ihbar.'},
];

const columns = [
  {key:'new',title:'Yeni İhbarlar',color:'var(--primary)'},
  {key:'investigating',title:'İnceleniyor',color:'var(--info)'},
  {key:'verified',title:'Doğrulandı',color:'var(--success)'},
  {key:'converted',title:'Habere Dönüştü',color:'var(--accent)'},
  {key:'rejected',title:'Reddedildi',color:'var(--error)'},
];

const priorityMap: Record<string,{label:string;cls:string}> = {
  urgent:{label:'Acil',cls:'badge-error'},
  high:{label:'Yüksek',cls:'badge-warning'},
  normal:{label:'Normal',cls:'badge-primary'},
  low:{label:'Düşük',cls:'badge-info'},
};

const statusLabels: Record<string,{label:string;cls:string}> = {
  new:{label:'Yeni',cls:'badge-primary'},
  investigating:{label:'İnceleniyor',cls:'badge-info'},
  verified:{label:'Doğrulandı',cls:'badge-success'},
  converted:{label:'Habere Dönüştü',cls:'badge-accent'},
  rejected:{label:'Reddedildi',cls:'badge-error'},
};

export default function TipsPage() {
  const [view, setView] = useState<'kanban'|'list'>('kanban');
  const [selected, setSelected] = useState<typeof tipData[0]|null>(null);

  const stats = [
    {label:'Yeni',value:tipData.filter(t=>t.status==='new').length,color:'var(--primary)',icon:'🆕'},
    {label:'İnceleniyor',value:tipData.filter(t=>t.status==='investigating').length,color:'var(--info)',icon:'🔍'},
    {label:'Doğrulandı',value:tipData.filter(t=>t.status==='verified').length,color:'var(--success)',icon:'✅'},
    {label:'Habere Dönüştü',value:156,color:'var(--accent)',icon:'📰'},
    {label:'Reddedildi',value:43,color:'var(--error)',icon:'❌'},
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🔔 Haber İhbarı</h1>
          <p className="page-subtitle">ihbar@canakkale.network adresine gelen ihbarlar</p>
        </div>
        <div className="page-header-actions">
          <div className="tabs" style={{marginBottom:0}}>
            <button className={`tab ${view==='kanban'?'active':''}`} onClick={()=>setView('kanban')}>Kanban</button>
            <button className={`tab ${view==='list'?'active':''}`} onClick={()=>setView('list')}>Liste</button>
          </div>
          <button className="btn btn-primary">+ Manuel İhbar</button>
        </div>
      </div>

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        {stats.map((s,i)=>(
          <div key={i} className="stat-card" style={{borderTop:`2px solid ${s.color}`}}>
            <div className="stat-card-top">
              <span style={{fontSize:'var(--text-xl)'}}>{s.icon}</span>
            </div>
            <div className="stat-card-value" style={{fontSize:'var(--text-2xl)'}}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {view === 'kanban' ? (
        <div className="kanban-board">
          {columns.map(col => {
            const items = tipData.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{width:8,height:8,borderRadius:'50%',background:col.color,display:'inline-block'}} />
                    {col.title}
                    <span className="kanban-column-count">{items.length}</span>
                  </div>
                </div>
                <div className="kanban-column-body">
                  {items.map(tip => (
                    <div key={tip.id} className="kanban-card" onClick={()=>setSelected(tip)} style={{cursor:'pointer'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'var(--space-2)'}}>
                        <span className={`badge ${priorityMap[tip.priority].cls}`}>{priorityMap[tip.priority].label}</span>
                        <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{tip.id}</span>
                      </div>
                      <div className="kanban-card-title">{tip.subject}</div>
                      <div className="kanban-card-desc">{tip.content}</div>
                      <div className="kanban-card-footer">
                        <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                          <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>📧 {tip.source}</span>
                        </div>
                        {tip.reporter && (
                          <div className="avatar avatar-sm" style={{background:'var(--primary-gradient)',color:'white',fontSize:9}}>{tip.reporter.split(' ').map(n=>n[0]).join('')}</div>
                        )}
                      </div>
                      <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:'var(--space-2)'}}>{tip.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="data-table-container">
          <div className="data-table-header">
            <div className="data-table-search">
              <span className="topbar-search-icon">🔍</span>
              <input placeholder="İhbar ara..." />
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>İhbar No</th><th>Konu</th><th>Kaynak</th><th>Öncelik</th><th>Muhabir</th><th>Durum</th><th>Tarih</th><th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tipData.map(tip=>(
                <tr key={tip.id} onClick={()=>setSelected(tip)} style={{cursor:'pointer'}}>
                  <td><span className="font-mono" style={{color:'var(--primary-light)'}}>{tip.id}</span></td>
                  <td style={{maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tip.subject}</td>
                  <td><span style={{fontSize:'var(--text-xs)'}}>{tip.source}</span></td>
                  <td><span className={`badge ${priorityMap[tip.priority].cls}`}>{priorityMap[tip.priority].label}</span></td>
                  <td>{tip.reporter || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                  <td><span className={`badge ${statusLabels[tip.status].cls}`}>{statusLabels[tip.status].label}</span></td>
                  <td style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{tip.date}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();setSelected(tip)}}>Detay</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <>
          <div className="modal-backdrop" onClick={()=>setSelected(null)} />
          <div className="modal" style={{maxWidth:640}}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selected.subject}</div>
                <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:4}}>{selected.id} • {selected.date}</div>
              </div>
              <button className="modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:'flex',gap:'var(--space-3)',marginBottom:'var(--space-4)',flexWrap:'wrap'}}>
                <span className={`badge ${priorityMap[selected.priority].cls}`}>Öncelik: {priorityMap[selected.priority].label}</span>
                <span className={`badge ${statusLabels[selected.status].cls}`}>Durum: {statusLabels[selected.status].label}</span>
                <span className="badge badge-info">Kaynak: {selected.sourceType === 'email' ? '📧 E-posta' : '📞 Telefon'}</span>
              </div>
              <div className="form-group">
                <label className="form-label">İhbar Kaynağı</label>
                <div style={{padding:'var(--space-3)',background:'var(--surface-2)',borderRadius:'var(--border-radius)',fontSize:'var(--text-sm)'}}>{selected.source}</div>
              </div>
              <div className="form-group">
                <label className="form-label">İhbar İçeriği</label>
                <div style={{padding:'var(--space-3)',background:'var(--surface-2)',borderRadius:'var(--border-radius)',fontSize:'var(--text-sm)',lineHeight:1.6}}>{selected.content}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Atanan Muhabir</label>
                <div style={{padding:'var(--space-3)',background:'var(--surface-2)',borderRadius:'var(--border-radius)',fontSize:'var(--text-sm)'}}>{selected.reporter || 'Henüz atanmadı'}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Editör Notu</label>
                <textarea className="form-textarea" placeholder="İhbar hakkında not ekleyin..." rows={3}></textarea>
              </div>
            </div>
            <div className="modal-footer" style={{flexWrap:'wrap'}}>
              <button className="btn btn-ghost">Muhabir Ata</button>
              <button className="btn btn-danger btn-sm">Reddet</button>
              <button className="btn btn-accent">✅ Onayla</button>
              <button className="btn btn-primary">📰 Habere Dönüştür</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
