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
            <input placeholder="İsim veya e-posta ara..." />
          </div>
          <div style={{display:'flex', gap:'var(--space-2)'}}>
            <button className="btn btn-ghost">Dışa Aktar</button>
            <button className="btn btn-ghost">Filtrele</button>
          </div>
        </div>
        
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : contacts.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>
            Henüz hiç kişi eklenmemiş.
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
              {contacts.map((contact) => (
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
    </div>
  );
}
