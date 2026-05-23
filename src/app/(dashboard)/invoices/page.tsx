'use client';
import { useState, useEffect } from 'react';

type Invoice = {
  id: string;
  invoiceNo: string;
  client?: { companyName: string };
  clientId: string | null;
  amount: number;
  status: string;
  dueDate?: string;
  createdAt: string;
};

type Client = {
  id: string;
  companyName: string;
};

const statusLabels: Record<string,{label:string;cls:string}> = {
  paid:{label:'Ödendi',cls:'badge-success'},
  unpaid:{label:'Bekliyor',cls:'badge-warning'},
  overdue:{label:'Gecikmiş',cls:'badge-error'},
  cancelled:{label:'İptal',cls:'badge-info'},
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ clientId: '', amount: 0, status: 'unpaid', dueDate: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, cliRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/clients')
      ]);
      setInvoices(await invRes.json());
      setClients(await cliRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.amount) return;
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoice),
      });
      if (res.ok) {
        const created = await res.json();
        // Append client info for UI display
        const client = clients.find(c => c.id === created.clientId);
        created.client = client;
        
        setInvoices([created, ...invoices]);
        setIsAdding(false);
        setNewInvoice({ clientId: '', amount: 0, status: 'unpaid', dueDate: '' });
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status } : inv));
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu faturayı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInvoices(invoices.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const totalAmount = invoices.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const totalUnpaid = invoices.filter(i => i.status === 'unpaid').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💳 Faturalar</h1>
          <p className="page-subtitle">Gelen ve giden tüm fatura kayıtları</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Fatura</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Toplam Fatura Tutarı</div>
          <div className="stat-card-value">₺{loading ? '-' : totalAmount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--success)'}}>
          <div className="stat-card-label">Ödenen (Tahsil Edilen)</div>
          <div className="stat-card-value" style={{color:'var(--success)'}}>₺{loading ? '-' : totalPaid.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card" style={{borderTop:'2px solid var(--warning)'}}>
          <div className="stat-card-label">Bekleyen (Alacak)</div>
          <div className="stat-card-value" style={{color:'var(--warning)'}}>₺{loading ? '-' : totalUnpaid.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : invoices.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Kayıtlı fatura yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fatura No</th>
                <th>Müşteri</th>
                <th>Tutar</th>
                <th>Son Ödeme</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><span className="font-mono" style={{color:'var(--primary-light)'}}>{inv.invoiceNo}</span></td>
                  <td style={{fontWeight:500}}>{inv.client?.companyName || 'Belirtilmemiş'}</td>
                  <td>₺{inv.amount.toLocaleString('tr-TR')}</td>
                  <td style={{color:'var(--text-muted)'}}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>
                    <select 
                      className="form-select" 
                      style={{padding:'4px', fontSize:'var(--text-xs)', width:'100px'}} 
                      value={inv.status} 
                      onChange={(e) => updateStatus(inv.id, e.target.value)}
                    >
                      <option value="unpaid">Bekliyor</option>
                      <option value="paid">Ödendi</option>
                      <option value="overdue">Gecikmiş</option>
                      <option value="cancelled">İptal</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(inv.id, e)}>Sil</button>
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
              <h2 className="modal-title">Yeni Fatura</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Müşteri Seçin</label>
                <select className="form-select" value={newInvoice.clientId} onChange={e=>setNewInvoice({...newInvoice, clientId: e.target.value})}>
                  <option value="">-- Müşteri Seçin --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tutar (₺) *</label>
                  <input type="number" className="form-input" value={newInvoice.amount} onChange={e=>setNewInvoice({...newInvoice, amount: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Son Ödeme Tarihi</label>
                  <input type="date" className="form-input" value={newInvoice.dueDate} onChange={e=>setNewInvoice({...newInvoice, dueDate: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={newInvoice.status} onChange={e=>setNewInvoice({...newInvoice, status: e.target.value})}>
                  <option value="unpaid">Bekliyor (Ödenmedi)</option>
                  <option value="paid">Ödendi (Tahsil Edildi)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateInvoice}>Fatura Oluştur</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
