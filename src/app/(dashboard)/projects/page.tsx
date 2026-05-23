'use client';
import { useState, useEffect } from 'react';

type Project = {
  id: string;
  name: string;
  status: string;
  progress: number;
  deadline?: string;
  createdAt: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', status: 'active', progress: 0, deadline: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (res.ok) {
        const created = await res.json();
        setProjects([created, ...projects]);
        setIsAdding(false);
        setNewProject({ name: '', status: 'active', progress: 0, deadline: '' });
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const updateProgress = async (id: string, progress: number) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress }),
      });
      if (res.ok) {
        setProjects(projects.map(p => p.id === id ? { ...p, progress } : p));
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Projeyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🚀 Projeler</h1>
          <p className="page-subtitle">Aktif projeler ve ilerleme durumları</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Proje</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Proje</div>
          <div className="stat-card-value">{loading ? '-' : projects.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Aktif</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>
            {loading ? '-' : projects.filter(p => p.status === 'active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Tamamlanan</div>
          <div className="stat-card-value" style={{color:'var(--accent)'}}>
            {loading ? '-' : projects.filter(p => p.status === 'completed').length}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:'var(--space-8)'}}>Yükleniyor...</div>
      ) : projects.length === 0 ? (
        <div style={{textAlign:'center', padding:'var(--space-8)', color:'var(--text-muted)'}}>Henüz hiç proje eklenmemiş.</div>
      ) : (
        <div className="grid-3">
          {projects.map(project => (
            <div key={project.id} className="card" style={{position:'relative'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-4)'}}>
                <h3 style={{fontSize:'var(--text-lg)'}}>{project.name}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(project.id)}>Sil</button>
              </div>
              
              <div style={{display:'flex', gap:'var(--space-2)', marginBottom:'var(--space-4)'}}>
                <span className={`badge ${project.status === 'active' ? 'badge-primary' : project.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                  {project.status === 'active' ? 'Aktif' : project.status === 'completed' ? 'Tamamlandı' : 'Beklemede'}
                </span>
                {project.deadline && (
                  <span className="badge badge-info">📅 {new Date(project.deadline).toLocaleDateString('tr-TR')}</span>
                )}
              </div>

              <div style={{borderTop:'1px solid var(--border)', paddingTop:'var(--space-4)'}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)', marginBottom:'var(--space-2)'}}>
                  <span>İlerleme</span>
                  <span style={{color:'var(--accent)'}}>{project.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${project.progress}%`, background:'var(--primary-gradient)'}}></div>
                </div>
                
                <div style={{display:'flex', gap:'4px', marginTop:'var(--space-3)'}}>
                  <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={() => updateProgress(project.id, Math.min(100, project.progress + 10))}>+10%</button>
                  <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={() => updateProgress(project.id, 100)}>Bitir</button>
                </div>
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
              <h2 className="modal-title">Yeni Proje Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Proje Adı *</label>
                <input className="form-input" value={newProject.name} onChange={e=>setNewProject({...newProject, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={newProject.status} onChange={e=>setNewProject({...newProject, status: e.target.value})}>
                    <option value="active">Aktif</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="on_hold">Beklemede</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Teslim Tarihi</label>
                  <input type="date" className="form-input" value={newProject.deadline} onChange={e=>setNewProject({...newProject, deadline: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateProject}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
