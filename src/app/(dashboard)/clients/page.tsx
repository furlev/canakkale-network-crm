'use client';

import { useState } from 'react';

interface Client {
  id: number;
  sirket: string;
  temsilci: string;
  email: string;
  telefon: string;
  toplamGelir: string;
  aktifProjeler: number;
  memnuniyetSkoru: number;
  durum: 'Aktif' | 'Pasif';
  sektorIcon: string;
}

const sampleClients: Client[] = [
  {
    id: 1,
    sirket: 'Çanakkale Medya A.Ş.',
    temsilci: 'Ahmet Yılmaz',
    email: 'info@canakkalemedya.com',
    telefon: '+90 286 212 00 00',
    toplamGelir: '₺285.000',
    aktifProjeler: 4,
    memnuniyetSkoru: 92,
    durum: 'Aktif',
    sektorIcon: '📰',
  },
  {
    id: 2,
    sirket: 'Truva Teknoloji Ltd.',
    temsilci: 'Elif Kara',
    email: 'iletisim@truvatech.com',
    telefon: '+90 286 214 55 00',
    toplamGelir: '₺180.500',
    aktifProjeler: 2,
    memnuniyetSkoru: 87,
    durum: 'Aktif',
    sektorIcon: '💻',
  },
  {
    id: 3,
    sirket: 'Gelibolu İnşaat',
    temsilci: 'Mustafa Öztürk',
    email: 'info@geliboluin.com',
    telefon: '+90 286 566 33 00',
    toplamGelir: '₺420.000',
    aktifProjeler: 6,
    memnuniyetSkoru: 95,
    durum: 'Aktif',
    sektorIcon: '🏗️',
  },
  {
    id: 4,
    sirket: 'Dardanel Gıda',
    temsilci: 'Zeynep Çelik',
    email: 'satis@dardanel.com.tr',
    telefon: '+90 286 218 77 00',
    toplamGelir: '₺155.250',
    aktifProjeler: 1,
    memnuniyetSkoru: 78,
    durum: 'Aktif',
    sektorIcon: '🐟',
  },
  {
    id: 5,
    sirket: 'Aegean Digital',
    temsilci: 'Burak Aydın',
    email: 'hello@aegeandigital.io',
    telefon: '+90 532 999 11 22',
    toplamGelir: '₺98.700',
    aktifProjeler: 3,
    memnuniyetSkoru: 84,
    durum: 'Pasif',
    sektorIcon: '🌐',
  },
  {
    id: 6,
    sirket: 'Marmara Holding',
    temsilci: 'Fatma Koç',
    email: 'bilgi@marmaraholding.com',
    telefon: '+90 212 555 00 00',
    toplamGelir: '₺62.300',
    aktifProjeler: 0,
    memnuniyetSkoru: 65,
    durum: 'Pasif',
    sektorIcon: '🏢',
  },
];

