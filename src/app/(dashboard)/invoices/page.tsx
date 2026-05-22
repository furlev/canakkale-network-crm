'use client';

import { useState } from 'react';

type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'draft';
type TabKey = 'all' | 'paid' | 'pending' | 'overdue' | 'draft';

interface Invoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

const invoices: Invoice[] = [
  { id: '1', number: 'FTR-2024-001', customer: 'Anadolu Medya Grubu', date: '2024-05-15', dueDate: '2024-06-15', amount: 78500, status: 'paid' },
  { id: '2', number: 'FTR-2024-002', customer: 'Ege Yayıncılık A.Ş.', date: '2024-05-18', dueDate: '2024-06-18', amount: 45200, status: 'paid' },
  { id: '3', number: 'FTR-2024-003', customer: 'Boğaz İletişim Ltd.', date: '2024-05-20', dueDate: '2024-06-20', amount: 92000, status: 'pending' },
  { id: '4', number: 'FTR-2024-004', customer: 'Trakya Dijital Hizmetler', date: '2024-04-10', dueDate: '2024-05-10', amount: 34000, status: 'overdue' },
  { id: '5', number: 'FTR-2024-005', customer: 'Marmara Reklam Ajansı', date: '2024-05-22', dueDate: '2024-06-22', amount: 63400, status: 'paid' },
  { id: '6', number: 'FTR-2024-006', customer: 'Karadeniz Teknoloji A.Ş.', date: '2024-05-25', dueDate: '2024-06-25', amount: 55800, status: 'pending' },
  { id: '7', number: 'FTR-2024-007', customer: 'Akdeniz Basım Yayın', date: '2024-03-28', dueDate: '2024-04-28', amount: 10000, status: 'overdue' },
  { id: '8', number: 'FTR-2024-008', customer: 'İstanbul Medya Platformu', date: '2024-05-28', dueDate: '2024-06-28', amount: 106300, status: 'draft' },
];

const statusConfig: Record<InvoiceStatus, { label: string; badge: string }> = {
  paid: { label: 'Ödendi', badge: 'badge badge-success' },
  pending: { label: 'Bekliyor', badge: 'badge badge-warning' },
  overdue: { label: 'Gecikmiş', badge: 'badge badge-error' },
  draft: { label: 'Taslak', badge: 'badge badge-info' },
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'paid', label: 'Ödenen' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'overdue', label: 'Geciken' },
  { key: 'draft', label: 'Taslak' },
];

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

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = invoices.filter((inv) => {
    const matchTab = activeTab === 'all' || inv.status === activeTab;
    const matchSearch =
      inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="main-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>🧾</span> Faturalar
          </h1>
          <p className="page-subtitle">Fatura yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">
            <span>📥</span> Dışa Aktar
          </button>
          <button className="btn btn-primary">
            <span>+</span> Yeni Fatura
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children">
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-change up">+12%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">₺485.200</div>
          <div className="stat-card-label">Toplam</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-top">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-change up">+8%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">₺342.800</div>
          <div className="stat-card-label">Ödenen</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-card-top">
            <div className="stat-card-icon">⏳</div>
            <div className="stat-card-change down">+5%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">₺98.400</div>
          <div className="stat-card-label">Bekleyen</div>
        </div>
        <div className="stat-card error">
          <div className="stat-card-top">
            <div className="stat-card-icon">⚠️</div>
            <div className="stat-card-change down">-3%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">₺44.000</div>
          <div className="stat-card-label">Geciken</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="data-table-container slide-up">
        <div className="data-table-header">
          <div className="data-table-search">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Fatura ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            {filtered.length} fatura
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fatura No</th>
              <th>Müşteri</th>
              <th>Tarih</th>
              <th>Vade Tarihi</th>
              <th style={{ textAlign: 'right' }}>Tutar</th>
              <th>Durum</th>
              <th style={{ textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {filtered.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <span className="font-mono font-semibold" style={{ color: 'var(--primary-light)' }}>
                    {inv.number}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className="avatar-sm"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--primary-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {inv.customer.charAt(0)}
                    </div>
                    <span className="truncate" style={{ maxWidth: 200 }}>
                      {inv.customer}
                    </span>
                  </div>
                </td>
                <td className="text-muted">{formatDate(inv.date)}</td>
                <td className="text-muted">{formatDate(inv.dueDate)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-semibold">{formatCurrency(inv.amount)}</span>
                </td>
                <td>
                  <span className={statusConfig[inv.status].badge}>
                    <span className={`badge-dot ${inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : inv.status === 'overdue' ? 'error' : 'primary'}`} />
                    {statusConfig[inv.status].label}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Görüntüle">👁️</button>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Düzenle">✏️</button>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="PDF İndir">📄</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="data-table-footer">
          <span>{filtered.length} kayıt gösteriliyor</span>
          <div className="pagination">
            <button className="pagination-btn">‹</button>
            <button className="pagination-btn active">1</button>
            <button className="pagination-btn">2</button>
            <button className="pagination-btn">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
