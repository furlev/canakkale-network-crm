'use client';

import { useState } from 'react';

type EstimateStatus = 'sent' | 'approved' | 'rejected' | 'draft';

interface Estimate {
  id: string;
  number: string;
  customer: string;
  date: string;
  validUntil: string;
  amount: number;
  status: EstimateStatus;
}

const estimates: Estimate[] = [
  { id: '1', number: 'TKL-2024-001', customer: 'Anadolu Medya Grubu', date: '2024-05-10', validUntil: '2024-06-10', amount: 125000, status: 'approved' },
  { id: '2', number: 'TKL-2024-002', customer: 'Boğaz İletişim Ltd.', date: '2024-05-14', validUntil: '2024-06-14', amount: 68000, status: 'sent' },
  { id: '3', number: 'TKL-2024-003', customer: 'Ege Yayıncılık A.Ş.', date: '2024-05-17', validUntil: '2024-06-17', amount: 42500, status: 'rejected' },
  { id: '4', number: 'TKL-2024-004', customer: 'Trakya Dijital Hizmetler', date: '2024-05-20', validUntil: '2024-06-20', amount: 89700, status: 'draft' },
  { id: '5', number: 'TKL-2024-005', customer: 'Marmara Reklam Ajansı', date: '2024-05-22', validUntil: '2024-06-22', amount: 156200, status: 'approved' },
  { id: '6', number: 'TKL-2024-006', customer: 'Karadeniz Teknoloji A.Ş.', date: '2024-05-25', validUntil: '2024-06-25', amount: 73000, status: 'sent' },
];

const statusConfig: Record<EstimateStatus, { label: string; badge: string }> = {
  sent: { label: 'Gönderildi', badge: 'badge badge-info' },
  approved: { label: 'Onaylandı', badge: 'badge badge-success' },
  rejected: { label: 'Reddedildi', badge: 'badge badge-error' },
  draft: { label: 'Taslak', badge: 'badge badge-warning' },
};

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

export default function EstimatesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const totalValue = estimates.reduce((sum, e) => sum + e.amount, 0);
  const approvedValue = estimates.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = estimates.filter((e) => e.status === 'sent').length;

  const filtered = estimates.filter(
    (e) =>
      e.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="main-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>📋</span> Teklifler
          </h1>
          <p className="page-subtitle">Teklif yönetimi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost">
            <span>📥</span> Dışa Aktar
          </button>
          <button className="btn btn-primary">
            <span>+</span> Yeni Teklif
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children">
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-change up">+15%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{formatCurrency(totalValue)}</div>
          <div className="stat-card-label">Toplam Teklif Değeri</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-top">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-change up">+22%</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{formatCurrency(approvedValue)}</div>
          <div className="stat-card-label">Onaylanan Değer</div>
        </div>
        <div className="stat-card info">
          <div className="stat-card-top">
            <div className="stat-card-icon">📨</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">{pendingCount}</div>
          <div className="stat-card-label">Yanıt Beklenen</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-card-top">
            <div className="stat-card-icon">📈</div>
          </div>
          <div className="stat-card-value font-mono counter-animate">%67</div>
          <div className="stat-card-label">Onay Oranı</div>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-container slide-up">
        <div className="data-table-header">
          <div className="data-table-search">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Teklif ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
            {filtered.length} teklif
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Teklif No</th>
              <th>Müşteri</th>
              <th>Tarih</th>
              <th>Geçerlilik</th>
              <th style={{ textAlign: 'right' }}>Tutar</th>
              <th>Durum</th>
              <th style={{ textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {filtered.map((est) => (
              <tr key={est.id}>
                <td>
                  <span className="font-mono font-semibold" style={{ color: 'var(--primary-light)' }}>
                    {est.number}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accent-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0a0a0f',
                        flexShrink: 0,
                      }}
                    >
                      {est.customer.charAt(0)}
                    </div>
                    <span className="truncate" style={{ maxWidth: 200 }}>
                      {est.customer}
                    </span>
                  </div>
                </td>
                <td className="text-muted">{formatDate(est.date)}</td>
                <td className="text-muted">{formatDate(est.validUntil)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-semibold">{formatCurrency(est.amount)}</span>
                </td>
                <td>
                  <span className={statusConfig[est.status].badge}>
                    <span
                      className={`badge-dot ${
                        est.status === 'approved'
                          ? 'success'
                          : est.status === 'sent'
                          ? 'primary'
                          : est.status === 'rejected'
                          ? 'error'
                          : 'warning'
                      }`}
                    />
                    {statusConfig[est.status].label}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Görüntüle">👁️</button>
                    <button className="btn btn-ghost btn-sm tooltip" data-tooltip="Düzenle">✏️</button>
                    {est.status === 'approved' && (
                      <button
                        className="btn btn-accent btn-sm tooltip"
                        data-tooltip="Faturaya Dönüştür"
                        style={{ gap: '4px' }}
                      >
                        🧾 Faturala
                      </button>
                    )}
                    {est.status === 'draft' && (
                      <button
                        className="btn btn-primary btn-sm tooltip"
                        data-tooltip="Gönder"
                      >
                        📤 Gönder
                      </button>
                    )}
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
            <button className="pagination-btn">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
