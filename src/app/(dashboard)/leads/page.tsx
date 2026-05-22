'use client';

import { useState } from 'react';

interface LeadCard {
  id: number;
  title: string;
  description: string;
  priority: 'Yüksek' | 'Orta' | 'Düşük';
  assignee: string;
  initials: string;
  date: string;
  value?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  colorClass: string;
  headerBg: string;
  cards: LeadCard[];
}

const initialColumns: KanbanColumn[] = [
  {
    id: 'yeni',
    title: 'Yeni',
    colorClass: 'primary',
    headerBg: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(162, 155, 254, 0.08))',
    cards: [
      {
        id: 1,
        title: 'Çanakkale Belediyesi Portalı',
        description: 'Belediye web sitesi yenileme projesi için teklif talebi alındı.',
        priority: 'Yüksek',
        assignee: 'Ahmet Y.',
        initials: 'AY',
        date: '22 May 2026',
        value: '₺125.000',
      },
      {
        id: 2,
        title: 'Truva Müze Dijital Dönüşüm',
        description: 'Sanal tur ve dijital rehber uygulaması geliştirme talebi.',
        priority: 'Orta',
        assignee: 'Elif K.',
        initials: 'EK',
        date: '20 May 2026',
        value: '₺85.000',
      },
      {
        id: 3,
        title: 'Bozcaada Turizm Platformu',
        description: 'Ada turizmini destekleyecek online rezervasyon sistemi.',
        priority: 'Düşük',
        assignee: 'Burak A.',
        initials: 'BA',
        date: '18 May 2026',
        value: '₺45.000',
      },
    ],
  },
  {
    id: 'iletisimde',
    title: 'İletişimde',
    colorClass: 'info',
    headerBg: 'linear-gradient(135deg, rgba(116, 185, 255, 0.15), rgba(163, 216, 255, 0.08))',
    cards: [
      {
        id: 4,
        title: 'Gelibolu Tarih Akademisi',
        description: 'Online eğitim platformu ve canlı yayın altyapısı kurulumu.',
        priority: 'Yüksek',
        assignee: 'Zeynep Ç.',
        initials: 'ZÇ',
        date: '15 May 2026',
        value: '₺200.000',
      },
      {
        id: 5,
        title: 'Dardanel E-Ticaret',
        description: 'Mevcut web sitesine e-ticaret modülü entegrasyonu.',
        priority: 'Orta',
        assignee: 'Mustafa Ö.',
        initials: 'MÖ',
        date: '12 May 2026',
        value: '₺65.000',
      },
    ],
  },
  {
    id: 'teklif',
    title: 'Teklif Verildi',
    colorClass: 'warning',
    headerBg: 'linear-gradient(135deg, rgba(253, 203, 110, 0.15), rgba(255, 234, 167, 0.08))',
    cards: [
      {
        id: 6,
        title: 'Aegean Digital Rebrand',
        description: 'Kurumsal kimlik yenileme ve marka stratejisi çalışması.',
        priority: 'Orta',
        assignee: 'Ayşe Ş.',
        initials: 'AŞ',
        date: '10 May 2026',
        value: '₺55.000',
      },
      {
        id: 7,
        title: 'TroiaNet Mobil Uygulama',
        description: 'iOS ve Android için müşteri yönetim uygulaması.',
        priority: 'Yüksek',
        assignee: 'Fatma K.',
        initials: 'FK',
        date: '8 May 2026',
        value: '₺150.000',
      },
    ],
  },
  {
    id: 'kazanildi',
    title: 'Kazanıldı',
    colorClass: 'success',
    headerBg: 'linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(85, 239, 196, 0.08))',
    cards: [
      {
        id: 8,
        title: 'Marmara Holding CRM',
        description: 'Kurumsal CRM sistemi tasarım ve geliştirme projesi tamamlandı.',
        priority: 'Yüksek',
        assignee: 'Mehmet D.',
        initials: 'MD',
        date: '5 May 2026',
        value: '₺320.000',
      },
    ],
  },
];

const priorityConfig = {
  Yüksek: { class: 'badge-error', icon: '🔴' },
  Orta: { class: 'badge-warning', icon: '🟡' },
  Düşük: { class: 'badge-info', icon: '🔵' },
};

