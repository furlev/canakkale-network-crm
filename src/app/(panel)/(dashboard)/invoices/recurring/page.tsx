'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Item = { description: string; quantity: number; unitPrice: number; vatRate: number };

type Recurring = {
  id: string;
  title: string;
  clientId: string | null;
  items: Item[];
  currency: string;
  interval: string;
  nextRunAt: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
};

type Client = { id: string; companyName: string };

type FormState = {
  title: string;
  clientId: string;
  currency: string;
  interval: string;
  nextRunAt: string;
  active: boolean;
  notes: string;
  items: Item[];
};

const CURRENCIES = [
  { code: 'TRY', sym: '₺' },
  { code: 'USD', sym: '$' },
  { code: 'EUR', sym: '€' },
  { code: 'GBP', sym: '£' },
];
const INTERVALS = [
  { k: 'monthly', l: 'Aylık' },
  { k: 'quarterly', l: 'Çeyreklik' },
  { k: 'yearly', l: 'Yıllık' },
];
const intervalLabel = (k: string) => INTERVALS.find((i) => i.k === k)?.l || k;
const sym = (code: string) => CURRENCIES.find((c) => c.code === code)?.sym || code;

const blankItem: Item = { description: '', quantity: 1, unitPrice: 0, vatRate: 20 };
const emptyForm: FormState = { title: '', clientId: '', currency: 'TRY', interval: 'monthly', nextRunAt: '', active: true, notes: '', items: [{ ...blankItem }] };

function totals(items: Item[]) {
  let subtotal = 0;
  let vatTotal = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    subtotal += line;
    vatTotal += line * ((Number(it.vatRate) || 0) / 100);
  }
  return { subtotal, vatTotal, amount: subtotal + vatTotal };
}
function money(n: number, code = 'TRY') {
  return `${sym(code)}${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RecurringInvoicesPage() {
  const [list, setList] = useState<Recurring[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [err, setErr] = useState('');
  const [runMsg, setRunMsg] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [rRes, cRes] = await Promise.all([fetch('/api/recurring-invoices'), fetch('/api/clients')]);
      if (rRes.ok) setList(await rRes.json());
      if (cRes.ok) setClients(await cRes.json());
    } catch (error) {
      console.error('Error fetching recurring invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setErr(''); setEditId(null); setForm({ ...emptyForm, items: [{ ...blankItem }] }); setModal('add'); };
  const openEdit = (r: Recurring) => {
    setErr('');
    setEditId(r.id);
    setForm({
      title: r.title,
      clientId: r.clientId || '',
      currency: r.currency || 'TRY',
      interval: r.interval || 'monthly',
      nextRunAt: r.nextRunAt ? r.nextRunAt.slice(0, 10) : '',
      active: r.active,
      notes: r.notes || '',
      items: (r.items || []).map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, vatRate: it.vatRate })),
    });
    setModal('edit');
  };

  const setItem = (i: number, patch: Partial<Item>) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...blankItem }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    setErr('');
    if (!form.title.trim()) { setErr('Başlık gerekli.'); return; }
    const items = form.items.filter((it) => it.description.trim());
    if (items.length === 0) { setErr('En az bir kalem ekleyin.'); return; }
    try {
      const url = modal === 'edit' && editId ? `/api/recurring-invoices/${editId}` : '/api/recurring-invoices';
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          clientId: form.clientId || null,
          currency: form.currency,
          interval: form.interval,
          nextRunAt: form.nextRunAt || null,
          active: form.active,
          notes: form.notes || null,
          items,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErr(d?.error || 'Kaydedilemedi.');
        return;
      }
      setModal(null);
      fetchData();
    } catch {
      setErr('Kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu tekrarlayan fatura şablonunu silmek istediğinize emin misiniz? Üretilmiş faturalar etkilenmez.')) return;
    const res = await fetch(`/api/recurring-invoices/${id}`, { method: 'DELETE' });
    if (res.ok) setList((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleActive = async (r: Recurring) => {
    const res = await fetch(`/api/recurring-invoices/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    });
    if (res.ok) setList((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
  };

  const runNow = async () => {
    setRunning(true);
    setRunMsg('');
    try {
      const res = await fetch('/api/cron/recurring-invoices', { method: 'POST' });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setRunMsg(d?.message || 'İşlem tamamlandı.');
        fetchData();
      } else {
        setRunMsg(d?.error || 'Çalıştırılamadı.');
      }
    } catch {
      setRunMsg('Çalıştırılamadı.');
    } finally {
      setRunning(false);
    }
  };

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.companyName || 'Belirtilmemiş';
  const now = Date.now();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🔁 Tekrarlayan Faturalar</h1>
          <p className="page-subtitle">Aylık/çeyreklik/yıllık retainer şablonları — otomatik fatura üretimi</p>
        </div>
        <div className="page-header-actions">
          <Link href="/invoices" className="btn btn-ghost">← Faturalar</Link>
          <button className="btn btn-ghost" disabled={running} onClick={runNow}>
            {running ? '...' : '⚡ Bekleyenleri Faturalandır'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Yeni Şablon</button>
        </div>
      </div>

      {runMsg && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--info)', borderRadius: 8, fontSize: 'var(--text-sm)' }}>
          {runMsg} <button className="btn btn-ghost btn-sm" onClick={() => setRunMsg('')}>✕</button>
        </div>
      )}

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz tekrarlayan fatura şablonu yok.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Müşteri</th>
                <th>Tutar</th>
                <th>Periyot</th>
                <th>Sonraki Üretim</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const t = totals(r.items || []);
                const due = r.nextRunAt ? new Date(r.nextRunAt).getTime() <= now : false;
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{clientName(r.clientId)}</td>
                    <td>{money(t.amount, r.currency)}</td>
                    <td>{intervalLabel(r.interval)}</td>
                    <td style={{ color: due && r.active ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString('tr-TR') : '-'}
                      {due && r.active && ' (vadesi geldi)'}
                    </td>
                    <td>
                      <button
                        className={`badge ${r.active ? 'badge-success' : 'badge-info'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => toggleActive(r)}
                        title="Aktif/pasif değiştir"
                      >
                        {r.active ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Düzenle</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r.id)}>Sil</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <>
          <div className="modal-backdrop" onClick={() => setModal(null)}></div>
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h2 className="modal-title">{modal === 'edit' ? 'Şablonu Düzenle' : 'Yeni Tekrarlayan Fatura'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="form-group" style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{err}</div>}

              <div className="form-group">
                <label className="form-label">Başlık *</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ör. Aylık sosyal medya retainer" />
              </div>

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

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Periyot</label>
                  <select className="form-select" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}>
                    {INTERVALS.map((i) => <option key={i.k} value={i.k}>{i.l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">İlk / Sonraki Üretim Tarihi</label>
                  <input type="date" className="form-input" value={form.nextRunAt} onChange={(e) => setForm({ ...form, nextRunAt: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Kalemler *</label>
                <table className="data-table" style={{ marginBottom: 'var(--space-2)' }}>
                  <thead>
                    <tr>
                      <th>Açıklama</th>
                      <th style={{ width: 70 }}>Miktar</th>
                      <th style={{ width: 110 }}>Birim Fiyat</th>
                      <th style={{ width: 70 }}>KDV %</th>
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
                        <td><button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} title="Kaldır">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Kalem Ekle</button>
              </div>

              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Aktif (vadesi gelince otomatik fatura üret)
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                Fatura Tutarı: {money(totals(form.items).amount, form.currency)}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave}>{modal === 'edit' ? 'Kaydet' : 'Oluştur'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
