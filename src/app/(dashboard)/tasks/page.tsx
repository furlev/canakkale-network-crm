'use client';

import { useState } from 'react';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'inprogress' | 'review' | 'done';
type ViewMode = 'kanban' | 'list';

interface Task {
  id: number;
  title: string;
  description: string;
  project: string;
  assignee: string;
  assigneeInitials: string;
  assigneeColor: string;
  priority: Priority;
  status: TaskStatus;
  deadline: string;
}

const priorityConfig: Record<Priority, { label: string; badge: string }> = {
  low: { label: 'Düşük', badge: 'badge-info' },
  normal: { label: 'Normal', badge: 'badge-primary' },
  high: { label: 'Yüksek', badge: 'badge-warning' },
  urgent: { label: 'Acil', badge: 'badge-error' },
};

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'Yapılacak', color: 'var(--text-muted)' },
  inprogress: { label: 'Devam Eden', color: 'var(--primary-light)' },
  review: { label: 'İncelemede', color: 'var(--warning)' },
  done: { label: 'Tamamlandı', color: 'var(--success)' },
};

const tasks: Task[] = [
  {
    id: 1,
    title: 'Ana sayfa tasarımını güncelle',
    description: 'Hero bölümünü yeni marka yönergelerine göre yeniden tasarla',
    project: 'Web Sitesi Yenileme',
    assignee: 'Ahmet Yılmaz',
    assigneeInitials: 'AY',
    assigneeColor: 'var(--primary-gradient)',
    priority: 'high',
    status: 'todo',
    deadline: '28 May 2026',
  },
  {
    id: 2,
    title: 'Veritabanı şemasını optimize et',
    description: 'Haber içerikleri için indeksleme ve sorgu optimizasyonu',
    project: 'Haber Portalı Geliştirme',
    assignee: 'Mehmet Kara',
    assigneeInitials: 'MK',
    assigneeColor: 'var(--accent-gradient)',
    priority: 'urgent',
    status: 'todo',
    deadline: '25 May 2026',
  },
  {
    id: 3,
    title: 'Instagram içerik takvimi oluştur',
    description: 'Haziran ayı için günlük paylaşım planı hazırla',
    project: 'Sosyal Medya Kampanyası',
    assignee: 'Deniz Çelik',
    assigneeInitials: 'DÇ',
    assigneeColor: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)',
    priority: 'normal',
    status: 'todo',
    deadline: '30 May 2026',
  },
  {
    id: 4,
    title: 'Responsive tasarım testleri',
    description: 'Tüm sayfalarda mobil uyumluluk testlerini tamamla',
    project: 'Web Sitesi Yenileme',
    assignee: 'Selin Erdoğan',
    assigneeInitials: 'SE',
    assigneeColor: 'linear-gradient(135deg, #00b894, #55efc4)',
    priority: 'high',
    status: 'todo',
    deadline: '01 Haz 2026',
  },
  {
    id: 5,
    title: 'API entegrasyonlarını tamamla',
    description: 'Üçüncü parti haber kaynaklarıyla API bağlantılarını kur',
    project: 'Haber Portalı Geliştirme',
    assignee: 'Mehmet Kara',
    assigneeInitials: 'MK',
    assigneeColor: 'var(--accent-gradient)',
    priority: 'urgent',
    status: 'inprogress',
    deadline: '26 May 2026',
  },
  {
    id: 6,
    title: 'Reklam banner tasarımları',
    description: 'Facebook ve Google Ads için 5 farklı banner seti',
    project: 'Sosyal Medya Kampanyası',
    assignee: 'Ahmet Yılmaz',
    assigneeInitials: 'AY',
    assigneeColor: 'var(--primary-gradient)',
    priority: 'normal',
    status: 'inprogress',
    deadline: '29 May 2026',
  },
  {
    id: 7,
    title: 'Push bildirim sistemi geliştir',
    description: 'Son dakika haberleri için anlık bildirim altyapısı',
    project: 'Haber Portalı Geliştirme',
    assignee: 'Burak Tekin',
    assigneeInitials: 'BT',
    assigneeColor: 'linear-gradient(135deg, #e17055, #fab1a0)',
    priority: 'high',
    status: 'inprogress',
    deadline: '02 Haz 2026',
  },
  {
    id: 8,
    title: 'SEO anahtar kelime analizi',
    description: 'Rakip analizi ve hedef anahtar kelimelerin belirlenmesi',
    project: 'SEO Optimizasyonu',
    assignee: 'Selin Erdoğan',
    assigneeInitials: 'SE',
    assigneeColor: 'linear-gradient(135deg, #00b894, #55efc4)',
    priority: 'normal',
    status: 'review',
    deadline: '27 May 2026',
  },
  {
    id: 9,
    title: 'Kullanıcı giriş sayfası UI',
    description: 'Login ve kayıt sayfalarının tasarımını tamamla',
    project: 'Web Sitesi Yenileme',
    assignee: 'Deniz Çelik',
    assigneeInitials: 'DÇ',
    assigneeColor: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)',
    priority: 'low',
    status: 'review',
    deadline: '03 Haz 2026',
  },
  {
    id: 10,
    title: 'Marina rezervasyon modülü',
    description: 'Online tekne yeri rezervasyon sisteminin son testleri',
    project: 'Mobil Uygulama',
    assignee: 'Burak Tekin',
    assigneeInitials: 'BT',
    assigneeColor: 'linear-gradient(135deg, #e17055, #fab1a0)',
    priority: 'high',
    status: 'done',
    deadline: '20 May 2026',
  },
  {
    id: 11,
    title: 'Ödeme entegrasyonu',
    description: 'İyzico ödeme altyapısı entegrasyon ve testleri',
    project: 'Mobil Uygulama',
    assignee: 'Mehmet Kara',
    assigneeInitials: 'MK',
    assigneeColor: 'var(--accent-gradient)',
    priority: 'urgent',
    status: 'done',
    deadline: '18 May 2026',
  },
  {
    id: 12,
    title: 'Performans raporlama panosu',
    description: 'Aylık KPI göstergelerini içeren dashboard tasarımı',
    project: 'İçerik Stratejisi',
    assignee: 'Ahmet Yılmaz',
    assigneeInitials: 'AY',
    assigneeColor: 'var(--primary-gradient)',
    priority: 'low',
    status: 'done',
    deadline: '22 May 2026',
  },
];

