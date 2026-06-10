'use client';
import { useState, useEffect } from 'react';

type Tip = {
  id: string;
  tipNumber: string;
  subject: string;
  content: string;
  source: string;
  sourceType: string;
  priority: string;
  status: string;
  reporter?: { name: string } | null;
  createdAt: string;
};

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
  const [selected, setSelected] = useState<Tip|null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTip, setNewTip] = useState({ subject: '', content: '', source: '', priority: 'normal', sourceType: 'phone' });
  const [checkingMail, setCheckingMail] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const handleCheckMail = async () => {
    setCheckingMail(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/cron/check-tips', { method: 'POST' });
      const data = await res.json();
      setActionMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error || 'Mail kontrolü başarısız'}`);
      if (res.ok && data.created > 0) fetchTips();
    } catch {
      setActionMsg('❌ Sunucuya ulaşılamadı');
    } finally {
      setCheckingMail(false);
    }
  };

  const convertToWordPress = async (tip: Tip) => {
    setActionMsg('');
    try {
      const res = await fetch('/api/wordpress/convert-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId: tip.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`✅ ${data.message}`);
        setTips(prev => prev.map(t => t.id === tip.id ? { ...t, status: 'converted' } : t));
        setSelected(null);
      } else {
        // WP yapılandırılmamışsa yerel olarak işaretleme seçeneği sun
        if (confirm(`WordPress'e gönderilemedi: ${data.error}\n\nİhbar yine de "Habere Dönüştü" olarak işaretlensin mi?`)) {
          updateTipStatus(tip.id, 'converted');
        }
      }
    } catch {
      setActionMsg('❌ Sunucuya ulaşılamadı');
    }
  };

  useEffect(() => {
    fetchTips();
  }, []);

  const fetchTips = async () => {
    try {
      const res = await fetch('/api/tips');
      const data = await res.json();
      setTips(data);
    } catch (error) {
      console.error('Error fetching tips:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTipStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTips(tips.map(t => t.id === id ? { ...t, status: newStatus } : t));
        if (selected?.id === id) {
          setSelected({ ...selected, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Error updating tip:', error);
    }
  };

  const handleCreateTip = async () => {
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTip),
      });
      if (res.ok) {
        const created = await res.json();
        setTips([created, ...tips]);
        setIsAdding(false);
        setNewTip({ subject: '', content: '', source: '', priority: 'normal', sourceType: 'phone' });
      }
    } catch (error) {
      console.error('Error creating tip:', error);
    }
  };

  const stats = [
    {label:'Yeni',value:tips.filter(t=>t.status==='new').length,color:'var(--primary)',icon:'🆕'},
    {label:'İnceleniyor',value:tips.filter(t=>t.status==='investigating').length,color:'var(--info)',icon:'🔍'},
    {label:'Doğrulandı',value:tips.filter(t=>t.status==='verified').length,color:'var(--success)',icon:'✅'},
    {label:'Habere Dönüştü',value:tips.filter(t=>t.status==='converted').length,color:'var(--accent)',icon:'📰'},
    {label:'Reddedildi',value:tips.filter(t=>t.status==='rejected').length,color:'var(--error)',icon:'❌'},
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
          <button className="btn btn-ghost" disabled={checkingMail} onClick={handleCheckMail}>
            📬 {checkingMail ? 'Kontrol ediliyor...' : 'Mailleri Kontrol Et'}
          </button>
          <button className="btn btn-primary" onClick={()=>setIsAdding(true)}>+ Manuel İhbar</button>
        </div>
      </div>

      {actionMsg && (
        <div style={{padding:'var(--space-3) var(--space-4)', borderRadius:'var(--border-radius)', background: actionMsg.startsWith('✅') ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: actionMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize:'var(--text-sm)', marginBottom:'var(--space-4)'}}>
          {actionMsg}
        </div>
      )}

      <div className="stats-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        {stats.map((s,i)=>(
          <div key={i} className="stat-card" style={{borderTop:`2px solid ${s.color}`}}>
            <div className="stat-card-top">
              <span style={{fontSize:'var(--text-xl)'}}>{s.icon}</span>
            </div>
            <div className="stat-card-value" style={{fontSize:'var(--text-2xl)'}}>{loading ? '-' : s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : view === 'kanban' ? (
        <div className="kanban-board">
          {columns.map(col => {
            const items = tips.filter(t => t.status === col.key);
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
                        <span className={`badge ${priorityMap[tip.priority]?.cls || 'badge-primary'}`}>{priorityMap[tip.priority]?.label || tip.priority}</span>
                        <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{tip.tipNumber}</span>
                      </div>
                      <div className="kanban-card-title">{tip.subject}</div>
                      <div className="kanban-card-desc">{tip.content}</div>
                      <div className="kanban-card-footer">
                        <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                          <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>
                            {tip.sourceType === 'email' ? '📧' : '📞'} {tip.source}
                          </span>
                        </div>
                        {tip.reporter && (
                          <div className="avatar avatar-sm" style={{background:'var(--primary-gradient)',color:'white',fontSize:9}}>
                            {tip.reporter.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                        )}
                      </div>
                      <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:'var(--space-2)'}}>
                        {new Date(tip.createdAt).toLocaleDateString('tr-TR')}
                      </div>
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
              {tips.map(tip=>(
                <tr key={tip.id} onClick={()=>setSelected(tip)} style={{cursor:'pointer'}}>
                  <td><span className="font-mono" style={{color:'var(--primary-light)'}}>{tip.tipNumber}</span></td>
                  <td style={{maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tip.subject}</td>
                  <td><span style={{fontSize:'var(--text-xs)'}}>{tip.source}</span></td>
                  <td><span className={`badge ${priorityMap[tip.priority]?.cls}`}>{priorityMap[tip.priority]?.label}</span></td>
                  <td>{tip.reporter?.name || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                  <td><span className={`badge ${statusLabels[tip.status]?.cls}`}>{statusLabels[tip.status]?.label}</span></td>
                  <td style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{new Date(tip.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();setSelected(tip)}}>Detay</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAY MODALI */}
      {selected && (
        <>
          <div className="modal-backdrop" onClick={()=>setSelected(null)} />
          <div className="modal" style={{maxWidth:640}}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selected.subject}</div>
                <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:4}}>{selected.tipNumber} • {new Date(selected.createdAt).toLocaleString('tr-TR')}</div>
              </div>
              <button className="modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{display:'flex',gap:'var(--space-3)',marginBottom:'var(--space-4)',flexWrap:'wrap'}}>
                <span className={`badge ${priorityMap[selected.priority]?.cls}`}>Öncelik: {priorityMap[selected.priority]?.label}</span>
                <span className={`badge ${statusLabels[selected.status]?.cls}`}>Durum: {statusLabels[selected.status]?.label}</span>
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
                <div style={{padding:'var(--space-3)',background:'var(--surface-2)',borderRadius:'var(--border-radius)',fontSize:'var(--text-sm)'}}>{selected.reporter?.name || 'Henüz atanmadı'}</div>
              </div>
            </div>
            <div className="modal-footer" style={{flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={()=>updateTipStatus(selected.id, 'investigating')}>🔍 İncelemeye Al</button>
              <button className="btn btn-danger btn-sm" onClick={()=>updateTipStatus(selected.id, 'rejected')}>Reddet</button>
              <button className="btn btn-accent" onClick={()=>updateTipStatus(selected.id, 'verified')}>✅ Doğrula</button>
              <button className="btn btn-primary" onClick={()=>convertToWordPress(selected)}>📰 Habere Dönüştür (WP Taslak)</button>
            </div>
          </div>
        </>
      )}

      {/* YENİ İHBAR EKLEME MODALI */}
      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={()=>setIsAdding(false)} />
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <div className="modal-title">Yeni Manuel İhbar</div>
              <button className="modal-close" onClick={()=>setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Konu / Başlık</label>
                <input className="form-input" value={newTip.subject} onChange={e=>setNewTip({...newTip, subject: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">İçerik Detayı</label>
                <textarea className="form-textarea" rows={4} value={newTip.content} onChange={e=>setNewTip({...newTip, content: e.target.value})}></textarea>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kaynak (İsim/Tel)</label>
                  <input className="form-input" value={newTip.source} onChange={e=>setNewTip({...newTip, source: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">İletişim Türü</label>
                  <select className="form-select" value={newTip.sourceType} onChange={e=>setNewTip({...newTip, sourceType: e.target.value})}>
                    <option value="phone">Telefon</option>
                    <option value="email">E-posta</option>
                    <option value="social">Sosyal Medya</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Öncelik Durumu</label>
                <select className="form-select" value={newTip.priority} onChange={e=>setNewTip({...newTip, priority: e.target.value})}>
                  <option value="low">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="high">Yüksek</option>
                  <option value="urgent">Acil</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateTip}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
