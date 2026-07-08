'use client';
import { useState, useEffect } from 'react';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  recurrence?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string } | null;
  createdAt: string;
};

type TeamMember = {
  id: string;
  name: string;
};

type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string;
  recurrence: string;
};

const emptyForm: TaskForm = { title: '', description: '', status: 'todo', priority: 'normal', dueDate: '', assigneeId: '', recurrence: '' };

const columns = [
  { key: 'todo', title: 'Yapılacak', color: 'var(--border-strong)' },
  { key: 'in_progress', title: 'Devam Ediyor', color: 'var(--info)' },
  { key: 'review', title: 'İncelemede', color: 'var(--warning)' },
  { key: 'done', title: 'Tamamlandı', color: 'var(--success)' },
];

const priorityMap: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Acil', cls: 'badge-error' },
  high: { label: 'Yüksek', cls: 'badge-warning' },
  normal: { label: 'Normal', cls: 'badge-primary' },
  low: { label: 'Düşük', cls: 'badge-info' },
};

const recurrenceMap: Record<string, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
};

export default function TasksPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  const formPayload = () => ({
    title: form.title,
    description: form.description,
    status: form.status,
    priority: form.priority,
    dueDate: form.dueDate || null,
    assigneeId: form.assigneeId || null,
    recurrence: form.recurrence || null,
  });

  const handleCreateTask = async () => {
    if (!form.title) return;
    setFormError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPayload()),
      });
      if (res.ok) {
        setIsAdding(false);
        setForm(emptyForm);
        await fetchTasks(); // atanan kişi bilgisiyle birlikte tazele
      } else {
        setFormError('Görev oluşturulamadı. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setFormError('Görev oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  const openEdit = (task: Task) => {
    setFormError('');
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      assigneeId: task.assigneeId || '',
      recurrence: task.recurrence || '',
    });
  };

  const handleUpdateTask = async () => {
    if (!editingId || !form.title) return;
    setFormError('');
    try {
      const res = await fetch(`/api/tasks/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPayload()),
      });
      if (res.ok) {
        setEditingId(null);
        setForm(emptyForm);
        await fetchTasks(); // tekrarlayan görevde yeni örnek oluşmuş olabilir
      } else {
        setFormError('Güncelleme başarısız oldu. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setFormError('Güncelleme başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  /** Durum değişikliği: iyimser güncelle, hata olursa geri al */
  const moveTask = async (id: string, newStatus: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === newStatus) return;
    const prevTasks = tasks;
    setTasks(tasks.map(t => (t.id === id ? { ...t, status: newStatus } : t)));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks(prevTasks); // geri al
        return;
      }
      // Tekrarlayan görev tamamlandıysa API yeni örneği üretti — listeyi tazele
      if (newStatus === 'done' && task.recurrence) {
        await fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setTasks(prevTasks); // geri al
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Görevi silmek istediğinize emin misiniz? (Çöp kutusundan geri alınabilir)')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveTask(id, status);
  };

  const isOverdue = (task: Task) =>
    !!task.dueDate && task.status !== 'done' && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

  const visibleTasks = tasks.filter(t =>
    (!filterAssignee || t.assigneeId === filterAssignee) &&
    (!filterPriority || t.priority === filterPriority)
  );

  const closeModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  };

  const renderCard = (task: Task) => (
    <div
      key={task.id}
      className="kanban-card"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => openEdit(task)}
      style={{ cursor: 'grab' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`badge ${priorityMap[task.priority]?.cls || 'badge-primary'}`}>
            {priorityMap[task.priority]?.label || task.priority}
          </span>
          {task.recurrence && (
            <span title={`Tekrarlayan görev: ${recurrenceMap[task.recurrence] || task.recurrence}`}>🔁</span>
          )}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 0, color: 'var(--text-muted)' }}
          onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
        >
          🗑️
        </button>
      </div>
      <div className="kanban-card-title">{task.title}</div>
      {task.description && <div className="kanban-card-desc">{task.description}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        <span>{task.assignee ? `👤 ${task.assignee.name}` : ''}</span>
        {task.dueDate && (
          <span style={isOverdue(task) ? { color: 'var(--error)', fontWeight: 600 } : undefined}>
            📅 {new Date(task.dueDate).toLocaleDateString('tr-TR')}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">✅ Görevler</h1>
          <p className="page-subtitle">Kişisel ve ekibe atanan görevler — kartları sürükleyerek durum değiştirin</p>
        </div>
        <div className="page-header-actions">
          <select className="form-select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
            <option value="">Tüm Kişiler</option>
            {team.map(member => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">Tüm Öncelikler</option>
            <option value="urgent">Acil</option>
            <option value="high">Yüksek</option>
            <option value="normal">Normal</option>
            <option value="low">Düşük</option>
          </select>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
            <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>Liste</button>
          </div>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setIsAdding(true); }}>+ Yeni Görev</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Yükleniyor...</div>
      ) : view === 'kanban' ? (
        <div className="kanban-board">
          {columns.map(col => {
            const items = visibleTasks.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                className="kanban-column"
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDragEnter={() => setDragOverCol(col.key)}
                onDragLeave={e => {
                  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOverCol(null);
                }}
                onDrop={e => handleDrop(e, col.key)}
                style={dragOverCol === col.key ? { outline: '2px dashed var(--primary)', outlineOffset: '-2px' } : undefined}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                    {col.title}
                    <span className="kanban-column-count">{items.length}</span>
                  </div>
                </div>
                <div className="kanban-column-body">
                  {items.map(renderCard)}
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
                <th>Görev</th><th>Öncelik</th><th>Atanan</th><th>Durum</th><th>Bitiş Tarihi</th><th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {task.title} {task.recurrence && <span title={`Tekrarlayan: ${recurrenceMap[task.recurrence] || task.recurrence}`}>🔁</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{task.description}</div>
                  </td>
                  <td><span className={`badge ${priorityMap[task.priority]?.cls}`}>{priorityMap[task.priority]?.label}</span></td>
                  <td>{task.assignee?.name || '—'}</td>
                  <td>
                    <select className="form-select" style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }} value={task.status} onChange={e => moveTask(task.id, e.target.value)}>
                      <option value="todo">Yapılacak</option>
                      <option value="in_progress">Devam Ediyor</option>
                      <option value="review">İncelemede</option>
                      <option value="done">Tamamlandı</option>
                    </select>
                  </td>
                  <td style={isOverdue(task) ? { color: 'var(--error)', fontWeight: 600 } : undefined}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(task)}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(task.id)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isAdding || editingId) && (
        <>
          <div className="modal-backdrop" onClick={closeModal}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Görevi Düzenle' : 'Yeni Görev'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{formError}</div>}
              <div className="form-group">
                <label className="form-label">Görev Başlığı *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}></textarea>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Öncelik</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Son Teslim</label>
                  <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="todo">Yapılacak</option>
                    <option value="in_progress">Devam Ediyor</option>
                    <option value="review">İncelemede</option>
                    <option value="done">Tamamlandı</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tekrar 🔁</label>
                  <select className="form-select" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                    <option value="">Yok</option>
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Atanan Kişi</label>
                <select className="form-select" value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>
                  <option value="">Atanmadı</option>
                  {team.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>İptal</button>
              <button className="btn btn-primary" onClick={editingId ? handleUpdateTask : handleCreateTask}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
