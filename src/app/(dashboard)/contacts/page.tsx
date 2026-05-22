'use client';

import { useState } from 'react';

interface Contact {
  id: number;
  ad: string;
  soyad: string;
  email: string;
  telefon: string;
  sirket: string;
  durum: 'Aktif' | 'Pasif';
  selected: boolean;
}

const sampleContacts: Contact[] = [
  { id: 1, ad: 'Ahmet', soyad: 'Yılmaz', email: 'ahmet.yilmaz@canakkale.net', telefon: '+90 532 111 22 33', sirket: 'Çanakkale Medya A.Ş.', durum: 'Aktif', selected: false },
  { id: 2, ad: 'Elif', soyad: 'Kara', email: 'elif.kara@bogazici.com', telefon: '+90 544 222 33 44', sirket: 'Boğaziçi Yazılım', durum: 'Aktif', selected: false },
  { id: 3, ad: 'Mehmet', soyad: 'Demir', email: 'mehmet.demir@truva.tech', telefon: '+90 505 333 44 55', sirket: 'Truva Teknoloji', durum: 'Pasif', selected: false },
  { id: 4, ad: 'Zeynep', soyad: 'Çelik', email: 'zeynep.celik@gelibolu.com', telefon: '+90 533 444 55 66', sirket: 'Gelibolu İnşaat', durum: 'Aktif', selected: false },
  { id: 5, ad: 'Mustafa', soyad: 'Öztürk', email: 'mustafa.ozturk@dardanel.com', telefon: '+90 542 555 66 77', sirket: 'Dardanel Gıda', durum: 'Aktif', selected: false },
  { id: 6, ad: 'Ayşe', soyad: 'Şahin', email: 'ayse.sahin@aegean.io', telefon: '+90 551 666 77 88', sirket: 'Aegean Digital', durum: 'Aktif', selected: false },
  { id: 7, ad: 'Burak', soyad: 'Aydın', email: 'burak.aydin@troianet.com', telefon: '+90 506 777 88 99', sirket: 'TroiaNet Bilişim', durum: 'Pasif', selected: false },
  { id: 8, ad: 'Fatma', soyad: 'Koç', email: 'fatma.koc@marmara.com.tr', telefon: '+90 537 888 99 00', sirket: 'Marmara Holding', durum: 'Aktif', selected: false },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts);
  const [activeTab, setActiveTab] = useState<'Tümü' | 'Aktif' | 'Pasif'>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Form state
  const [formAd, setFormAd] = useState('');
  const [formSoyad, setFormSoyad] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefon, setFormTelefon] = useState('');
  const [formSirket, setFormSirket] = useState('');
  const [formNotlar, setFormNotlar] = useState('');

  const filteredContacts = contacts.filter((c) => {
    const matchesTab = activeTab === 'Tümü' || c.durum === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      `${c.ad} ${c.soyad}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.sirket.toLowerCase().includes(q) ||
      c.telefon.includes(q);
    return matchesTab && matchesSearch;
  });

  const handleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    setContacts((prev) => prev.map((c) => ({ ...c, selected: next })));
  };

  const handleSelect = (id: number) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleDelete = (id: number) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const resetForm = () => {
    setFormAd('');
    setFormSoyad('');
    setFormEmail('');
    setFormTelefon('');
    setFormSirket('');
    setFormNotlar('');
  };

  const handleAddContact = () => {
    if (!formAd || !formSoyad) return;
    const newContact: Contact = {
      id: Date.now(),
      ad: formAd,
      soyad: formSoyad,
      email: formEmail || `${formAd.toLowerCase()}.${formSoyad.toLowerCase()}@ornek.com`,
      telefon: formTelefon || '+90 5XX XXX XX XX',
      sirket: formSirket || 'Belirtilmedi',
      durum: 'Aktif',
      selected: false,
    };
    setContacts((prev) => [newContact, ...prev]);
    setModalOpen(false);
    resetForm();
  };

  const getInitials = (ad: string, soyad: string) =>
    `${ad.charAt(0)}${soyad.charAt(0)}`.toUpperCase();

  const avatarColors = [
    'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    'linear-gradient(135deg, #00cec9, #81ecec)',
    'linear-gradient(135deg, #e17055, #fab1a0)',
    'linear-gradient(135deg, #00b894, #55efc4)',
    'linear-gradient(135deg, #fdcb6e, #ffeaa7)',
    'linear-gradient(135deg, #74b9ff, #a3d8ff)',
    'linear-gradient(135deg, #fd79a8, #fdcb6e)',
    'linear-gradient(135deg, #6c5ce7, #00cec9)',
  ];

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span>👥</span> Kişiler
          </h1>
          <p className="page-subtitle">Tüm kişilerinizi yönetin</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={() => {}}>
            ↓ Dışa Aktar
          </button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            + Yeni Kişi
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['Tümü', 'Aktif', 'Pasif'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'Tümü' && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>({contacts.length})</span>
            )}
            {tab === 'Aktif' && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                ({contacts.filter((c) => c.durum === 'Aktif').length})
              </span>
            )}
            {tab === 'Pasif' && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                ({contacts.filter((c) => c.durum === 'Pasif').length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        {/* Table Header with Search */}
        <div className="data-table-header">
          <div className="data-table-search">
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-md)' }}>🔍</span>
            <input
              type="text"
              placeholder="Kişi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {filteredContacts.length} sonuç
            </span>
          </div>
        </div>

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: 16, height: 16 }}
                />
              </th>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Telefon</th>
              <th>Şirket</th>
              <th>Durum</th>
              <th style={{ textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {filteredContacts.map((contact, idx) => (
              <tr key={contact.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={contact.selected}
                    onChange={() => handleSelect(contact.id)}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: 16, height: 16 }}
                  />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className="avatar"
                      style={{
                        background: avatarColors[idx % avatarColors.length],
                        color: 'white',
                      }}
                    >
                      {getInitials(contact.ad, contact.soyad)}
                    </div>
                    <div>
                      <div className="font-semibold">{contact.ad} {contact.soyad}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ color: 'var(--text-secondary)' }}>{contact.email}</span>
                </td>
                <td>
                  <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {contact.telefon}
                  </span>
                </td>
                <td>
                  <span style={{ color: 'var(--text-secondary)' }}>{contact.sirket}</span>
                </td>
                <td>
                  <span
                    className={`badge ${contact.durum === 'Aktif' ? 'badge-success' : 'badge-error'}`}
                  >
                    <span
                      className={`badge-dot ${contact.durum === 'Aktif' ? 'success' : 'error'}`}
                    />
                    {contact.durum}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex items-center gap-1" style={{ justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost btn-icon btn-sm tooltip"
                      data-tooltip="Düzenle"
                      style={{ width: 32, height: 32 }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm tooltip"
                      data-tooltip="Sil"
                      onClick={() => handleDelete(contact.id)}
                      style={{ width: 32, height: 32 }}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="data-table-footer">
          <span>1-{filteredContacts.length} / 24 kişi</span>
          <div className="pagination">
            <button className="pagination-btn">‹</button>
            <button className="pagination-btn active">1</button>
            <button className="pagination-btn">2</button>
            <button className="pagination-btn">3</button>
            <button className="pagination-btn">›</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)} />
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Kişi Ekle</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); resetForm(); }}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ad</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Kişinin adı"
                    value={formAd}
                    onChange={(e) => setFormAd(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Kişinin soyadı"
                    value={formSoyad}
                    onChange={(e) => setFormSoyad(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="+90 5XX XXX XX XX"
                  value={formTelefon}
                  onChange={(e) => setFormTelefon(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Şirket</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Şirket adı"
                  value={formSirket}
                  onChange={(e) => setFormSirket(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea
                  className="form-textarea"
                  placeholder="Kişi hakkında notlar..."
                  value={formNotlar}
                  onChange={(e) => setFormNotlar(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setModalOpen(false); resetForm(); }}>
                İptal
              </button>
              <button className="btn btn-primary" onClick={handleAddContact}>
                Kişi Ekle
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