const avatarColors = [
  'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  'linear-gradient(135deg, #00cec9, #81ecec)',
  'linear-gradient(135deg, #e17055, #fab1a0)',
  'linear-gradient(135deg, #00b894, #55efc4)',
  'linear-gradient(135deg, #fdcb6e, #ffeaa7)',
  'linear-gradient(135deg, #74b9ff, #a3d8ff)',
  'linear-gradient(135deg, #fd79a8, #e84393)',
  'linear-gradient(135deg, #6c5ce7, #00cec9)',
];

const columnDotColors: Record<string, string> = {
  primary: 'var(--primary)',
  info: 'var(--info)',
  warning: 'var(--warning)',
  success: 'var(--success)',
};

export default function LeadsPage() {
  const [columns] = useState<KanbanColumn[]>(initialColumns);

  const totalValue = initialColumns
    .flatMap((c) => c.cards)
    .reduce((sum, card) => {
      const num = parseInt((card.value || '₺0').replace(/[₺.]/g, '').replace(',', ''), 10);
      return sum + num;
    }, 0);

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>🎯</span> Leads
          </h1>
          <p className="page-subtitle">Potansiyel müşterilerinizi takip edin</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">📊 Rapor</button>
          <button className="btn btn-primary">+ Yeni Lead</button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid stagger-children" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">📋</div>
          </div>
          <div className="stat-card-value counter-animate">
            {initialColumns.reduce((s, c) => s + c.cards.length, 0)}
          </div>
          <div className="stat-card-label">Toplam Lead</div>
        </div>
        <div className="stat-card info">
          <div className="stat-card-top">
            <div className="stat-card-icon">📞</div>
          </div>
          <div className="stat-card-value counter-animate">
            {initialColumns.find((c) => c.id === 'iletisimde')?.cards.length || 0}
          </div>
          <div className="stat-card-label">İletişimde</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-top">
            <div className="stat-card-icon">📄</div>
          </div>
          <div className="stat-card-value counter-animate">
            {initialColumns.find((c) => c.id === 'teklif')?.cards.length || 0}
          </div>
          <div className="stat-card-label">Teklif Verildi</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-top">
            <div className="stat-card-icon">🏆</div>
          </div>
          <div className="stat-card-value counter-animate">
            ₺{(totalValue / 1000).toFixed(0)}K
          </div>
          <div className="stat-card-label">Toplam Değer</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {columns.map((column) => (
          <div className="kanban-column" key={column.id}>
            {/* Column Header */}
            <div
              className="kanban-column-header"
              style={{ background: column.headerBg }}
            >
              <div className="kanban-column-title">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: columnDotColors[column.colorClass],
                    display: 'inline-block',
                    boxShadow: `0 0 8px ${columnDotColors[column.colorClass]}`,
                  }}
                />
                {column.title}
                <span className="kanban-column-count">{column.cards.length}</span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--text-md)',
                }}
              >
                +
              </button>
            </div>

            {/* Column Body */}
            <div className="kanban-column-body">
              {column.cards.map((card, cardIdx) => (
                <div className="kanban-card slide-up" key={card.id} style={{ animationDelay: `${cardIdx * 0.08}s` }}>
                  {/* Card Top - Priority */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge ${priorityConfig[card.priority].class}`}>
                      {priorityConfig[card.priority].icon} {card.priority}
                    </span>
                    {card.value && (
                      <span
                        className="font-mono font-semibold"
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-light)' }}
                      >
                        {card.value}
                      </span>
                    )}
                  </div>

                  {/* Card Title & Desc */}
                  <div className="kanban-card-title">{card.title}</div>
                  <div className="kanban-card-desc">{card.description}</div>

                  {/* Card Footer */}
                  <div className="kanban-card-footer">
                    <div className="flex items-center gap-2">
                      <div
                        className="kanban-card-avatar"
                        style={{
                          background: avatarColors[card.id % avatarColors.length],
                          color: 'white',
                        }}
                      >
                        {card.initials}
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {card.assignee}
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      📅 {card.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
