'use client';
import { useState, useEffect } from 'react';

type Expense = {
  id: string;
  category: string;
  amount: number;
  description?: string;
  date: string;
  createdAt: string;
};

const categoryMap: Record<string, {label:string, icon:string}> = {
  software: {label: 'Yazılım & Araçlar', icon: '💻'},
  marketing: {label: 'Pazarlama', icon: '📈'},
  office: {label: 'Ofis & Sarf', icon: '📎'},
  travel: {label: 'Seyahat', icon: '✈️'},
  other: {label: 'Diğer', icon: '🏷️'},
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'software', amount: 0, description: '', date: '' });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!newExpense.amount) return;
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpense),
      });
      if (res.ok) {
        const created = await res.json();
        setExpenses([created, ...expenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsAdding(false);
        setNewExpense({ category: 'software', amount: 0, description: '', date: '' });
      }
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu gider kalemini silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses(expenses.filter(e => e.id !== id));
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📉 Giderler</h1>
          <p className="page-subtitle">Şirket içi ve operasyonel gider takibi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>+ Yeni Gider</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{borderTop:'2px solid var(--error)'}}>
          <div className="stat-card-label">Toplam Gider</div>
          <div className="stat-card-value" style={{color:'var(--error)'}}>₺{loading ? '-' : totalExpense.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bu Ayki Gider</div>
          <div className="stat-card-value">
            ₺{loading ? '-' : expenses
              .filter(e => new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
              .reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('tr-TR')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">İşlem Sayısı</div>
          <div className="stat-card-value">{loading ? '-' : expenses.length}</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : expenses.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Kayıtlı gider yok.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kategori</th>
                <th>Açıklama</th>
                <th>Tutar</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td style={{color:'var(--text-muted)'}}>{new Date(expense.date).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'var(--space-2)'}}>
                      <span>{categoryMap[expense.category]?.icon || '🏷️'}</span>
                      <span className="badge badge-info">{categoryMap[expense.category]?.label || expense.category}</span>
                    </div>
                  </td>
                  <td>{expense.description || '-'}</td>
                  <td style={{fontWeight:500, color:'var(--error)'}}>-₺{expense.amount.toLocaleString('tr-TR')}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(expense.id)}>Sil</button>
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
              <h2 className="modal-title">Yeni Gider Kalemi</h2>
              <button className="modal-close" onClick={() => setIsAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tutar (₺) *</label>
                <input type="number" className="form-input" value={newExpense.amount} onChange={e=>setNewExpense({...newExpense, amount: Number(e.target.value)})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={newExpense.category} onChange={e=>setNewExpense({...newExpense, category: e.target.value})}>
                    {Object.entries(categoryMap).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tarih</label>
                  <input type="date" className="form-input" value={newExpense.date} onChange={e=>setNewExpense({...newExpense, date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={2} value={newExpense.description} onChange={e=>setNewExpense({...newExpense, description: e.target.value})}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAdding(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleCreateExpense}>Gider Ekle</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
