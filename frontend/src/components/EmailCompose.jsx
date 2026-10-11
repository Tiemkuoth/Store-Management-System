import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Send, RefreshCw, AlertCircle, CheckCircle2,
  Inbox, Settings, X, ChevronDown, User, Clock, AlertTriangle
} from 'lucide-react';
import apiFetch from '../utils/apiFetch';

/* ── helpers ─────────────────────────────────────────────── */
function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── SMTP Status Banner ──────────────────────────────────── */
function SmtpBanner({ status }) {
  if (!status) return null;
  if (status.configured) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', borderRadius: '10px',
        background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
        fontSize: '12px', color: '#047857'
      }}>
        <CheckCircle2 size={14} />
        <span><strong>SMTP ready</strong> — sending via <strong>{status.user}</strong> on <strong>{status.host}:{status.port}</strong></span>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '12px 16px', borderRadius: '10px',
      background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
      fontSize: '12px', color: '#92400e'
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
      <div>
        <strong>SMTP not configured.</strong> Emails will be logged to the console only.
        {' '}Add <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '4px' }}>SMTP_HOST</code>,{' '}
        <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '4px' }}>SMTP_USER</code>,{' '}
        <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '4px' }}>SMTP_PASS</code> to your <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '4px' }}>.env</code> file.
      </div>
    </div>
  );
}

