import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Package, Plus, ClipboardList, RotateCcw,
  AlertCircle, Bell, History, User, LogOut,
  CheckCircle2, Clock, XCircle, ChevronRight, X, Menu,
  Send, Inbox, RefreshCw, AlertTriangle, Info, Settings,
  Lock, Eye, EyeOff, Mail, Phone, Shield, Building, AtSign,
} from 'lucide-react';
import { apiFetch } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';

/* ─── helpers ─── */
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtFull = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const statusBadge = (s) => {
  const map = {
    Pending: { bg: 'rgba(245,158,11,.12)', color: '#d97706', icon: <Clock size={11} /> },
    Approved: { bg: 'rgba(16,185,129,.12)', color: '#059669', icon: <CheckCircle2 size={11} /> },
    Rejected: { bg: 'rgba(239,68,68,.12)', color: '#dc2626', icon: <XCircle size={11} /> },
    Issued: { bg: 'rgba(99,102,241,.12)', color: '#4f46e5', icon: <Package size={11} /> },
    Returned: { bg: 'rgba(100,116,139,.12)', color: '#475569', icon: <RotateCcw size={11} /> },
    Open: { bg: 'rgba(245,158,11,.12)', color: '#d97706', icon: <AlertTriangle size={11} /> },
    Resolved: { bg: 'rgba(16,185,129,.12)', color: '#059669', icon: <CheckCircle2 size={11} /> },
  };
  const s2 = map[s] || { bg: 'rgba(100,116,139,.1)', color: '#64748b', icon: <Info size={11} /> };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: s2.bg, color: s2.color, fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s2.icon} {s}
    </span>
  );
};

const NAV = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'MY_ITEMS', label: 'My Items', icon: Package },
  { id: 'REQUEST', label: 'Request Material', icon: Plus },
  { id: 'MY_REQUESTS', label: 'My Requests', icon: ClipboardList },
  { id: 'RETURNS', label: 'Returns', icon: RotateCcw },
  { id: 'REPORT', label: 'Report Issue', icon: AlertCircle },
  { id: 'ISSUES', label: 'My Issues', icon: AlertTriangle },
  { id: 'HISTORY', label: 'History', icon: History },
  { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },
  { id: 'PROFILE', label: 'Profile', icon: User },
  { id: 'SETTINGS', label: 'Settings', icon: Settings },
];

