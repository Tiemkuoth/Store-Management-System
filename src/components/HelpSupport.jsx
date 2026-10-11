import React, { useContext, useState, useEffect } from 'react';
import { HelpCircle, Book, MessageSquare, AlertTriangle, Shield, CheckCircle, Send } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import apiFetch from '../utils/apiFetch';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

export default function HelpSupport() {
  const { currentUser } = useContext(AuthContext) || {};
  // Use the logged-in admin's email, or a generic fallback
  const adminEmail = currentUser?.email || 'contact your administrator';

  const toast = useToast();
  const [targetRole, setTargetRole] = useState('director');
  const [issue, setIssue] = useState('');
  const [details, setDetails] = useState('');

  const [category, setCategory] = useState('System Issue');
  const [urgency, setUrgency] = useState('medium');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await apiFetch('/users');
        if (res.ok) {
          const data = await res.json();
          // API returns { data: [...], total, page, limit, pages }
          setUsers(data.data || data || []);
        }
      } catch (err) {
        console.error('Error fetching users for support panel:', err);
        setUsers([]); // Ensure users is always an array
      }
    };
    loadUsers();
  }, []);

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!issue.trim() || !details.trim()) {
      toast.error('Please fill in all form fields');
      return;
    }

    setSubmitting(true);
    try {
      const formattedContent = `🔴 [COMPLAINT] — [${category.toUpperCase()}]\nUrgency: ${urgency.toUpperCase()}\nSubject: ${issue.trim()}\n\n${details.trim()}`;

      const res = await apiFetch('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          targetRole,
          content: formattedContent
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit complaint');
      }

      toast.success('✨ Complaint submitted successfully and sent directly to chat!');
      setIssue('');
      setDetails('');
      setIsSubmitted(true);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="responsive-help-grid">

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', color: '#6366f1' }}>
              <Book size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>Documentation & User Guide</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
            Learn how to use the Store Management System effectively. Covers navigation, purchase orders, receiving stock, and generating reports.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => alert("Opening User Guide...")}>📖 View User Guide</button>
            <button className="btn btn-secondary" onClick={() => alert("Opening API Documentation...")}>📄 System Docs</button>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', color: '#10b981' }}>
              <HelpCircle size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-strong)', margin: 0 }}>Frequently Asked Questions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>How do I reset my password?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>Click on your profile avatar in the top right, select "Change Password", and enter your new credentials.</p>
            </details>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>How is inventory value calculated?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>The system uses current stock quantity multiplied by unit cost to determine total valuation.</p>
            </details>
            <details style={{ background: 'var(--bg-card-header)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
              <summary style={{ fontWeight: '500', color: 'var(--text-strong)' }}>Can I delete a transaction?</summary>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>No. Transactions are immutable for audit compliance. Perform an adjustment or return to correct records.</p>
            </details>
          </div>
        </div>

      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        {isSubmitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 10px', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', color: '#10b981' }}>
              <CheckCircle size={48} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-strong)', margin: '0 0 6px 0' }}>Complaint Submitted</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                Your complaint was successfully routed and delivered to all active users in the <strong>{targetRole}</strong> group.
              </p>
            </div>
            <button
              onClick={() => setIsSubmitted(false)}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '8px 16px', marginTop: '10px' }}
            >
              Submit Another Complaint
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-strong)', margin: 0, letterSpacing: '-0.02em' }}>Incident Desk & Support Ticket</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>File a structured complaint. The ticket is immediately routed to the chat box of active personnel.</p>
              </div>
            </div>
            <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Recipient Routing Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-strong)' }}>Send Support Ticket To:</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', transition: 'border-color 0.2s', height: '42px' }}
                >
                  <option value="director">Director ({users.filter(u => u.role === 'Director' && u.status === 'Active').map(u => u.full_name || u.username).join(', ') || 'No active users'})</option>
                  <option value="admin">Administrator ({users.filter(u => u.role === 'Administrator' && u.status === 'Active').map(u => u.full_name || u.username).join(', ') || 'No active users'})</option>
                  <option value="manager">Manager ({users.filter(u => u.role === 'Manager' && u.status === 'Active').map(u => u.full_name || u.username).join(', ') || 'No active users'})</option>
                  <option value="storekeeper">Storekeeper ({users.filter(u => u.role === 'Storekeeper' && u.status === 'Active').map(u => u.full_name || u.username).join(', ') || 'No active users'})</option>
                  <option value="employee">Employee ({users.filter(u => u.role === 'Employee' && u.status === 'Active').map(u => u.full_name || u.username).join(', ') || 'No active users'})</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '20px' }}>

                {/* Left Column: Routing & Triage Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                      1. Category & Severity
                    </h4>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-strong)', marginBottom: '8px' }}>Category:</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { value: 'System Issue', label: 'System & Technical Issue', icon: '🖥️' },
                        { value: 'Inventory/Stock', label: 'Inventory & Stock Discrepancy', icon: '📦' },
                        { value: 'Billing/Procurement', label: 'Billing & Procurement', icon: '💰' },
                        { value: 'Staff Conduct', label: 'Staff Conduct & Performance', icon: '👥' },
                        { value: 'Other', label: 'Other Support Inquiries', icon: '❓' }
                      ].map((cat) => {
                        const isActive = category === cat.value;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setCategory(cat.value)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: isActive ? '2px solid #6366f1' : '1px solid var(--border-color)',
                              background: isActive ? 'rgba(99,102,241,0.05)' : 'var(--bg-main)',
                              color: isActive ? '#6366f1' : 'var(--text-main)',
                              fontSize: '13px',
                              fontWeight: isActive ? '700' : '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                              <span>{cat.label}</span>
                            </div>
                            {isActive && <CheckCircle size={15} style={{ color: '#6366f1' }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-strong)', marginBottom: '8px' }}>Urgency Level:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {['low', 'medium', 'high', 'critical'].map((level) => {
                        const isActive = urgency === level;
                        const colors = {
                          low: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', color: '#10b981' },
                          medium: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', color: '#f59e0b' },
                          high: { bg: 'rgba(249, 115, 22, 0.08)', border: '#f97316', color: '#f97316' },
                          critical: { bg: 'rgba(185, 28, 28, 0.08)', border: '#b91c1c', color: '#b91c1c' }
                        };
                        const conf = colors[level];
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setUrgency(level)}
                            style={{
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: isActive ? `2px solid ${conf.border}` : '1px solid var(--border-color)',
                              background: isActive ? conf.bg : 'var(--bg-main)',
                              color: isActive ? conf.color : 'var(--text-muted)',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: conf.border }} />
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Ticket Content Card */}
                <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                    2. Ticket Details
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-strong)', marginBottom: '6px' }}>Subject:</label>
                      <input
                        type="text"
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                        placeholder="Brief summary of the issue"
                        required
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', transition: 'all 0.2s ease', height: '40px', boxSizing: 'border-box' }}
                        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                      />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-strong)', marginBottom: '6px' }}>Description:</label>
                      <textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder={"Describe the issue in detail:\n• What happened and when?\n• Steps to reproduce the problem\n• What resolution or action do you need?"}
                        rows={8}
                        required
                        style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', flex: 1, minHeight: '180px', transition: 'all 0.2s ease', lineHeight: '1.6' }}
                        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery info bar */}
              <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'rgba(99,102,241,0.05)', padding: '14px 18px', borderRadius: '12px', borderLeft: '4px solid #6366f1', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#6366f1' }}>
                  📬 Recipient list context:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {users.filter(u => u.role === { 'director': 'Director', 'admin': 'Administrator', 'manager': 'Manager', 'storekeeper': 'Storekeeper' }[targetRole] && u.status === 'Active').length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active users with this role found.</span>
                  ) : (
                    users
                      .filter(u => u.role === { 'director': 'Director', 'admin': 'Administrator', 'manager': 'Manager', 'storekeeper': 'Storekeeper' }[targetRole] && u.status === 'Active')
                      .map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 'bold'
                          }}>
                            {u.full_name ? u.full_name[0].toUpperCase() : u.username[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-strong)' }}>{u.full_name || u.username}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
                  fontWeight: '700',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.01)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                <Send size={16} /> {submitting ? 'Sending Ticket...' : 'Submit Incident Ticket'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
