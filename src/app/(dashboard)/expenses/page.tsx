'use client';

import { useState } from 'react';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  project: string;
}

interface CategoryInfo {
  label: string;
  amount: number;
  color: string;
  gradient: string;
}

const expenses: Expense[] = [
  { id: '1', date: '2024-05-02', category: 'Personel', description: 'Mayıs ayı maaş ödemeleri', amount: 145000, project: 'Genel' },
  { id: '2', date: '2024-05-05', category: 'Teknoloji', description: 'Sunucu yenileme ve lisanslar', amount: 28500, project: 'Altyapı' },
  { id: '3', date: '2024-05-08', category: 'Ofis', description: 'Kira ve aidat ödemesi', amount: 18000, project: 'Genel' },
  { id: '4', date: '2024-05-10', category: 'Pazarlama', description: 'Google Ads kampanya bütçesi', amount: 12400, project: 'Dijital Pazarlama' },
  { id: '5', date: '2024-05-12', category: 'Diğer', description: 'Hukuk danışmanlık ücreti', amount: 8500, project: 'Genel' },
  { id: '6', date: '2024-05-15', category: 'Teknoloji', description: 'Adobe Creative Cloud yıllık', amount: 6200, project: 'İçerik Üretim' },
  { id: '7', date: '2024-05-18', category: 'Pazarlama', description: 'Sosyal medya sponsorlu içerik', amount: 9800, project: 'Sosyal Medya' },
  { id: '8', date: '2024-05-20', category: 'Ofis', description: 'Kırtasiye ve sarf malzeme', amount: 3200, project: 'Genel' },
];

const categories: CategoryInfo[] = [
  { label: 'Personel', amount: 145000, color: 'var(--primary-light)', gradient: 'var(--primary-gradient)' },
  { label: 'Ofis', amount: 21200, color: 'var(--accent-light)', gradient: 'var(--accent-gradient)' },
  { label: 'Teknoloji', amount: 34700, color: 'var(--info-light)', gradient: 'linear-gradient(135deg, #74b9ff, #a3d8ff)' },
  { label: 'Pazarlama', amount: 22200, color: 'var(--warning-light)', gradient: 'linear-gradient(135deg, #fdcb6e, #ffeaa7)' },
  { label: 'Diğer', amount: 8500, color: 'var(--error-light)', gradient: 'linear-gradient(135deg, #e17055, #fab1a0)' },
];

const totalExpense = categories.reduce((sum, c) => sum + c.amount, 0);
const maxCategory = Math.max(...categories.map((c) => c.amount));

function formatCurrency(value: number): string {
  return '₺' + value.toLocaleString('tr-TR');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const categoryEmoji: Record<string, string> = {
  'Personel': '👥',
  'Ofis': '🏢',
  'Teknoloji': '💻',
  'Pazarlama': '📢',
  'Diğer': '📁',
};

export default function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.project.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="main-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>💸</span> Giderler
          </h1>
          <p className="page-subtitle">Gider takibi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">
            <span>📥</span> Rapor İndir
          </button>
          <button className="btn btn-primary">
            <span>+</span> Yeni Gider
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid stagger-children">
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-change down">+7%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{formatCurrency(totalExpense)}</div>
          <div className="stat-card-label">Toplam Gider (Bu Ay)</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-top">
            <div className="stat-card-icon">📊</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{expenses.length}</div>
          <div className="stat-card-label">İşlem Sayısı</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-card-top">
            <div className="stat-card-icon">📈</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{formatCurrency(Math.round(totalExpense / expenses.length))}</div>
          <div className="stat-card-label">Ortalama Gider</div>
        </div>
        <div className="stat-card info">
          <div className="stat-card-top">
            <div className="stat-card-icon">🏷️</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{categories.length}</div>
          <div className="stat-card-label">Kategori</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="card mb-6 slide-up">
        <div className="card-header">
          <h3 className="card-title">Kategori Dağılımı</h3>
          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            Bu ay
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {categories.map((cat) => {
            const pct = Math.round((cat.amount / totalExpense) * 100);
            const barWidth = Math.round((cat.amount / maxCategory) * 100);
            return (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{categoryEmoji[cat.label]}</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: cat.color }}>
                      {formatCurrency(cat.amount)}
                    </span>
                    <span className="badge badge-primary font-mono" style={{ minWidth: 42, textAlign: 'center' }}>
                      %{pct}
                    </span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: cat.gradient,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="data-table-container slide-up">
        <div className="data-table-header">
          <div className="data-table-search">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Gider ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            {filtered.length} gider
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Kategori</th>
              <th>Açıklama</th>
              <th style={{ textAlign: 'right' }}>Tutar</th>
              <th>Proje</th>
              <th style={{ textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {filtered.map((exp) => (
              <tr key={exp.id}>
                <td className="text-muted">{formatDate(exp.date)}</td>
                <td>
                  <span className="badge badge-primary">
                    {categoryEmoji[exp.category]} {exp.category}
                  </span>
                </td>
                <td style={{ color: 'var(--text-primary)' }}>{exp.description}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-semibold text-error">{formatCurrency(exp.amount)}</span>
                </td>
                <td>
                  <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {exp.project}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Düzenle">✏️</button>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Sil">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="data-table-footer">
          <span>{filtered.length} kayıt gösteriliyor</span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold" style={{ color: 'var(--error-light)' }}>
              Toplam: {formatCurrency(filtered.reduce((sum, e) => sum + e.amount, 0))}
            </span>
            <div className="pagination">
              <button className="pagination-btn">‹</button>
              <button className="pagination-btn active">1</button>
              <button className="pagination-btn">›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
