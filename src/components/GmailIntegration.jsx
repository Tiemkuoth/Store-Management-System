import React, { useState, useEffect } from 'react';
import { Mail, Send, LogOut, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Inbox } from 'lucide-react';
import { apiFetch } from '../contexts/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );
}

export default function GmailIntegration({ currentUser }) {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    checkStatus();
    // Handle OAuth redirect check if we just returned from Google
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleOAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const raw = await apiFetch('/gmail/status');
      const res = raw.ok ? await raw.json() : null;
      if (res?.connected) {
        setConnected(true);
        setEmail(res.email);
        fetchEmails();
      } else {
        setConnected(false);
      }
    } catch (err) {
      // Silently ignore on load — Gmail may simply not be configured
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code) => {
    try {
      setLoading(true);
      const raw = await apiFetch(`/gmail/callback?code=${code}`);
      const res = await raw.json();
      if (res.success) {
        setConnected(true);
        setEmail(res.email);
        fetchEmails();
      } else {
        setError(res.error || 'Failed to complete Google authentication.');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to complete Google authentication.');
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setError(null);
      const raw = await apiFetch('/gmail/auth-url');
      const res = await raw.json();
      if (res.url) {
        window.location.href = res.url;
      } else {
        // Server returned an error (e.g. 503 — credentials not configured)
        setError(res.error || 'Gmail integration is not available. Please contact your administrator.');
      }
    } catch (err) {
      setError('Could not reach the server. Please check your connection and try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await apiFetch('/gmail/disconnect', { method: 'POST' });
      setConnected(false);
      setEmail('');
      setEmails([]);
    } catch (err) {
      setError('Failed to disconnect.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const raw = await apiFetch('/gmail/messages');
      if (!raw.ok) { setLoading(false); return; }
      const data = await raw.json();
      setEmails(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch recent emails.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;
    try {
      setSending(true);
      const raw = await apiFetch('/gmail/send', {
        method: 'POST',
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody })
      });
      const res = await raw.json();
      if (!raw.ok) throw new Error(res.error || 'Send failed');
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setError(null);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  if (loading && !connected && !emails.length) {
    return <div className="loading-spinner" style={{ margin: '40px auto', display: 'block' }}></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(234, 67, 53, 0.12)', color: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #1e293b)' }}>Gmail Integration</h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--text-muted, #64748b)' }}>Connect your Google account to read incoming emails and dispatch client communications</p>
          </div>
        </div>

        <div>
          {connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                {email}
              </span>
              <button onClick={handleDisconnect} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                <LogOut size={14} /> Disconnect
              </button>
            </div>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-surface-muted, #f1f5f9)', color: 'var(--text-muted, #64748b)', border: '1px solid var(--bg-border, #e2e8f0)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }}></span>
              Not Connected
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ margin: '4px 0', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#dc2626', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
          <AlertCircle size={18} />
          <span>{typeof error === 'object' ? (error.message || 'An unexpected error occurred.') : error}</span>
        </div>
      )}

      {connected ? (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Inbox Section */}
          <div className="glass-card" style={{ flex: '1 1 500px', padding: '20px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Inbox size={18} color="var(--primary, #3b82f6)" /> Recent Messages
              </h3>
              <button onClick={fetchEmails} className="btn btn-secondary btn-sm" title="Refresh Emails">
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
            
            {loading && !emails.length ? (
              <div className="loading-spinner" style={{ margin: '30px auto' }}></div>
            ) : emails.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emails.map(msg => (
                  <div key={msg.id} style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--bg-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{msg.from.replace(/<.*>/, '').trim()}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(msg.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{msg.subject}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {msg.snippet}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>No recent emails found in your inbox.</p>
            )}
          </div>

          {/* Compose Section */}
          <div className="glass-card" style={{ flex: '1 1 360px', padding: '20px', borderRadius: '14px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <Send size={18} color="var(--primary, #3b82f6)" /> Compose Email
            </h3>
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Recipient Email *</label>
                <input 
                  type="email" 
                  value={composeTo} 
                  onChange={e => setComposeTo(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="recipient@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject *</label>
                <input 
                  type="text" 
                  value={composeSubject} 
                  onChange={e => setComposeSubject(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="Subject line"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Message *</label>
                <textarea 
                  value={composeBody} 
                  onChange={e => setComposeBody(e.target.value)} 
                  required 
                  className="form-textarea" 
                  style={{ minHeight: '130px', resize: 'vertical' }}
                  placeholder="Write your message here..."
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={sending} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                {sending ? 'Sending...' : <><Send size={16} /> Send Email</>}
              </button>
              {sendSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '9px', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> Email sent successfully!
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* Disconnected Hero State */
        <div className="glass-card" style={{ padding: '50px 24px', textAlign: 'center', maxWidth: '620px', margin: '20px auto', borderRadius: '18px', border: '1px solid var(--bg-border)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(234, 67, 53, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', color: '#ea4335' }}>
            <Mail size={32} />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Connect Your Gmail Account</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 22px auto', fontSize: '0.88rem', lineHeight: '1.6' }}>
            Integrate Gmail to review incoming customer emails and send invoices, material requests, and confirmations directly from the Store Management dashboard.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface-muted, rgba(100,116,139,0.06))', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--bg-border)' }}>
              <CheckCircle2 size={14} color="#10b981" /> OAuth 2.0 Secure
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface-muted, rgba(100,116,139,0.06))', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--bg-border)' }}>
              <CheckCircle2 size={14} color="#10b981" /> Direct In-App Inbox
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface-muted, rgba(100,116,139,0.06))', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--bg-border)' }}>
              <ShieldCheck size={14} color="#3b82f6" /> No Stored Passwords
            </span>
          </div>

          <button 
            type="button" 
            onClick={handleConnect} 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#1f2937',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.12)'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
          >
            <GoogleIcon />
            <span>Connect with Google</span>
          </button>
        </div>
      )}
    </div>
  );
}
