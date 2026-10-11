import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, UserPlus, FileText, Edit2, Trash2, KeyRound, Camera,
  CheckCircle2, XCircle, Search, Filter, Lock, Mail, User, Info, Key
} from 'lucide-react';
import UserAvatar from './UserAvatar';
import apiFetch from '../utils/apiFetch';
import { API_BASE } from '../utils/apiFetch';
import { sanitizeText } from '../utils/displayValue';

const ALL_ROLES = [
  'Director',
  'Administrator',
  'Manager',
  'Storekeeper',
  'Employee',
];

const ROLE_BADGE = {
  Director: 'badge-danger',
  Administrator: 'badge-danger',
  Manager: 'badge-warning',
  Storekeeper: 'badge-success',
  Employee: 'badge-info',
};

function StatusBadge({ status }) {
  const s = status || 'Active';
  if (s === 'Active') return <span className="badge badge-success"><CheckCircle2 size={11} /> Active</span>;
  if (s === 'Locked') return <span className="badge badge-warning"><Lock size={11} /> Locked</span>;
  return <span className="badge badge-danger"><XCircle size={11} /> Inactive</span>;
}

export default function UserAndAuditManager({ users = [], auditLogs = [], currentUser, onAddUser, onRefresh, readOnly = false }) {
  // Use props passed from App.jsx instead of trying to destruct incorrectly from DataContext
  const [activeTab, setActiveTab] = useState('USERS');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const editAvatarInputRef = useRef(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginHistoryUser, setLoginHistoryUser] = useState(null);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [toast, setToast] = useState(null);

  // User Email Messaging State
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailRecipient, setMailRecipient] = useState(null);
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  const [formData, setFormData] = useState({
    username: '', password: '', confirm_password: '', full_name: '', email: '', phone_contact: '', department: '', role: 'Storekeeper', avatar_url: ''
  });
  const [editData, setEditData] = useState({
    full_name: '', email: '', phone_contact: '', department: '', role: 'Storekeeper', status: 'Active'
  });
  const createAvatarInputRef = useRef(null);

  // Role-based capability checks
  const isDirector = (currentUser?.role === 'Director') && !readOnly;
  const isAdmin = (currentUser?.role === 'Administrator' || isDirector) && !readOnly;
  const isManager = currentUser?.role === 'Manager' && !readOnly;
  const canManageUsers = isDirector || isAdmin || isManager;

  // Roles allowed for each user management level
  // Director: Can manage ALL roles
  // Admin: Can manage most roles (cannot promote to Director)
  // Manager: Can manage limited roles only
  const managementRoles = isDirector
    ? ['Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee']
    : isAdmin
      ? ['Administrator', 'Manager', 'Storekeeper', 'Employee']
      : ['Manager', 'Storekeeper', 'Employee'];

  // Roles a Manager is allowed to assign
  const managerAllowedRoles = ['Manager', 'Storekeeper', 'Employee'];

  // Can edit user profile/role info
  const canEditUser = (u) => {
    // Director can edit anyone except themselves
    if (isDirector && u.id !== currentUser?.id) return true;
    // Admin can edit anyone except Directors and themselves
    if (isAdmin && u.id !== currentUser?.id && u.role !== 'Director') return true;
    // Manager can edit limited roles only
    if (isManager && u.role !== 'Administrator' && u.role !== 'Director' && u.id !== currentUser?.id) return true;
    return false;
  };

  // Roles selectable in add/edit forms — Based on user's management level
  const selectableRoles = isDirector
    ? ALL_ROLES
    : isAdmin
      ? ALL_ROLES.filter(r => r !== 'Director')
      : managerAllowedRoles;

  // Auditors see only users tab
  useEffect(() => { if (readOnly) setActiveTab('USERS'); }, [readOnly]);

  const showToast = (msg, type = 'success') => {
    const safeMsg = typeof msg === 'string' ? msg : (msg?.message || msg?.error || 'An error occurred');
    setToast({ msg: safeMsg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── CREATE ── */
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      showToast('Passwords do not match', 'error');
      return;
    }
    const trimmedUsername = formData.username?.trim ? formData.username.trim() : formData.username;
    const { confirm_password: _confirmPassword, ...rest } = formData;
    const trimmedData = { ...rest, username: trimmedUsername };
    const error = await onAddUser(trimmedData);
    if (error) {
      showToast(error, 'error');
      return;
    }
    // ✅ USER CREATED SUCCESSFULLY
    // Show success message, then close modal, then refresh list (onAddUser already called fetchData)
    showToast(`User "${trimmedUsername}" created successfully`);

    // Reset form state
    setFormData({ username: '', password: '', confirm_password: '', full_name: '', email: '', phone_contact: '', department: '', role: 'Storekeeper', avatar_url: '' });

    // Close modal after brief delay so user sees the success message
    setTimeout(() => {
      setShowAddModal(false);
    }, 1000);
  };

  /* ── EDIT ── */
  const openEdit = (u) => {
    if (String(u.id) === String(currentUser?.id)) {
      showToast('Use Edit Profile to update your own account.', 'error');
      return;
    }
    setSelectedUser(u);
    setEditData({ full_name: u.full_name, email: u.email, phone_contact: u.phone_contact || '', department: u.department || '', role: u.role, status: u.status || 'Active' });
    setEditAvatarUrl(u.avatar_url || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editData, avatar_url: editAvatarUrl || null })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowEditModal(false);
      onRefresh?.();
      showToast('User updated successfully');
    } catch (err) { showToast(err.message || 'Failed to update user', 'error'); }
  };

  /* ── PASSWORD RESET ── */
  const openPasswordReset = (u) => { setSelectedUser(u); setNewPassword(''); setShowPwdModal(true); };

  /* ── EMAIL MESSAGING ── */
  const openSendEmail = (u) => {
    setMailRecipient(u);
    setMailSubject('');
    setMailMessage('');
    setShowMailModal(true);
  };

  const handleDispatchUserEmail = async (e) => {
    e.preventDefault();
    if (!mailRecipient || !mailRecipient.email) {
      showToast('Recipient does not have a valid email configured.', 'error');
      return;
    }
    setSendingMail(true);
    try {
      const res = await apiFetch('/users/send-email', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: mailRecipient.id,
          subject: mailSubject,
          message: mailMessage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed sending email message');
      setShowMailModal(false);
      showToast(data.message || `Email sent to ${mailRecipient.full_name || mailRecipient.username}`);
    } catch (err) {
      showToast(err.message || 'Failed sending email', 'error');
    } finally {
      setSendingMail(false);
    }
  };

  /* ── LOGIN HISTORY ── */
  const openLoginHistory = async (u) => {
    setLoginHistoryUser(u);
    setLoginHistory([]);
    setShowLoginHistory(true);
    try {
      const res = await apiFetch(`/users/${u.id}/login-history`);
      if (res.ok) { const data = await res.json(); setLoginHistory(data); }
    } catch { /* silent */ }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/users/${selectedUser.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowPwdModal(false);
      showToast(`Password reset for ${selectedUser.username}`);
    } catch (err) { showToast(err.message || 'Failed to reset password', 'error'); }
  };

  /* ── STATUS CHANGE (Lock / Unlock / Activate / Deactivate) ── */
  const handleSetStatus = async (u, newStatus) => {
    try {
      const res = await apiFetch(`/users/${u.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onRefresh?.();
      const labels = { Active: 'activated', Inactive: 'deactivated', Locked: 'locked' };
      showToast(`User "${u.username}" ${labels[newStatus] || newStatus}`);
    } catch (err) { showToast(err.message || 'Failed to update status', 'error'); }
  };

  /* ── DELETE ── */
  const openDelete = (u) => { setSelectedUser(u); setShowDelConfirm(true); };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/users/${selectedUser.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowDelConfirm(false);
      onRefresh?.();
      showToast(`User "${selectedUser.username}" deleted`);
    } catch (err) { showToast(err.message || 'Failed to delete user', 'error'); }
  };

  /* ── AUDIT filtering ── */
  const uniqueActions = ['ALL', ...new Set(auditLogs.map(l => l.action_type))];
  const filteredLogs = auditLogs.filter(l => {
    const matchSearch = auditSearch === '' ||
      (l.username || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (l.description || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (l.action_type || '').toLowerCase().includes(auditSearch.toLowerCase());
    const matchAction = auditActionFilter === 'ALL' || l.action_type === auditActionFilter;
    const logDate = l.created_at ? new Date(l.created_at) : null;
    const matchFrom = !auditDateFrom || (logDate && logDate >= new Date(auditDateFrom));
    const matchTo = !auditDateTo || (logDate && logDate <= new Date(auditDateTo + 'T23:59:59'));
    return matchSearch && matchAction && matchFrom && matchTo;
  });

  /* ── USER list filtering ── */
  const filteredUsers = users.filter(u =>
    userSearch === '' ||
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* ── Page header card ── */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>

        {/* Top row: identity + action */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--bg-border)',
        }}>
          {/* Left: icon + title + description */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(51,102,255,0.10)', border: '1px solid rgba(51,102,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={20} color="var(--primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>
                  User Roles &amp; Audits
                </h2>
                {readOnly && (
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 10px',
                    borderRadius: '999px', background: 'rgba(244,161,0,0.12)',
                    color: '#7a5100', border: '1px solid rgba(244,161,0,0.25)',
                    whiteSpace: 'nowrap',
                  }}>Read-only</span>
                )}
                {isManager && (
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 10px',
                    borderRadius: '999px', background: 'rgba(245,158,11,0.10)',
                    color: '#92400e', border: '1px solid rgba(245,158,11,0.25)',
                    whiteSpace: 'nowrap',
                  }}>Manager view</span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Manage user accounts, roles &amp; permissions, and monitor system activity logs
              </p>
            </div>
          </div>

          {/* Right: action button */}
          {canManageUsers && activeTab === 'USERS' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <UserPlus size={15} /> Add System User
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', flexWrap: 'wrap' }}>
          {!readOnly && (
            <button
              className={`btn btn-sm ${activeTab === 'USERS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('USERS')}
            >
              <ShieldCheck size={14} /> System Users ({users.length})
            </button>
          )}
        </div>
      </div>


      {/* ── USERS TAB ── */}
      {activeTab === 'USERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Search + info bar */}
          <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text" className="form-input"
                placeholder="Search by name, username, email, role…"
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                style={{ paddingLeft: '34px' }}
              />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredUsers.length} of {users.length} users</span>
          </div>


          <div className="table-container glass-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>User</th>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Dept</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  {canManageUsers && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No users match your search.</td></tr>
                ) : filteredUsers.map(u => {
                  return (
                    <tr key={u.id}>
                      <td>
                        <UserAvatar user={u} size={32} status={u.status} />
                      </td>
                      <td><span style={{ fontWeight: '700', color: 'var(--text-muted-strong)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{u.username}</span></td>
                      <td style={{ fontWeight: '600' }}>{u.full_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{sanitizeText(u.email, 'Email pending')}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{sanitizeText(u.phone_contact, '—')}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{sanitizeText(u.department, '—')}</td>
                      <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-info'}`}>{u.role}</span></td>
                      <td><StatusBadge status={u.status} /></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      {canManageUsers && (
                        <td>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>

                            {/* Edit */}
                            {canEditUser(u) && (
                              <button className="btn btn-secondary btn-sm" title="Edit user info & role" onClick={() => openEdit(u)}>
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Delete */}
                            {canEditUser(u) && (
                              <button className="btn btn-danger btn-sm" title="Delete user" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }} onClick={() => openDelete(u)}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADD USER MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Add New User</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', padding: 0 }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body" style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* LEFT COLUMN - User Information & Photo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* User Information Header */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Information</h4>

                    {/* Profile Photo Section */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', alignItems: 'flex-start' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', background: 'linear-gradient(135deg, #6366f1, #0ea5e9)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: '800', flexShrink: 0 }}>
                          {formData.avatar_url ? (
                            <img src={(formData.avatar_url && formData.avatar_url.startsWith('/avatars/')) ? API_BASE.replace(/\/api\/?$/i, '') + formData.avatar_url : formData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span>{formData.full_name?.[0]?.toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={createAvatarInputRef}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!file.type.startsWith('image/')) {
                              return showToast('Please select a valid image file', 'error');
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              return showToast('Image must be under 5MB', 'error');
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => setFormData(prev => ({ ...prev, avatar_url: event.target.result }));
                            reader.readAsDataURL(file);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => createAvatarInputRef.current?.click()}
                          style={{
                            position: 'absolute',
                            bottom: '-8px',
                            right: '-8px',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: 'white',
                            border: '2px solid var(--bg-main)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Profile Photo</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload Photo</span>
                        {formData.avatar_url && (
                          <button type="button" className="btn btn-secondary btn-sm" style={{ width: 'fit-content', marginTop: '4px' }} onClick={() => setFormData(prev => ({ ...prev, avatar_url: '' }))}>
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Username & Full Name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Username</label>
                        <input type="text" className="form-input" placeholder="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Full Name</label>
                        <input type="text" className="form-input" placeholder="John Smith" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
                      </div>
                    </div>

                    {/* Email & Phone */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Email Address</label>
                        <input type="email" className="form-input" placeholder="user@store.org" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Phone Contact</label>
                        <input type="text" className="form-input" placeholder="+251-911-000000" value={formData.phone_contact} onChange={e => setFormData({ ...formData, phone_contact: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Department</label>
                        <input type="text" className="form-input" placeholder="e.g. Sales, HR" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Login Security */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login Security</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Password</label>
                        <input type="password" className="form-input" placeholder="••••••••" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Confirm Password</label>
                        <input type="password" className="form-input" placeholder="••••••••" value={formData.confirm_password} onChange={e => setFormData({ ...formData, confirm_password: e.target.value })} required />
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN - Role & Access, Organisation, Account Status, Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Role & Access */}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role & Access</h4>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Role</label>
                      <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                        {selectableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {formData.role === 'Employee' && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Employee accounts have basic operational access only.
                      </div>
                    )}
                  </div>

                  {/* Account Status */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Status</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)' }}>
                      <input
                        type="checkbox"
                        checked={formData.status === 'Active'}
                        onChange={e => setFormData({ ...formData, status: e.target.checked ? 'Active' : 'Inactive' })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <label style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', margin: 0, flex: 1 }}>Active</label>
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</h4>
                    <textarea
                      className="form-input"
                      placeholder="Additional Notes (Internal use only)"
                      value={formData.notes || ''}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><UserPlus size={14} /> Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── USER MODALS ── */}
      <>
        {showEditModal && selectedUser && (
          <div className="modal-overlay" style={{ zIndex: 1400 }}>
            <div className="modal-content user-edit-modal">

              {/* HEADER */}
              <div className="user-edit-header">
                <div className="user-edit-title-wrap">
                  <div className="user-edit-title-icon"><User size={22} /></div>
                  <div>
                    <h2>Edit User</h2>
                    <p>Update user information and permissions.</p>
                  </div>
                </div>
                <button className="user-edit-close" aria-label="Close edit user" onClick={() => setShowEditModal(false)}>×</button>
              </div>

              {/* CONTENT */}
              <form onSubmit={handleEditSubmit}>
                <div className="user-edit-body">
                  <aside className="user-edit-profile">
                    <div className="user-edit-avatar-wrap">
                      <div className="user-edit-avatar">
                        {editAvatarUrl ? (
                          <img src={editAvatarUrl.startsWith('/avatars/') ? API_BASE.replace(/\/api\/?$/i, '') + editAvatarUrl : editAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          selectedUser.username?.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <button type="button" className="user-edit-avatar-action" aria-label="Change photo" onClick={() => editAvatarInputRef.current?.click()}><Camera size={14} /></button>
                    </div>
                    <h3>{selectedUser.username}</h3>
                    <span className="user-edit-username-badge">Username</span>
                    <div className="user-edit-photo-actions">
                      <button type="button" onClick={() => editAvatarInputRef.current?.click()}><Camera size={14} /> Change Photo</button>
                      {editAvatarUrl && <button type="button" className="danger" onClick={() => setEditAvatarUrl(null)}><Trash2 size={14} /> Remove Photo</button>}
                    </div>
                    <div className="user-edit-tips">
                      <Info size={18} />
                      <div><strong>User Tips</strong><p>Changes you make here will be reflected in the user's profile.</p></div>
                    </div>
                    <input type="file" ref={editAvatarInputRef} accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) return showToast('Please select a valid image file', 'error');
                      if (file.size > 5 * 1024 * 1024) return showToast('Image must be under 5MB', 'error');
                      const reader = new FileReader();
                      reader.onload = (event) => setEditAvatarUrl(event.target.result);
                      reader.readAsDataURL(file);
                    }} />
                  </aside>

                  <div className="user-edit-fields">
                    <div className="user-edit-field-row">
                      <div className="user-edit-field">
                        <label>Username</label>
                        <div className="user-edit-readonly">{selectedUser.username}</div>
                      </div>
                      <div className="user-edit-field">
                        <label>Full Name</label>
                        <input type="text" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} required />
                      </div>
                    </div>

                    <div className="user-edit-field-row">
                      <div className="user-edit-field">
                        <label>Email</label>
                        <input type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                      </div>
                      <div className="user-edit-field">
                        <label>Phone Contact</label>
                        <input type="text" value={editData.phone_contact} onChange={e => setEditData({ ...editData, phone_contact: e.target.value })} placeholder="+251-911-000000" />
                      </div>
                    </div>

                    <div className="user-edit-field-row">
                      <div className="user-edit-field">
                        <label>Department</label>
                        <input type="text" value={editData.department} onChange={e => setEditData({ ...editData, department: e.target.value })} placeholder="e.g. Sales, HR" />
                      </div>
                      <div className="user-edit-field">
                        <label>Role</label>
                        <select value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                          {selectableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="user-edit-field-row">
                      <div className="user-edit-field">
                        <label>Status</label>
                        <select value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Locked">Locked</option>
                        </select>
                      </div>
                      {/* Empty field for grid alignment */}
                      <div className="user-edit-field"></div>
                    </div>

                    {/* Action Icons */}
                    <div className="user-edit-actions">
                      <button type="button" title="Send Email" style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '5px', padding: '10px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }} onClick={() => openSendEmail(selectedUser)}>
                        <Mail size={14} />
                        <span>Email</span>
                      </button>
                      <button type="button" title="Reset Password" style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '5px', padding: '10px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }} onClick={() => openPasswordReset(selectedUser)}>
                        <Key size={14} />
                        <span>Password</span>
                      </button>
                      <button type="button" title={editData.status === 'Locked' ? 'Unlock User' : 'Lock User'} style={{ flex: 1, background: editData.status === 'Locked' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)', border: editData.status === 'Locked' ? '1px solid #ef4444' : '1px solid var(--bg-border)', borderRadius: '5px', padding: '10px 8px', cursor: 'pointer', color: editData.status === 'Locked' ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }} onClick={() => {
                        const nextStatus = editData.status === 'Locked' ? 'Active' : 'Locked';
                        setEditData({ ...editData, status: nextStatus });
                        handleSetStatus(selectedUser, nextStatus);
                      }}>
                        <Lock size={14} />
                        <span>Lock</span>
                      </button>
                      <button type="button" title="View login history" style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '5px', padding: '10px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }} onClick={() => openLoginHistory(selectedUser)}>
                        <FileText size={14} />
                        <span>History</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="user-edit-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><CheckCircle2 size={15} /> Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPwdModal && selectedUser && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Reset Password — {selectedUser.username}</h3>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowPwdModal(false)}>×</button>
              </div>
              <form onSubmit={handlePasswordReset}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '12px', color: '#f59e0b' }}>
                    You are resetting the password for <strong>{selectedUser.full_name}</strong> ({selectedUser.role}).
                    The user will need to log in with the new password.
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password" className="form-input"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPwdModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><KeyRound size={14} /> Reset Password</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>

      {/* ── DELETE CONFIRM ── */}
      {showDelConfirm && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete User Account</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowDelConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Are you sure you want to permanently delete <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedUser.full_name}</strong> ({selectedUser.username})?
              </p>
              <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>
                This action cannot be undone. Consider deactivating or locking the account instead.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGIN HISTORY MODAL ── */}
      {showLoginHistory && loginHistoryUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>
                Login History — {loginHistoryUser.username}
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowLoginHistory(false)}>×</button>
            </div>
            <div className="modal-body">
              {loginHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No login history available.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Action</th><th>Description</th><th>IP Address</th><th>Timestamp</th></tr>
                    </thead>
                    <tbody>
                      {loginHistory.map(log => (
                        <tr key={log.id}>
                          <td><span className="badge badge-info">{log.action_type}</span></td>
                          <td style={{ fontSize: '13px' }}>{log.description}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLoginHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SEND EMAIL MESSAGE MODAL */}
      {showMailModal && mailRecipient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} color="#6366f1" /> Send Email Message to {mailRecipient.full_name || mailRecipient.username}
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }} onClick={() => setShowMailModal(false)}>×</button>
            </div>
            <form onSubmit={handleDispatchUserEmail}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'var(--bg-surface-muted)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>To:</strong> {mailRecipient.full_name} ({mailRecipient.email})</span>
                  <span><strong>Role:</strong> {mailRecipient.role}</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    className="form-input"
                    value={mailSubject}
                    onChange={e => setMailSubject(e.target.value)}
                    placeholder="Enter email message subject..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message Body</label>
                  <textarea
                    className="form-textarea"
                    rows={5}
                    value={mailMessage}
                    onChange={e => setMailMessage(e.target.value)}
                    placeholder="Type your message to this user..."
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMailModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sendingMail}>
                  {sendingMail ? 'Dispatching Email…' : '✉️ Send Email Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
