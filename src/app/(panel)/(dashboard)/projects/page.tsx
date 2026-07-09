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
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: '', status: 'active', progress: 0, deadline: '' });
  const [editError, setEditError] = useState('');

  // ── Kârlılık (zaman kayıtlarından proje bazlı) ──
  const [profit, setProfit] = useState<Record<string, { minutes: number; billable: number }>>({});

  // ── Proje şablonları ──
  type TemplateTaskRow = { title: string; offsetDays?: number; dependsOnIndex?: number | null };
  type Template = { id: string; name: string; description?: string | null; tasks: TemplateTaskRow[] };
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [fromTplOpen, setFromTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState<{ name: string; description: string; tasks: TemplateTaskRow[] }>({ name: '', description: '', tasks: [{ title: '', offsetDays: 0, dependsOnIndex: null }] });
  const [tplError, setTplError] = useState('');
  const [genForm, setGenForm] = useState({ templateId: '', name: '', startDate: '', clientId: '' });
  const [genError, setGenError] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchProfit();
    fetchTemplates();
  }, []);

  const fetchProfit = async () => {
    // Zaman kayıtları (B+ tümünü görür) → projeye göre dakika + faturalanabilir tutar
    try {
      const res = await fetch('/api/time-entries');
      if (!res.ok) return;
      const entries: Array<{ projectId?: string | null; minutes: number; billable: boolean; rate?: number | null }> = await res.json();
      const map: Record<string, { minutes: number; billable: number }> = {};
      for (const e of entries) {
        if (!e.projectId) continue;
        const cur = map[e.projectId] || { minutes: 0, billable: 0 };
        cur.minutes += e.minutes;
        if (e.billable && e.rate) cur.billable += (e.minutes / 60) * e.rate;
        map[e.projectId] = cur;
      }
      setProfit(map);
    } catch (error) {
      console.error('Kârlılık verisi alınamadı:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/project-templates');
      if (res.ok) setTemplates(await res.json());
    } catch (error) {
      console.error('Şablonlar alınamadı:', error);
    }
  };

  const saveTemplate = async () => {
    setTplError('');
    const tasks = tplForm.tasks
      .map(t => ({ ...t, title: t.title.trim() }))
      .filter(t => t.title);
    if (!tplForm.name.trim() || tasks.length === 0) { setTplError('Şablon adı ve en az bir görev gerekli.'); return; }
    try {
      const res = await fetch('/api/project-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tplForm.name.trim(), description: tplForm.description || null, tasks }),
      });
      if (res.ok) {
        setTplForm({ name: '', description: '', tasks: [{ title: '', offsetDays: 0, dependsOnIndex: null }] });
        await fetchTemplates();
      } else {
        const d = await res.json().catch(() => ({}));
        setTplError(d.error || 'Şablon kaydedilemedi.');
      }
    } catch (error) {
      console.error(error); setTplError('Şablon kaydedilemedi.');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Şablonu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/project-templates/${id}`, { method: 'DELETE' });
      if (res.ok) setTemplates(templates.filter(t => t.id !== id));
    } catch (error) { console.error(error); }
  };

  const createFromTemplate = async () => {
    setGenError('');
    if (!genForm.templateId) { setGenError('Bir şablon seçin.'); return; }
    setGenBusy(true);
    try {
      const res = await fetch('/api/projects/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: genForm.templateId,
          name: genForm.name || undefined,
          startDate: genForm.startDate || undefined,
          clientId: genForm.clientId || null,
        }),
      });
      if (res.ok) {
        setFromTplOpen(false);
        setGenForm({ templateId: '', name: '', startDate: '', clientId: '' });
        await fetchProjects();
      } else {
        const d = await res.json().catch(() => ({}));
        setGenError(d.error || 'Proje oluşturulamadı.');
      }
    } catch (error) {
      console.error(error); setGenError('Proje oluşturulamadı.');
    } finally {
      setGenBusy(false);
    }
  };

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

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      status: project.status,
      progress: project.progress,
      deadline: project.deadline ? project.deadline.slice(0, 10) : '',
    });
    setEditError('');
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    if (!editForm.name) return;
    setEditError('');
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...updated } : p));
        setEditingProject(null);
      } else {
        setEditError('Proje güncellenemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      setEditError('Proje güncellenemedi. Lütfen tekrar deneyin.');
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
          <button className="btn btn-ghost" onClick={() => setTemplatesOpen(true)}>📁 Şablonlar</button>
          <button className="btn btn-ghost" onClick={() => { setGenError(''); setFromTplOpen(true); }}>✨ Şablondan Oluştur</button>
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
                <div style={{display:'flex', gap:'4px'}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(project)}>Düzenle</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(project.id)}>Sil</button>
                </div>
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

                {/* Kârlılık — zaman kayıtlarından harcanan saat + faturalanabilir gelir */}
                {profit[project.id] && (
                  <div style={{marginTop:'var(--space-3)', paddingTop:'var(--space-3)', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)'}}>
                    <span style={{color:'var(--text-muted)'}}>⏱️ {Math.round(profit[project.id].minutes / 60 * 10) / 10} saat</span>
                    <span style={{color:'var(--success)', fontWeight:600}}>💰 {profit[project.id].billable.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                  </div>
                )}
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

      {editingProject && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingProject(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Projeyi Düzenle</h2>
              <button className="modal-close" onClick={() => setEditingProject(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editError && <div className="badge badge-error" style={{marginBottom:'var(--space-4)'}}>{editError}</div>}
              <div className="form-group">
                <label className="form-label">Proje Adı *</label>
                <input className="form-input" value={editForm.name} onChange={e=>setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})}>
                    <option value="active">Aktif</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="on_hold">Beklemede</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Teslim Tarihi</label>
                  <input type="date" className="form-input" value={editForm.deadline} onChange={e=>setEditForm({...editForm, deadline: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">İlerleme (%)</label>
                <input type="number" min={0} max={100} className="form-input" value={editForm.progress} onChange={e=>setEditForm({...editForm, progress: Math.min(100, Math.max(0, Number(e.target.value) || 0))})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingProject(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateProject}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {/* Şablondan proje oluştur */}
      {fromTplOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setFromTplOpen(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">✨ Şablondan Proje Oluştur</h2>
              <button className="modal-close" onClick={() => setFromTplOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {genError && <div style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{genError}</div>}
              {templates.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Önce &quot;📁 Şablonlar&quot; menüsünden bir şablon tanımlayın.</div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Şablon *</label>
                    <select className="form-select" value={genForm.templateId} onChange={e => setGenForm({ ...genForm, templateId: e.target.value })}>
                      <option value="">— Seçin —</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tasks.length} görev)</option>)}
                    </select>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Proje Adı (opsiyonel)</label>
                      <input className="form-input" value={genForm.name} onChange={e => setGenForm({ ...genForm, name: e.target.value })} placeholder="Boşsa şablon adı kullanılır" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Başlangıç Tarihi</label>
                      <input type="date" className="form-input" value={genForm.startDate} onChange={e => setGenForm({ ...genForm, startDate: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Şablondaki görevler proje altında oluşturulur; bağımlılık zinciri ve teslim tarihleri (offset gün) otomatik kurulur.
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setFromTplOpen(false)}>İptal</button>
              <button className="btn btn-primary" disabled={genBusy || templates.length === 0} onClick={createFromTemplate}>{genBusy ? 'Oluşturuluyor...' : 'Oluştur'}</button>
            </div>
          </div>
        </>
      )}

      {/* Şablon yönetimi */}
      {templatesOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setTemplatesOpen(false)}></div>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">📁 Proje Şablonları</h2>
              <button className="modal-close" onClick={() => setTemplatesOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {templates.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  {templates.map(t => (
                    <div key={t.id} className="card" style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.tasks.length} görev{t.description ? ` · ${t.description}` : ''}</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteTemplate(t.id)}>Sil</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)' }}>Yeni Şablon</h3>
                {tplError && <div style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{tplError}</div>}
                <div className="form-group">
                  <label className="form-label">Şablon Adı *</label>
                  <input className="form-input" value={tplForm.name} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} placeholder="ör. Kurumsal Web Sitesi" />
                </div>
                <div className="form-group">
                  <label className="form-label">Açıklama</label>
                  <input className="form-input" value={tplForm.description} onChange={e => setTplForm({ ...tplForm, description: e.target.value })} />
                </div>
                <label className="form-label">Görevler</label>
                {tplForm.tasks.map((task, i) => (
                  <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                    <input className="form-input" style={{ flex: 2 }} value={task.title} placeholder={`Görev ${i + 1} başlığı`} onChange={e => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
                    <input className="form-input" style={{ width: 90 }} type="number" min={0} value={task.offsetDays ?? 0} title="Başlangıçtan kaç gün sonra teslim" onChange={e => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x, j) => j === i ? { ...x, offsetDays: parseInt(e.target.value, 10) || 0 } : x) })} />
                    <select className="form-select" style={{ width: 140 }} value={task.dependsOnIndex ?? ''} title="Bağlı olduğu görev" onChange={e => setTplForm({ ...tplForm, tasks: tplForm.tasks.map((x, j) => j === i ? { ...x, dependsOnIndex: e.target.value === '' ? null : parseInt(e.target.value, 10) } : x) })}>
                      <option value="">Bağımsız</option>
                      {tplForm.tasks.map((_, j) => j < i ? <option key={j} value={j}>← Görev {j + 1}</option> : null)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => setTplForm({ ...tplForm, tasks: tplForm.tasks.filter((_, j) => j !== i) })} disabled={tplForm.tasks.length <= 1}>✕</button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setTplForm({ ...tplForm, tasks: [...tplForm.tasks, { title: '', offsetDays: 0, dependsOnIndex: null }] })}>+ Görev Ekle</button>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <button className="btn btn-primary" onClick={saveTemplate}>Şablonu Kaydet</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setTemplatesOpen(false)}>Kapat</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
