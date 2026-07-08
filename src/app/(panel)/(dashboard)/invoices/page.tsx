'use client';
import { useState, useEffect } from 'react';

type Item = { id?: string; description: string; quantity: number; unitPrice: number; vatRate: number };

type Invoice = {
  id: string;
  invoiceNo: string;
  client?: { companyName: string; email?: string | null };
  clientId: string | null;
  amount: number;
  currency: string;
  subtotal?: number | null;
  vatTotal?: number | null;
  discount?: number | null;
  notes?: string | null;
  status: string;
  dueDate?: string;
  sentAt?: string | null;
  items?: Item[];
  createdAt: string;
};

type Client = { id: string; companyName: string };

type FormState = {
  clientId: string;
  currency: string;
  status: string;
  dueDate: string;
  discount: number;
  notes: string;
  amount: number; // yalnızca kalem yokken kullanılır
  items: Item[];
};

const CURRENCIES = [
  { code: 'TRY', sym: '₺' },
  { code: 'USD', sym: '$' },
  { code: 'EUR', sym: '€' },
  { code: 'GBP', sym: '£' },
];

const statusLabels: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Ödendi', cls: 'badge-success' },
  unpaid: { label: 'Bekliyor', cls: 'badge-warning' },
  overdue: { label: 'Gecikmiş', cls: 'badge-error' },
  cancelled: { label: 'İptal', cls: 'badge-info' },
};

const emptyForm: FormState = { clientId: '', currency: 'TRY', status: 'unpaid', dueDate: '', discount: 0, notes: '', amount: 0, items: [] };
const blankItem: Item = { description: '', quantity: 1, unitPrice: 0, vatRate: 20 };

function sym(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.sym || code;
}

/** İstemci tarafı toplam önizlemesi (sunucu kesin hesabı yapar). */
function totals(items: Item[], discount: number) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    subtotal += line;
    vatTotal += line * ((Number(it.vatRate) || 0) / 100);
  }
  const disc = Math.max(0, Number(discount) || 0);
  const amount = Math.max(0, subtotal + vatTotal - disc);
  return { subtotal, vatTotal, discount: disc, amount };
}

