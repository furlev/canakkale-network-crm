'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* API sözleşmesi: /api/site-admin/readers (bkz. src/app/api/site-admin/readers) */
type Reader = {
  id: string;
  email: string;
  name: string | null;
  plan: string; // free | premium
  premiumUntil: string | null;
  confirmedAt: string | null;
  createdAt: string;
};

/** premiumUntil geçmişte mi? (plan premium ama süre dolmuş). */
function isExpired(r: Reader): boolean {
  return r.plan === 'premium' && !!r.premiumUntil && new Date(r.premiumUntil).getTime() < Date.now();
}

function PlanBadge({ r }: { r: Reader }) {
  if (r.plan === 'premium') {
    const expired = isExpired(r);
    return (
      <span className={`badge ${expired ? 'badge-warning' : 'badge-success'}`} title={r.premiumUntil || ''}>
        ★ Premium{expired ? ' (süresi doldu)' : ''}
      </span>
    );
  }
  return <span className="badge" style={{ color: 'var(--text-muted)' }}>Ücretsiz</span>;
}

export default function OkuyucularPage() {
  const [items, setItems] = useState<Reader[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ free: 0, premium: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const fetchReaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-admin/readers');
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCounts(data.counts || {});
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReaders();
  }, [fetchReaders]);

  const setPlan = async (r: Reader, action: 'premium' | 'free') => {
    if (action === 'premium') {
      const raw = prompt('Kaç ay premium verilsin?', '1');
      if (raw === null) return;
      const months = Math.max(1, Math.min(60, parseInt(raw, 10) || 1));
      await mutate(r.id, { action, months });
    } else {
      if (!confirm(`${r.email} premium üyeliğinden düşürülsün mü?`)) return;
      await mutate(r.id, { action });
    }
  };

  const mutate = async (id: string, payload: { action: 'premium' | 'free'; months?: number }) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/site-admin/readers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      if (res.ok) await fetchReaders();
      else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'İşlem başarısız oldu.');
      }
    } catch {
      alert('Sunucuya ulaşılamadı.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = q.trim()
    ? items.filter(
        r =>
          r.email.toLowerCase().includes(q.toLowerCase()) ||
          (r.name || '').toLowerCase().includes(q.toLowerCase()),
      )
    : items;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">👥 Okuyucular</h1>
          <p className="page-subtitle">
            Site üyeleri — {counts.free ?? 0} ücretsiz · {counts.premium ?? 0} premium
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/site-yonetimi" className="btn btn-ghost">← Site Yönetimi</Link>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input
          type="search"
          className="input"
          placeholder="E-posta veya ada göre ara…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Kayıtlı okuyucu bulunmuyor.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Okuyucu</th>
                <th>Plan</th>
                <th>Premium Bitiş</th>
                <th>Kayıt</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ opacity: busyId === r.id ? 0.5 : 1 }}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{r.name || '—'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.email}</div>
                  </td>
                  <td><PlanBadge r={r} /></td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.premiumUntil ? new Date(r.premiumUntil).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === r.id}
                        onClick={() => setPlan(r, 'premium')}
                      >
                        ★ Premium yap
                      </button>
                      {r.plan === 'premium' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => setPlan(r, 'free')}
                        >
                          Düşür
                        </button>
                      )}
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
