import React, { useContext, useMemo, useState, useCallback, useEffect } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Building2, CheckCircle2, ClipboardList,
  DollarSign, Package, Plus, Settings, Shield, Tag, Truck, UserCog,
  Users, ArrowRight, RefreshCw, XCircle,
} from 'lucide-react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import apiFetch from '../utils/apiFetch';
import { useToast } from '../hooks/useToast';
import '../styles/ManagementControlDashboard.css';

const ADMIN_ROLES = ['Director', 'Administrator'];

const formatNumber = value => value === null || value === undefined ? '—' : Number(value).toLocaleString();
const formatCurrency = value => value === null || value === undefined ? '—' : `ETB ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function ManagementControlDashboard() {
  const { currentUser } = useContext(AuthContext) || {};
  const {
    stats = {}, materials = [], categories = [], suppliers = [], employees = [],
    auditLogs = [], usersList = [], fetchData, apiError = false, dbStatus = 'Connecting...'
  } = useContext(DataContext) || {};

  const navigate = id => window.dispatchEvent(new CustomEvent('directorNavigate', { detail: { nav: id } }));
  const authorized = ADMIN_ROLES.includes(currentUser?.role);
  const pendingActions = (Number(stats.pendingRequests) || 0) + (Number(stats.pendingDisposals) || 0) + (Number(stats.draftPOs) || 0);

  // ── Pending material requests ────────────────────────────────
  const [pendingReqs, setPendingReqs] = useState([]);
  const [reqsLoading, setReqsLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const toast = useToast();

  const fetchPending = useCallback(async () => {
    setReqsLoading(true);
    try {
      const res = await apiFetch('/material-requests?limit=100');
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.data || []);
      setPendingReqs(rows.filter(r => r.status === 'Pending'));
    } catch {
      // silently ignore — dashboard still works without this
    } finally {
      setReqsLoading(false);
    }
  }, []);

  useEffect(() => { if (authorized) fetchPending(); }, [authorized]);

  const handleApprove = async (req) => {
    setActioningId(req.id);
    try {
      const res = await apiFetch(`/material-requests/${req.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: 'Approved' }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error || 'Approval failed'); return; }
      const d = await res.json();
      toast.success(`${req.request_code} approved & issued — ${d.issued_quantity} × ${d.material} (${d.transaction_code})`);
      fetchPending();
      fetchData?.(true);
    } catch { toast.error('Approval failed'); }
    finally { setActioningId(null); }
  };

  const handleReject = async (req) => {
    const reason = window.prompt(`Rejection reason for ${req.request_code}:`);
    if (!reason?.trim()) return;
    setActioningId(req.id);
    try {
      const res = await apiFetch(`/material-requests/${req.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: reason }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error || 'Rejection failed'); return; }
      toast.success(`${req.request_code} rejected`);
      fetchPending();
      fetchData?.(true);
    } catch { toast.error('Rejection failed'); }
    finally { setActioningId(null); }
  };
  // ────────────────────────────────────────────────────────────
  const lowStockCount = stats.lowStockCount ?? materials.filter(material => Number(material.current_stock) <= Number(material.min_stock_level)).length;
  const failedActionsCount = useMemo(() => {
    if (stats.failedActions !== undefined && stats.failedActions !== null) return stats.failedActions;
    return auditLogs.filter(log => /fail|error|denied|reject|invalid|locked/i.test(`${log.action_type || ''} ${log.description || ''}`)).length;
  }, [stats.failedActions, auditLogs]);
  const recentLogs = useMemo(() => {
    return auditLogs
      .filter(log => log.action_type !== 'UPDATE_PREFERRED_PAGE' && !String(log.action_type || '').includes('PREFERRED_PAGE') && !String(log.description || '').includes('preferred page'))
      .slice(0, 6);
  }, [auditLogs]);
  const categoryBars = useMemo(() => (stats.categoryStats || []).slice(0, 5), [stats.categoryStats]);
  const maxCategoryValue = Math.max(...categoryBars.map(item => Number(item.category_value) || 0), 1);
  const analytics = useMemo(() => {
    const totalValue = Number(stats.totalStockValue) || materials.reduce((sum, material) => sum + (Number(material.current_stock) || 0) * (Number(material.unit_cost) || 0), 0);
    const activeUsers = Number(stats.totalUsers ?? usersList.filter(user => user.status === 'Active').length) || 0;
    const healthyUsers = usersList.filter(user => user.status === 'Active').length;
    const riskUsers = usersList.filter(user => user.password_weak === true || user.passwordStrength === 'weak');
    const auditTotal = auditLogs.length || 1;
    const eventCounts = auditLogs.reduce((counts, log) => {
      const action = String(log.action_type || '').toLowerCase();
      const desc = String(log.description || '').toLowerCase();
      let key = 'System';
      if (/login|logout|password|auth|session/i.test(action) || /login|logout|password/i.test(desc)) key = 'Logins';
      else if (/stock|material|category|supplier|transfer|disposal|request|order|po/i.test(action) || /material|stock|category|supplier|transfer|disposal|request/i.test(desc)) key = 'Inventory';
      else if (/user|role|employee|dept|account|permission/i.test(action) || /user|employee|department|role/i.test(desc)) key = 'People';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, { Inventory: 0, Logins: 0, People: 0, System: 0 });
    const bubbleSizes = ['large', 'medium', 'small', 'tiny'];
    const sortedBubbles = Object.entries(eventCounts).map(([name, count]) => ({ name, count, pct: Math.round((count / auditTotal) * 100) })).sort((a, b) => b.count - a.count).map((item, index) => ({ ...item, sizeClass: bubbleSizes[index] || 'tiny' }));
    const channels = [['Employees', employees.length], ['Suppliers', suppliers.length], ['Materials', materials.length], ['Categories', categories.length], ['Audit events', auditLogs.length]];
    const maxChannel = Math.max(...channels.map(([, value]) => value), 1);
    const totalMatsCount = materials.length || 1;
    const reliabilityScore = Math.max(10, Math.min(100, Math.round(((totalMatsCount - lowStockCount) / totalMatsCount) * 100)));
    const totalUsersCount = usersList.length || 1;
    const securityScore = Math.max(10, Math.min(100, Math.round(100 - (riskUsers.length / totalUsersCount) * 100)));
    const activityScore = auditLogs.length > 0 ? Math.min(100, Math.max(50, 60 + auditLogs.length * 2)) : 50;
    const overallHealth = Math.round((securityScore + reliabilityScore + activityScore) / 3);
    return { totalValue, activeUsers, healthyUsers, riskUsers, auditTotal, eventCounts, sortedBubbles, channels, maxChannel, securityScore, reliabilityScore, activityScore, overallHealth };
  }, [stats.totalStockValue, stats.totalUsers, materials, usersList, employees, suppliers, categories, auditLogs, lowStockCount]);

  if (!authorized) {
    return <div className="mcc-page mcc-denied"><Shield size={42} /><h2>Management access required</h2><p>Your current role cannot access the control center.</p></div>;
  }

  const activeUsersCount = stats.totalUsers ?? usersList.filter(u => u.status === 'Active').length;

  const controlModules = [
    ['Employees', 'Add, edit, status, departments and accountability', Users, 'EMPLOYEES', ['Add Employee', 'EMPLOYEES'], '#3b82f6', `${formatNumber(stats.totalEmployees ?? employees.length)} employees`],
    ['Materials', 'Inventory, stock adjustments, costs and locations', Package, 'MATERIALS', ['Add Material', 'MATERIALS'], '#10b981', `${formatNumber(stats.totalMaterials ?? materials.length)} items`],
    ['Suppliers', 'Contacts, status and supplied material relationships', Truck, 'SUPPLIERS', ['Add Supplier', 'SUPPLIERS'], '#8b5cf6', `${formatNumber(stats.totalSuppliers ?? suppliers.length)} suppliers`],
    ['Categories', 'Organize materials and manage category status', Tag, 'CATEGORIES', ['Add Category', 'CATEGORIES'], '#f59e0b', `${formatNumber(stats.totalCategories ?? categories.length)} categories`],
    ['Warehouses', 'Manage warehouse locations, capacity and distribution', Building2, 'WAREHOUSES', ['View Warehouses', 'WAREHOUSES'], '#06b6d4', `${formatNumber(stats.totalWarehouses)} warehouses`],
    ['Transactions', 'Stock movements, low stock alerts and adjustments', AlertTriangle, 'TRANSACTIONS', ['View Movements', 'TRANSACTIONS'], '#ef4444', `${formatNumber(lowStockCount)} low stock`],
    ['Requests', 'Review, approve or reject pending material requests', ClipboardList, 'REQUESTS', ['View Requests', 'REQUESTS'], '#f97316', `${formatNumber(pendingActions)} pending`],
    ['Audit Logs', 'Track system activity, user actions and audit history', Activity, 'USER_AUDIT', ['View Audit', 'USER_AUDIT'], '#64748b', `${formatNumber(stats.totalAuditLogs ?? auditLogs.length)} events`],
    ['Users', 'Manage roles, permissions, status and system access', UserCog, 'USERS_AUDIT', ['Manage Users', 'USERS_AUDIT'], '#a855f7', `${formatNumber(activeUsersCount)} active`],
    ['System Settings', 'Configure system parameters, organization and policies', Settings, 'SETTINGS', ['Open Settings', 'SETTINGS'], '#0ea5e9', 'Configuration'],
  ];

  const kpiCards = [
    { label: 'Inventory Value', value: formatCurrency(analytics.totalValue), sub: 'Finance', iconBg: 'rgba(139,92,246,0.1)', iconColor: '#8b5cf6', tag: 'Live' },
    { label: 'Total Materials', value: formatNumber(stats.totalMaterials ?? materials.length), sub: 'Catalog', iconBg: 'rgba(99,102,241,0.1)', iconColor: '#6366f1', tag: `${formatNumber(stats.outOfStockCount ?? 0)} empty` },
    { label: 'Active Users', value: formatNumber(activeUsersCount), sub: 'People', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#3b82f6', tag: `${formatNumber(usersList.length)} total` },
    { label: 'Low Stock Items', value: formatNumber(lowStockCount), sub: 'Alert', iconBg: 'rgba(245,158,11,0.1)', iconColor: '#f59e0b', tag: lowStockCount > 0 ? 'Action needed' : 'All clear' },
    { label: 'Pending Requests', value: formatNumber(pendingActions), sub: 'Queue', iconBg: 'rgba(249,115,22,0.1)', iconColor: '#f97316', tag: 'Approvals' },
    { label: 'Warehouses', value: formatNumber(stats.totalWarehouses), sub: 'Locations', iconBg: 'rgba(6,182,212,0.1)', iconColor: '#06b6d4', tag: `${formatNumber(stats.totalSuppliers ?? suppliers.length)} suppliers` },
    { label: 'Audit Events', value: formatNumber(stats.totalAuditLogs ?? auditLogs.length), sub: 'Activity', iconBg: 'rgba(100,116,139,0.1)', iconColor: '#64748b', tag: 'All time' },
  ];

  return (
    <div className="mcc-page">

      {/* ══ HERO ══════════════════════════════════════════════════ */}
      <header className="mcc-hero">
        <div className="mcc-hero-left">
          <div className="mcc-hero-eyebrow">
            <span className="mcc-hero-eyebrow-dot" />
            Management Control System
          </div>
          <h1>Command Center</h1>
          <p>One live view of people, inventory, decisions and system activity.</p>
          <div className="mcc-hero-stats">
            {[
              { val: formatNumber(stats.totalMaterials ?? materials.length), label: 'Materials' },
              { val: formatNumber(activeUsersCount), label: 'Active Users' },
              { val: formatNumber(lowStockCount), label: 'Low Stock' },
              { val: formatNumber(pendingActions), label: 'Pending' },
            ].map(s => (
              <div className="mcc-hero-stat" key={s.label}>
                <div className="mcc-hero-stat-val">{s.val}</div>
                <div className="mcc-hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mcc-hero-actions">
          <span className="mcc-live"><i />Live data</span>
          <button className="mcc-icon-button" onClick={() => fetchData?.(true)} title="Refresh all data"><RefreshCw size={17} /></button>
          <span className="mcc-role"><Shield size={13} />{currentUser?.role}</span>
        </div>
      </header>

      <section className="mcc-section">
        <div className="mcc-section-heading"><div><h2>Manage the system</h2></div><span>Open a dedicated management page</span></div>
        <div className="mcc-module-grid">{controlModules.map(([title, description, Icon, destination, quickAction, accent, stat]) => (
          <article
            className="mcc-module"
            key={title}
            onClick={() => navigate(destination)}
            style={{ '--module-accent': accent }}
          >
            <div className="mcc-module-top">
              <span className="mcc-module-icon"><Icon size={18} /></span>
              <span className="mcc-module-stat">{stat}</span>
            </div>
            <div className="mcc-module-body">
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <button
              className="mcc-module-btn"
              onClick={event => { event.stopPropagation(); navigate(quickAction[1]); }}
            >
              <Plus size={12} /> {quickAction[0]}
            </button>
          </article>
        ))}</div>
      </section>

      <section className="mcc-analytics-grid" aria-label="Command center analytics">
        <section className="mcc-visual-card mcc-sales-card">
          <VisualHeading eyebrow="Inventory overview" title="Value movement" action="View report" />
          <div className="mcc-big-number">{formatCurrency(analytics.totalValue)}</div>
          <div className="mcc-positive">↑ {formatNumber(materials.length)} tracked materials</div>
          <MiniFlowChart values={categoryBars.length ? categoryBars.map(item => Number(item.category_value) || 0) : [18, 27, 22, 34, 29, 42]} />
          <div className="mcc-chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span></div>
          <div className="mcc-legend"><i className="mcc-dot purple" /> Stock value <i className="mcc-dot teal" /> Materials <i className="mcc-dot blue" /> Categories</div>
        </section>
        <section className="mcc-visual-card">
          <VisualHeading eyebrow="Coverage" title="Top acquisition channels" action="This month" />
          <div className="mcc-channel-list">{analytics.channels.map(([label, value]) => <div className="mcc-channel" key={label}><span>{label}</span><i><b style={{ width: `${(value / analytics.maxChannel) * 100}%` }} /></i><strong>{formatNumber(value)}</strong></div>)}</div>
        </section>
        <section className="mcc-visual-card mcc-revenue-card">
          <VisualHeading eyebrow="Portfolio" title="Total stock value" action="↗" />
          <div className="mcc-big-number">{formatCurrency(analytics.totalValue)}</div>
          <div className="mcc-positive">↑ Live inventory valuation</div>
          <MiniWaveChart />
        </section>
        <section className="mcc-visual-card mcc-risk-card">
          <VisualHeading eyebrow="System control" title={analytics.riskUsers.length ? 'Accounts at risk' : 'Account health'} action="View all" />
          <div className="mcc-risk-head"><span>ACCOUNT</span><span>HEALTH SCORE</span><span>ACTIVITY</span><span>STATUS</span></div>
          {(usersList.length ? usersList.slice(0, 5) : [{ username: 'No users', status: 'Unknown' }]).map((user, index) => {
            const activityCount = auditLogs.filter(l => l.user_id === user.id).length;
            const hasChangedPassword = auditLogs.some(l => l.user_id === user.id && /password/i.test(l.action_type || ''));

            // Only Employee-role users are expected to have a linked document
            const isEmployeeRole = user.role === 'Employee';
            const empRecord = employees.find(e => e.user_id === user.id || e.email === user.email);
            const hasDocument = !!empRecord?.document_url;

            let score = user.status === 'Active' ? 60 : 35;
            if (user.status === 'Active') {
              if (user.phone_contact) score += 5;
              if (user.department) score += 5;
              if (user.email) score += 5;
              score += Math.min(10, activityCount * 2);
              if (hasChangedPassword) score += 15;
              else score += 8;
              if (!isEmployeeRole || hasDocument) score += 5;
            }

            const missingFields = [];
            if (!user.phone_contact) missingFields.push('phone');
            if (!user.department) missingFields.push('department');
            if (!user.email) missingFields.push('email');
            if (isEmployeeRole && !hasDocument) missingFields.push('document');

            return (
              <div className="mcc-risk-row" key={user.id || user.username || index}>
                <strong>
                  {user.username || user.full_name}
                  {missingFields.length > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: '10px', fontWeight: 700,
                      background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                      padding: '1px 6px', borderRadius: '4px',
                    }}>incomplete</span>
                  )}
                  {missingFields.length > 0 && (
                    <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
                      Missing: {missingFields.join(', ')}
                    </span>
                  )}
                </strong>
                <em className={score >= 75 ? 'good' : 'warning'}>{score}</em>
                <RiskSparkline tone={score >= 85 ? 0 : score >= 70 ? 1 : 2} />
                <small style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>{user.status || 'Unknown'}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: hasChangedPassword ? '#10b981' : '#64748b' }}>
                    {hasChangedPassword ? '✓ Password updated' : '• Password set'}
                  </span>
                  {isEmployeeRole && (
                    hasDocument ? (
                      <a
                        href={empRecord.document_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textDecoration: 'none' }}
                      >📄 View document</a>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>✗ No document</span>
                    )
                  )}
                </small>
              </div>
            );
          })}
        </section>
        <section className="mcc-visual-card mcc-success-card">
          <VisualHeading eyebrow="Reliability" title="Success rate" action="↗" />
          <Gauge value={analytics.auditTotal ? Math.round((analytics.healthyUsers / Math.max(analytics.activeUsers, 1)) * 100) : 0} />
          <p className="mcc-gauge-copy">Active accounts are available for daily operations.</p>
          <div className="mcc-two-stat"><span>People<strong>{formatNumber(employees.length)}</strong></span><span>New users<strong>{formatNumber(usersList.length)}</strong></span></div>
        </section>
        <section className="mcc-visual-card mcc-events-card">
          <VisualHeading eyebrow="Engagement" title="Events breakdown" action="" />
          <div className="mcc-bubbles">{analytics.sortedBubbles.map(bubble => <span className={bubble.sizeClass} key={bubble.name}>{bubble.pct}%<small>{bubble.name}</small></span>)}</div>
        </section>
        <section className="mcc-visual-card mcc-health-card">
          <VisualHeading eyebrow="Account health" title="System health" action="" />
          <HealthRadar score={analytics.overallHealth} />
          <div className="mcc-health-legend"><span><i className="mcc-dot purple" /> Security <b>{analytics.securityScore}</b></span><span><i className="mcc-dot teal" /> Reliability <b>{analytics.reliabilityScore}</b></span><span><i className="mcc-dot blue" /> Activity <b>{analytics.activityScore}</b></span></div>
        </section>
      </section>

      <div className="mcc-content-grid">
        <section className="mcc-panel mcc-chart-panel">
          <div className="mcc-panel-heading"><div><span className="mcc-kicker">Inventory intelligence</span><h2>Value by category</h2></div><BarChart3 size={20} /></div>
          {categoryBars.length ? <div className="mcc-bars">{categoryBars.map(item => <div className="mcc-bar-row" key={item.category}><div><span>{item.category}</span><b>{formatCurrency(item.category_value)}</b></div><span className="mcc-bar-track"><i style={{ width: `${(Number(item.category_value || 0) / maxCategoryValue) * 100}%` }} /></span></div>)}</div> : <EmptyState text="Category valuation data is not available yet." />}
        </section>
        <section className="mcc-panel mcc-control-panel">
          <div className="mcc-panel-heading"><div><span className="mcc-kicker">System control</span><h2>Operational signals</h2></div><Activity size={20} /></div>
          <Signal icon={Users} label="Active users" value={formatNumber(stats.totalUsers ?? usersList.filter(u => u.status === 'Active').length)} onClick={() => navigate('USERS_AUDIT')} />
          <Signal icon={ClipboardList} label="Pending approvals" value={formatNumber((Number(stats.pendingRequests) || 0) + (Number(stats.pendingDisposals) || 0))} onClick={() => navigate('REQUESTS')} />
          <Signal icon={AlertTriangle} label="Low stock items" value={formatNumber(lowStockCount)} tone={Number(lowStockCount) > 0 ? 'warning' : 'good'} onClick={() => navigate('TRANSACTIONS')} />
          <Signal icon={AlertTriangle} label="Failed actions" value={formatNumber(failedActionsCount)} tone={Number(failedActionsCount) > 0 ? 'warning' : 'good'} onClick={() => navigate('USER_AUDIT')} />
          <Signal icon={Activity} label="Recent changes" value={formatNumber(auditLogs.length)} onClick={() => navigate('USER_AUDIT')} />
          <Signal icon={Shield} label="Security events" value={auditLogs.filter(log => /login|logout|password|permission|role/i.test(log.action_type || '')).length} onClick={() => navigate('USER_AUDIT')} />
          <Signal icon={AlertTriangle} label="System alerts" value={apiError ? 'Action required' : 'None detected'} tone={apiError ? 'warning' : 'good'} onClick={() => navigate('USER_AUDIT')} />
          <Signal icon={CheckCircle2} label="System status" value={apiError ? dbStatus : 'Operational'} tone={apiError ? 'warning' : 'good'} onClick={() => navigate('USER_AUDIT')} />
        </section>
      </div>

      {/* ── Pending Material Requests ── */}
      <section className="mcc-panel" style={{ margin: '0 0 24px' }}>
        <div className="mcc-panel-heading">
          <div>
            <span className="mcc-kicker">Approvals needed</span>
            <h2>Pending material requests</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {pendingReqs.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>
                {pendingReqs.length} pending
              </span>
            )}
            <button
              className="mcc-icon-button"
              onClick={fetchPending}
              title="Refresh pending requests"
            >
              <RefreshCw size={15} />
            </button>
            <button
              className="mcc-text-button"
              onClick={() => navigate('REQUESTS')}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {reqsLoading ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Loading pending requests…
          </div>
        ) : pendingReqs.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            <CheckCircle2 size={20} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div>No pending requests — you're all caught up.</div>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="data-table table-dense" style={{ width: '100%', minWidth: '780px' }}>
              <thead>
                <tr>
                  {['Code', 'Material', 'Qty', 'Priority', 'Purpose', 'Requested By', 'Actions'].map(h => (
                    <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingReqs.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#818cf8', whiteSpace: 'nowrap' }}>
                      {req.request_code}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>{req.material_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.material_code}</div>
                    </td>
                    <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                      {req.quantity} {req.unit_of_measure || ''}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                        background: req.priority === 'Urgent' ? 'rgba(239,68,68,0.15)' : req.priority === 'High' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                        color: req.priority === 'Urgent' ? '#ef4444' : req.priority === 'High' ? '#f59e0b' : '#818cf8',
                      }}>
                        {req.priority || 'Normal'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={req.purpose}>
                      {req.purpose || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {req.requester_name || req.requester_username || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actioningId === req.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', borderRadius: '6px', border: 'none',
                            background: 'rgba(16,185,129,0.15)', color: '#10b981',
                            fontWeight: '600', fontSize: '12px', cursor: 'pointer',
                            opacity: actioningId === req.id ? 0.6 : 1,
                          }}
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={actioningId === req.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', borderRadius: '6px', border: 'none',
                            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                            fontWeight: '600', fontSize: '12px', cursor: 'pointer',
                            opacity: actioningId === req.id ? 0.6 : 1,
                          }}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mcc-bottom-grid">
        <section className="mcc-panel"><div className="mcc-panel-heading"><div><span className="mcc-kicker">Recent changes</span><h2>Activity feed</h2></div><button className="mcc-text-button" onClick={() => navigate('USER_AUDIT')}>View all <ArrowRight size={14} /></button></div>{recentLogs.length ? <div className="mcc-activity-list">{recentLogs.map(log => <button className="mcc-activity" key={log.id} onClick={() => navigate('USER_AUDIT')}><span className="mcc-activity-dot" /><span><b>{formatActionTitle(log.action_type)}</b><small>{formatActionDescription(log.description, log.action_type)}</small></span><time>{new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></button>)}</div> : <EmptyState text="No audit activity has been recorded yet." />}</section>
      </div>

    </div>
  );
}

function EmptyState({ text }) { return <div className="mcc-empty"><Activity size={18} /><span>{text}</span></div>; }
function Signal({ icon: Icon, label, value, tone = '', onClick }) {
  return (
    <div className={`mcc-signal ${onClick ? 'clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} title={onClick ? `Click to view ${label.toLowerCase()}` : undefined}>
      <Icon size={16} /><span>{label}</span><strong className={tone}>{value}</strong>
    </div>
  );
}
function VisualHeading({ eyebrow, title, action }) { return <div className="mcc-visual-heading"><div><span className="mcc-kicker">{eyebrow}</span><h2>{title}</h2></div>{action && <button type="button">{action}</button>}</div>; }
function MiniFlowChart({ values }) { const max = Math.max(...values, 1); return <div className="mcc-flow-chart">{values.slice(0, 6).map((value, index) => <div className="mcc-flow-column" key={`${value}-${index}`}><span style={{ height: `${Math.max((value / max) * 100, 12)}%`, background: 'linear-gradient(to top, #34d399, #10b981)', borderRadius: '4px' }} /><b style={{ height: `${Math.max((value / max) * 72, 10)}%`, background: 'linear-gradient(to top, #38bdf8, #0ea5e9)', borderRadius: '4px' }} /><i style={{ height: `${Math.max((value / max) * 44, 8)}%`, background: 'linear-gradient(to top, #a78bfa, #8b5cf6)', borderRadius: '4px' }} /></div>)}</div>; }
function MiniWaveChart() { return <svg className="mcc-wave-chart" viewBox="0 0 320 100" preserveAspectRatio="none" aria-label="Stock value trend" style={{ filter: 'drop-shadow(0 8px 12px rgba(99,102,241,0.2))' }}><defs><linearGradient id="waveFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" /></linearGradient><linearGradient id="waveLine" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#3b82f6" /><stop offset="50%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs><path d="M0 74 C30 35 55 84 84 58 S135 20 164 59 S214 85 242 43 S285 20 320 48 V100 H0Z" fill="url(#waveFill)" /><path d="M0 74 C30 35 55 84 84 58 S135 20 164 59 S214 85 242 43 S285 20 320 48" fill="none" stroke="url(#waveLine)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Gauge({ value }) { const offset = 157 - (157 * Math.min(value, 100)) / 100; return <div className="mcc-gauge" style={{ filter: 'drop-shadow(0 8px 12px rgba(16,185,129,0.15))' }}><svg viewBox="0 0 160 92"><defs><linearGradient id="gaugeGrad" x1="0" x2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs><path d="M16 78 A64 64 0 0 1 144 78" pathLength="157" fill="none" stroke="#f1f5f9" strokeWidth="14" strokeLinecap="round" /><path d="M16 78 A64 64 0 0 1 144 78" pathLength="157" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round" strokeDasharray="157" strokeDashoffset={offset} /></svg><strong style={{ color: '#0f172a' }}>{value}%</strong></div>; }
function HealthRadar({ score = 88 }) { return <div className="mcc-radar"><svg viewBox="0 0 180 145" style={{ filter: 'drop-shadow(0 6px 12px rgba(139,92,246,0.15))' }}><polygon points="90,8 158,48 132,124 48,124 22,48" fill="none" stroke="#e2e8f0" strokeWidth="1.5" /><polygon points="90,28 136,55 118,105 62,105 44,55" fill="none" stroke="#e2e8f0" strokeWidth="1.5" /><polygon points="90,22 142,55 113,113 59,104 43,58" fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="90" cy="22" r="4.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2" /><circle cx="142" cy="55" r="4.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2" /><circle cx="113" cy="113" r="4.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2" /><circle cx="59" cy="104" r="4.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2" /><circle cx="43" cy="58" r="4.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2" /></svg><strong>{score}<small style={{ marginTop: '2px', color: '#64748b' }}>Overall<br />health</small></strong></div>; }
function RiskSparkline({ tone = 0 }) { const colors = ['#ef4444', '#f59e0b', '#10b981']; return <svg className="mcc-risk-sparkline" viewBox="0 0 68 20" aria-label="Account activity trend"><path d="M1 12 C7 2 12 18 19 9 S30 3 36 11 S47 17 53 8 S61 4 67 7" fill="none" stroke={colors[tone]} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 2px 4px ${colors[tone]}40)` }} /></svg>; }

function formatActionTitle(actionType) {
  if (!actionType) return 'System Event';
  const type = String(actionType).toUpperCase();
  const titleMap = {
    'LOGIN': 'User Logged In',
    'LOGOUT': 'User Logged Out',
    'UPDATE_SETTINGS': 'Updated System Settings',
    'UPDATE_EMPLOYEE': 'Updated Employee Record',
    'ADD_EMPLOYEE': 'Added Employee',
    'DELETE_EMPLOYEE': 'Removed Employee',
    'ADD_MATERIAL': 'Added New Material',
    'UPDATE_MATERIAL': 'Updated Material Info',
    'DELETE_MATERIAL': 'Deleted Material',
    'STOCK_IN': 'Stock Intake (Stock In)',
    'STOCK_OUT': 'Stock Issued (Stock Out)',
    'ADD_SUPPLIER': 'Added Supplier',
    'UPDATE_SUPPLIER': 'Updated Supplier',
    'ADD_CATEGORY': 'Added Category',
    'UPDATE_CATEGORY': 'Updated Category',
    'CREATE_USER': 'Created User Account',
    'UPDATE_USER': 'Updated User Account',
  };
  if (titleMap[type]) return titleMap[type];
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatActionDescription(desc, actionType) {
  if (!desc) return 'System activity recorded.';
  let text = String(desc).trim();
  if (text.startsWith('Updated: organization_') || (text.startsWith('Updated: ') && text.length > 80)) {
    const keys = text.replace('Updated: ', '').split(',').map(k => k.trim());
    return `Updated ${keys.length} system settings & policies`;
  }
  if (text.length > 110) {
    return text.slice(0, 107) + '...';
  }
  return text;
}