/* ─── Toast ─── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: type === 'error' ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 600, fontSize: '0.82rem', boxShadow: '0 6px 20px rgba(0,0,0,.18)', maxWidth: 320 }}>
      {type === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={14} /></button>
    </div>
  );
}

/* ─── Stat card ─── */
function StatCard({ label, value, icon: Icon, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .18s ease, transform .18s ease' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.08)', e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = '', e.currentTarget.style.transform = '')}>
      <div style={{ width: 40, height: 40, borderRadius: 9, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-muted-strong)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
      {onClick && <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)', flexShrink: 0 }} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function EmployeePortal({ currentUser, onLogout }) {
  const [page, setPage] = useState('DASHBOARD');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});

  // shared header state
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sms_theme') === 'dark');
  const [clockTime, setClockTime] = useState(() => new Date());
  const [showBell, setShowBell] = useState(false);
  const bellRef = useRef(null);

  // data
  const [myItems, setMyItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [history, setHistory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [notifications, setNotifs] = useState([]);

  // forms
  const [reqForm, setReqForm] = useState({ material_id: '', quantity: 1, purpose: '', priority: 'Normal', required_date: '', remarks: '' });
  const [retForm, setRetForm] = useState({ request_id: '', quantity: 1, remarks: '' });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 'Normal' });

  // Settings form
  const [pwForm, setPwForm]       = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw]       = useState({ current: false, new: false, confirm: false });

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const setLoad = useCallback((key, val) => setLoading(p => ({ ...p, [key]: val })), []);

  /* ─── fetch helpers ─── */
  const load = useCallback(async (key, url, setter) => {
    setLoad(key, true);
    try {
      const res = await apiFetch(url);
      if (res.ok) {
        const d = await res.json();
        setter(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
      } else {
        const d = await res.json().catch(() => ({}));
        const errObj = d.error;
        const errMsg = typeof errObj === 'string' ? errObj : (errObj?.message || `Failed to load ${key}`);
        showToast(errMsg, 'error');
      }
    } catch (e) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setLoad(key, false);
    }
  }, [setLoad, showToast]);

  const loadAll = useCallback(() => {
    load('items', '/employee-portal/my-items', setMyItems);
    load('requests', '/employee-portal/my-requests', setRequests);
    load('issues', '/employee-portal/my-issues', setIssues);
    load('history', '/employee-portal/history', setHistory);
    load('materials', '/materials', setMaterials);
    load('notifs', '/employee-portal/notifications', setNotifs);
  }, [load]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 30 seconds to stay in sync
  useEffect(() => {
    const interval = setInterval(() => {
      load('requests', '/employee-portal/my-requests', setRequests);
      load('items', '/employee-portal/my-items', setMyItems);
      load('notifs', '/employee-portal/notifications', setNotifs);
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mark notifications as read when viewing them
  useEffect(() => {
    if (page === 'NOTIFICATIONS' && notifications.some(n => !n.is_read)) {
      apiFetch('/employee-portal/notifications/mark-read', { method: 'PUT' })
        .then(() => setNotifs(p => p.map(n => ({ ...n, is_read: 1 }))))
        .catch(e => console.warn('Failed to mark read', e));
    }
  }, [page, notifications]);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('sms_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  /* ─── navigate helper ─── */
  const nav = (id) => { setPage(id); if (window.innerWidth < 768) setSidebarOpen(false); };

  /* ─── submit request ─── */
  const submitRequest = async (e) => {
    e.preventDefault();
    if (loading.submitReq) return;
    if (!reqForm.material_id) return showToast('Please select a material', 'error');
    if (Number(reqForm.quantity) <= 0) return showToast('Quantity must be > 0', 'error');
    if (!reqForm.purpose.trim()) return showToast('Purpose is required', 'error');
    setLoad('submitReq', true);
    try {
      const res = await apiFetch('/material-requests', { method: 'POST', body: JSON.stringify(reqForm) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to submit request');
      showToast(`Request ${d.request_code} submitted — awaiting approval`);
      setReqForm({ material_id: '', quantity: 1, purpose: '', priority: 'Normal', remarks: '' });
      load('requests', '/employee-portal/my-requests', setRequests);
      nav('MY_REQUESTS');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoad('submitReq', false); }
  };

  /* ─── submit return ─── */
  const submitReturn = async (e) => {
    e.preventDefault();
    if (loading.submitRet) return;
    if (!retForm.request_id) return showToast('Select a request to return', 'error');
    setLoad('submitRet', true);
    try {
      const res = await apiFetch('/employee-portal/returns', { method: 'POST', body: JSON.stringify(retForm) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to submit return');
      showToast('Return submitted successfully');
      setRetForm({ request_id: '', quantity: 1, remarks: '' });
      load('items', '/employee-portal/my-items', setMyItems);
      load('requests', '/employee-portal/my-requests', setRequests);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoad('submitRet', false); }
  };

  /* ─── submit issue ─── */
  const submitIssue = async (e) => {
    e.preventDefault();
    if (loading.submitIssue) return;
    if (!issueForm.title || !issueForm.description) return showToast('Title and description required', 'error');
    setLoad('submitIssue', true);
    try {
      const res = await apiFetch('/employee-portal/issues', { method: 'POST', body: JSON.stringify(issueForm) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to report issue');
      showToast('Issue reported successfully');
      setIssueForm({ title: '', description: '', priority: 'Normal' });
      load('issues', '/employee-portal/my-issues', setIssues);
      nav('ISSUES');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoad('submitIssue', false); }
  };

  /* ─── change password ─── */
  const changePassword = async (e) => {
    e.preventDefault();
    if (pwLoading) return;
    if (!pwForm.current_password) return showToast('Current password is required', 'error');
    if (!pwForm.new_password)     return showToast('New password is required', 'error');
    if (pwForm.new_password.length < 8) return showToast('New password must be at least 8 characters', 'error');
    if (pwForm.new_password !== pwForm.confirm_password) return showToast('New passwords do not match', 'error');
    setPwLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', { method: 'PUT', body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to change password');
      showToast('Password changed successfully. Please log in again.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(onLogout, 2000);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setPwLoading(false); }
  };

  /* ─── stats ─── */
  const stats = {
    items: myItems.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    issued: requests.filter(r => r.status === 'Issued').length,
    total: requests.length,
    issues: issues.filter(i => i.status === 'Open').length,
    pendingReturns: requests.filter(r => r.status === 'Issued').length, // Issued but not yet returned
    returned: requests.filter(r => r.status === 'Returned').length,
    unreadNotifs: notifications.filter(n => !n.is_read).length,
  };

  const issuedRequests = requests.filter(r => r.status === 'Issued');

  /* ─── shared input style ─── */
  const inp = { className: 'form-input', style: { width: '100%' } };
  const sel = { className: 'form-select', style: { width: '100%' } };

  /* ─── page content ─── */
  const renderPage = () => {
    switch (page) {

      /* ── Dashboard ── */
      case 'DASHBOARD': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Welcome */}
          <div style={{ background: 'linear-gradient(120deg,#4f46e5,#7c3aed)', borderRadius: 12, padding: '20px 22px', color: '#fff', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <UserAvatar user={currentUser} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: .75, marginBottom: 3 }}>Employee Portal</div>
              <div style={{ fontSize: 'clamp(1rem,2.5vw,1.3rem)', fontWeight: 800, lineHeight: 1.2 }}>Welcome, {currentUser?.full_name?.split(' ')[0] || 'Employee'}</div>
              <div style={{ fontSize: '0.75rem', opacity: .8, marginTop: 3 }}>{currentUser?.role} — {fmtFull(new Date())}</div>
            </div>
            <button onClick={loadAll} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 7, color: '#fff', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
            <StatCard label="Assigned Items" value={stats.items} icon={Package} color="#4f46e5" onClick={() => nav('MY_ITEMS')} />
            <StatCard label="Pending Requests" value={stats.pending} icon={Clock} color="#f59e0b" onClick={() => nav('MY_REQUESTS')} />
            <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="#10b981" onClick={() => nav('MY_REQUESTS')} />
            <StatCard label="Issued to Me" value={stats.issued} icon={Inbox} color="#3b82f6" onClick={() => nav('MY_ITEMS')} />
            <StatCard label="Open Issues" value={stats.issues} icon={AlertTriangle} color="#ef4444" onClick={() => nav('ISSUES')} />
          </div>

          {/* Recent requests */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>Recent Requests</span>
              <button onClick={() => nav('MY_REQUESTS')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ChevronRight size={12} />
              </button>
            </div>
            {requests.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No requests yet. <button onClick={() => nav('REQUEST')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Make your first request →</button>
              </div>
            ) : requests.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--bg-border)' }}>
                <Package size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.material_name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.request_code} · {fmt(r.created_at)}</div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.quantity} {r.unit_of_measure || ''}</span>
                  {statusBadge(r.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      /* ── My Items ── */
      case 'MY_ITEMS': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="My Assigned Items" subtitle="Materials currently issued to you" icon={Package} onRefresh={() => load('items', '/employee-portal/my-items', setMyItems)} loading={loading.items} />
          {loading.items ? <Loader /> : myItems.length === 0 ? (
            <Empty msg="No items assigned to you yet." />
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                  <colgroup>
                    <col style={{ width: '28%' }} /><col style={{ width: '16%' }} /><col style={{ width: '12%' }} /><col style={{ width: '14%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-muted)' }}>
                      {['Material', 'Code', 'Qty', 'Issued On', 'Purpose', 'Status'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '2px solid var(--bg-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                        <td style={{ padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.material_name}</td>
                        <td style={{ padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--primary)' }}>{item.material_code}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#10b981' }}>{item.quantity} {item.unit_of_measure || ''}</td>
                        <td style={{ padding: '7px 10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(item.issued_at || item.created_at)}</td>
                        <td style={{ padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{item.purpose || '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{statusBadge(item.status || 'Issued')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );

      /* ── Request Material ── */
      case 'REQUEST': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Request Material" subtitle="Submit a material request for manager approval" icon={Plus} />
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '18px 20px' }}>
            <form onSubmit={submitRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Material *</label>
                  <select {...sel} required value={reqForm.material_id} onChange={e => setReqForm(p => ({ ...p, material_id: e.target.value }))}>
                    <option value="">— Select Material —</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.material_code}) — Stock: {m.current_stock}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" min="1" required {...inp} placeholder="1"
                    value={reqForm.quantity} onChange={e => setReqForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select {...sel} value={reqForm.priority} onChange={e => setReqForm(p => ({ ...p, priority: e.target.value }))}>
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Required By</label>
                  <input type="date" {...inp}
                    min={new Date().toISOString().split('T')[0]}
                    value={reqForm.required_date} onChange={e => setReqForm(p => ({ ...p, required_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Purpose *</label>
                <input type="text" required {...inp} placeholder="Describe why you need this material…"
                  value={reqForm.purpose} onChange={e => setReqForm(p => ({ ...p, purpose: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Remarks</label>
                <textarea className="form-textarea" rows={3} placeholder="Any additional notes…"
                  value={reqForm.remarks} onChange={e => setReqForm(p => ({ ...p, remarks: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => nav('MY_REQUESTS')}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading.submitReq}>
                  <Send size={14} /> {loading.submitReq ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>

          {/* Workflow info */}
          <div style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.18)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Request Workflow:</strong> Your request will be reviewed by a Manager or Administrator.
              Once approved, a Storekeeper will issue the materials to you. You can track the status in <strong>My Requests</strong>.
            </div>
          </div>
        </div>
      );

      /* ── My Requests ── */
      case 'MY_REQUESTS': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="My Requests" subtitle="Track all your material requests" icon={ClipboardList} onRefresh={() => load('requests', '/employee-portal/my-requests', setRequests)} loading={loading.requests}>
            <button className="btn btn-primary btn-sm" onClick={() => nav('REQUEST')}>
              <Plus size={13} /> New Request
            </button>
          </SectionHeader>
          {loading.requests ? <Loader /> : requests.length === 0 ? (
            <Empty msg="No requests yet.">
              <button className="btn btn-primary btn-sm" onClick={() => nav('REQUEST')}><Plus size={13} /> Make Request</button>
            </Empty>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                  <colgroup>
                    <col style={{ width: '13%' }} /><col style={{ width: '20%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '15%' }} /><col style={{ width: '12%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-muted)' }}>
                      {['Code', 'Material', 'Qty', 'Priority', 'Requested', 'Req. By', 'Purpose', 'Status'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '2px solid var(--bg-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.request_code}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.material_name}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#10b981' }}>{r.quantity}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: r.priority === 'Urgent' ? 'rgba(239,68,68,.1)' : r.priority === 'High' ? 'rgba(245,158,11,.1)' : 'rgba(100,116,139,.1)', color: r.priority === 'Urgent' ? '#dc2626' : r.priority === 'High' ? '#d97706' : '#475569' }}>{r.priority || 'Normal'}</span>
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                        <td style={{ padding: '7px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.required_date ? fmt(r.required_date) : '—'}</td>
                        <td style={{ padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.72rem' }} title={r.purpose}>{r.purpose || '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{statusBadge(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );

      /* ── Returns ── */
      case 'RETURNS': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Return Material" subtitle="Return issued materials back to the store" icon={RotateCcw} />
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '18px 20px', marginBottom: 10 }}>
            {issuedRequests.length === 0 ? (
              <Empty msg="You have no issued items to return currently." />
            ) : (
              <form onSubmit={submitReturn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Select Issued Request *</label>
                    <select {...sel} required value={retForm.request_id} onChange={e => setRetForm(p => ({ ...p, request_id: e.target.value }))}>
                      <option value="">— Select —</option>
                      {issuedRequests.map(r => (
                        <option key={r.id} value={r.id}>{r.material_name} — {r.quantity} {r.unit_of_measure || ''} ({r.request_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Return Quantity *</label>
                    <input type="number" min="1" required {...inp} placeholder="1"
                      value={retForm.quantity} onChange={e => setRetForm(p => ({ ...p, quantity: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Return Remarks</label>
                  <textarea className="form-textarea" rows={3} placeholder="Reason for return or condition notes…"
                    value={retForm.remarks} onChange={e => setRetForm(p => ({ ...p, remarks: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading.submitRet}>
                    <RotateCcw size={14} /> {loading.submitRet ? 'Submitting…' : 'Submit Return'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--bg-border)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>
              Returned Items
            </div>
            {requests.filter(r => r.status === 'Returned').length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>No returned items.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-muted)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Code</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Material</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Returned On</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.filter(r => r.status === 'Returned').map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)' }}>{r.request_code}</td>
                      <td style={{ padding: '7px 10px' }}>{r.material_name}</td>
                      <td style={{ padding: '7px 10px' }}>{fmt(r.updated_at)}</td>
                      <td style={{ padding: '7px 10px' }}>{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      );

      /* ── Report Issue ── */
      case 'REPORT': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Report an Issue" subtitle="Report a problem with materials or the system" icon={AlertCircle} />
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '18px 20px' }}>
            <form onSubmit={submitIssue} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Issue Title *</label>
                  <input type="text" required {...inp} placeholder="Brief description of the issue…"
                    value={issueForm.title} onChange={e => setIssueForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select {...sel} value={issueForm.priority} onChange={e => setIssueForm(p => ({ ...p, priority: e.target.value }))}>
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Full Description *</label>
                <textarea className="form-textarea" rows={5} required
                  placeholder="Describe the issue in detail — what happened, when, and what impact it has…"
                  value={issueForm.description} onChange={e => setIssueForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => nav('ISSUES')}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={loading.submitIssue}>
                  <AlertCircle size={14} /> {loading.submitIssue ? 'Reporting…' : 'Report Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );

      /* ── My Issues ── */
      case 'ISSUES': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="My Issues" subtitle="Issues you have reported" icon={AlertTriangle} onRefresh={() => load('issues', '/employee-portal/my-issues', setIssues)} loading={loading.issues}>
            <button className="btn btn-danger btn-sm" onClick={() => nav('REPORT')}>
              <Plus size={13} /> Report Issue
            </button>
          </SectionHeader>
          {loading.issues ? <Loader /> : issues.length === 0 ? (
            <Empty msg="No issues reported.">
              <button className="btn btn-secondary btn-sm" onClick={() => nav('REPORT')}><AlertCircle size={13} /> Report an Issue</button>
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {issues.map(iss => (
                <div key={iss.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 9, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: iss.status === 'Open' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)', color: iss.status === 'Open' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>{iss.title}</span>
                      {statusBadge(iss.status || 'Open')}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtFull(iss.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{iss.description}</p>
                    {iss.resolution && (
                      <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.18)', fontSize: '0.72rem', color: '#059669' }}>
                        <strong>Resolution:</strong> {iss.resolution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      /* ── History ── */
      case 'HISTORY': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="My History" subtitle="Full record of your material transactions" icon={History} onRefresh={() => load('history', '/employee-portal/history', setHistory)} loading={loading.history} />
          {loading.history ? <Loader /> : history.length === 0 ? (
            <Empty msg="No transaction history yet." />
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                  <colgroup>
                    <col style={{ width: '13%' }} /><col style={{ width: '12%' }} /><col style={{ width: '22%' }} /><col style={{ width: '10%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-muted)' }}>
                      {['Code', 'Type', 'Material', 'Qty', 'Purpose', 'Date', 'Status'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '2px solid var(--bg-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)', background: h.transaction_type === 'STOCK_OUT' ? 'rgba(99,102,241,.03)' : h.transaction_type === 'RETURN' ? 'rgba(16,185,129,.03)' : 'transparent' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.transaction_code}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: h.transaction_type === 'RETURN' ? 'rgba(16,185,129,.1)' : 'rgba(99,102,241,.1)', color: h.transaction_type === 'RETURN' ? '#059669' : '#4f46e5' }}>{h.transaction_type}</span>
                        </td>
                        <td style={{ padding: '7px 10px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.material_name}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#10b981' }}>{h.quantity}</td>
                        <td style={{ padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.72rem' }} title={h.purpose}>{h.purpose || '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(h.transaction_date || h.created_at)}</td>
                        <td style={{ padding: '7px 10px' }}>{statusBadge(h.status || 'Completed')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );

      /* ── Profile ── */
      case 'PROFILE': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 960 }}>
          <SectionHeader title="My Profile" subtitle="Your personal account information and credentials" icon={User} />

          {/* Hero Profile Card */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            
            {/* Banner with gradient & avatar */}
            <div style={{ 
              background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #7c3aed 100%)', 
              padding: '28px 24px', 
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: 20 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 260 }}>
                <div style={{ 
                  borderRadius: '50%', 
                  padding: 3, 
                  background: 'rgba(255,255,255,0.25)', 
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)' 
                }}>
                  <UserAvatar user={currentUser} size={70} style={{ border: '3px solid #fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                    {currentUser?.full_name || currentUser?.username}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ 
                      padding: '3px 10px', 
                      borderRadius: 999, 
                      background: 'rgba(255,255,255,0.2)', 
                      backdropFilter: 'blur(6px)', 
                      fontSize: '0.72rem', 
                      fontWeight: 700, 
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Shield size={12} /> {currentUser?.role || 'Staff'}
                    </span>
                    <span style={{ 
                      padding: '3px 9px', 
                      borderRadius: 999, 
                      background: 'rgba(16, 185, 129, 0.25)', 
                      color: '#6ee7b7', 
                      fontSize: '0.72rem', 
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }}></span>
                      Active
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Mail size={13} /> {currentUser?.email || 'No email associated'}
                  </div>
                </div>
              </div>

              {/* Quick Actions in Banner */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => nav('SETTINGS')} className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', gap: 6, fontWeight: 600 }}>
                  <Settings size={14} /> Settings
                </button>
                <button onClick={onLogout} className="btn btn-sm" style={{ background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', gap: 6, fontWeight: 600 }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>

            {/* Account Details Tiles */}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {[
                { label: 'Username', value: `@${currentUser?.username || '—'}`, icon: AtSign, color: '#3b82f6' },
                { label: 'Full Legal Name', value: currentUser?.full_name || '—', icon: User, color: '#6366f1' },
                { label: 'Email Address', value: currentUser?.email || 'Not configured', icon: Mail, color: '#ec4899' },
                { label: 'Assigned Role', value: currentUser?.role || 'Staff', icon: Shield, color: '#8b5cf6' },
                { label: 'Phone Contact', value: currentUser?.phone || 'Not provided', icon: Phone, color: '#10b981' },
                { label: 'Department', value: currentUser?.department_name || 'General Operations', icon: Building, color: '#f59e0b' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ 
                  background: 'var(--bg-surface-muted, rgba(241,245,249,0.5))', 
                  border: '1px solid var(--bg-border)', 
                  borderRadius: 12, 
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{ 
                    width: 38, 
                    height: 38, 
                    borderRadius: 10, 
                    background: `${color}15`, 
                    color: color, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0 
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value)}>
                      {value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Notice */}
            <div style={{ 
              padding: '14px 24px', 
              background: 'var(--bg-page, rgba(0,0,0,0.02))', 
              borderTop: '1px solid var(--bg-border)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: 10 
            }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} /> To update personal details or department assignments, please contact your store administrator.
              </span>
              <button onClick={() => nav('SETTINGS')} className="btn btn-secondary btn-sm" style={{ gap: 6, fontSize: '0.75rem' }}>
                <Lock size={13} /> Change Password
              </button>
            </div>
          </div>
        </div>
      );

      /* ── Notifications ── */
      case 'NOTIFICATIONS': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Notifications" subtitle="Your recent alerts and updates" icon={Bell} onRefresh={() => load('notifs', '/employee-portal/notifications', setNotifs)} loading={loading.notifs} />
          {loading.notifs ? <Loader /> : notifications.length === 0 ? (
            <Empty msg="No notifications yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notifications.map(n => (
                <div key={n.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${n.is_read ? 'var(--bg-border)' : 'rgba(99,102,241,.3)'}`, borderRadius: 9, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', opacity: n.is_read ? 0.75 : 1 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: n.type === 'error' ? 'rgba(239,68,68,.1)' : n.type === 'success' ? 'rgba(16,185,129,.1)' : n.is_read ? 'var(--bg-surface-muted)' : 'rgba(99,102,241,.1)', color: n.type === 'error' ? '#ef4444' : n.type === 'success' ? '#10b981' : n.is_read ? 'var(--text-muted)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bell size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: n.is_read ? 600 : 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>{n.title || n.message}</span>
                      {!n.is_read && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,.12)', color: 'var(--primary)' }}>New</span>}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtFull(n.created_at)}</span>
                    </div>
                    {n.message && n.title && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{n.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      /* ── Settings ── */
      case 'SETTINGS': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionHeader title="Settings" subtitle="Manage your account preferences" icon={Settings} />

          {/* Change Password */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={15} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>Change Password</span>
            </div>
            <form onSubmit={changePassword} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'current', label: 'Current Password', field: 'current_password' },
                { key: 'new',     label: 'New Password',     field: 'new_password' },
                { key: 'confirm', label: 'Confirm New Password', field: 'confirm_password' },
              ].map(({ key, label, field }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      className="form-input"
                      style={{ width: '100%', paddingRight: 38 }}
                      placeholder={label}
                      value={pwForm[field]}
                      onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                      required
                      autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                      tabIndex={-1}
                    >
                      {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                  <Lock size={14} /> {pwLoading ? 'Changing…' : 'Change Password'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Password must be at least 8 characters. You will be logged out after a successful change.
              </p>
            </form>
          </div>

          {/* Theme */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted-strong)' }}>Dark Mode</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Toggle between light and dark interface</div>
            </div>
            <button
              onClick={() => setDarkMode(d => !d)}
              style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid var(--bg-border)', background: darkMode ? '#4f46e5' : 'var(--bg-surface-muted)', color: darkMode ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', transition: 'all .2s ease' }}
            >
              {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>
      );

      default: return <Empty msg="Page not found." />;
    }
  };

  /* ─── layout ─── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', position: 'relative' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Mobile overlay ── */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1199, backdropFilter: 'blur(2px)' }} />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 200,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-border)',
        boxShadow: '2px 0 12px rgba(15,23,42,.05)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.26s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      }}>
        {/* brand */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={16} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Employee Portal</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.full_name}</div>
          </div>
        </div>

        {/* nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 10px' }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button key={item.id} onClick={() => nav(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? '#fff' : 'var(--text-primary)',
                fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                textAlign: 'left', transition: 'background .14s ease',
                marginBottom: 1,
              }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg-surface-muted)')}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}>
                <Icon size={15} style={{ flexShrink: 0 }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* logout */}
        <div style={{ padding: '8px 6px', borderTop: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <button onClick={onLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', border: 'none', borderRadius: 7, cursor: 'pointer', background: 'transparent', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, textAlign: 'left', transition: 'background .14s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, marginLeft: sidebarOpen ? 200 : 0, display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'margin-left .26s ease' }}>
        {/* topbar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 100, height: 44, background: 'var(--bg-surface)', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: '1px solid var(--bg-border)', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0 }}>
            <Menu size={15} />
          </button>
          <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {NAV.find(n => n.id === page)?.label || 'Employee Portal'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={() => nav('NOTIFICATIONS')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', position: 'relative', padding: 4 }}>
              <Bell size={16} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              )}
            </button>
            <UserAvatar user={currentUser} size={28} style={{ cursor: 'pointer' }} onClick={() => nav('PROFILE')} />
          </div>
        </header>

        {/* page */}
        <main style={{ flex: 1, padding: 'clamp(12px,2vw,20px)', minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

/* ─── Small reusable sub-components ─── */
function SectionHeader({ title, subtitle, icon: Icon, onRefresh, loading, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted-strong)' }}>{title}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {children}
        {onRefresh && (
          <button onClick={onRefresh} className="btn btn-secondary btn-sm" style={{ padding: '5px 8px' }} disabled={loading}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.75s linear infinite' : 'none' }} />
          </button>
        )}
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--text-muted)', gap: 10, fontSize: '0.8rem' }}>
      <RefreshCw size={16} style={{ animation: 'spin 0.75s linear infinite', color: 'var(--primary)' }} />
      Loading…
    </div>
  );
}

function Empty({ msg, children }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)', borderRadius: 10, padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Inbox size={20} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{msg}</p>
      {children}
    </div>
  );
}
