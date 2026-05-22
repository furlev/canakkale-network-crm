'use client';

import { useState } from 'react';

type ProjectStatus = 'active' | 'completed' | 'pending' | 'planning';

interface TeamMember {
  initials: string;
  color: string;
}

interface Project {
  id: number;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  team: TeamMember[];
  deadline: string;
  budget: string;
  description: string;
}

const statusConfig: Record<ProjectStatus, { label: string; badge: string }> = {
  active: { label: 'Devam Ediyor', badge: 'badge-primary' },
  completed: { label: 'Tamamlandı', badge: 'badge-success' },
  pending: { label: 'Beklemede', badge: 'badge-warning' },
  planning: { label: 'Planlanıyor', badge: 'badge-info' },
};

const projects: Project[] = [
  {
    id: 1,
    name: 'Web Sitesi Yenileme',
    client: 'Çanakkale Belediyesi',
    status: 'active',
    progress: 72,
    team: [
      { initials: 'AY', color: 'var(--primary-gradient)' },
      { initials: 'MK', color: 'var(--accent-gradient)' },
      { initials: 'SE', color: 'linear-gradient(135deg, #00b894, #55efc4)' },
    ],
    deadline: '15 Haz 2026',
    budget: '₺185.000',
    description: 'Kurumsal web sitesinin modern tasarımla yenilenmesi',
  },
  {
    id: 2,
    name: 'Sosyal Medya Kampanyası',
    client: 'Troya Turizm',
    status: 'active',
    progress: 45,
    team: [
      { initials: 'DÇ', color: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)' },
      { initials: 'AY', color: 'var(--primary-gradient)' },
    ],
    deadline: '30 May 2026',
    budget: '₺52.000',
    description: 'Yaz sezonu için kapsamlı sosyal medya kampanyası',
  },
  {
    id: 3,
    name: 'Haber Portalı Geliştirme',
    client: 'Çanakkale Network',
    status: 'active',
    progress: 88,
    team: [
      { initials: 'MK', color: 'var(--accent-gradient)' },
      { initials: 'SE', color: 'linear-gradient(135deg, #00b894, #55efc4)' },
      { initials: 'BT', color: 'linear-gradient(135deg, #e17055, #fab1a0)' },
      { initials: 'AY', color: 'var(--primary-gradient)' },
    ],
    deadline: '10 Haz 2026',
    budget: '₺320.000',
    description: 'Yeni nesil haber portalı altyapı geliştirmesi',
  },
  {
    id: 4,
    name: 'Mobil Uygulama',
    client: 'Gelibolu Marina',
    status: 'completed',
    progress: 100,
    team: [
      { initials: 'BT', color: 'linear-gradient(135deg, #e17055, #fab1a0)' },
      { initials: 'DÇ', color: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)' },
    ],
    deadline: '01 May 2026',
    budget: '₺275.000',
    description: 'iOS ve Android için marina yönetim uygulaması',
  },
  {
    id: 5,
    name: 'SEO Optimizasyonu',
    client: 'Assos Butik Otel',
    status: 'pending',
    progress: 15,
    team: [
      { initials: 'SE', color: 'linear-gradient(135deg, #00b894, #55efc4)' },
    ],
    deadline: '20 Tem 2026',
    budget: '₺38.000',
    description: 'Otel web sitesi için kapsamlı SEO çalışması',
  },
  {
    id: 6,
    name: 'İçerik Stratejisi',
    client: 'Çanakkale Ticaret Odası',
    status: 'planning',
    progress: 5,
    team: [
      { initials: 'AY', color: 'var(--primary-gradient)' },
      { initials: 'DÇ', color: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)' },
      { initials: 'MK', color: 'var(--accent-gradient)' },
    ],
    deadline: '01 Ağu 2026',
    budget: '₺95.000',
    description: '2026 yılı için dijital içerik stratejisi planlaması',
  },
];

type FilterTab = 'all' | 'active' | 'completed' | 'pending';

export default function ProjectsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return p.status === 'active';
    if (activeFilter === 'completed') return p.status === 'completed';
    if (activeFilter === 'pending') return p.status === 'pending' || p.status === 'planning';
    return true;
  });

  const getProgressBarClass = (status: ProjectStatus) => {
    switch (status) {
      case 'active': return 'primary';
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'planning': return 'info';
      default: return 'primary';
    }
  };

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>📁</span> Projeler
          </h1>
          <p className="page-subtitle">Tüm projelerinizi takip edin</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">
            <span>📊</span> Rapor
          </button>
          <button className="btn btn-primary">
            <span>＋</span> Yeni Proje
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">📂</div>
            <div className="stat-card-change up">▲ 12%</div>
          </div>
          <div className="stat-card-value counter-animate">24</div>
          <div className="stat-card-label">Toplam Proje</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-card-top">
            <div className="stat-card-icon">🚀</div>
            <div className="stat-card-change up">▲ 8%</div>
          </div>
          <div className="stat-card-value counter-animate">18</div>
          <div className="stat-card-label">Aktif Proje</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-top">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-change up">▲ 2</div>
          </div>
          <div className="stat-card-value counter-animate">4</div>
          <div className="stat-card-label">Tamamlanan</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-top">
            <div className="stat-card-icon">⏳</div>
            <div className="stat-card-change down">▼ 1</div>
          </div>
          <div className="stat-card-value counter-animate">2</div>
          <div className="stat-card-label">Bekleyen</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {([
          { key: 'all' as FilterTab, label: 'Tümü', count: 24 },
          { key: 'active' as FilterTab, label: 'Aktif', count: 18 },
          { key: 'completed' as FilterTab, label: 'Tamamlanan', count: 4 },
          { key: 'pending' as FilterTab, label: 'Bekleyen', count: 2 },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeFilter === tab.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Project Cards Grid */}
      <div className="grid-3 stagger-children">
        {filteredProjects.map((project) => (
          <div key={project.id} className="card" style={{ cursor: 'pointer' }}>
            {/* Card Top: Status + Menu */}
            <div className="card-header">
              <span className={`badge ${statusConfig[project.status].badge}`}>
                <span className={`badge-dot ${project.status === 'active' ? 'primary' : project.status === 'completed' ? 'success' : project.status === 'pending' ? 'warning' : 'primary'}`}></span>
                {statusConfig[project.status].label}
              </span>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 28, height: 28 }}>⋮</button>
            </div>

            {/* Project Info */}
            <h3 style={{
              fontSize: 'var(--text-md)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-1)',
            }}>
              {project.name}
            </h3>
            <p style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
            }}>
              {project.description}
            </p>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span>🏢</span> {project.client}
            </p>

            {/* Progress */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>İlerleme</span>
                <span className="font-mono" style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: project.progress === 100 ? 'var(--success)' : 'var(--text-primary)',
                }}>
                  {project.progress}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${getProgressBarClass(project.status)}`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {/* Footer: Avatars + Deadline + Budget */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {/* Team Avatars */}
              <div className="avatar-group">
                {project.team.map((member, i) => (
                  <div
                    key={i}
                    className="avatar avatar-sm tooltip"
                    data-tooltip={member.initials}
                    style={{
                      background: member.color,
                      color: 'white',
                      fontSize: '9px',
                    }}
                  >
                    {member.initials}
                  </div>
                ))}
              </div>

              {/* Meta Info */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  📅 {project.deadline}
                </span>
                <span className="font-mono" style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--accent-light)',
                }}>
                  {project.budget}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
