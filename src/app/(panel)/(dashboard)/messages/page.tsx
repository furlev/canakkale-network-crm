'use client';
import { useState, useEffect, useRef } from 'react';

type Conversation = {
  id: string;
  name: string;
  role: string;
  department?: string | null;
  status: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unread: number;
};

type Message = {
  id: string;
  conversationId: string;
  fromMe: boolean;
  content: string;
  createdAt: string;
};

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  status: string;
};

const roleLabels: Record<string, string> = { admin: 'Yönetici', editor: 'Editör', user: 'Üye' };

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function timeLabel(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newSearch, setNewSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConv) fetchMessages(activeConv);
  }, [activeConv]);

  // Polling: aktif konuşmanın mesajlarını ve konuşma listesini her 5 sn'de bir yenile.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (activeConv) fetchMessages(activeConv);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      setConversations(data);
      if (data.length > 0) setActiveConv((prev) => prev || data[0].id);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      setMessages(await res.json());
      setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unread: 0 } : c)));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSend = async () => {
    if (!msgInput.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConv, content: msgInput.trim(), fromMe: true }),
      });
      if (res.ok) {
        const created = await res.json();
        setMessages([...messages, created]);
        setConversations(prev => prev.map(c => (c.id === activeConv ? { ...c, lastMessage: created.content, lastMessageAt: created.createdAt } : c)));
        setMsgInput('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const openNewChat = async () => {
    setShowNew(true);
    setNewSearch('');
    setTeamLoading(true);
    try {
      const res = await fetch('/api/team');
      const data = res.ok ? await res.json() : [];
      setTeamUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching team:', error);
      setTeamUsers([]);
    } finally {
      setTeamLoading(false);
    }
  };

  const startConversation = (userId: string) => {
    // Konuşma listesinde yoksa (henüz mesaj yok) yer tutucu bir konuşma ekle.
    setConversations(prev => {
      if (prev.some(c => c.id === userId)) return prev;
      const u = teamUsers.find(t => t.id === userId);
      if (!u) return prev;
      return [
        { id: u.id, name: u.name, role: u.role, department: u.department, status: u.status, lastMessage: null, lastMessageAt: null, unread: 0 },
        ...prev,
      ];
    });
    setActiveConv(userId);
    setMessages([]);
    setShowNew(false);
  };

  const activeUser = conversations.find(c => c.id === activeConv);
  const filteredConvs = conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredTeam = teamUsers.filter(u => u.name.toLowerCase().includes(newSearch.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">💬 Mesajlar</h1>
          <p className="page-subtitle">Ekip içi iletişim</p>
        </div>
        <button className="btn btn-primary" onClick={openNewChat}>+ Yeni Sohbet</button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Yükleniyor...</div>
      ) : conversations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-title">Ekip üyesi yok</div>
          <div className="empty-state-desc">Mesajlaşmak için önce Ekip sayfasından üye ekleyin.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 'calc(100vh - 240px)', overflow: 'hidden' }}>
          <div style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="data-table-search" style={{ width: '100%' }}>
                <span>🔍</span>
                <input placeholder="Kişi ara..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredConvs.map(c => (
                <div key={c.id} onClick={() => setActiveConv(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', background: activeConv === c.id ? 'var(--surface-3)' : 'transparent', borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}>
                  <div style={{ position: 'relative' }}>
                    <div className="avatar" style={{ background: 'var(--primary-gradient)', color: 'white' }}>{initials(c.name)}</div>
                    {c.status === 'active' && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-primary)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{timeLabel(c.lastMessageAt)}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage || roleLabels[c.role] || c.role}
                    </div>
                  </div>
                  {c.unread > 0 && <span className="sidebar-link-badge">{c.unread}</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="avatar" style={{ background: 'var(--primary-gradient)', color: 'white' }}>{activeUser ? initials(activeUser.name) : '?'}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{activeUser?.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: activeUser?.status === 'active' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {activeUser ? `${roleLabels[activeUser.role] || activeUser.role}${activeUser.department ? ' · ' + activeUser.department : ''}` : ''}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Henüz mesaj yok. İlk mesajı gönderin. 👋
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.fromMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: 'var(--space-3) var(--space-4)', borderRadius: m.fromMe ? 'var(--border-radius-lg) var(--border-radius-lg) 4px var(--border-radius-lg)' : 'var(--border-radius-lg) var(--border-radius-lg) var(--border-radius-lg) 4px', background: m.fromMe ? 'var(--primary)' : 'var(--surface-3)', color: m.fromMe ? 'white' : 'var(--text-primary)' }}>
                      <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{m.content}</div>
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                        {new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--space-3)' }}>
              <input
                className="form-input"
                placeholder="Mesajınızı yazın..."
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleSend} disabled={sending || !msgInput.trim()}>Gönder</button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <>
          <div className="modal-backdrop" onClick={() => setShowNew(false)}></div>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Yeni Sohbet</h2>
              <button className="modal-close" onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="data-table-search" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
                <span>🔍</span>
                <input placeholder="Kişi ara..." value={newSearch} onChange={e => setNewSearch(e.target.value)} />
              </div>
              {teamLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>Yükleniyor...</div>
              ) : filteredTeam.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>Kullanıcı bulunamadı.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto' }}>
                  {filteredTeam.map(u => (
                    <div key={u.id} onClick={() => startConversation(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', cursor: 'pointer', borderRadius: 'var(--border-radius)', transition: 'background var(--transition-fast)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="avatar" style={{ background: 'var(--primary-gradient)', color: 'white' }}>{initials(u.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {roleLabels[u.role] || u.role}{u.department ? ' · ' + u.department : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
