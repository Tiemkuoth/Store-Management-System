import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Send, Search, MessageCircle, Trash2, ArrowLeft } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';

export default function Messages() {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false); // Show new conversation modal
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const isMounted = useRef(true);
  const lastMessagesSigRef = useRef(''); // Used to prevent unnecessary re-renders

  const initialLoadDone = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper functions - must be defined before use in effects
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!isMounted.current) return;
    try {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      
      // Load both inbox and sent messages concurrently without blocking the main thread
      const [inboxData, sentData] = await Promise.all([
        apiFetch('/messages/inbox').then(r => r.json()).catch(() => ({ messages: [], unread: 0 })),
        apiFetch('/messages/sent').then(r => r.json()).catch(() => ({ messages: [] }))
      ]);
      
      if (!isMounted.current) return;
      
      const allMessages = [
        ...(inboxData.messages || []),
        ...(sentData.messages || [])
      ];

      // Fingerprint check to prevent heavy DOM re-renders if messages haven't changed
      const currentSig = JSON.stringify(allMessages.map(m => `${m.id}-${m.is_read}`));
      if (currentSig !== lastMessagesSigRef.current) {
        setMessages(allMessages);
        lastMessagesSigRef.current = currentSig;
      }
      
      setUnreadCount(inboxData.unread || 0);
      initialLoadDone.current = true;
    } catch (e) {
      if (!e.message?.includes('Failed to fetch')) console.error(e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!isMounted.current) return;
    try {
      const res = await apiFetch('/messages/unread/count');
      if (!isMounted.current) return;
      const data = await res.json();
      setUnreadCount(data.unread || 0);
    } catch (_e) {}
  };

  const loadRecipients = async () => {
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const response = await res.json();
        // API returns { data: [...], total, page, limit, pages }
        const usersArray = response.data || response || [];
        setRecipients(usersArray.filter(u => u.id !== currentUser?.id) || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedRecipient || !messageText.trim()) {
      return;
    }

    try {
      const res = await apiFetch('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: selectedRecipient.id,
          content: messageText
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }

      toast.success('✨ Message sent!');
      setMessageText('');
      await loadMessages();
      await loadUnreadCount();
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleStartConversation = (user) => {
    setSelectedRecipient(user);
    setShowNewMessageModal(false);
    setMessageText(''); // Clear input for new message
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;

    try {
      const res = await apiFetch(`/messages/${messageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete message');
      toast.success('Message deleted');
      loadMessages();
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleClearConversation = async () => {
    if (!selectedRecipient) return;
    if (!confirm(`Delete all messages with ${selectedRecipient.full_name}? This action cannot be undone.`)) return;

    try {
      const messagesToDelete = conversationMessages;
      let deleted = 0;
      
      for (const msg of messagesToDelete) {
        const res = await apiFetch(`/messages/${msg.id}`, { method: 'DELETE' });
        if (res.ok) deleted++;
      }
      
      toast.success(`✓ Deleted ${deleted} messages`);
      loadMessages();
      setSelectedRecipient(null);
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleMarkMessageAsRead = async (messageId) => {
    try {
      const res = await apiFetch(`/messages/${messageId}/read`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark as read');
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: true } : m));
      await loadUnreadCount();
    } catch (e) {
      console.error('Error marking message as read:', e);
    }
  };

  // Calculate derived state - memoized to prevent glitches
  const conversationMessages = React.useMemo(() => 
    selectedRecipient
      ? messages.filter(m => 
          (m.sender_id === selectedRecipient.id && m.recipient_id === currentUser?.id) ||
          (m.sender_id === currentUser?.id && m.recipient_id === selectedRecipient.id)
        ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      : [],
    [messages, selectedRecipient?.id, currentUser?.id]
  );

  const conversationPartners = React.useMemo(() => {
    const partnersMap = new Map();
    messages.forEach(m => {
      const partner = m.sender_id === currentUser?.id ? {
        id: m.recipient_id,
        full_name: m.recipient_name,
        avatar_url: m.recipient_avatar,
        username: m.recipient_username
      } : {
        id: m.sender_id,
        full_name: m.sender_name,
        avatar_url: m.sender_avatar,
        username: m.sender_username
      };
      if (!partnersMap.has(partner.id)) {
        partnersMap.set(partner.id, partner);
      }
    });
    return Array.from(partnersMap.values()).sort((a, b) => b.id - a.id);
  }, [messages, currentUser?.id]);

  const filteredPartners = React.useMemo(() => 
    conversationPartners.filter(p =>
      p.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchText.toLowerCase())
    ),
    [conversationPartners, searchText]
  );

  // Effects
  useEffect(() => {
    isMounted.current = true;
    window.dispatchEvent(new Event('messages:opened'));
    loadMessages();
    loadRecipients();
    // Messages page is first opened


    refreshIntervalRef.current = setInterval(() => {
      loadMessages(); // Handles unread count internally now
    }, 5000);

    return () => {
      isMounted.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages.length, selectedRecipient?.id]);

  useEffect(() => {
    if (selectedRecipient?.id && conversationMessages.length > 0) {
      conversationMessages.forEach(msg => {
        if (msg.recipient_id === currentUser?.id && !msg.is_read) {
          handleMarkMessageAsRead(msg.id);
        }
      });
    }
  }, [selectedRecipient?.id, conversationMessages, currentUser?.id]);

  return (
    <>
      <style>{`
        .msg-item { transition: all 0.3s ease; border-left: 3px solid transparent; }
        .msg-item:hover { border-left-color: #5B4FFF; background: var(--bg-hover); }
        .msg-item.active { border-left-color: #5B4FFF; background: var(--bg-hover); }
      `}</style>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div style={{ height: 'calc(100vh - var(--header-height, 56px) - 36px)', minHeight: '480px', maxHeight: '100%', background: 'var(--bg-main)', display: 'flex', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, width: '100%', height: '100%', background: 'var(--bg-main)', overflow: 'hidden' }}>
          {/* Left Sidebar - Conversations */}
          <div className="msg-sidebar" style={{ width: isMobile ? '100%' : '320px', minWidth: isMobile ? '100%' : '320px', borderRight: isMobile ? 'none' : '1px solid var(--border-color)', display: isMobile && selectedRecipient ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', position: 'relative', height: '100%' }}>
            {/* Search */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '13px', outline: 'none', background: 'var(--bg-main)', color: 'var(--text-main)', transition: 'all 0.3s ease', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#5B4FFF'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
              {/* New Message Button */}
              <button
                onClick={() => setShowNewMessageModal(true)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #5B4FFF, #00B4DB)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(91, 79, 255, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.boxShadow = '0 4px 12px rgba(91, 79, 255, 0.4)'}
                onMouseLeave={(e) => e.target.style.boxShadow = '0 2px 8px rgba(91, 79, 255, 0.3)'}
              >
                ✏️ New Message
              </button>
            </div>

            {/* Conversations List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>⚙️ Loading...</div>
              ) : filteredPartners.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <MessageCircle size={32} opacity={0.2} style={{ marginBottom: '8px' }} />
                  <p>No conversations</p>
                </div>
              ) : (
                filteredPartners.map((partner) => {
                  const allMsgs = messages.filter(m => 
                    (m.sender_id === partner.id && m.recipient_id === currentUser?.id) ||
                    (m.sender_id === currentUser?.id && m.recipient_id === partner.id)
                  ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                  const lastMsg = allMsgs[0];
                  const unreadInConv = messages.filter(m => m.sender_id === partner.id && m.recipient_id === currentUser?.id && !m.is_read).length;
                  
                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedRecipient(partner)}
                      className={`msg-item ${selectedRecipient?.id === partner.id ? 'active' : ''}`}
                      style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start' }}
                    >
                      {/* Avatar Container */}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {partner.avatar_url ? (
                            <img loading="lazy" src={partner.avatar_url} alt={partner.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                          ) : (
                            <span style={{ color: '#666', fontWeight: '700', fontSize: '18px' }}>
                              {partner.full_name?.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <div style={{ fontSize: '14px', fontWeight: unreadInConv > 0 ? '700' : '600', color: unreadInConv > 0 ? '#5B4FFF' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {partner.full_name}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                          {lastMsg?.content?.substring(0, 40) || 'No messages'}
                        </div>
                      </div>

                      {/* Green Dot Indicator for Unread Messages */}
                      {unreadInConv > 0 && (
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', alignSelf: 'center', marginLeft: 'auto', marginRight: '4px', flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Chat Area */}
          <div className="msg-chat" style={{ flex: 1, display: isMobile && !selectedRecipient ? 'none' : 'flex', flexDirection: 'column', background: 'var(--bg-main)', position: 'relative', minWidth: 0, height: '100%' }}>
            {selectedRecipient ? (
              <>
                {/* Chat Header */}
                <div style={{ padding: 'clamp(10px, 1.8vw, 16px) clamp(12px, 2.5vw, 24px)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setSelectedRecipient(null)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 10px', marginRight: '2px' }}
                        title="Back to conversations"
                      >
                        <ArrowLeft size={16} />
                      </button>
                    )}
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedRecipient.avatar_url ? (
                        <img loading="lazy" src={selectedRecipient.avatar_url} alt={selectedRecipient.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                      ) : (
                        <span style={{ color: '#666', fontWeight: '700', fontSize: '18px' }}>
                          {selectedRecipient.full_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedRecipient.full_name}
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        @{selectedRecipient.username}
                      </p>
                    </div>
                  </div>
                  
                  {/* Clear conversation button */}
                  <button
                    onClick={handleClearConversation}
                    style={{
                      background: 'rgba(255, 76, 76, 0.1)',
                      border: '1px solid rgba(255, 76, 76, 0.3)',
                      color: '#FF4C4C',
                      cursor: 'pointer',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 76, 76, 0.2)';
                      e.target.style.borderColor = 'rgba(255, 76, 76, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 76, 76, 0.1)';
                      e.target.style.borderColor = 'rgba(255, 76, 76, 0.3)';
                    }}
                    title="Delete all messages in this conversation"
                  >
                    <Trash2 size={14} /> <span className="sign-out-label">Clear All</span>
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(12px, 2vw, 20px)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-main)' }}>
                  {conversationMessages.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
                      <div>
                        <MessageCircle size={48} opacity={0.2} style={{ marginBottom: '8px' }} />
                        <p>No messages yet. Say hello!</p>
                      </div>
                    </div>
                  ) : (
                    conversationMessages.map((msg, idx) => {
                      const isSender = msg.sender_id === currentUser?.id;
                      const showTimestamp = idx === 0 || new Date(msg.created_at).getTime() - new Date(conversationMessages[idx - 1].created_at).getTime() > 60000;
                      const showDeleteBtn = hoveredMessageId === msg.id; // Use parent state
                      
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSender ? 'flex-end' : 'flex-start', gap: '4px' }}>
                          {/* Time separator */}
                          {showTimestamp && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginY: '8px', textAlign: 'center', width: '100%' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          
                          {/* Message bubble */}
                          <div 
                            onMouseEnter={() => setHoveredMessageId(msg.id)}
                            onMouseLeave={() => setHoveredMessageId(null)}
                            style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', justifyContent: isSender ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                            {!isSender && (
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
                                {msg.sender_avatar ? (
                                  <img loading="lazy" src={msg.sender_avatar} alt={msg.sender_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                                ) : (
                                  <span style={{ color: '#666', fontWeight: '700', fontSize: '12px' }}>
                                    {msg.sender_name?.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: isSender ? 'flex-end' : 'flex-start', width: '100%' }}>
                              {/* Sender name - show for all messages */}
                              {!isSender && (
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingX: '12px' }}>
                                  {msg.sender_name}
                                </div>
                              )}
                              {isSender && (
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#5B4FFF', paddingX: '12px', textAlign: 'right' }}>
                                  You
                                </div>
                              )}
                              
                              {/* Message bubble with delete button */}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', justifyContent: isSender ? 'flex-end' : 'flex-start' }}>
                                <div style={{ 
                                  background: isSender ? 'linear-gradient(135deg, #5B4FFF, #00B4DB)' : 'var(--bg-secondary)',
                                  padding: '10px 14px',
                                  borderRadius: isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                  color: isSender ? 'white' : 'var(--text-main)',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  lineHeight: '1.4',
                                  boxShadow: isSender ? '0 1px 2px rgba(91, 79, 255, 0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
                                  position: 'relative'
                                }}>
                                  {msg.content}
                                  
                                  {/* Read status for sender messages */}
                                  {isSender && (
                                    <span style={{ 
                                      fontSize: '9px', 
                                      marginLeft: '8px', 
                                      opacity: 0.95, 
                                      color: msg.is_read ? '#a5f3fc' : '#e2e8f0', 
                                      fontWeight: '600',
                                      letterSpacing: '0.02em'
                                    }}>
                                      {msg.is_read ? '✓✓ Read' : '✓ Sent'}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Delete button - appears on hover */}
                                {showDeleteBtn && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    style={{
                                      background: 'rgba(255, 76, 76, 0.9)',
                                      border: 'none',
                                      color: 'white',
                                      cursor: 'pointer',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      transition: 'all 0.2s ease',
                                      opacity: 0.9,
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 76, 76, 1)'}
                                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 76, 76, 0.9)'}
                                    title="Delete message"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} style={{ padding: 'clamp(10px, 1.5vw, 16px) clamp(12px, 2.5vw, 24px)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
                    style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'var(--bg-main)', color: 'var(--text-main)', transition: 'all 0.2s ease' }}
                    onFocus={(e) => e.target.style.borderColor = '#5B4FFF'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    style={{ background: messageText.trim() ? 'linear-gradient(135deg, #5B4FFF, #00B4DB)' : 'rgba(91, 79, 255, 0.3)', border: 'none', color: 'white', cursor: messageText.trim() ? 'pointer' : 'not-allowed', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease', boxShadow: messageText.trim() ? '0 4px 12px rgba(91, 79, 255, 0.3)' : 'none' }}
                    onMouseEnter={(e) => messageText.trim() && (e.target.style.boxShadow = '0 6px 16px rgba(91, 79, 255, 0.4)')}
                    onMouseLeave={(e) => messageText.trim() && (e.target.style.boxShadow = '0 4px 12px rgba(91, 79, 255, 0.3)')}
                  >
                    <Send size={16} /> Send
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', flexDirection: 'column', gap: '16px' }}>
                <MessageCircle size={64} opacity={0.2} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>Select a conversation</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.7 }}>Choose a person from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowNewMessageModal(false)}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            maxHeight: '70vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
              Start a Conversation
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Select a person to message
            </p>
            
            {/* Users List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
              {recipients.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No users available
                </div>
              ) : (
                recipients.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartConversation(user)}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = '#5B4FFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-main)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#e0e0e0',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--border-color)'
                    }}>
                      {user.avatar_url ? (
                        <img loading="lazy" src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                      ) : (
                        <span style={{ color: '#666', fontWeight: '700', fontSize: '16px' }}>
                          {user.full_name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {user.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{user.username}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => setShowNewMessageModal(false)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--bg-hover)';
                e.target.style.borderColor = '#5B4FFF';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'var(--border-color)';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
