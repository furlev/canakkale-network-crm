'use client';
import { useState, useEffect } from 'react';
import DataTable, { type Column } from '@/components/DataTable';
import { SkeletonStats } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

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

const catLabel = (c: string) => categoryMap[c]?.label || c;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'software', amount: 0, description: '', date: '' });
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editError, setEditError] = useState('');

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

  const handleBulkDelete = async (rows: Expense[]) => {
    if (!confirm(`${rows.length} gider kalemini silmek istediğinize emin misiniz?`)) return;
    const ids = new Set(rows.map(r => r.id));
    try {
      await Promise.all(rows.map(r => fetch(`/api/expenses/${r.id}`, { method: 'DELETE' })));
      setExpenses(prev => prev.filter(e => !ids.has(e.id)));
    } catch (error) {
      console.error('Error bulk deleting expenses:', error);
    }
  };

  const openEdit = (expense: Expense) => {
    setEditError('');
    setEditingExpense({ ...expense, date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '' });
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    if (!editingExpense.amount) return;
    setEditError('');
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingExpense.category,
          amount: editingExpense.amount,
          description: editingExpense.description,
          date: editingExpense.date,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setExpenses(expenses
          .map(e => e.id === updated.id ? updated : e)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setEditingExpense(null);
      } else {
        setEditError('Güncelleme başarısız oldu. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      setEditError('Güncelleme başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const thisMonth = expenses
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + curr.amount, 0);

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Tarih',
      accessor: (e) => (e.date ? new Date(e.date).toISOString().slice(0, 10) : ''),
      render: (e) => <span className="text-muted">{e.date ? new Date(e.date).toLocaleDateString('tr-TR') : '-'}</span>,
      width: 130,
    },
    {
      key: 'category',
      header: 'Kategori',
      accessor: (e) => catLabel(e.category),
      filterable: true,
      render: (e) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>{categoryMap[e.category]?.icon || '🏷️'}</span>
          <span className="badge badge-info">{catLabel(e.category)}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Açıklama',
      accessor: (e) => e.description || '',
      render: (e) => e.description || '-',
    },
    {
      key: 'amount',
      header: 'Tutar',
      accessor: (e) => e.amount,
      numeric: true,
      render: (e) => <span style={{ fontWeight: 500, color: 'var(--error)' }}>-₺{e.amount.toLocaleString('tr-TR')}</span>,
    },
    {
      key: 'actions',
      header: 'İşlemler',
      sortable: false,
      hideable: false,
      csv: false,
      align: 'right',
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Düzenle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)}>Sil</button>
        </div>
      ),
    },
  ];

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

      {loading ? (
        <SkeletonStats count={3} />
      ) : (
        <div className="stats-grid">
          <div className="stat-card" style={{borderTop:'2px solid var(--error)'}}>
            <div className="stat-card-label">Toplam Gider</div>
            <div className="stat-card-value" style={{color:'var(--error)'}}>₺{totalExpense.toLocaleString('tr-TR')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Bu Ayki Gider</div>
            <div className="stat-card-value">₺{thisMonth.toLocaleString('tr-TR')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">İşlem Sayısı</div>
            <div className="stat-card-value">{expenses.length}</div>
          </div>
        </div>
      )}

      <DataTable<Expense>
        columns={columns}
        rows={expenses}
        rowKey={(e) => e.id}
        loading={loading}
        searchPlaceholder="Açıklama veya kategori ara..."
        csvFileName="giderler"
        selectable
        initialSort={{ key: 'date', dir: 'desc' }}
        bulkActions={[{ label: 'Sil', icon: '🗑️', variant: 'danger', onClick: handleBulkDelete }]}
        emptyState={<EmptyState icon="💸" title="Kayıtlı gider yok" description="İlk gider kalemini ekleyerek başlayın." actionLabel="+ Yeni Gider" onAction={() => setIsAdding(true)} />}
      />

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

      {editingExpense && (
        <>
          <div className="modal-backdrop" onClick={() => setEditingExpense(null)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Gider Kalemini Düzenle</h2>
              <button className="modal-close" onClick={() => setEditingExpense(null)}>✕</button>
            </div>
            <div className="modal-body">
              {editError && <div style={{color:'var(--error)', marginBottom:'var(--space-3)'}}>{editError}</div>}
              <div className="form-group">
                <label className="form-label">Tutar (₺) *</label>
                <input type="number" className="form-input" value={editingExpense.amount} onChange={e=>setEditingExpense({...editingExpense, amount: Number(e.target.value)})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={editingExpense.category} onChange={e=>setEditingExpense({...editingExpense, category: e.target.value})}>
                    {Object.entries(categoryMap).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tarih</label>
                  <input type="date" className="form-input" value={editingExpense.date} onChange={e=>setEditingExpense({...editingExpense, date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Açıklama</label>
                <textarea className="form-textarea" rows={2} value={editingExpense.description || ''} onChange={e=>setEditingExpense({...editingExpense, description: e.target.value})}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingExpense(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpdateExpense}>Kaydet</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
