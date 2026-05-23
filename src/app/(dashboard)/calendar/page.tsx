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

  // Group events by day for a simple calendar view
  const eventsByDay: Record<string, Event[]> = {};
  events.forEach(event => {
    const d = new Date(event.date);
    const dateStr = d.toISOString().split('T')[0];
    if (!eventsByDay[dateStr]) eventsByDay[dateStr] = [];
    eventsByDay[dateStr].push(event);
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📅 Takvim & Etkinlikler</h1>
          <p className="page-subtitle">Yaklaşan toplantılar ve önemli tarihler</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Etkinlik</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : events.length === 0 ? (
        <div style={{textAlign:'center', padding:'var(--space-8)', color:'var(--text-muted)'}}>Yaklaşan etkinlik yok.</div>
      ) : (
        <div className="grid-2">
          {Object.entries(eventsByDay).map(([dateStr, dayEvents]) => (
            <div key={dateStr} className="card" style={{borderLeft: '4px solid var(--border)'}}>
              <h3 style={{fontSize:'var(--text-lg)', marginBottom:'var(--space-4)', display:'flex', alignItems:'center', gap:'8px'}}>
                <span>🗓️</span> {new Date(dateStr).toLocaleDateString('tr-TR', {weekday:'long', month:'long', day:'numeric'})}
              </h3>
              
              <div style={{display:'flex', flexDirection:'column', gap:'var(--space-3)'}}>
                {dayEvents.map(event => (
                  <div key={event.id} style={{
                    padding:'var(--space-3)', 
                    background:'var(--surface-2)', 
                    borderRadius:'var(--border-radius)',
                    borderLeft: `3px solid ${eventTypes[event.type]?.color || 'var(--primary)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{fontWeight:500, marginBottom:'4px'}}>{event.title}</div>
                      {event.description && <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>{event.description}</div>}
                      <div style={{fontSize:'var(--text-xs)', marginTop:'8px', display:'inline-block', padding:'2px 6px', background:'var(--surface)', borderRadius:'4px'}}>
                        {new Date(event.date).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(event.id)}>Sil</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
