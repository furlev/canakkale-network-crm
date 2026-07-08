'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type AuditRow = {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  createdAt: string;
};

const actionLabels: Record<string, { label: string; cls: string }> = {
  created: { label: 'Oluşturuldu', cls: 'badge-success' },
  updated: { label: 'Güncellendi', cls: 'badge-info' },
  deleted: { label: 'Silindi', cls: 'badge-warning' },
  restored: { label: 'Geri Alındı', cls: 'badge-success' },
  hard_deleted: { label: 'Kalıcı Silindi', cls: 'badge-error' },
  paid: { label: 'Ödendi', cls: 'badge-success' },
  approved: { label: 'Onaylandı', cls: 'badge-success' },
  rejected: { label: 'Reddedildi', cls: 'badge-error' },
  published: { label: 'Yayınlandı', cls: 'badge-primary' },
};

const entityLabels: Record<string, string> = {
  client: 'Müşteri',
  project: 'Proje',
  task: 'Görev',
  lead: 'Lead',
  invoice: 'Fatura',
  estimate: 'Teklif',
  expense: 'Gider',
  contract: 'Sözleşme',
  proposal: 'Teklifname',
  payment: 'Ödeme',
  warn: 'Uyarı',
  setting: 'Ayar',
  team: 'Ekip',
  aiDraft: 'AI Taslak',
};

const LIMIT = 50;

export default function AuditPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Yalnız A: admin olmayanları ana sayfaya yönlendir (API zaten 403 döndürür)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(me => {
        if (me?.role === 'admin') setAllowed(true);
        else router.replace('/');
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (entityFilter) params.set('entity', entityFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.items);
        setTotal(data.total);
        setEntities(data.entities || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter]);

  useEffect(() => {
    if (allowed) fetchLogs();
  }, [allowed, fetchLogs]);

  if (!allowed) {
    return <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Yükleniyor...</div>;
  }

  const totalPages = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🕵️ Denetim Kayıtları</h1>
          <p className="page-subtitle">Sistemdeki hassas işlemlerin izi (yalnız Baş Yönetici)</p>
        </div>
        <div className="page-header-actions">
          <select
            className="form-select"
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Varlıklar</option>
            {entities.map(e => (
              <option key={e} value={e}>{entityLabels[e] || e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Denetim kaydı bulunamadı.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Varlık</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(row.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.userName || '—'}</td>
                  <td>
                    <span className={`badge ${actionLabels[row.action]?.cls || 'badge-info'}`}>
                      {actionLabels[row.action]?.label || row.action}
                    </span>
                  </td>
                  <td>{entityLabels[row.entity] || row.entity}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{row.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Toplam {total} kayıt — sayfa {page}/{totalPages}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ‹ Önceki
          </button>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Sonraki ›
          </button>
        </div>
      </div>
    </div>
  );
}
