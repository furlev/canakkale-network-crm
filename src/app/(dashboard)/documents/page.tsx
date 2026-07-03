'use client';
import { useState, useEffect } from 'react';

type Document = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  createdAt: string;
};

const fileIcons: Record<string, string> = {
  pdf: '📄',
  word: '📝',
  excel: '📊',
  image: '🖼️',
  other: '📁',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', type: 'pdf', size: 1024, url: '' });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!newDoc.name) return;
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc),
      });
      if (res.ok) {
        const created = await res.json();
        setDocuments([created, ...documents]);
        setIsUploading(false);
        setNewDoc({ name: '', type: 'pdf', size: 1024, url: '' });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== id));
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">📁 Dosya Yönetimi</h1>
          <p className="page-subtitle">Şirket içi belge ve medya deposu</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsUploading(true)}>☁️ Dosya Yükle</button>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom: 'var(--space-6)'}}>
        <div className="stat-card">
          <div className="stat-card-label">Toplam Dosya</div>
          <div className="stat-card-value">{loading ? '-' : documents.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Kullanılan Alan</div>
          <div className="stat-card-value" style={{color:'var(--info)'}}>
            {loading ? '-' : (documents.reduce((acc, curr) => acc + curr.size, 0) / (1024*1024)).toFixed(2)} MB
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Sözleşmeler</div>
          <div className="stat-card-value" style={{color:'var(--warning)'}}>{loading ? '-' : documents.filter(d => d.type === 'pdf').length}</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{padding:'var(--space-8)', textAlign:'center'}}>Yükleniyor...</div>
        ) : documents.length === 0 ? (
          <div style={{padding:'var(--space-8)', textAlign:'center', color:'var(--text-muted)'}}>Henüz dosya yüklenmemiş.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Dosya Adı</th>
                <th>Tür</th>
                <th>Boyut</th>
                <th>Yüklenme Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'var(--space-2)'}}>
                      <span style={{fontSize:'var(--text-xl)'}}>{fileIcons[doc.type] || '📁'}</span>
                      <span style={{fontWeight:500}}>{doc.name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-info">{doc.type.toUpperCase()}</span></td>
                  <td>{(doc.size / 1024).toFixed(1)} KB</td>
                  <td style={{color:'var(--text-muted)'}}>{new Date(doc.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <div style={{display:'flex', gap:'var(--space-2)'}}>
                      <button className="btn btn-ghost btn-sm" onClick={() => doc.url ? window.open(doc.url, '_blank') : alert('Bu dosya için indirme bağlantısı bulunmuyor.')}>İndir</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(doc.id)}>Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isUploading && (
        <>
          <div className="modal-backdrop" onClick={() => setIsUploading(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Dosya Yükle</h2>
              <button className="modal-close" onClick={() => setIsUploading(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Dosya Adı *</label>
                <input className="form-input" value={newDoc.name} onChange={e=>setNewDoc({...newDoc, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Dosya Türü</label>
                  <select className="form-select" value={newDoc.type} onChange={e=>setNewDoc({...newDoc, type: e.target.value})}>
                    <option value="pdf">PDF (Sözleşme/Rapor)</option>
                    <option value="word">Word (Döküman)</option>
                    <option value="excel">Excel (Tablo)</option>
                    <option value="image">Görsel</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temsili Boyut (KB)</label>
                  <input type="number" className="form-input" value={newDoc.size} onChange={e=>setNewDoc({...newDoc, size: Number(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Dosya URL (opsiyonel)</label>
                <input className="form-input" value={newDoc.url} onChange={e=>setNewDoc({...newDoc, url: e.target.value})} placeholder="https://..." />
              </div>
              <div className="form-group" style={{marginTop:'var(--space-4)'}}>
                <div style={{border:'2px dashed var(--border)', padding:'var(--space-8)', textAlign:'center', borderRadius:'var(--border-radius)', color:'var(--text-muted)'}}>
                  Sürükle bırak özelliği simüle edilmektedir. Burası gerçek bir dosya yükleme alanı (AWS S3 vb.) ile entegre edilebilir.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsUploading(false)}>İptal</button>
              <button className="btn btn-primary" onClick={handleUpload}>Yükle</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