const columns: { key: TaskStatus; label: string; dotColor: string }[] = [
  { key: 'todo', label: 'Yapılacak', dotColor: 'var(--text-muted)' },
  { key: 'inprogress', label: 'Devam Eden', dotColor: 'var(--primary)' },
  { key: 'review', label: 'İncelemede', dotColor: 'var(--warning)' },
  { key: 'done', label: 'Tamamlandı', dotColor: 'var(--success)' },
];

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  const getColumnTasks = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>✅</span> Görevler
          </h1>
          <p className="page-subtitle">Görevlerinizi organize edin</p>
        </div>
        <div className="page-header-actions">
          {/* View Toggle */}
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              ▦ Kanban
            </button>
            <button
              className={`tab ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰ Liste
            </button>
          </div>
          <button className="btn btn-primary">
            <span>＋</span> Yeni Görev
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        {columns.map((col) => {
          const count = getColumnTasks(col.key).length;
          return (
            <div
              key={col.key}
              className={`stat-card ${col.key === 'todo' ? 'info' : col.key === 'inprogress' ? 'primary' : col.key === 'review' ? 'warning' : 'success'}`}
            >
              <div className="stat-card-top">
                <div className="stat-card-icon">
                  {col.key === 'todo' ? '📋' : col.key === 'inprogress' ? '⚡' : col.key === 'review' ? '🔍' : '🎉'}
                </div>
              </div>
              <div className="stat-card-value counter-animate">{count}</div>
              <div className="stat-card-label">{col.label}</div>
            </div>
          );
        })}
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="kanban-board fade-in">
          {columns.map((col) => {
            const colTasks = getColumnTasks(col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col.dotColor,
                        display: 'inline-block',
                      }}
                    />
                    {col.label}
                  </div>
                  <span className="kanban-column-count">{colTasks.length}</span>
                </div>
                <div className="kanban-column-body">
                  {colTasks.map((task) => (
                    <div key={task.id} className="kanban-card">
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-2)',
                      }}>
                        <span className={`badge ${priorityConfig[task.priority].badge}`} style={{ fontSize: '10px' }}>
                          {priorityConfig[task.priority].label}
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            width: 26,
                            height: 26,
                            padding: 0,
                            fontSize: '14px',
                            borderRadius: 'var(--border-radius-sm)',
                          }}
                          title="Zamanlayıcı"
                        >
                          ⏱️
                        </button>
                      </div>
                      <div className="kanban-card-title">{task.title}</div>
                      <div className="kanban-card-desc">{task.description}</div>
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        marginBottom: 'var(--space-3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        📁 {task.project}
                      </div>
                      <div className="kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div
                            className="kanban-card-avatar"
                            style={{
                              background: task.assigneeColor,
                              color: 'white',
                            }}
                          >
                            {task.assigneeInitials}
                          </div>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {task.assignee.split(' ')[0]}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}>
                          📅 {task.deadline}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="data-table-container fade-in">
          <div className="data-table-header">
            <div className="data-table-search">
              <span style={{ color: 'var(--text-muted)' }}>🔍</span>
              <input type="text" placeholder="Görev ara..." />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm">📥 Dışa Aktar</button>
              <button className="btn btn-ghost btn-sm">🔽 Filtrele</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Görev</th>
                <th>Proje</th>
                <th>Atanan</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>Bitiş Tarihi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="font-semibold" style={{ fontSize: 'var(--text-sm)' }}>{task.title}</span>
                      <span className="text-muted truncate" style={{ fontSize: 'var(--text-xs)', maxWidth: 280 }}>
                        {task.description}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {task.project}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div
                        className="avatar avatar-sm"
                        style={{ background: task.assigneeColor, color: 'white', fontSize: '9px' }}
                      >
                        {task.assigneeInitials}
                      </div>
                      <span style={{ fontSize: 'var(--text-sm)' }}>{task.assignee}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${priorityConfig[task.priority].badge}`}>
                      {priorityConfig[task.priority].label}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      task.status === 'todo' ? 'badge-info' :
                      task.status === 'inprogress' ? 'badge-primary' :
                      task.status === 'review' ? 'badge-warning' :
                      'badge-success'
                    }`}>
                      {statusConfig[task.status].label}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {task.deadline}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      style={{ width: 28, height: 28, fontSize: '14px' }}
                      title="Zamanlayıcı"
                    >
                      ⏱️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="data-table-footer">
            <span>Toplam {tasks.length} görev</span>
            <div className="pagination">
              <button className="pagination-btn">‹</button>
              <button className="pagination-btn active">1</button>
              <button className="pagination-btn">2</button>
              <button className="pagination-btn">›</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