function money(n: number, code = 'TRY') {
  return `${sym(code)}${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'aging'>('list');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, cliRes] = await Promise.all([fetch('/api/invoices'), fetch('/api/clients')]);
      setInvoices(await invRes.json());
      setClients(await cliRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const t = totals(form.items, form.discount);
  const usingItems = form.items.length > 0;

  const openAdd = () => {
    setErr('');
    setEditId(null);
    setForm({ ...emptyForm, items: [] });
    setModal('add');
  };

  const openEdit = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setErr('');
    setEditId(inv.id);
    setForm({
      clientId: inv.clientId || '',
      currency: inv.currency || 'TRY',
      status: inv.status,
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
      discount: inv.discount || 0,
      notes: inv.notes || '',
      amount: inv.amount || 0,
      items: (inv.items || []).map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, vatRate: it.vatRate })),
    });
    setModal('edit');
  };

  const setItem = (i: number, patch: Partial<Item>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...blankItem }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const buildPayload = () => {
    const base = {
      clientId: form.clientId || null,
      currency: form.currency,
      status: form.status,
      dueDate: form.dueDate || null,
      notes: form.notes || null,
    };
    if (usingItems) {
      return { ...base, discount: form.discount || 0, items: form.items };
    }
    // Kalem yoksa (geriye dönük) elle tutar; indirim uygulanmaz.
    return { ...base, discount: 0, amount: form.amount, items: [] };
  };

  const handleSave = async () => {
    setErr('');
    if (!usingItems && !form.amount) {
      setErr('En az bir kalem ekleyin veya bir tutar girin.');
      return;
    }
    if (usingItems && form.items.some((it) => !it.description.trim())) {
      setErr('Her kalemin açıklaması olmalı.');
      return;
    }
    try {
      const url = modal === 'edit' && editId ? `/api/invoices/${editId}` : '/api/invoices';
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Fatura kaydedilemedi.');
        return;
      }
      const saved: Invoice = await res.json();
      if (!saved.client) saved.client = clients.find((c) => c.id === saved.clientId) as Client | undefined;
      setInvoices((prev) => (modal === 'edit' ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev]));
      setModal(null);
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErr('Fatura kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)));
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bu faturayı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const openPdf = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/invoices/${id}/pdf`, '_blank', 'noopener');
  };

  const sendInvoice = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`${inv.invoiceNo} numaralı faturayı müşteriye e-posta ile göndermek istiyor musunuz?`)) return;
    setBusy(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send`, { method: 'POST' });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, sentAt: d?.sentAt || new Date().toISOString() } : i)));
        alert('Fatura gönderildi.');
      } else {
        alert(d?.error || 'Fatura gönderilemedi.');
      }
    } catch {
      alert('Fatura gönderilemedi.');
    } finally {
      setBusy(null);
    }
  };

  const totalAmount = invoices.reduce((acc, c) => acc + c.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((acc, c) => acc + c.amount, 0);
  const totalUnpaid = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').reduce((acc, c) => acc + c.amount, 0);

  // ── Tahsilat / yaşlandırma ──
  const now = Date.now();
  const outstanding = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');
  const daysPastDue = (inv: Invoice) => (inv.dueDate ? Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000) : -1);
  const buckets = { current: 0, b0: 0, b30: 0, b60: 0 };
  for (const inv of outstanding) {
    const d = daysPastDue(inv);
    if (d < 0) buckets.current += inv.amount;
    else if (d <= 30) buckets.b0 += inv.amount;
    else if (d <= 60) buckets.b30 += inv.amount;
    else buckets.b60 += inv.amount;
  }
  const agingRows = [...outstanding].sort((a, b) => daysPastDue(b) - daysPastDue(a));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💳 Faturalar</h1>
          <p className="page-subtitle">Kalemli fatura, KDV, PDF ve tahsilat takibi</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Fatura</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Toplam Fatura Tutarı</div>
          <div className="stat-card-value">₺{loading ? '-' : totalAmount.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid var(--success)' }}>
          <div className="stat-card-label">Ödenen (Tahsil Edilen)</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>₺{loading ? '-' : totalPaid.toLocaleString('tr-TR')}</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid var(--warning)' }}>
          <div className="stat-card-label">Bekleyen (Alacak)</div>
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₺{loading ? '-' : totalUnpaid.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', margin: 'var(--space-4) 0' }}>
        <button className={`btn btn-sm ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('list')}>Faturalar</button>
        <button className={`btn btn-sm ${tab === 'aging' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('aging')}>Tahsilat</button>
      </div>

      {tab === 'list' ? (
        <div className="data-table-container">
          {loading ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Kayıtlı fatura yok.</div>
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
                    <td>
                      <span className="font-mono" style={{ color: 'var(--primary-light)' }}>{inv.invoiceNo}</span>
                      {inv.sentAt && <span title="Gönderildi" style={{ marginLeft: 6 }}>✉️</span>}
                    </td>
                    <td style={{ fontWeight: 500 }}>{inv.client?.companyName || 'Belirtilmemiş'}</td>
                    <td>{money(inv.amount, inv.currency)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ padding: '4px', fontSize: 'var(--text-xs)', width: '100px' }}
                        value={inv.status}
                        onChange={(e) => updateStatus(inv.id, e.target.value)}
                      >
                        <option value="unpaid">Bekliyor</option>
                        <option value="paid">Ödendi</option>
                        <option value="overdue">Gecikmiş</option>
                        <option value="cancelled">İptal</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => openEdit(inv, e)}>Düzenle</button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => openPdf(inv.id, e)}>PDF</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy === inv.id} onClick={(e) => sendInvoice(inv, e)}>
                        {busy === inv.id ? '...' : 'Gönder'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => handleDelete(inv.id, e)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="stat-card"><div className="stat-card-label">Vadesi Gelmemiş</div><div className="stat-card-value">₺{buckets.current.toLocaleString('tr-TR')}</div></div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--warning)' }}><div className="stat-card-label">0-30 Gün</div><div className="stat-card-value" style={{ color: 'var(--warning)' }}>₺{buckets.b0.toLocaleString('tr-TR')}</div></div>
            <div className="stat-card" style={{ borderTop: '2px solid #e67e22' }}><div className="stat-card-label">30-60 Gün</div><div className="stat-card-value" style={{ color: '#e67e22' }}>₺{buckets.b30.toLocaleString('tr-TR')}</div></div>
            <div className="stat-card" style={{ borderTop: '2px solid var(--error)' }}><div className="stat-card-label">60+ Gün</div><div className="stat-card-value" style={{ color: 'var(--error)' }}>₺{buckets.b60.toLocaleString('tr-TR')}</div></div>
          </div>
          <div className="data-table-container">
            {agingRows.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>Açık (tahsil edilecek) fatura yok. 🎉</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fatura No</th>
                    <th>Müşteri</th>
                    <th>Tutar</th>
                    <th>Son Ödeme</th>
                    <th>Gecikme</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {agingRows.map((inv) => {
                    const d = daysPastDue(inv);
                    return (
                      <tr key={inv.id}>
                        <td><span className="font-mono" style={{ color: 'var(--primary-light)' }}>{inv.invoiceNo}</span></td>
                        <td style={{ fontWeight: 500 }}>{inv.client?.companyName || 'Belirtilmemiş'}</td>
                        <td>{money(inv.amount, inv.currency)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('tr-TR') : '-'}</td>
                        <td>
                          {d < 0 ? <span className="badge badge-info">Vade gelmedi</span> : <span className={`badge ${d > 60 ? 'badge-error' : 'badge-warning'}`}>{d} gün</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={(e) => openPdf(inv.id, e)}>PDF</button>
                          <button className="btn btn-ghost btn-sm" disabled={busy === inv.id} onClick={(e) => sendInvoice(inv, e)}>
                            {busy === inv.id ? '...' : 'Hatırlat'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {modal && (
        <>
          <div className="modal-backdrop" onClick={() => setModal(null)}></div>
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h2 className="modal-title">{modal === 'edit' ? 'Faturayı Düzenle' : 'Yeni Fatura'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="form-group" style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Müşteri</label>
                  <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">-- Müşteri Seçin --</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Para Birimi</label>
                  <select className="form-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.sym})</option>)}
                  </select>
                </div>
              </div>

              {/* ── Kalem editörü ── */}
              <div className="form-group">
                <label className="form-label">Kalemler</label>
                {form.items.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                    Kalem yok — aşağıdan kalem ekleyin veya manuel tutar girin.
                  </div>
                ) : (
                  <table className="data-table" style={{ marginBottom: 'var(--space-2)' }}>
                    <thead>
                      <tr>
                        <th>Açıklama</th>
                        <th style={{ width: 70 }}>Miktar</th>
                        <th style={{ width: 110 }}>Birim Fiyat</th>
                        <th style={{ width: 70 }}>KDV %</th>
                        <th style={{ width: 110 }}>Tutar</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, i) => (
                        <tr key={i}>
                          <td><input className="form-input" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Hizmet/ürün" /></td>
                          <td><input type="number" min={0} className="form-input" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} /></td>
                          <td><input type="number" min={0} step="0.01" className="form-input" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} /></td>
                          <td><input type="number" min={0} max={100} className="form-input" value={it.vatRate} onChange={(e) => setItem(i, { vatRate: Number(e.target.value) })} /></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{money((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), form.currency)}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} title="Kaldır">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Kalem Ekle</button>
              </div>

              {!usingItems && (
                <div className="form-group">
                  <label className="form-label">Tutar (manuel) *</label>
                  <input type="number" min={0} step="0.01" className="form-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                </div>
              )}

              <div className="grid-2">
                {usingItems && (
                  <div className="form-group">
                    <label className="form-label">İndirim ({sym(form.currency)})</label>
                    <input type="number" min={0} step="0.01" className="form-input" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Son Ödeme Tarihi</label>
                  <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Durum</label>
                <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="unpaid">Bekliyor</option>
                  <option value="paid">Ödendi</option>
                  <option value="overdue">Gecikmiş</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {/* ── Toplam önizleme ── */}
              {usingItems && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', display: 'grid', gap: 4, justifyContent: 'end', textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Ara Toplam: {money(t.subtotal, form.currency)}</div>
                  <div style={{ color: 'var(--text-muted)' }}>KDV: {money(t.vatTotal, form.currency)}</div>
                  {t.discount > 0 && <div style={{ color: 'var(--error)' }}>İndirim: -{money(t.discount, form.currency)}</div>}
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Genel Toplam: {money(t.amount, form.currency)}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>{modal === 'edit' ? 'Kaydet' : 'Fatura Oluştur'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
