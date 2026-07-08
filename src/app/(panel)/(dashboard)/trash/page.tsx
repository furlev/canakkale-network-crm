'use client';
import { useState, useEffect } from 'react';

type TrashRow = {
  model: string;
  id: string;
  label: string;
  deletedAt: string;
};

const modelLabels: Record<string, { label: string; icon: string }> = {
  client: { label: 'Müşteri', icon: '🏢' },
  project: { label: 'Proje', icon: '📁' },
  task: { label: 'Görev', icon: '✅' },
  lead: { label: 'Lead', icon: '🎯' },
  invoice: { label: 'Fatura', icon: '🧾' },
  estimate: { label: 'Teklif', icon: '📄' },
  expense: { label: 'Gider', icon: '📉' },
  contract: { label: 'Sözleşme', icon: '📝' },
  proposal: { label: 'Teklifname', icon: '📋' },
};

export default function TrashPage() {
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrash();
    fetchMe();
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await fetch('/api/trash');
      if (res.ok) {
        setRows(await res.json());
      } else {
        setError('Çöp kutusu yüklenemedi.');
      }
    } catch (err) {
      console.error('Error fetching trash:', err);
      setError('Çöp kutusu yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const me = await res.json();
        setIsAdmin(me.role === 'admin');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  const handleRestore = async (row: TrashRow) => {
    setError('');
    setBusyId(row.id);
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: row.model, id: row.id, action: 'restore' }),
      });
      if (res.ok) {
        setRows(rows.filter(r => !(r.model === row.model && r.id === row.id)));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Geri alma başarısız oldu.');
      }
    } catch (err) {
      console.error('Error restoring:', err);
      setError('Geri alma başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  };

  const handleHardDelete = async (row: TrashRow) => {
    const typeLabel = modelLabels[row.model]?.label || row.model;
    if (!confirm(`"${row.label}" (${typeLabel}) KALICI olarak silinecek ve geri alınamayacak. Emin misiniz?`)) return;
    setError('');
    setBusyId(row.id);
    try {
      const res = await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: row.model, id: row.id }),
      });
      if (res.ok) {
        setRows(rows.filter(r => !(r.model === row.model && r.id === row.id)));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kalıcı silme başarısız oldu.');
      }
    } catch (err) {
      console.error('Error hard-deleting:', err);
      setError('Kalıcı silme başarısız oldu.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = filter === 'all' ? rows : rows.filter(r => r.model === filter);
  const presentModels = Array.from(new Set(rows.map(r => r.model)));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🗑️ Çöp Kutusu</h1>
          <p className="page-subtitle">Silinen kayıtları geri alın{isAdmin ? ' veya kalıcı olarak silin' : ''}</p>
        </div>
        <div className="page-header-actions">
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Tüm Türler ({rows.length})</option>
            {presentModels.map(m => (
              <option key={m} value={m}>
                {modelLabels[m]?.label || m} ({rows.filter(r => r.model === m).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{error}</div>}

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Çöp kutusu boş.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tür</th>
                <th>Ad</th>
                <th>Silinme Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={`${row.model}-${row.id}`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span>{modelLabels[row.model]?.icon || '📦'}</span>
                      <span className="badge badge-info">{modelLabels[row.model]?.label || row.model}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.label}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(row.deletedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === row.id}
                      onClick={() => handleRestore(row)}
                    >
                      ↩️ Geri Al
                    </button>
                    {isAdmin && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--error)' }}
                        disabled={busyId === row.id}
                        onClick={() => handleHardDelete(row)}
                      >
                        Kalıcı Sil
                      </button>
                    )}
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