/* ── Contact picker ──────────────────────────────────────── */
function ContactPicker({ contacts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c =>
    (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const addContact = (email) => {
    const current = value.split(',').map(e => e.trim()).filter(Boolean);
    if (!current.includes(email)) {
      onChange([...current, email].join(', '));
    }
    setSearch('');
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="recipient@example.com (comma-separate multiple)"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        {contacts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--bg-border)',
              background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '11px',
              color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <User size={13} /> Contacts <ChevronDown size={11} />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 50,
          width: '280px', marginTop: '4px',
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '12px', height: '32px' }}
              autoFocus
            />
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No contacts found</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => addContact(c.email)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 14px', width: '100%', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#6366f1,#0ea5e9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '11px', fontWeight: '700',
                }}>
                  {(c.full_name || c.email)[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{c.role}</span>
              </button>
            ))}
          </div>
          <div style={{ padding: '6px 8px', borderTop: '1px solid var(--bg-border)', textAlign: 'right' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export default function EmailCompose() {
  const [smtpStatus, setSmtpStatus]   = useState(null);
  const [contacts,   setContacts]     = useState([]);
  const [sentEmails, setSentEmails]   = useState([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [activeTab,  setActiveTab]    = useState('compose'); // 'compose' | 'sent'

  // Form state
  const [to,      setTo]      = useState('');
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Load SMTP status + contacts on mount
  useEffect(() => {
    apiFetch('/email/status').then(r => r.ok ? r.json() : null).then(d => d && setSmtpStatus(d));
    apiFetch('/email/contacts').then(r => r.ok ? r.json() : []).then(d => setContacts(Array.isArray(d) ? d : []));
  }, []);

  const fetchSent = useCallback(async () => {
    setLoadingSent(true);
    try {
      const res = await apiFetch('/email/sent');
      if (res.ok) setSentEmails(await res.json());
    } catch (_) {}
    finally { setLoadingSent(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'sent') fetchSent();
  }, [activeTab, fetchSent]);

  const handleSend = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!to.trim())      return setError('Please enter at least one recipient.');
    if (!subject.trim()) return setError('Subject is required.');
    if (!body.trim())    return setError('Message body is required.');

    setSending(true);
    try {
      const res = await apiFetch('/email/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send email.'); return; }
      setSuccess(`Email sent to ${to}`);
      setTo(''); setSubject(''); setBody('');
      // Refresh sent tab silently
      fetchSent();
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'rgba(99,102,241,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={22} color="#6366f1" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>Email Center</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Send emails via SMTP — no Google account required
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {[
            { id: 'compose', icon: Send,   label: 'Compose' },
            { id: 'sent',    icon: Inbox,  label: `Sent (${sentEmails.length})` },
            { id: 'config',  icon: Settings, label: 'Config' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none',
                background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === tab.id ? '#6366f1' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? '700' : '500',
                fontSize: '12px', cursor: 'pointer',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SMTP Banner ── */}
      <SmtpBanner status={smtpStatus} />

      {/* ══ COMPOSE TAB ══════════════════════════════════════ */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(0,380px)', gap: '20px', alignItems: 'start' }}>

          {/* Compose form */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={15} color="#6366f1" /> New Message
            </h3>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '12px', marginBottom: '14px' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {success && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#047857', fontSize: '12px', marginBottom: '14px' }}>
                <CheckCircle2 size={14} /> {success}
              </div>
            )}

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">To *</label>
                <ContactPicker contacts={contacts} value={to} onChange={setTo} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Subject *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Email subject…"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Message *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Write your message here…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  style={{ minHeight: '200px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setTo(''); setSubject(''); setBody(''); setError(''); setSuccess(''); }}
                  style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={13} /> Clear
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: '130px', justifyContent: 'center' }}
                >
                  {sending ? (
                    <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                  ) : (
                    <><Send size={14} /> Send Email</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick contacts sidebar */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <User size={14} color="#6366f1" /> Quick Contacts
            </h3>
            {contacts.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No contacts with email addresses found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {contacts.slice(0, 10).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const existing = to.split(',').map(e => e.trim()).filter(Boolean);
                      if (!existing.includes(c.email)) {
                        setTo([...existing, c.email].join(', '));
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', borderRadius: '10px',
                      border: '1px solid transparent', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#6366f1,#0ea5e9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '12px', fontWeight: '800',
                    }}>
                      {(c.full_name || c.email)[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: '700', color: '#6366f1',
                      background: 'rgba(99,102,241,0.1)', padding: '2px 6px',
                      borderRadius: '999px', flexShrink: 0, marginLeft: 'auto',
                    }}>{c.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ SENT TAB ═════════════════════════════════════════ */}
      {activeTab === 'sent' && (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
              Sent Emails — {sentEmails.length} records
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchSent} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={13} style={loadingSent ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
            </button>
          </div>

          {loadingSent ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px' }}>Loading sent emails…</div>
            </div>
          ) : sentEmails.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Inbox size={28} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <div style={{ fontSize: '14px', fontWeight: '600' }}>No emails sent yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Emails you send will appear here</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-dense" style={{ minWidth: '680px' }}>
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Preview</th>
                    <th>Status</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {sentEmails.map(email => (
                    <tr key={email.id}>
                      <td style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {email.recipient_to}
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.body}
                      </td>
                      <td>
                        {email.status === 'sent' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#047857', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '999px' }}>
                            <CheckCircle2 size={10} /> Sent
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#dc2626', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '999px' }} title={email.error_message || ''}>
                            <AlertCircle size={10} /> Failed
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={10} /> {formatDate(email.sent_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ CONFIG TAB ═══════════════════════════════════════ */}
      {activeTab === 'config' && (
        <div className="glass-card" style={{ padding: '28px', maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={16} color="#6366f1" /> SMTP Configuration
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Configure these variables in your server <code style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px' }}>.env</code> file and restart the server.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { key: 'SMTP_HOST',  ex: 'smtp.gmail.com',       desc: 'SMTP server hostname' },
              { key: 'SMTP_PORT',  ex: '587',                   desc: '587 (TLS) or 465 (SSL)' },
              { key: 'SMTP_USER',  ex: 'you@gmail.com',         desc: 'Your email address / SMTP username' },
              { key: 'SMTP_PASS',  ex: 'your-app-password',     desc: 'App password (not your login password)' },
              { key: 'MAIL_FROM',  ex: '"Store SMS" <you@gmail.com>', desc: 'From name and address shown to recipients' },
            ].map(({ key, ex, desc }) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', alignItems: 'start', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
                <code style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1' }}>{key}</code>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>{desc}</div>
                  <code style={{ fontSize: '11px', color: 'var(--text-main)', opacity: 0.7 }}>e.g. {ex}</code>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#4338ca', fontWeight: '600' }}>💡 Using Gmail?</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Enable 2FA on your Google account, then go to <strong>Google Account → Security → App Passwords</strong> and generate a 16-character app password. Use that as <code>SMTP_PASS</code>.
              Set <code>SMTP_HOST=smtp.gmail.com</code> and <code>SMTP_PORT=587</code>.
            </p>
          </div>

          <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>Current status</p>
            {smtpStatus ? (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>Host: <strong style={{ color: 'var(--text-main)' }}>{smtpStatus.host || '—'}</strong></div>
                <div>Port: <strong style={{ color: 'var(--text-main)' }}>{smtpStatus.port}</strong></div>
                <div>User: <strong style={{ color: 'var(--text-main)' }}>{smtpStatus.user || '—'}</strong></div>
                <div>From: <strong style={{ color: 'var(--text-main)' }}>{smtpStatus.from || '—'}</strong></div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px', background: smtpStatus.configured ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: smtpStatus.configured ? '#047857' : '#92400e' }}>
                    {smtpStatus.configured ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {smtpStatus.configured ? 'Ready' : 'Not configured'}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
