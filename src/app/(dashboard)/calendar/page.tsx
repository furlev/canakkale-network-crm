'use client';
import { useState, useEffect } from 'react';

type Event = {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string;
};

const eventTypes: Record<string, {label:string, color:string}> = {
  meeting: {label: 'Toplantı', color: 'var(--primary)'},
  deadline: {label: 'Teslim Tarihi', color: 'var(--error)'},
  event: {label: 'Etkinlik', color: 'var(--accent)'},
};

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'meeting', description: '' });
  const [icsUrl, setIcsUrl] = useState<string | null>(null); // abonelik modalı
  const [icsCopied, setIcsCopied] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      if (res.ok) {
        const created = await res.json();
        setEvents([...events, created].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setIsAdding(false);
        setNewEvent({ title: '', date: '', type: 'meeting', description: '' });
      }
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // Kişisel ICS abonelik adresini al ve kopyalanabilir modalda göster
  const handleSubscribe = async () => {
    try {
      const res = await fetch('/api/calendar/ics-link');
      if (res.ok) {
        const data = await res.json();
        setIcsCopied(false);
        setIcsUrl(data.url);
      }
    } catch (error) {
      console.error('Error fetching ics link:', error);
    }
  };

  const copyIcsUrl = async () => {
    if (!icsUrl) return;
    try {
      await navigator.clipboard.writeText(icsUrl);
      setIcsCopied(true);
    } catch {
      // clipboard izni yoksa kullanıcı metni elle seçebilir
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(events.filter(e => e.id !== id));
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Yerel tarihi YYYY-MM-DD anahtarına çevir (UTC kaymasını önlemek için)
  const toKey = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Etkinlikleri güne göre grupla (ay ızgarasında hücrelere yerleştirmek için)
  const eventsByDay: Record<string, Event[]> = {};
  events.forEach(event => {
    const dateStr = toKey(new Date(event.date));
    if (!eventsByDay[dateStr]) eventsByDay[dateStr] = [];
    eventsByDay[dateStr].push(event);
  });

  // Bir güne tıklayınca ekleme modalını o tarihle (12:00) aç
  const handleDayClick = (dayDate: Date) => {
    const dateWithTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 12, 0);
    const localDatetime = `${toKey(dateWithTime)}T12:00`;
    setNewEvent({ title: '', date: localDatetime, type: 'meeting', description: '' });
    setIsAdding(true);
  };

  // Ay navigasyonu
  const goToPrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const goToNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Ay ızgarası: Pazartesi başlangıçlı 6 satır x 7 sütun
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // JS: 0=Paz..6=Cmt. Pzt başlangıç için ofset (Pzt=0..Paz=6)
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const gridDays: Date[] = [];
  for (let i = 0; i < 42; i++) {
    gridDays.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const todayKey = toKey(new Date());
  const weekdayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const monthLabel = viewDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📅 Takvim & Etkinlikler</h1>
          <p className="page-subtitle">Yaklaşan toplantılar ve önemli tarihler</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={handleSubscribe}>📅 Takvime abone ol (Google/Apple)</button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Etkinlik</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : (
        <div className="card">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-4)', gap:'var(--space-2)', flexWrap:'wrap'}}>
            <h2 style={{fontSize:'var(--text-lg)', textTransform:'capitalize', margin:0}}>{monthLabel}</h2>
            <div style={{display:'flex', gap:'var(--space-2)'}}>
              <button className="btn btn-ghost btn-sm" onClick={goToPrevMonth} aria-label="Önceki ay">‹</button>
              <button className="btn btn-ghost btn-sm" onClick={goToToday}>Bugün</button>
              <button className="btn btn-ghost btn-sm" onClick={goToNextMonth} aria-label="Sonraki ay">›</button>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'6px'}}>
            {weekdayLabels.map(w => (
              <div key={w} style={{textAlign:'center', fontSize:'var(--text-xs)', fontWeight:600, color:'var(--text-muted)', padding:'var(--space-2) 0'}}>{w}</div>
            ))}
            {gridDays.map(dayDate => {
              const key = toKey(dayDate);
              const inMonth = dayDate.getMonth() === month;
              const isToday = key === todayKey;
              const dayEvents = eventsByDay[key] || [];
              return (
                <div
                  key={key}
                  onClick={() => handleDayClick(dayDate)}
                  style={{
                    minHeight:'96px',
                    padding:'6px',
                    borderRadius:'var(--border-radius)',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: inMonth ? 'var(--surface-2)' : 'var(--surface)',
                    opacity: inMonth ? 1 : 0.5,
                    cursor:'pointer',
                    display:'flex',
                    flexDirection:'column',
                    gap:'4px',
                  }}
                >
                  <div style={{
                    fontSize:'var(--text-xs)',
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                    textAlign:'right',
                  }}>{dayDate.getDate()}</div>

                  <div style={{display:'flex', flexDirection:'column', gap:'3px', overflow:'hidden'}}>
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        title={`${event.title}${event.description ? ' — ' + event.description : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                        style={{
                          fontSize:'var(--text-xs)',
                          padding:'2px 6px',
                          borderRadius:'4px',
                          background: eventTypes[event.type]?.color || 'var(--primary)',
                          color:'#fff',
                          whiteSpace:'nowrap',
                          overflow:'hidden',
                          textOverflow:'ellipsis',
                          cursor:'pointer',
                        }}
                      >
                        {new Date(event.date).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})} {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {icsUrl && (
        <>
          <div className="modal-backdrop" onClick={() => setIcsUrl(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">📅 Takvim Aboneliği</h2>
              <button className="modal-close" onClick={() => setIcsUrl(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom:'var(--space-3)', fontSize:'var(--text-sm)', color:'var(--text-muted)'}}>
                Bu adresi Google Takvim&apos;de &quot;URL ile ekle&quot; veya Apple Takvim&apos;de &quot;Yeni Takvim Aboneliği&quot; alanına yapıştırın; etkinlikler ve size atanan görevler otomatik senkronize olur.
              </p>
              <div style={{display:'flex', gap:'var(--space-2)'}}>
                <input className="form-input" readOnly value={icsUrl} onFocus={e => e.currentTarget.select()} style={{flex:1, fontSize:'var(--text-xs)'}} />
                <button className="btn btn-primary" onClick={copyIcsUrl}>{icsCopied ? '✓ Kopyalandı' : 'Kopyala'}</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIcsUrl(null)}>Kapat</button>
            </div>
          </div>
        </>
      )}

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Etkinlik</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tarih ve Saat *</label>
                  <input type="datetime-local" className="form-input" value={newEvent.date} onChange={e=>setNewEvent({...newEvent, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tür</label>
                  <select className="form-select" value={newEvent.type} onChange={e=>setNewEvent({...newEvent, type: e.target.value})}>
                    {Object.entries(eventTypes).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={newEvent.description} onChange={e=>setNewEvent({...newEvent, description: e.target.value})}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateEvent}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
