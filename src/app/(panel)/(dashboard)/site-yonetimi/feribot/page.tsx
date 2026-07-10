'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Ferry = {
  id: string;
  route: string;
  departTime: string;
  days: string;
  operator: string;
  season: string | null;
  active: boolean;
};

type FormState = {
  id: string | null;
  route: string;
  departTime: string;
  days: string;
  operator: string;
  season: string;
  active: boolean;
};

const EMPTY: FormState = {
  id: null, route: '', departTime: '', days: 'hergun', operator: 'GESTAŞ', season: '', active: true,
};

const DAY_LABEL: Record<string, string> = {
  hergun: 'Her gün',
  haftaici: 'Hafta içi',
  haftasonu: 'Hafta sonu',
};

export default function FeribotYonetimPage() {
  const [items, setItems] = useState<Ferry[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-admin/ferry');
      const data = await res.json();
      setItems(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const edit = (f: Ferry) =>
    setForm({
      id: f.id, route: f.route, departTime: f.departTime, days: f.days,
      // 'auto' = cron işareti; formda geçerli bir sezon değeri değil → düzenlenen
      // oto satır kaydedilince manuel satıra dönüşür (sezon boşalır).
      operator: f.operator, season: f.season === 'auto' ? '' : (f.season || ''), active: f.active,
    });

  const save = async () => {
    if (!form.route.trim()) { setMsg({ kind: 'error', text: 'Hat/rota zorunlu.' }); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.departTime)) {
      setMsg({ kind: 'error', text: 'Kalkış saati HH:MM biçiminde olmalı (ör. 07:30).' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const payload = {
      route: form.route.trim(),
      departTime: form.departTime,
      days: form.days,
      operator: form.operator.trim() || 'GESTAŞ',
      season: form.season || null,
      active: form.active,
    };
    try {
      const res = await fetch(form.id ? `/api/site-admin/ferry/${form.id}` : '/api/site-admin/ferry', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ kind: 'error', text: data?.error || 'Kaydetme başarısız.' }); return; }
      setForm(EMPTY);
      setMsg({ kind: 'success', text: form.id ? 'Sefer güncellendi ✓' : 'Sefer eklendi ✓' });
      await load();
    } catch {
      setMsg({ kind: 'error', text: 'Sunucuya ulaşılamadı.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: Ferry) => {
    setBusyId(f.id);
    try {
      const res = await fetch(`/api/site-admin/ferry/${f.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !f.active }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (f: Ferry) => {
    if (!confirm(`"${f.route} ${f.departTime}" seferi silinsin mi?`)) return;
    setBusyId(f.id);
    try {
      const res = await fetch(`/api/site-admin/ferry/${f.id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">⛴️ Feribot Tarifesi</h1>
          <p className="page-subtitle">
            <Link href="/site-yonetimi" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>← Site Yönetimi</Link>
            {'  ·  canakkale.network/feribot sayfasını besler. Tarife günde iki kez GESTAŞ sitesinden otomatik çekilir (Sezon sütununda “Oto” işaretli satırlar cron yönetimindedir); elle eklediğin satırlara dokunulmaz. Oto bir satırı düzenlersen manuel satıra dönüşür.'}
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius)', background: msg.kind === 'success' ? 'rgba(0,184,148,0.12)' : 'rgba(255,118,117,0.12)', color: msg.kind === 'success' ? 'var(--success)' : 'var(--error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {msg.text}
        </div>
      )}

      {/* Ekle / Düzenle formu */}
      <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          {form.id ? '✏️ Seferi Düzenle' : '➕ Yeni Sefer'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hat / Rota</label>
            <input className="form-input" value={form.route} onChange={(e) => setField('route', e.target.value)} placeholder="Çanakkale-Eceabat" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Kalkış Saati</label>
            <input className="form-input" value={form.departTime} onChange={(e) => setField('departTime', e.target.value)} placeholder="07:30" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Günler</label>
            <select className="form-select" value={form.days} onChange={(e) => setField('days', e.target.value)}>
              <option value="hergun">Her gün</option>
              <option value="haftaici">Hafta içi</option>
              <option value="haftasonu">Hafta sonu</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">İşletme</label>
            <input className="form-input" value={form.operator} onChange={(e) => setField('operator', e.target.value)} placeholder="GESTAŞ" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sezon</label>
            <select className="form-select" value={form.season} onChange={(e) => setField('season', e.target.value)}>
              <option value="">Tüm yıl</option>
              <option value="yaz">Yaz</option>
              <option value="kis">Kış</option>
            </select>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} />
            Aktif (sitede görünür)
          </label>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Ekle'}
          </button>
          {form.id && <button className="btn btn-ghost" disabled={saving} onClick={() => setForm(EMPTY)}>İptal</button>}
        </div>
      </div>

      {/* Mevcut seferler */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz sefer girilmedi.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hat</th>
                <th>Kalkış</th>
                <th>Günler</th>
                <th>İşletme</th>
                <th>Sezon</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} style={{ opacity: busyId === f.id ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{f.route}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{f.departTime}</td>
                  <td>{DAY_LABEL[f.days] || f.days}</td>
                  <td>{f.operator}</td>
                  <td>{f.season === 'yaz' ? 'Yaz' : f.season === 'kis' ? 'Kış' : f.season === 'auto' ? 'Oto' : '—'}</td>
                  <td>
                    {f.active
                      ? <span className="badge badge-success">Aktif</span>
                      : <span className="badge badge-warning">Pasif</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => edit(f)}>Düzenle</button>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => toggleActive(f)}>
                        {f.active ? 'Pasifleştir' : 'Aktifleştir'}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => remove(f)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
