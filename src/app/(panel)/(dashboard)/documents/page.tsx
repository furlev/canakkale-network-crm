'use client';
/**
 * Depo — klasörlü dosya deposu (Google Drive destekli).
 * Klasör ızgarası + breadcrumb, kilitli (şifreli) klasörler için sessionStorage token'lı
 * şifre modalı, yeni klasör / düzenleme / taşıma / yeniden adlandırma modalları.
 * C kullanıcılar salt-okurdur (FolderAccess.canWrite hariç) — yönetim butonları gizlenir.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

type Me = { id: string; role: string };

type FolderItem = {
  id: string;
  name: string;
  minLevel: string;
  restricted: boolean;
  locked: boolean;
  canWrite: boolean;
  canManage: boolean;
  counts: { documents: number; folders: number };
  access: { userId: string; canWrite: boolean }[];
  createdAt: string;
};

type Crumb = { id: string; name: string; locked: boolean };

type CurrentFolder = {
  id: string; name: string; parentId: string | null; minLevel: string;
  restricted: boolean; locked: boolean; canWrite: boolean;
  access: { userId: string; canWrite: boolean }[];
};

type DepotView = {
  folders: FolderItem[];
  breadcrumb: Crumb[];
  current: CurrentFolder | null;
  canWrite: boolean;
  canManage: boolean;
  driveConfigured: boolean;
};

type DocItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string | null;
  mime?: string | null;
  driveFileId?: string | null;
  uploadedByName?: string | null;
  folderId?: string | null;
  createdAt: string;
};

type TeamUser = { id: string; name: string; title?: string | null };

type FlatFolder = { id: string; name: string; parentId: string | null; locked: boolean; canWrite: boolean };

const fileIcons: Record<string, string> = {
  pdf: '📄', word: '📝', excel: '📊', image: '🖼️', other: '📁',
};

const MAX_UPLOAD = 100 * 1024 * 1024; // 100 MB

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Tarayıcıda satır içi açılabilen (önizlenebilen) türler: video/görsel/PDF. */
function isPreviewable(doc: DocItem): boolean {
  const m = (doc.mime || '').toLowerCase();
  if (m.startsWith('video/') || m.startsWith('image/') || m === 'application/pdf') return true;
  return doc.type === 'image' || doc.type === 'pdf';
}

/* ── Kilit token'ları (sessionStorage, 30 dk) ── */
const tokenKey = (folderId: string) => `depot_token_${folderId}`;

