import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Crown,
  FileText,
  KeyRound,
  Lock,
  Settings,
  Shield,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import '../styles/GrandDirectorPanelPremium.css';

const tabs = [
  { id: 'overview', label: 'Overview', icon: Crown },
  { id: 'permissions', label: 'Permissions', icon: Lock },
  { id: 'hierarchy', label: 'Role hierarchy', icon: Users },
  { id: 'audit', label: 'Audit activity', icon: Activity },
];

const formatDate = (date) => date
  ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : 'Recently';

export default function GrandDirectorPanel({ currentUser, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [info, setInfo] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [hierarchy, setHierarchy] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadPanel = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        apiFetch('/director/info'),
        apiFetch('/director/permissions'),
        apiFetch('/director/role-hierarchy'),
        apiFetch('/director/audit-logs?limit=20&page=1'),
      ]);
      const [infoResponse, permissionResponse, hierarchyResponse, auditResponse] = responses;
      if (!infoResponse.ok) throw new Error('Unable to load administration statistics');
      const [infoData, permissionData, hierarchyData, auditData] = await Promise.all(
        responses.map((response) => response.json())
      );
      setInfo(infoData);
      setPermissions(permissionResponse.ok ? permissionData : null);
      setHierarchy(hierarchyResponse.ok ? hierarchyData.hierarchy || [] : []);
      setAuditLogs(auditResponse.ok ? auditData.data || [] : []);
    } catch (error) {
      notify(error.message || 'Unable to load the administration panel', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Director' || currentUser?.role === 'Administrator') loadPanel();
  }, [currentUser?.id]);

  const closeModal = () => {
    setModal(null);
    setModalData({});
  };

  const openModal = (type) => {
    setModal(type);
    setModalData({});
  };

  const runAction = async (action) => {
    setWorking(true);
    try {
      let response;
      if (action === 'create-user') {
        response = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({ ...modalData, password: 'TempPassword123!' }),
        });
      } else if (action === 'assign-role') {
        response = await apiFetch(`/users/${modalData.userId}`, {
          method: 'PUT',
          body: JSON.stringify({ role: modalData.role }),
        });
      } else if (action === 'lock-account') {
        response = await apiFetch(`/users/${modalData.userId}/lock`, { method: 'POST' });
      } else if (action === 'generate-report') {
        response = await apiFetch('/reports/generate', {
          method: 'POST',
          body: JSON.stringify({ type: modalData.type || 'users', format: 'pdf' }),
        });
        if (response.ok) {
          const blob = await response.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `administration-report-${Date.now()}.pdf`;
          link.click();
          URL.revokeObjectURL(link.href);
        }
      }
      if (response && !response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'The action could not be completed');
      }
      notify(action === 'generate-report' ? 'Report downloaded' : 'Action completed successfully');
      closeModal();
      if (action !== 'generate-report') loadPanel();
    } catch (error) {
      notify(error.message || 'The action could not be completed', 'error');
    } finally {
      setWorking(false);
    }
  };

  if (currentUser?.role !== 'Director' && currentUser?.role !== 'Administrator') {
    return (
      <div className="gd-empty-page">
        <Shield size={42} />
        <h2>Restricted administration</h2>
        <p>This workspace is available to Director and Administrator accounts only.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Total users', value: info?.systemStats?.totalUsers || 0, icon: Users, action: () => onNavigate?.('USERS_AUDIT') },
    { label: 'Active users', value: info?.systemStats?.activeUsers || 0, icon: CheckCircle2, action: () => onNavigate?.('USERS_AUDIT') },
    { label: 'Roles', value: info?.systemStats?.totalRoles || 0, icon: Crown, action: () => setActiveTab('hierarchy') },
    { label: 'Permissions', value: info?.permissionCount || 0, icon: KeyRound, action: () => setActiveTab('permissions') },
    { label: 'Audit events', value: info?.systemStats?.auditLogEntries || 0, icon: FileText, action: () => setActiveTab('audit') },
  ];

  const quickActions = [
    { label: 'Create new user', hint: 'Add a system account', icon: UserPlus, action: () => openModal('create-user') },
    { label: 'Assign role', hint: 'Update user access', icon: Users, action: () => openModal('assign-role') },
    { label: 'Lock account', hint: 'Suspend an account', icon: Lock, action: () => openModal('lock-account') },
    { label: 'Generate report', hint: 'Download system data', icon: BarChart3, action: () => openModal('generate-report') },
    { label: 'System settings', hint: 'Configure the platform', icon: Settings, action: () => onNavigate?.('SETTINGS') },
    { label: 'User management', hint: 'Review all accounts', icon: Users, action: () => onNavigate?.('USERS_AUDIT') },
  ];

  return (
    <div className="gd-workspace">
      <header className="gd-topbar">
        <button type="button" className="gd-back-button" onClick={() => onNavigate?.('DASHBOARD')}><ArrowLeft size={16} /> Back</button>
        <div className="gd-title-block">
          <div><h1>System administration</h1></div>
        </div>
        <div className="gd-topbar-meta">
          <span className="gd-online"><i /> System active</span>
          <span className="gd-role"><Crown size={15} /> {currentUser?.role}</span>
        </div>
      </header>

      <main className="gd-dashboard">
        {message && (
          <div className={`gd-toast ${message.type}`} role="status">
            <CheckCircle2 size={16} /> {message.text}
            <button type="button" onClick={() => setMessage(null)}><X size={15} /></button>
          </div>
        )}

        <section className="gd-welcome">
          <div><span className="gd-eyebrow">Executive overview</span><h2>Everything under control.</h2><p>Monitor access, security, and organization-wide activity from one workspace.</p></div>
          <div className="gd-welcome-badge"><Shield size={28} /><div><small>Authority level</small><strong>100</strong></div></div>
        </section>

        <section className="gd-stats" aria-label="Administration statistics">
          {stats.map(({ label, value, icon: Icon, action }) => (
            <button type="button" className="gd-stat" key={label} onClick={action}>
              <span className="gd-stat-icon"><Icon size={18} /></span>
              <span className="gd-stat-label">{label}</span>
              <strong>{loading ? '—' : value}</strong>
              <span className="gd-stat-link">Open view <span>→</span></span>
            </button>
          ))}
        </section>

        <div className="gd-columns">
          <section className="gd-panel gd-primary-panel">
            <div className="gd-panel-heading"><div><span className="gd-eyebrow">Workspace</span><h2>Administration tools</h2></div><span className="gd-secure-label"><Shield size={14} /> Secure</span></div>
            <nav className="gd-tabs" aria-label="Administration views">
              {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}><Icon size={15} /> {label}</button>)}
            </nav>
            {activeTab === 'overview' && <div className="gd-tool-grid">{[
              { title: 'Create users', text: 'Add and manage system accounts', icon: UserPlus, action: () => openModal('create-user') },
              { title: 'Manage roles', text: 'Review the role hierarchy', icon: Crown, action: () => setActiveTab('hierarchy') },
              { title: 'Permissions', text: 'Inspect access across modules', icon: KeyRound, action: () => setActiveTab('permissions') },
              { title: 'Audit activity', text: 'Review recent system events', icon: Activity, action: () => setActiveTab('audit') },
              { title: 'Reports', text: 'Export administration data', icon: BarChart3, action: () => openModal('generate-report') },
              { title: 'Employees', text: 'Manage employee records', icon: Users, action: () => onNavigate?.('EMPLOYEES') },
              { title: 'Warehouses', text: 'Manage branch locations', icon: Shield, action: () => onNavigate?.('WAREHOUSES') },
              { title: 'Settings', text: 'Configure system behavior', icon: Settings, action: () => onNavigate?.('SETTINGS') },
            ].map(({ title, text, icon: Icon, action }) => <button type="button" className="gd-tool" key={title} onClick={action}><span className="gd-tool-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{text}</small></span><span className="gd-tool-arrow">↗</span></button>)}</div>}
            {activeTab === 'permissions' && <div className="gd-list-grid">{Object.entries(permissions?.categorized || {}).slice(0, 10).map(([name, values]) => <div className="gd-list-card" key={name}><strong>{name}</strong><span>{values.length} permissions</span></div>)}{!permissions && <p className="gd-muted">Permissions are unavailable.</p>}</div>}
            {activeTab === 'hierarchy' && <div className="gd-hierarchy">{hierarchy.slice(0, 10).map((role) => <div className="gd-hierarchy-row" key={role.role}><span className="gd-rank">{role.rank}</span><div><strong>{role.role}</strong><small>Authority level {role.authorityLevel}</small></div><b>{role.accessLevel}</b></div>)}</div>}
            {activeTab === 'audit' && <div className="gd-audit-list">{auditLogs.slice(0, 8).map((log) => <div className="gd-audit-row" key={log.id}><span className="gd-audit-dot" /><div><strong>{log.action_type || 'System activity'}</strong><small>{log.description || 'No description'} · {log.username || 'System'}</small></div><time>{formatDate(log.created_at)}</time></div>)}{auditLogs.length === 0 && <p className="gd-muted">No recent audit activity.</p>}</div>}
          </section>

          <aside className="gd-side-column">
            <section className="gd-panel gd-quick-panel"><div className="gd-panel-heading"><div><span className="gd-eyebrow">Shortcuts</span><h2>Quick actions</h2></div><Zap size={18} /></div><div className="gd-quick-list">{quickActions.map(({ label, hint, icon: Icon, action }) => <button type="button" key={label} onClick={action}><span className="gd-quick-icon"><Icon size={15} /></span><span><strong>{label}</strong><small>{hint}</small></span><span>→</span></button>)}</div></section>
            <section className="gd-panel gd-security-panel"><div className="gd-panel-heading"><div><span className="gd-eyebrow">Security posture</span><h2>Protected account</h2></div><Shield size={18} /></div><p>This account has the highest authority level. Changes are recorded in the audit trail.</p><div className="gd-security-grid"><span><CheckCircle2 size={14} /> Full authority</span><span><CheckCircle2 size={14} /> Audit trail</span><span><CheckCircle2 size={14} /> Live monitoring</span><span><CheckCircle2 size={14} /> Protected role</span></div></section>
          </aside>
        </div>
      </main>

      {modal && <div className="gd-dialog-backdrop" role="presentation" onMouseDown={closeModal}><form className="gd-dialog" onSubmit={(event) => { event.preventDefault(); runAction(modal); }} onMouseDown={(event) => event.stopPropagation()}><div className="gd-dialog-header"><div><span className="gd-eyebrow">Administration</span><h2>{modal === 'create-user' ? 'Create new user' : modal === 'assign-role' ? 'Assign role' : modal === 'lock-account' ? 'Lock account' : 'Generate report'}</h2></div><button type="button" onClick={closeModal} aria-label="Close"><X size={18} /></button></div><div className="gd-dialog-body">{modal === 'create-user' && <><label>Username<input required value={modalData.username || ''} onChange={(event) => setModalData({ ...modalData, username: event.target.value })} /></label><label>Email<input required type="email" value={modalData.email || ''} onChange={(event) => setModalData({ ...modalData, email: event.target.value })} /></label><label>Role<select value={modalData.role || 'Storekeeper'} onChange={(event) => setModalData({ ...modalData, role: event.target.value })}><option>Storekeeper</option><option>Employee</option><option>Manager</option><option>Administrator</option></select></label></>}{modal === 'assign-role' && <><label>User ID<input required value={modalData.userId || ''} onChange={(event) => setModalData({ ...modalData, userId: event.target.value })} /></label><label>Role<select required value={modalData.role || ''} onChange={(event) => setModalData({ ...modalData, role: event.target.value })}><option value="">Select a role</option>{hierarchy.map((role) => <option key={role.role} value={role.role}>{role.role}</option>)}</select></label></>}{modal === 'lock-account' && <label>User ID<input required value={modalData.userId || ''} onChange={(event) => setModalData({ ...modalData, userId: event.target.value })} /></label>}{modal === 'generate-report' && <label>Report type<select value={modalData.type || 'users'} onChange={(event) => setModalData({ ...modalData, type: event.target.value })}><option value="users">Users</option><option value="roles">Roles</option><option value="permissions">Permissions</option><option value="audit">Audit activity</option></select></label>}</div><div className="gd-dialog-footer"><button type="button" className="gd-button secondary" onClick={closeModal}>Cancel</button><button type="submit" className="gd-button primary" disabled={working}>{working ? 'Working...' : 'Continue'}</button></div></form></div>}
    </div>
  );
}
