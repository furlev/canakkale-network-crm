'use client';
import { useState } from 'react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const dayNames = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const events: Record<number, {title:string; color:string; time:string}[]> = {
    3: [{title:'Ekip Toplantısı', color:'var(--primary)', time:'10:00'}],
    7: [{title:'Müşteri Sunumu', color:'var(--accent)', time:'14:00'}, {title:'Haber Deadline', color:'var(--error)', time:'18:00'}],
    12: [{title:'Sprint Review', color:'var(--primary)', time:'11:00'}],
    15: [{title:'Fatura Kesimi', color:'var(--warning)', time:'09:00'}],
    18: [{title:'Basın Toplantısı', color:'var(--success)', time:'15:00'}],
    22: [{title:'İhbar Değerlendirme', color:'var(--error)', time:'10:00'}],
    25: [{title:'Strateji Toplantısı', color:'var(--primary)', time:'13:00'}],
    28: [{title:'Performans Raporu', color:'var(--accent)', time:'16:00'}],
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const days: (number|null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const todayDate = new Date();
  const isToday = (d: number) => d === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();
  const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📅 Takvim</h1>
          <p className="page-subtitle">Etkinlik ve görevlerinizi planlayın</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary">+ Yeni Etkinlik</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:'var(--space-6)'}}>
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-6)'}}>
            <button className="btn btn-ghost" onClick={prevMonth}>◀</button>
            <h2 style={{fontSize:'var(--text-xl)', fontWeight:700}}>{monthNames[month]} {year}</h2>
            <div style={{display:'flex', gap:'var(--space-2)'}}>
              <button className="btn btn-ghost btn-sm" onClick={today}>Bugün</button>
              <button className="btn btn-ghost" onClick={nextMonth}>▶</button>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px'}}>
            {dayNames.map(d => (
              <div key={d} style={{padding:'var(--space-2)', textAlign:'center', fontSize:'var(--text-xs)', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase'}}>{d}</div>
            ))}
            {days.map((day, i) => (
              <div key={i} onClick={() => day && setSelectedDate(day)} style={{
                minHeight: 80,
                padding: 'var(--space-2)',
                background: day === selectedDate ? 'var(--surface-3)' : day ? 'var(--surface-1)' : 'transparent',
                borderRadius: 'var(--border-radius)',
                cursor: day ? 'pointer' : 'default',
                border: isToday(day!) ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                transition: 'all var(--transition-fast)',
              }}>
                {day && (
                  <>
                    <span style={{fontSize:'var(--text-sm)', fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? 'var(--primary-light)' : 'var(--text-primary)'}}>{day}</span>
                    <div style={{marginTop:4, display:'flex', flexDirection:'column', gap:2}}>
                      {(events[day] || []).map((e, j) => (
                        <div key={j} style={{fontSize:10, padding:'1px 4px', borderRadius:4, background:`${e.color}22`, color:e.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{e.title}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{marginBottom:'var(--space-4)'}}>
            <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>
              {selectedDate ? `${selectedDate} ${monthNames[month]}` : 'Gün Seçin'}
            </h3>
            {selectedDate && selectedEvents.length > 0 ? (
              <div style={{display:'flex', flexDirection:'column', gap:'var(--space-3)'}}>
                {selectedEvents.map((e, i) => (
                  <div key={i} style={{padding:'var(--space-3)', background:'var(--surface-2)', borderRadius:'var(--border-radius)', borderLeft:`3px solid ${e.color}`}}>
                    <div style={{fontWeight:600, fontSize:'var(--text-sm)'}}>{e.title}</div>
                    <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4}}>🕐 {e.time}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{color:'var(--text-muted)', fontSize:'var(--text-sm)'}}>
                {selectedDate ? 'Bu günde etkinlik yok' : 'Etkinlikleri görmek için bir gün seçin'}
              </p>
            )}
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:'var(--space-4)'}}>Yaklaşan Etkinlikler</h3>
            {[{t:'Ekip Toplantısı',d:'3 gün sonra',c:'var(--primary)'},{t:'Müşteri Sunumu',d:'7 gün sonra',c:'var(--accent)'},{t:'Sprint Review',d:'12 gün sonra',c:'var(--success)'}].map((e,i)=>(
              <div key={i} style={{display:'flex', alignItems:'center', gap:'var(--space-3)', padding:'var(--space-3) 0', borderBottom:'1px solid var(--border-subtle)'}}>
                <div style={{width:8, height:8, borderRadius:'50%', background:e.c, flexShrink:0}} />
                <div>
                  <div style={{fontSize:'var(--text-sm)', fontWeight:500}}>{e.t}</div>
                  <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>{e.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
