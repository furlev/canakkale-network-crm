'use client';
import { useState, useEffect } from 'react';

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  createdAt: string;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', status: 'active' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', status: 'active' });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async () => {
    if (!newContact.firstName || !newContact.email) return;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
      if (res.ok) {
        const created = await res.json();
        setContacts([created, ...contacts]);
        setIsAdding(false);
        setNewContact({ firstName: '', lastName: '', email: '', phone: '', company: '', status: 'active' });
      }
    } catch (error) {
      console.error('Error creating contact:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu kişiyi silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(contacts.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditContact({
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      email: contact.email,
      phone: contact.phone || '',
      company: contact.company || '',
      status: contact.status,
    });
  };

  const handleUpdateContact = async () => {
    if (!editingId) return;
    if (!editContact.firstName || !editContact.email) return;
    try {
      const res = await fetch(`/api/contacts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editContact),
      });
      if (res.ok) {
        const updated = await res.json();
        setContacts(contacts.map(c => c.id === editingId ? updated : c));
        setEditingId(null);
      }
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const cycleStatusFilter = () => {
    setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'inactive' : 'all');
  };

  const handleExport = () => {
    const headers = ['Ad', 'Soyad', 'E-Posta', 'Telefon', 'Şirket', 'Durum', 'Kayıt Tarihi'];
    const escapeCsv = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredContacts.map(c => [
      c.firstName, c.lastName || '', c.email, c.phone || '', c.company || '',
      c.status === 'active' ? 'Aktif' : 'Pasif',
      new Date(c.createdAt).toLocaleDateString('tr-TR'),
    ].map(escapeCsv).join(','));
    const csv = '﻿' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kisiler.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredContacts = contacts.filter((contact) => {
    if (statusFilter !== 'all' && contact.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${contact.firstName} ${contact.lastName || ''} ${contact.email} ${contact.company || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  const statusFilterLabel = statusFilter === 'all' ? 'Tümü' : statusFilter === 'active' ? 'Aktif' : 'Pasif';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👥 Kişiler</h1>
          <p className="page-subtitle">Toplam {contacts.length} kişi listeleniyor</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Kişi Ekle</button>
        </div>
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <div className="data-table-search">
            <span className="topbar-search-icon">🔍</span>
            <input placeholder="İsim veya e-posta ara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:'var(--space-2)'}}>
            <button className="btn btn-ghost" onClick={handleExport}>Dışa Aktar</button>
            <button className="btn btn-ghost" onClick={cycleStatusFilter}>Filtrele: {statusFilterLabel}</button>
          </div>
        </div>
        
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : filteredContacts.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>
            {contacts.length === 0 ? 'Henüz hiç kişi eklenmemiş.' : 'Filtreye uygun kişi bulunamadı.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Şirket</th>
                <th>E-Posta</th>
                <th>Telefon</th>
                <th>Durum</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'var(--space-3)'}}>
                      <div className="avatar avatar-sm">
                        {contact.firstName[0]}{contact.lastName?.[0]}
                      </div>
                      <span style={{fontWeight:500}}>{contact.firstName} {contact.lastName}</span>
                    </div>
                  </td>
                  <td>{contact.company || '-'}</td>
                  <td style={{color:'var(--text-muted)'}}>{contact.email}</td>
                  <td>{contact.phone || '-'}</td>
                  <td>
                    <span className={`badge ${contact.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                      {contact.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td style={{fontSize:'var(--text-xs)', color:'var(--text-muted)'}}>
                    {new Date(contact.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleStartEdit(contact)}>Düzenle</button>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(contact.id, e)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdding && (
        <>
          <div className="modal-backdrop" onClick={() => setIsAdding(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Kişi Ekle</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input className="form-input" value={newContact.firstName} onChange={e=>setNewContact({...newContact, firstName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input className="form-input" value={newContact.lastName} onChange={e=>setNewContact({...newContact, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">E-Posta *</label>
                  <input type="email" className="form-input" value={newContact.email} onChange={e=>setNewContact({...newContact, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={newContact.phone} onChange={e=>setNewContact({...newContact, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Şirket</label>
                <input className="form-input" value={newContact.company} onChange={e=>setNewContact({...newContact, company: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateContact}>Kaydet</button>
            </div>
          </div>
        </>
      )}

      {editingId && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingId(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Kişiyi Düzenle</h2>
              <button className="modal-close" onClick={() => setEditingId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input className="form-input" value={editContact.firstName} onChange={e=>setEditContact({...editContact, firstName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Soyad</label>
                  <input className="form-input" value={editContact.lastName} onChange={e=>setEditContact({...editContact, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">E-Posta *</label>
                  <input type="email" className="form-input" value={editContact.email} onChange={e=>setEditContact({...editContact, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={editContact.phone} onChange={e=>setEditContact({...editContact, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Şirket</label>
                  <input className="form-input" value={editContact.company} onChange={e=>setEditContact({...editContact, company: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Durum</label>
                  <select className="form-select" value={editContact.status} onChange={e=>setEditContact({...editContact, status: e.target.value})}>
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingId(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateContact}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
