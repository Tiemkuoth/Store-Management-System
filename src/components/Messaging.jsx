import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Send, Trash2, Search, X, MessageCircle, RefreshCw, Plus, Clock, Check, CheckCheck, MessageSquare } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

export default function Messaging({ isOpen, onClose }) {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();
  
  const [messages, setMessages] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [activeContactId, setActiveContactId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // Helper: Get avatar gradients
  const getAvatarGradient = (id) => {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #4f46e5)', // Indigo
      'linear-gradient(135deg, #0ea5e9, #0284c7)', // Sky
      'linear-gradient(135deg, #10b981, #059669)', // Emerald
      'linear-gradient(135deg, #f59e0b, #d97706)', // Amber
      'linear-gradient(135deg, #ec4899, #db2777)', // Pink
      'linear-gradient(135deg, #8b5cf6, #7c3aed)', // Purple
      'linear-gradient(135deg, #f97316, #ea580c)', // Orange
      'linear-gradient(135deg, #14b8a6, #0d9488)', // Teal
    ];
    return gradients[id % gradients.length];
  };

  // Helper: Get user initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  // Helper: Format time
  const formatTime = (date) => {
    const then = new Date(date);
    return then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper: Format date headers
  const formatDateHeader = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      loadRecipients();

      // Poll for updates every 5 seconds
      refreshIntervalRef.current = setInterval(() => {
        pollMessages();
      }, 5000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOpen]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      await fetchAndProcessMessages();
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const pollMessages = async () => {
    try {
      await fetchAndProcessMessages();
    } catch (e) {
      console.error('Error polling messages:', e);
    }
  };

  const fetchAndProcessMessages = async () => {
    try {
      const [inboxRes, sentRes] = await Promise.all([
        apiFetch('/messages/inbox?limit=500'),
        apiFetch('/messages/sent?limit=500')
      ]);
      
      if (!inboxRes.ok || !sentRes.ok) {
        console.error('Messages API error - inbox:', inboxRes.status, 'sent:', sentRes.status);
        const inboxErr = await inboxRes.json().catch(() => ({}));
        const sentErr = await sentRes.json().catch(() => ({}));
        console.error('Inbox error:', inboxErr);
        console.error('Sent error:', sentErr);
        return;
      }
      
      const inboxData = await inboxRes.json();
      const sentData = await sentRes.json();

      const inboxMsgs = inboxData.messages || [];
      const sentMsgs = sentData.messages || [];

      // Merge and sort ascending by date
      const combined = [...inboxMsgs, ...sentMsgs].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      setMessages(combined);
    } catch (e) {
      console.error('Error in fetchAndProcessMessages:', e);
      toast.error('Failed to load messages: ' + e.message);
    }
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
      console.error('Error loading recipients:', e);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchAndProcessMessages();
    setRefreshing(false);
    toast.success('Messages refreshed');
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeContactId || !inputText.trim()) {
      toast.warning('Please select a contact and enter a message');
      return;
    }

    setSending(true);
    try {
      console.log('Sending message to:', activeContactId, 'Content:', inputText.trim());
      
      const res = await apiFetch('/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_id: activeContactId,
          content: inputText.trim()
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Send message error:', error);
        throw new Error(error.error || 'Failed to send message');
      }

      console.log('Message sent successfully');
      setInputText('');
      await fetchAndProcessMessages();
      toast.success('Message sent');
      // Scroll to bottom after DOM update
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error('Error sending message:', e);
      toast.error('Error sending message: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const res = await apiFetch(`/messages/${messageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete message');
      toast.success('Message deleted');
      await fetchAndProcessMessages();
    } catch (e) {
      toast.error('Error deleting message: ' + e.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Group messages into conversations
  const chatThreads = {};
  messages.forEach(msg => {
    const isSentByMe = msg.sender_id === currentUser?.id;
    const partnerId = isSentByMe ? msg.recipient_id : msg.sender_id;
    const partnerName = isSentByMe ? msg.recipient_name : msg.sender_name;
    const partnerUsername = isSentByMe ? msg.recipient_username : msg.sender_username;
    const partnerAvatar = isSentByMe ? msg.recipient_avatar : msg.sender_avatar;

    if (!partnerId) return;

    if (!chatThreads[partnerId]) {
      chatThreads[partnerId] = {
        contactId: partnerId,
        name: partnerName || partnerUsername || `User #${partnerId}`,
        username: partnerUsername || '',
        avatar: partnerAvatar || null,
        messages: [],
        lastMessage: null,
        unreadCount: 0
      };
    }

    chatThreads[partnerId].messages.push(msg);
    chatThreads[partnerId].lastMessage = msg;
    if (!isSentByMe && !msg.is_read) {
      chatThreads[partnerId].unreadCount += 1;
    }
  });

  // Fallback: extract any users we have in threads who might not be in recipients list
  const knownRecipientsMap = new Map(recipients.map(r => [r.id, r]));
  Object.values(chatThreads).forEach(thread => {
    if (!knownRecipientsMap.has(thread.contactId)) {
      knownRecipientsMap.set(thread.contactId, {
        id: thread.contactId,
        full_name: thread.name,
        username: thread.username,
        avatar_url: thread.avatar
      });
    }
  });

  // Combine into contacts lists
  const allContacts = Array.from(knownRecipientsMap.values()).map(user => {
    const thread = chatThreads[user.id] || {
      contactId: user.id,
      name: user.full_name || user.username || `User #${user.id}`,
      username: user.username,
      avatar: user.avatar_url,
      messages: [],
      lastMessage: null,
      unreadCount: 0
    };
    return thread;
  });

  // Sort: contacts with active messages first (by latest date), then alphabetically
  const sortedContacts = allContacts.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.name.localeCompare(b.name);
  });

  // Search filter
  const filteredContacts = sortedContacts.filter(c => 
    c.name.toLowerCase().includes(searchText.toLowerCase()) || 
    c.username?.toLowerCase().includes(searchText.toLowerCase())
  );

  const activeContact = knownRecipientsMap.get(activeContactId);
  const activeThread = chatThreads[activeContactId] || { messages: [] };

  // Scroll to bottom when opening chat thread
  useEffect(() => {
    if (activeContactId) {
      scrollToBottom();

      // Mark unread messages as read
      if (activeThread.unreadCount > 0) {
        activeThread.messages.forEach(async (msg) => {
          if (msg.recipient_id === currentUser?.id && !msg.is_read) {
            try {
              await apiFetch(`/messages/${msg.id}/read`, { method: 'POST' });
            } catch (err) {
              console.error(err);
            }
          }
        });
        // Light delay and refresh list locally
        setTimeout(fetchAndProcessMessages, 500);
      }
    }
  }, [activeContactId]);

  // Group current active thread messages by day
  const groupedMessages = [];
  let lastDateStr = '';
  activeThread.messages.forEach(msg => {
    const dateStr = new Date(msg.created_at).toDateString();
    if (dateStr !== lastDateStr) {
      groupedMessages.push({ type: 'date', value: dateStr });
      lastDateStr = dateStr;
    }
    groupedMessages.push({ type: 'message', value: msg });
  });

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .chat-bubble {
          animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .chat-bubble:hover .delete-action {
          opacity: 1;
          transform: scale(1);
        }
        .delete-action {
          opacity: 0;
          transform: scale(0.85);
          transition: all 0.15s ease-in-out;
        }
        .contact-item {
          transition: all 0.2s ease;
          border-radius: 10px;
          margin: 4px 8px;
        }
        .contact-item:hover {
          background: rgba(99, 102, 241, 0.04);
        }
        .contact-item.active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.12)) !important;
          border-left-color: #6366f1;
        }
        /* Custom scrollbars */
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 9999px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
      `}</style>

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '18px', backdropFilter: 'blur(4px)' }}>
        <div className="modal-content" style={{ width: '1100px', maxWidth: '100%', height: '700px', background: 'var(--bg-card, #ffffff)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            
            {/* Sidebar (Left) */}
            <div style={{ width: '320px', background: 'var(--bg-card-header, #f9fafb)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              
              {/* Header */}
              <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageCircle size={20} color="#6366f1" />
                  <span style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-strong)' }}>Messages</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => setShowUserPicker(!showUserPicker)} 
                    style={{ border: 'none', width: '30px', height: '30px', borderRadius: '50%', background: showUserPicker ? 'rgba(99, 102, 241, 0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: showUserPicker ? '#6366f1' : 'var(--text-muted)' }} 
                    title="Start New Chat"
                  >
                    <Plus size={16} />
                  </button>
                  <button onClick={handleManualRefresh} disabled={refreshing} style={{ border: 'none', width: '30px', height: '30px', borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }} title="Refresh">
                    <RefreshCw size={15} className={refreshing ? 'spin-anim' : ''} />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '36px', background: 'var(--bg-main, #ffffff)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 10px', gap: '8px' }}>
                  <Search size={14} color="#8a94a6" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={showUserPicker ? "Search contacts..." : "Search messages..."}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--text-main)' }}
                  />
                  {searchText && <X size={14} color="#8a94a6" style={{ cursor: 'pointer' }} onClick={() => setSearchText('')} />}
                </div>
              </div>

              {/* Contacts / Threads List or User Picker */}
              <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
                {showUserPicker ? (
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700', color: '#6366f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>SELECT A CONTACT</span>
                      <button onClick={() => setShowUserPicker(false)} style={{ border: 'none', background: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                    {recipients.length === 0 ? (
                      <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No other users found
                      </div>
                    ) : (
                      recipients
                        .filter(u => u.full_name?.toLowerCase().includes(searchText.toLowerCase()) || u.username?.toLowerCase().includes(searchText.toLowerCase()))
                        .map(user => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setActiveContactId(user.id);
                              setShowUserPicker(false);
                              setSearchText('');
                            }}
                            className="contact-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.04))'
                            }}
                          >
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                fontSize: '12px',
                                fontWeight: '600',
                                borderRadius: '50%',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: getAvatarGradient(user.id)
                              }}
                            >
                              {getInitials(user.full_name || user.username)}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-strong)' }}>{user.full_name || user.username}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.role}</div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                ) : (
                  // Normal conversation threads list
                  filteredContacts.length === 0 ? (
                    <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No active conversations.<br/>Click <strong>+</strong> above to start one!
                    </div>
                  ) : (
                    filteredContacts.map((c) => {
                      const isSelected = activeContactId === c.contactId;
                      const previewText = c.lastMessage 
                        ? (c.lastMessage.sender_id === currentUser?.id ? 'You: ' : '') + c.lastMessage.content
                        : 'No messages yet';

                      return (
                        <div
                          key={c.contactId}
                          onClick={() => setActiveContactId(c.contactId)}
                          className={`contact-item ${isSelected ? 'active' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderLeft: '4px solid transparent',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            borderLeftColor: isSelected ? '#6366f1' : 'transparent'
                          }}
                        >
                          {/* Avatar */}
                          {c.avatar ? (
                            <img
                              src={c.avatar}
                              alt={c.name}
                              style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div
                            className="avatar"
                            style={{
                              width: '38px',
                              height: '38px',
                              fontSize: '13px',
                              fontWeight: '600',
                              borderRadius: '50%',
                              color: '#fff',
                              display: c.avatar ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: getAvatarGradient(c.contactId),
                              flexShrink: 0
                            }}
                          >
                            {getInitials(c.name)}
                          </div>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name}
                              </div>
                              {c.lastMessage && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                  {new Date(c.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                              <div style={{ fontSize: '12px', color: isSelected ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingRight: '4px' }}>
                                {previewText}
                              </div>
                              {c.unreadCount > 0 && (
                                <div style={{ background: '#6366f1', color: '#ffffff', fontSize: '10px', fontWeight: '700', minWidth: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                                  {c.unreadCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>

            {/* Conversation Window (Right) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main, #fafafa)' }}>
              
              {activeContactId ? (
                <>
                  {/* Top Bar / Header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card, #ffffff)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {activeContact?.avatar_url ? (
                        <img
                          src={activeContact.avatar_url}
                          alt={activeContact.full_name || activeContact.username}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className="avatar"
                        style={{
                          width: '36px',
                          height: '36px',
                          fontSize: '13px',
                          fontWeight: '600',
                          borderRadius: '50%',
                          color: '#fff',
                          display: activeContact?.avatar_url ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: getAvatarGradient(activeContactId)
                        }}
                      >
                        {getInitials(activeContact?.full_name || activeContact?.username)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-strong)' }}>
                          {activeContact?.full_name || activeContact?.username}
                        </div>
                        <div style={{ fontSize: '11px', color: '#10b981', marginTop: '1px', fontWeight: '500' }}>
                          Role: {activeContact?.role || 'User'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={onClose} style={{ border: 'none', width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-card-header, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Messages list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }} className="custom-scroll">
                    {loading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
                        Loading chat history...
                      </div>
                    ) : activeThread.messages.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, gap: '8px', color: 'var(--text-muted)' }}>
                        <MessageSquare size={32} strokeWidth={1.5} />
                        <span style={{ fontSize: '13px' }}>No messages in this chat. Send a message below to start!</span>
                      </div>
                    ) : (
                      groupedMessages.map((item, idx) => {
                        if (item.type === 'date') {
                          return (
                            <div key={`date-${idx}`} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', background: 'var(--bg-card-header, #e5e7eb)', padding: '4px 10px', borderRadius: '12px' }}>
                                {formatDateHeader(item.value)}
                              </span>
                            </div>
                          );
                        }

                        const msg = item.value;
                        const isMine = msg.sender_id === currentUser?.id;

                        return (
                          <div
                            key={msg.id}
                            className="chat-bubble"
                            style={{
                              display: 'flex',
                              justifyContent: isMine ? 'flex-end' : 'flex-start',
                              alignItems: 'flex-end',
                              gap: '6px'
                            }}
                          >
                            {/* Time and Receipts */}
                            {isMine && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', opacity: 0.8 }}>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                  {formatTime(msg.created_at)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {msg.is_read ? (
                                    <CheckCheck size={13} color="#6366f1" />
                                  ) : (
                                    <Check size={13} color="#8a94a6" />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Content */}
                            <div
                              style={{
                                maxWidth: '65%',
                                padding: '10px 14px',
                                borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                background: isMine ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--bg-card, #ffffff)',
                                color: isMine ? '#ffffff' : 'var(--text-main)',
                                border: isMine ? 'none' : '1px solid var(--border-color)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                position: 'relative'
                              }}
                            >
                              {msg.content}
                              
                              {/* Hover delete action */}
                              <button
                                className="delete-action"
                                onClick={() => handleDeleteMessage(msg.id)}
                                style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  [isMine ? 'left' : 'right']: '-24px',
                                  background: 'var(--bg-card, #ffffff)',
                                  border: '1px solid var(--border-color)',
                                  color: '#ef4444',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                title="Delete message"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>

                            {/* Time for incoming messages */}
                            {!isMine && (
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                {formatTime(msg.created_at)}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Box */}
                  <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', background: 'var(--bg-card, #ffffff)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-main, #f3f4f6)', borderRadius: '24px', border: '1px solid var(--border-color)', padding: '0 16px', transition: 'border-color 0.2s', height: '44px' }}>
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          fontSize: '13px',
                          height: '100%'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending || !inputText.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#ffffff',
                        border: 'none',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                        transition: 'transform 0.2s, opacity 0.2s',
                        opacity: !inputText.trim() ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => { if (inputText.trim()) e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: 'var(--text-muted)', padding: '40px' }}>
                  <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                    <MessageSquare size={40} strokeWidth={1.5} />
                    <div style={{ position: 'absolute', inset: '-6px', border: '2px dashed rgba(99, 102, 241, 0.2)', borderRadius: '50%', animation: 'spin 20s linear infinite' }} />
                  </div>
                  <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                    <h4 style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-strong)', margin: '0 0 8px 0' }}>Your Conversations</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
                      Select an existing contact from the left list, or click the **Plus (+)** icon to start a new chat thread.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