function getStoredToken(folderId: string): string | null {
  try {
    const raw = sessionStorage.getItem(tokenKey(folderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token: string; expiresAt: number };
    if (!parsed.token || parsed.expiresAt < Date.now() + 5000) {
      sessionStorage.removeItem(tokenKey(folderId));
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

function storeToken(folderId: string, token: string, expiresAt: number) {
  try {
    sessionStorage.setItem(tokenKey(folderId), JSON.stringify({ token, expiresAt }));
  } catch { /* sessionStorage yoksa sessiz geç */ }
}

/** İlgili klasör(ler) için x-folder-token başlığı (virgülle çoklu token). */
function tokenHeaders(folderIds: Array<string | null | undefined>): Record<string, string> {
  const tokens = folderIds
    .filter((id): id is string => !!id)
    .map((id) => getStoredToken(id))
    .filter((t): t is string => !!t);
  return tokens.length ? { 'x-folder-token': tokens.join(',') } : {};
}

export default function DocumentsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<DepotView | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docsLocked, setDocsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Modallar
  const [folderModal, setFolderModal] = useState<{ mode: 'new' } | { mode: 'edit'; folder: FolderItem } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; name: string; navigate: boolean } | null>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [renameDoc, setRenameDoc] = useState<DocItem | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocItem | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null); // 'f:<id>' | 'd:<id>'

  // Yükleme
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe({ id: data.id, role: data.role }))
      .catch(() => {});
  }, []);

  const loadAll = useCallback(async (targetId: string | null) => {
    setLoading(true);
    setPageError('');
    setOpenMenu(null);
    try {
      const fres = await fetch(`/api/folders${targetId ? `?parentId=${encodeURIComponent(targetId)}` : ''}`);
      if (!fres.ok) {
        const err = await fres.json().catch(() => ({}));
        setPageError(err.error || 'Klasörler alınamadı');
        setView(null);
        setDocs([]);
        return;
      }
      const data: DepotView = await fres.json();
      setView(data);

      const dres = await fetch(
        `/api/documents${targetId ? `?folderId=${encodeURIComponent(targetId)}` : ''}`,
        { headers: tokenHeaders([targetId]) }
      );
      if (dres.status === 423) {
        setDocs([]);
        setDocsLocked(true);
      } else if (dres.ok) {
        setDocs(await dres.json());
        setDocsLocked(false);
      } else {
        const err = await dres.json().catch(() => ({}));
        setDocs([]);
        setDocsLocked(false);
        setPageError(err.error || 'Dosyalar alınamadı');
      }
    } catch {
      setPageError('Depo yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(folderId); }, [folderId, loadAll]);

  const refresh = () => loadAll(folderId);

  /* ── Gezinme ── */
  const openFolder = (f: { id: string; name: string; locked: boolean }) => {
    if (f.locked && !getStoredToken(f.id)) {
      setUnlockTarget({ id: f.id, name: f.name, navigate: true });
      return;
    }
    setFolderId(f.id);
  };

  /* ── Yükleme (Drive) ── */
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    if (file.size > MAX_UPLOAD) {
      setUploadError(`Dosya çok büyük (${(file.size / (1024 * 1024)).toFixed(1)} MB) — en fazla 100 MB yükleyebilirsiniz.`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    if (folderId) form.append('folderId', folderId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents/upload');
    const headers = tokenHeaders([folderId]);
    if (headers['x-folder-token']) xhr.setRequestHeader('x-folder-token', headers['x-folder-token']);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status === 201) {
        refresh();
      } else if (xhr.status === 423 && folderId && view?.current) {
        setUnlockTarget({ id: folderId, name: view.current.name, navigate: false });
      } else {
        try {
          setUploadError(JSON.parse(xhr.responseText)?.error || 'Yükleme başarısız');
        } catch {
          setUploadError('Yükleme başarısız');
        }
      }
    };
    xhr.onerror = () => {
      setUploadProgress(null);
      setUploadError('Yükleme sırasında ağ hatası oluştu');
    };
    setUploadProgress(0);
    xhr.send(form);
  };

  /* ── İndirme ── */
  const downloadDoc = async (doc: DocItem) => {
    // Harici bağlantı (Drive'sız, data: olmayan) → doğrudan aç
    if (!doc.driveFileId && doc.url && !doc.url.startsWith('data:')) {
      window.open(doc.url, '_blank');
      return;
    }
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, { headers: tokenHeaders([folderId]) });
      if (res.status === 423 && folderId && view?.current) {
        setUnlockTarget({ id: folderId, name: view.current.name, navigate: false });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Dosya indirilemedi');
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      alert('Dosya indirilemedi');
    }
  };

  /* ── Önizleme (satır içi; video için Range/byte-serving ile seek destekli) ── */
  const openPreview = (doc: DocItem) => {
    // Harici bağlantı (Drive'sız, data: olmayan) → doğrudan aç
    if (!doc.driveFileId && doc.url && !doc.url.startsWith('data:')) {
      window.open(doc.url, '_blank', 'noopener');
      return;
    }
    let url = `/api/documents/${doc.id}/download?inline=1`;
    const token = folderId ? getStoredToken(folderId) : null;
    if (token) url += `&token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener');
  };

  /* ── Silme ── */
  const deleteDoc = async (doc: DocItem) => {
    if (!confirm(`"${doc.name}" dosyasını silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: tokenHeaders([folderId]),
    });
    if (res.ok) refresh();
    else alert((await res.json().catch(() => ({})))?.error || 'Dosya silinemedi');
  };

  const deleteFolder = async (f: FolderItem) => {
    if (!confirm(`"${f.name}" klasörünü silmek istediğinize emin misiniz? İçindeki dosyalar da silinir.`)) return;
    const res = await fetch(`/api/folders/${f.id}`, { method: 'DELETE' });
    if (res.ok) refresh();
    else alert((await res.json().catch(() => ({})))?.error || 'Klasör silinemedi');
  };

  const isC = me ? me.role !== 'admin' && me.role !== 'editor' : true;
  const canManage = !!view?.canManage && !isC;
  const canWriteHere = !!view?.canWrite;
  const driveOk = !!view?.driveConfigured;
  const totalSize = docs.reduce((acc, d) => acc + (d.size || 0), 0);

  return (
    <div onClick={() => openMenu && setOpenMenu(null)}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">🗄️ Depo</h1>
          <p className="page-subtitle">Şirket içi klasörlü belge ve medya deposu</p>
        </div>
        <div className="page-header-actions">
          {canManage && (
            <button className="btn btn-ghost" onClick={() => setFolderModal({ mode: 'new' })}>📁 Yeni Klasör</button>
          )}
          {canWriteHere && !docsLocked && (
            <>
              <button className="btn btn-ghost" onClick={() => setLinkModal(true)}>🔗 Bağlantı Ekle</button>
              {driveOk && (
                <button
                  className="btn btn-primary"
                  disabled={uploadProgress !== null}
                  onClick={() => fileInputRef.current?.click()}
                >
                  ☁️ Dosya Yükle
                </button>
              )}
            </>
          )}
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePicked} />
        </div>
      </div>

      {canWriteHere && !loading && !driveOk && (
        <div style={{
          marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
          border: '1px solid var(--warning)', borderRadius: 8, fontSize: 'var(--text-sm)',
        }}>
          ⚠️ Google Drive bağlı değil — dosya yükleme kapalı, ancak <strong>bağlantı ekleyebilirsiniz</strong>.
          Bağlamak için: <code>node scripts/prep-drive-oauth.mjs</code> ve <code>GOOGLE_DRIVE_CREDENTIALS_JSON</code> env değişkeni.
        </div>
      )}

      {uploadProgress !== null && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Yükleniyor... %{uploadProgress}</div>
          <div style={{ height: 8, background: 'var(--border, #eee)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--info)', transition: 'width .2s' }} />
          </div>
        </div>
      )}
      {uploadError && (
        <div style={{ marginBottom: 'var(--space-4)', color: 'var(--error)', fontSize: 'var(--text-sm)' }}>
          {uploadError} <button className="btn btn-ghost btn-sm" onClick={() => setUploadError('')}>✕</button>
        </div>
      )}
      {pageError && (
        <div style={{ marginBottom: 'var(--space-4)', color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{pageError}</div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setFolderId(null)} style={{ fontWeight: folderId ? 400 : 600 }}>
          🏠 Depo
        </button>
        {view?.breadcrumb.map((c, i) => (
          <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontWeight: i === view.breadcrumb.length - 1 ? 600 : 400 }}
              onClick={() => openFolder(c)}
            >
              {c.locked ? '🔒 ' : ''}{c.name}
            </button>
          </span>
        ))}
      </div>

      {/* İstatistik satırı */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-label">Klasör</div>
          <div className="stat-card-value">{loading ? '-' : view?.folders.length ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Dosya</div>
          <div className="stat-card-value">{loading ? '-' : docsLocked ? '🔒' : docs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Bu Görünümde Boyut</div>
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>
            {loading || docsLocked ? '-' : formatSize(totalSize)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="data-table-container">
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
        </div>
      ) : (
        <>
          {/* Klasör ızgarası */}
          {(view?.folders.length ?? 0) > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
            }}>
              {view!.folders.map((f) => (
                <div
                  key={f.id}
                  className="stat-card"
                  style={{ cursor: 'pointer', position: 'relative' }}
                  onClick={() => openFolder(f)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 'var(--text-xl)' }}>📁</div>
                    {canManage && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `f:${f.id}` ? null : `f:${f.id}`); }}
                      >⋯</button>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, margin: 'var(--space-2) 0', wordBreak: 'break-word' }}>{f.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
                    {f.locked && <span className="badge badge-warning">🔒 Şifreli</span>}
                    {f.restricted && <span className="badge badge-info">👥 Kısıtlı</span>}
                    {f.minLevel !== 'C' && <span className="badge badge-error">{f.minLevel}+</span>}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    {f.counts.folders > 0 && `${f.counts.folders} klasör · `}{f.counts.documents} dosya
                  </div>
                  {openMenu === `f:${f.id}` && (
                    <div
                      style={{
                        position: 'absolute', top: 40, right: 8, zIndex: 20,
                        background: 'var(--bg-secondary, #fff)', border: '1px solid var(--border, #ddd)',
                        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                        display: 'flex', flexDirection: 'column', minWidth: 170,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                        onClick={() => { setOpenMenu(null); setFolderModal({ mode: 'edit', folder: f }); }}>
                        ✏️ Düzenle
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--error)' }}
                        onClick={() => { setOpenMenu(null); deleteFolder(f); }}>
                        🗑️ Sil
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Dosya listesi */}
          <div className="data-table-container">
            {docsLocked ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>🔒</div>
                <div style={{ marginBottom: 'var(--space-4)', color: 'var(--text-muted)' }}>
                  Bu klasörün içeriği şifre korumalı.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => view?.current && setUnlockTarget({ id: view.current.id, name: view.current.name, navigate: false })}
                >
                  Şifreyi Gir
                </button>
              </div>
            ) : docs.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                {view?.folders.length ? 'Bu klasörde dosya yok.' : 'Henüz dosya yüklenmemiş.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dosya Adı</th>
                    <th>Tür</th>
                    <th>Boyut</th>
                    <th>Yükleyen</th>
                    <th>Tarih</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--text-xl)' }}>{fileIcons[doc.type] || '📁'}</span>
                          <span style={{ fontWeight: 500, wordBreak: 'break-word' }}>{doc.name}</span>
                          {doc.driveFileId && <span className="badge badge-info" title="Google Drive'da saklanıyor">Drive</span>}
                        </div>
                      </td>
                      <td><span className="badge badge-info">{(doc.type || 'other').toUpperCase()}</span></td>
                      <td>{formatSize(doc.size)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{doc.uploadedByName || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(doc.createdAt).toLocaleDateString('tr-TR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', position: 'relative' }}>
                          {isPreviewable(doc) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openPreview(doc)} title="Yeni sekmede önizle / oynat">Önizle</button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => downloadDoc(doc)}>İndir</button>
                          {canWriteHere && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === `d:${doc.id}` ? null : `d:${doc.id}`); }}
                              >⋯</button>
                              {openMenu === `d:${doc.id}` && (
                                <div
                                  style={{
                                    position: 'absolute', top: '100%', right: 0, zIndex: 20,
                                    background: 'var(--bg-secondary, #fff)', border: '1px solid var(--border, #ddd)',
                                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
                                    display: 'flex', flexDirection: 'column', minWidth: 180,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => { setOpenMenu(null); setRenameDoc(doc); }}>
                                    ✏️ Yeniden Adlandır
                                  </button>
                                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => { setOpenMenu(null); setMoveDoc(doc); }}>
                                    📦 Taşı
                                  </button>
                                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--error)' }}
                                    onClick={() => { setOpenMenu(null); deleteDoc(doc); }}>
                                    🗑️ Sil
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modallar */}
      {folderModal && me && (
        <FolderModal
          mode={folderModal.mode}
          folder={folderModal.mode === 'edit' ? folderModal.folder : undefined}
          parentId={folderId}
          isAdminUser={me.role === 'admin'}
          onClose={() => setFolderModal(null)}
          onSaved={() => { setFolderModal(null); refresh(); }}
        />
      )}

      {unlockTarget && (
        <UnlockModal
          target={unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onUnlocked={(navigate, id) => {
            setUnlockTarget(null);
            if (navigate) setFolderId((prev) => (prev === id ? prev : id));
            if (!navigate || folderId === id) refresh();
          }}
        />
      )}

      {linkModal && (
        <LinkModal
          folderId={folderId}
          onClose={() => setLinkModal(false)}
          onSaved={() => { setLinkModal(false); refresh(); }}
        />
      )}

      {renameDoc && (
        <RenameModal
          doc={renameDoc}
          folderId={folderId}
          onClose={() => setRenameDoc(null)}
          onSaved={() => { setRenameDoc(null); refresh(); }}
        />
      )}

      {moveDoc && (
        <MoveModal
          doc={moveDoc}
          folderId={folderId}
          canWriteRoot={!isC}
          onClose={() => setMoveDoc(null)}
          onSaved={() => { setMoveDoc(null); refresh(); }}
        />
      )}
    </div>
  );
}

/* ══════════ Kilit açma modalı ══════════ */
function UnlockModal({ target, onClose, onUnlocked }: {
  target: { id: string; name: string; navigate: boolean };
  onClose: () => void;
  onUnlocked: (navigate: boolean, id: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/folders/${target.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Kilit açılamadı');
        return;
      }
      storeToken(target.id, data.token, data.expiresAt);
      onUnlocked(target.navigate, target.id);
    } catch {
      setError('Kilit açılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">🔒 {target.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Klasör Şifresi</label>
            <input
              type="password"
              className="form-input"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{error}</div>}
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Erişim 30 dakika geçerlidir; süre dolunca şifre yeniden istenir.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !password}>
            {busy ? 'Doğrulanıyor...' : 'Aç'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════ Yeni klasör / düzenleme modalı ══════════ */
function FolderModal({ mode, folder, parentId, isAdminUser, onClose, onSaved }: {
  mode: 'new' | 'edit';
  folder?: FolderItem;
  parentId: string | null;
  isAdminUser: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(folder?.name ?? '');
  const [minLevel, setMinLevel] = useState(folder?.minLevel ?? 'C');
  const [restricted, setRestricted] = useState(folder?.restricted ?? false);
  const [selected, setSelected] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const a of folder?.access ?? []) m.set(a.userId, a.canWrite);
    return m;
  });
  const [password, setPassword] = useState('');
  const [removePassword, setRemovePassword] = useState(false);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/team')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setTeam(data))
      .catch(() => {});
  }, []);

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, false);
      return next;
    });
  };

  const toggleWrite = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.set(id, !next.get(id));
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const userIds = Array.from(selected.entries()).map(([userId, canWrite]) => ({ userId, canWrite }));
      const payload: Record<string, unknown> = { name: name.trim(), minLevel, restricted, userIds };
      if (mode === 'new') {
        payload.parentId = parentId;
        if (password) payload.password = password;
      } else {
        if (removePassword) payload.password = null;
        else if (password) payload.password = password;
      }
      const res = await fetch(mode === 'new' ? '/api/folders' : `/api/folders/${folder!.id}`, {
        method: mode === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Kaydedilemedi');
        return;
      }
      onSaved();
    } catch {
      setError('Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const isLocked = mode === 'edit' && !!folder?.locked;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{mode === 'new' ? '📁 Yeni Klasör' : '✏️ Klasörü Düzenle'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Klasör Adı *</label>
            <input className="form-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Asgari Erişim Seviyesi</label>
            <select className="form-select" value={minLevel} onChange={(e) => setMinLevel(e.target.value)}>
              <option value="C">C — Tüm ekip</option>
              <option value="B">B — Ekip Lideri / Muhasebe ve üzeri</option>
              {isAdminUser && <option value="A">A — Yalnızca Baş Yönetici</option>}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} />
              👥 Kısıtlı klasör (yalnızca seçili kullanıcılar + Baş Yönetici görür)
            </label>
          </div>
          {(restricted || selected.size > 0) && (
            <div className="form-group">
              <label className="form-label">Erişebilecek Kullanıcılar</label>
              <div style={{
                maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border, #ddd)',
                borderRadius: 8, padding: 'var(--space-2)',
              }}>
                {team.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Ekip listesi yükleniyor...</div>}
                {team.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleUser(u.id)} />
                      {u.name}{u.title ? ` — ${u.title}` : ''}
                    </label>
                    {selected.has(u.id) && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!selected.get(u.id)} onChange={() => toggleWrite(u.id)} />
                        yazabilir
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Not: Ekip liderleri yalnızca kendi ekibindeki kullanıcılara erişim verebilir.
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">
              {isLocked ? 'Yeni Şifre (yalnızca Baş Yönetici sıfırlayabilir)' : 'Şifre (opsiyonel — klasörü kilitler)'}
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              disabled={removePassword}
              placeholder={mode === 'edit' ? 'Boş bırakılırsa değişmez' : 'En az 4 karakter'}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {isLocked && isAdminUser && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" checked={removePassword} onChange={(e) => setRemovePassword(e.target.checked)} />
                🔓 Şifreyi kaldır (denetim kaydına düşer)
              </label>
            </div>
          )}
          {error && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor...' : mode === 'new' ? 'Oluştur' : 'Kaydet'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════ Bağlantı ile ekleme modalı ══════════ */
function LinkModal({ folderId, onClose, onSaved }: {
  folderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('other');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tokenHeaders([folderId]) },
        body: JSON.stringify({ name: name.trim(), url: url.trim() || null, type, folderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Eklenemedi');
        return;
      }
      onSaved();
    } catch {
      setError('Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">🔗 Bağlantı ile Dosya Ekle</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Dosya Adı *</label>
            <input className="form-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Bağlantı (URL)</label>
            <input className="form-input" value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tür</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="word">Word</option>
              <option value="excel">Excel</option>
              <option value="image">Görsel</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          {error && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════ Yeniden adlandırma modalı ══════════ */
function RenameModal({ doc, folderId, onClose, onSaved }: {
  doc: DocItem;
  folderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(doc.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...tokenHeaders([folderId]) },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Yeniden adlandırılamadı');
        return;
      }
      onSaved();
    } catch {
      setError('Yeniden adlandırılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">✏️ Yeniden Adlandır</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Yeni Ad *</label>
            <input
              className="form-input" value={name} autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════ Taşıma modalı ══════════ */
function MoveModal({ doc, folderId, canWriteRoot, onClose, onSaved }: {
  doc: DocItem;
  folderId: string | null;
  canWriteRoot: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [target, setTarget] = useState<string>(''); // '' = kök
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/folders?all=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setFolders(data))
      .catch(() => {});
  }, []);

  // Ağaç sırası + girinti derinliği
  const ordered: Array<FlatFolder & { depth: number }> = [];
  const addChildren = (parentId: string | null, depth: number) => {
    if (depth > 20) return;
    for (const f of folders.filter((x) => x.parentId === parentId)) {
      ordered.push({ ...f, depth });
      addChildren(f.id, depth + 1);
    }
  };
  addChildren(null, 0);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...tokenHeaders([folderId, target || null]) },
        body: JSON.stringify({ folderId: target || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 423
          ? 'Hedef veya kaynak klasör şifreli — önce ilgili klasörün şifresini girin.'
          : data.error || 'Taşınamadı');
        return;
      }
      onSaved();
    } catch {
      setError('Taşınamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">📦 Taşı: {doc.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Hedef Klasör</label>
            <select className="form-select" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="" disabled={!canWriteRoot}>
                🏠 Genel Alan (kök){!canWriteRoot ? ' — yetki yok' : ''}
              </option>
              {ordered.map((f) => {
                const needsUnlock = f.locked && !getStoredToken(f.id);
                const disabled = !f.canWrite || f.id === doc.folderId || needsUnlock;
                return (
                  <option key={f.id} value={f.id} disabled={disabled}>
                    {' '.repeat(f.depth * 3)}📁 {f.name}
                    {f.locked ? ' 🔒' : ''}
                    {f.id === doc.folderId ? ' (mevcut)' : !f.canWrite ? ' — yazma yetkisi yok' : needsUnlock ? ' — şifre gerekli' : ''}
                  </option>
                );
              })}
            </select>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              Şifreli hedefler için önce o klasöre girip şifresini açmanız gerekir.
            </div>
          </div>
          {error && <div style={{ color: 'var(--error)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || (target || null) === (doc.folderId || null)}>
            {busy ? 'Taşınıyor...' : 'Taşı'}
          </button>
        </div>
      </div>
    </>
  );
}
