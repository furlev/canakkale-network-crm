'use client';
import { useState } from 'react';

const conversations = [
  {id:1,name:'Mehmet Yılmaz',role:'Editör',avatar:'MY',lastMsg:'Haberin son hali hazır mı?',time:'2 dk',unread:3,online:true},
  {id:2,name:'Ayşe Kaya',role:'Muhabir',avatar:'AK',lastMsg:'İhbar kaynağıyla görüştüm',time:'15 dk',unread:1,online:true},
  {id:3,name:'Can Demir',role:'Satış',avatar:'CD',lastMsg:'Reklam teklifi gönderildi',time:'1 saat',unread:0,online:false},
  {id:4,name:'Zeynep Arslan',role:'Editör',avatar:'ZA',lastMsg:'Fotoğrafları yükledim',time:'3 saat',unread:0,online:true},
  {id:5,name:'Burak Şahin',role:'Muhabir',avatar:'BŞ',lastMsg:'Sahada durum iyi',time:'5 saat',unread:0,online:false},
];

const messagesData: Record<number,{sender:string;text:string;time:string;mine:boolean}[]> = {
  1:[
    {sender:'Mehmet',text:'Merhaba, bugünkü manşet hakkında konuşabilir miyiz?',time:'09:30',mine:false},
    {sender:'Ben',text:'Tabii, hangi konu hakkında düşünüyorsun?',time:'09:32',mine:true},
    {sender:'Mehmet',text:'Boğazdaki gemi trafiği haberi çok dikkat çekici',time:'09:33',mine:false},
    {sender:'Ben',text:'Evet, ihbar da geldi zaten. Kaynakları doğrulamamız lazım.',time:'09:35',mine:true},
    {sender:'Mehmet',text:'Muhabiri sahaya gönderdim, en geç öğlene kadar bilgi gelir',time:'09:36',mine:false},
    {sender:'Mehmet',text:'Haberin son hali hazır mı?',time:'09:45',mine:false},
  ],
  2:[
    {sender:'Ayşe',text:'İhbar kaynağıyla telefonda görüştüm',time:'10:00',mine:false},
    {sender:'Ben',text:'Ne söyledi?',time:'10:02',mine:true},
    {sender:'Ayşe',text:'Bilgiyi doğruladı, fotoğraf da gönderecek',time:'10:05',mine:false},
  ],
};

export default function MessagesPage() {
  const [activeConv, setActiveConv] = useState(1);
  const [msgInput, setMsgInput] = useState('');
  const msgs = messagesData[activeConv] || [];
  const activeUser = conversations.find(c=>c.id===activeConv);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💬 Mesajlar</h1>
          <p className="page-subtitle">Ekip içi iletişim</p>
        </div>
      </div>

      <div className="card" style={{padding:0, display:'grid', gridTemplateColumns:'300px 1fr', minHeight:'calc(100vh - 240px)', overflow:'hidden'}}>
        <div style={{borderRight:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column'}}>
          <div style={{padding:'var(--space-4)', borderBottom:'1px solid var(--border-subtle)'}}>
            <div className="data-table-search" style={{width:'100%'}}><span>🔍</span><input placeholder="Kişi ara..." /></div>
          </div>
          <div style={{flex:1, overflowY:'auto'}}>
            {conversations.map(c=>(
              <div key={c.id} onClick={()=>setActiveConv(c.id)} style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'var(--space-3) var(--space-4)',cursor:'pointer',background:activeConv===c.id?'var(--surface-3)':'transparent',borderBottom:'1px solid var(--border-subtle)',transition:'background var(--transition-fast)'}}>
                <div style={{position:'relative'}}>
                  <div className="avatar" style={{background:'var(--primary-gradient)',color:'white'}}>{c.avatar}</div>
                  {c.online && <div style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:'var(--success)',border:'2px solid var(--bg-primary)'}} />}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:'var(--text-sm)',fontWeight:600}}>{c.name}</span>
                    <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{c.time}</span>
                  </div>
                  <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.lastMsg}</div>
                </div>
                {c.unread > 0 && <span className="sidebar-link-badge">{c.unread}</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column'}}>
          <div style={{padding:'var(--space-4)',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:'var(--space-3)'}}>
            <div className="avatar" style={{background:'var(--primary-gradient)',color:'white'}}>{activeUser?.avatar}</div>
            <div>
              <div style={{fontWeight:600,fontSize:'var(--text-sm)'}}>{activeUser?.name}</div>
              <div style={{fontSize:'var(--text-xs)',color:activeUser?.online?'var(--success)':'var(--text-muted)'}}>{activeUser?.online?'Çevrimiçi':'Çevrimdışı'}</div>
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'var(--space-4)',display:'flex',flexDirection:'column',gap:'var(--space-3)'}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.mine?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'70%',padding:'var(--space-3) var(--space-4)',borderRadius:m.mine?'var(--border-radius-lg) var(--border-radius-lg) 4px var(--border-radius-lg)':'var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px',background:m.mine?'var(--primary)':'var(--surface-3)',color:m.mine?'white':'var(--text-primary)'}}>
                  <div style={{fontSize:'var(--text-sm)',lineHeight:1.5}}>{m.text}</div>
                  <div style={{fontSize:'var(--text-xs)',opacity:0.7,marginTop:4,textAlign:'right'}}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{padding:'var(--space-4)',borderTop:'1px solid var(--border-subtle)',display:'flex',gap:'var(--space-3)'}}>
            <input className="form-input" placeholder="Mesajınızı yazın..." value={msgInput} onChange={e=>setMsgInput(e.target.value)} style={{flex:1}} />
            <button className="btn btn-primary">Gönder</button>
          </div>
        </div>
      </div>
    </div>
  );
}