const avatarColors = [
  'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  'linear-gradient(135deg, #00cec9, #81ecec)',
  'linear-gradient(135deg, #e17055, #fab1a0)',
  'linear-gradient(135deg, #00b894, #55efc4)',
  'linear-gradient(135deg, #fdcb6e, #ffeaa7)',
  'linear-gradient(135deg, #74b9ff, #a3d8ff)',
];

function getProgressColor(score: number): string {
  if (score >= 90) return 'success';
  if (score >= 75) return 'primary';
  if (score >= 60) return 'warning';
  return 'error';
}

export default function ClientsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>🏢</span> Müşteriler
          </h1>
          <p className="page-subtitle">Müşteri portföyünüzü yönetin</p>
        </div>
        <div className="page-header-actions">
          {/* View Toggle */}
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ▦ Grid
            </button>
            <button
              className={`tab ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰ Liste
            </button>
          </div>
          <button className="btn btn-primary">+ Yeni Müşteri</button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid stagger-children">
        <div className="stat-card primary">
          <div className="stat-card-top">
            <div className="stat-card-icon">👥</div>
            <div className="stat-card-change up">▲ 12%</div>
          </div>
          <div className="stat-card-value counter-animate">48</div>
          <div className="stat-card-label">Toplam Müşteri</div>
        </div>
        <div className="stat-card success">
          <div className="stat-card-top">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-change up">▲ 5%</div>
          </div>
          <div className="stat-card-value counter-animate">42</div>
          <div className="stat-card-label">Aktif</div>
        </div>
        <div className="stat-card error">
          <div className="stat-card-top">
            <div className="stat-card-icon">⏸️</div>
            <div className="stat-card-change down">▼ 2%</div>
          </div>
          <div className="stat-card-value counter-animate">6</div>
          <div className="stat-card-label">Pasif</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-card-top">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-change up">▲ 18%</div>
          </div>
          <div className="stat-card-value counter-animate">₺1.2M</div>
          <div className="stat-card-label">Toplam Gelir</div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid-3 stagger-children">
          {sampleClients.map((client, idx) => (
            <div className="card" key={client.id}>
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <div
                    className="avatar avatar-lg"
                    style={{ background: avatarColors[idx % avatarColors.length], color: 'white' }}
                  >
                    {client.sektorIcon}
                  </div>
                  <div>
                    <div className="card-title" style={{ fontSize: 'var(--text-base)' }}>
                      {client.sirket}
                    </div>
                    <div className="card-subtitle">{client.temsilci}</div>
                  </div>
                </div>
                <span className={`badge ${client.durum === 'Aktif' ? 'badge-success' : 'badge-error'}`}>
                  <span className={`badge-dot ${client.durum === 'Aktif' ? 'success' : 'error'}`} />
                  {client.durum}
                </span>
              </div>

              {/* Client Info */}
              <div className="flex-col gap-3" style={{ display: 'flex', marginBottom: 'var(--space-4)' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>✉️</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{client.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>📞</span>
                  <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{client.telefon}</span>
                </div>
              </div>

              {/* Revenue & Projects */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--border-radius)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div className="font-mono font-bold" style={{ color: 'var(--accent-light)', fontSize: 'var(--text-md)' }}>
                    {client.toplamGelir}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Toplam Gelir</div>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--border-subtle)' }} />
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div className="font-mono font-bold" style={{ color: 'var(--primary-light)', fontSize: 'var(--text-md)' }}>
                    {client.aktifProjeler}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Aktif Proje</div>
                </div>
              </div>

              {/* Satisfaction Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Memnuniyet Skoru</span>
                  <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    %{client.memnuniyetSkoru}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${getProgressColor(client.memnuniyetSkoru)}`}
                    style={{ width: `${client.memnuniyetSkoru}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Şirket</th>
                <th>Temsilci</th>
                <th>E-posta</th>
                <th>Toplam Gelir</th>
                <th>Aktif Projeler</th>
                <th>Memnuniyet</th>
                <th>Durum</th>
                <th style={{ textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {sampleClients.map((client, idx) => (
                <tr key={client.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="avatar"
                        style={{ background: avatarColors[idx % avatarColors.length], color: 'white' }}
                      >
                        {client.sektorIcon}
                      </div>
                      <span className="font-semibold">{client.sirket}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{client.temsilci}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{client.email}</td>
                  <td>
                    <span className="font-mono font-semibold" style={{ color: 'var(--accent-light)' }}>
                      {client.toplamGelir}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono">{client.aktifProjeler}</span>
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div
                          className={`progress-bar-fill ${getProgressColor(client.memnuniyetSkoru)}`}
                          style={{ width: `${client.memnuniyetSkoru}%` }}
                        />
                      </div>
                      <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: 32 }}>
                        %{client.memnuniyetSkoru}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${client.durum === 'Aktif' ? 'badge-success' : 'badge-error'}`}>
                      <span className={`badge-dot ${client.durum === 'Aktif' ? 'success' : 'error'}`} />
                      {client.durum}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center gap-1" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Görüntüle" style={{ width: 32, height: 32 }}>
                        👁️
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm tooltip" data-tooltip="Düzenle" style={{ width: 32, height: 32 }}>
                        ✏️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
