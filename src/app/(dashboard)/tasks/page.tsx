'use client';
import { useState, useEffect } from 'react';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  createdAt: string;
};

type TeamMember = {
  id: string;
  name: string;
};

const columns = [
  {key:'todo',title:'Yapılacaklar',color:'var(--border-strong)'},
  {key:'in_progress',title:'Devam Edenler',color:'var(--info)'},
  {key:'review',title:'İncelemede',color:'var(--warning)'},
  {key:'done',title:'Tamamlandı',color:'var(--success)'},
];

const priorityMap: Record<string,{label:string;cls:string}> = {
  urgent:{label:'Acil',cls:'badge-error'},
  high:{label:'Yüksek',cls:'badge-warning'},
  normal:{label:'Normal',cls:'badge-primary'},
  low:{label:'Düşük',cls:'badge-info'},
};

export default function TasksPage() {
  const [view, setView] = useState<'kanban'|'list'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'todo', priority: 'normal', dueDate: '', assigneeId: '' });

  useEffect(() => {
    fetchTasks();
    fetchTeam();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks([created, ...tasks]);
        setIsAdding(false);
        setNewTask({ title: '', description: '', status: 'todo', priority: 'normal', dueDate: '', assigneeId: '' });
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const prevStatusMap: Record<string, string> = {
    review: 'in_progress',
    in_progress: 'todo',
    done: 'review',
  };

  const updateTaskStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Görevi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">✅ Görevler</h1>
          <p className="page-subtitle">Kişisel ve ekibe atanan görevler</p>
        </div>
        <div className="page-header-actions">
          <div className="tabs" style={{marginBottom:0}}>
            <button className={`tab ${view==='kanban'?'active':''}`} onClick={()=>setView('kanban')}>Kanban</button>
            <button className={`tab ${view==='list'?'active':''}`} onClick={()=>setView('list')}>Liste</button>
          </div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Görev</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : view === 'kanban' ? (
        <div className="kanban-board">
          {columns.map(col => {
            const items = tasks.filter(t => t.status === col.key);
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
                  {items.map(task => (
                    <div key={task.id} className="kanban-card">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'var(--space-2)'}}>
                        <span className={`badge ${priorityMap[task.priority]?.cls || 'badge-primary'}`}>{priorityMap[task.priority]?.label || task.priority}</span>
                        <button className="btn btn-ghost btn-sm" style={{padding:0,color:'var(--text-muted)'}} onClick={() => handleDelete(task.id)}>🗑️</button>
                      </div>
                      <div className="kanban-card-title">{task.title}</div>
                      <div className="kanban-card-desc">{task.description}</div>
                      
                      {task.dueDate && (
                        <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)', marginBottom:'var(--space-3)'}}>
                          📅 {new Date(task.dueDate).toLocaleDateString('tr-TR')}
                        </div>
                      )}
                      
                      <div style={{display:'flex', gap:'4px', marginTop:'var(--space-3)', borderTop:'1px solid var(--border)', paddingTop:'var(--space-2)'}}>
                        {col.key !== 'todo' && <button className="btn btn-ghost btn-sm" style={{flex:1, fontSize:'10px'}} onClick={() => updateTaskStatus(task.id, prevStatusMap[col.key] || 'todo')}>Geri</button>}
                        {col.key === 'todo' && <button className="btn btn-ghost btn-sm" style={{flex:1, fontSize:'10px'}} onClick={() => updateTaskStatus(task.id, 'in_progress')}>Başla</button>}
                        {col.key === 'in_progress' && <button className="btn btn-ghost btn-sm" style={{flex:1, fontSize:'10px'}} onClick={() => updateTaskStatus(task.id, 'review')}>İncelemeye Al</button>}
                        {col.key === 'review' && <button className="btn btn-ghost btn-sm" style={{flex:1, fontSize:'10px'}} onClick={() => updateTaskStatus(task.id, 'done')}>Tamamla</button>}
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Görev</th><th>Öncelik</th><th>Durum</th><th>Bitiş Tarihi</th><th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task=>(
                <tr key={task.id}>
                  <td>
                    <div style={{fontWeight:500}}>{task.title}</div>
                    <div style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{task.description}</div>
                  </td>
                  <td><span className={`badge ${priorityMap[task.priority]?.cls}`}>{priorityMap[task.priority]?.label}</span></td>
                  <td>
                    <select className="form-select" style={{padding:'2px 8px', fontSize:'var(--text-xs)'}} value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                      <option value="todo">Yapılacak</option>
                      <option value="in_progress">Devam Ediyor</option>
                      <option value="review">İncelemede</option>
                      <option value="done">Tamamlandı</option>
                    </select>
                  </td>
                  <td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(task.id)}>Sil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Görev</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Görev Başlığı *</label>
                <input className="form-input" value={newTask.title} onChange={e=>setNewTask({...newTask, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={newTask.description} onChange={e=>setNewTask({...newTask, description: e.target.value})}></textarea>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={newTask.priority} onChange={e=>setNewTask({...newTask, priority: e.target.value})}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Son Teslim</label>
                  <input type="date" className="form-input" value={newTask.dueDate} onChange={e=>setNewTask({...newTask, dueDate: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Atanan Kişi</label>
                <select className="form-select" value={newTask.assigneeId} onChange={e=>setNewTask({...newTask, assigneeId: e.target.value})}>
                  <option value="">Atanmadı</option>
                  {team.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateTask}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
