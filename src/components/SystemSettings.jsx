import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { apiFetch as authenticatedApiFetch } from '../contexts/AuthContext';
import apiFetch from '../utils/apiFetch';
import { Settings, Save, RotateCcw, Building2, DollarSign, Bell, ShieldAlert, CheckCircle2, KeyRound, Lock, Upload, Trash2, Database, HelpCircle, Info, Download, Mail } from 'lucide-react';

const DEFAULTS = {
  organization_name: 'Store Management System',
  organization_logo: '',
  currency: 'USD',
  currency_symbol: '$',
  low_stock_threshold: '5',
  out_of_stock_threshold: '0',
  allow_negative_stock: 'false',
  require_reason_stock_adjust: 'true',
  require_approval_stock_adjust: 'true',
  require_approval_stock_out: 'false',
  track_damaged_products: 'true',
  track_expired_products: 'true',
  track_batch_numbers: 'true',
  track_expiry_dates: 'true',
  auto_low_stock_alerts: 'true',
  session_timeout: '12',
  max_login_attempts: '5',
  account_lockout_duration: '15',
  two_factor_auth: 'false',
  multiple_session_control: 'true',
  login_activity_tracking: 'true',
  failed_login_tracking: 'true',
  date_format: 'MM/DD/YYYY',
  timezone: 'UTC',
  system_email: '',
  pwd_min_length: '8',
  pwd_require_uppercase: 'true',
  pwd_require_lowercase: 'true',
  pwd_require_number: 'true',
  pwd_require_special: 'false',
  pwd_history_limit: '5',
  pwd_expiry_days: '0',
  pwd_prevent_reused: 'true',
  receipt_prefix: 'REC-',
  invoice_prefix: 'INV-',
  next_invoice_num: '1001',
  show_logo_on_receipt: 'true',
  show_store_address: 'true',
  show_cashier_name: 'true',
  show_tax_number: 'true',
  tax_number: 'TAX-998822',
  tax_rate: '15',
  receipt_footer: 'Thank you for your business!',
  invoice_footer: 'Payment due within 30 days.',
  print_format: 'A4',
  notify_low_stock: 'true',
  notify_out_of_stock: 'true',
  notify_expiry: 'true',
  notify_orders: 'true',
  notify_security: 'true',
  notify_email_channel: 'true',
  notify_in_app_channel: 'true',
};

// ── Section wrapper ───────────────────────────────────────────
function Section({ icon: Icon, title, color = '#6366f1', children }) {
  return (
    <div className="settings-section-card">
      <div className="settings-section-header">
        <div className="settings-section-icon" style={{ background: `${color}18` }}>
          <Icon size={18} color={color} />
        </div>
        <h2 className="settings-section-title">{title}</h2>
      </div>
      <div className="settings-section-body">
        <div className="settings-section-grid">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────
function Field({ label, span = 1, children }) {
  return (
    <div className="form-group" style={{ gridColumn: `span ${span}` }}>
      <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

export default function SystemSettings() {
  const { currentUser } = useContext(AuthContext) || {};
  const logoInputRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [activeSection, setActiveSection] = useState('organisation');
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [preferredPage, setPreferredPage] = useState(currentUser?.preferred_page || 'DASHBOARD');

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/system/settings');
        if (res.status === 401 || res.status === 403) { setLoading(false); return; }
        if (!res.ok) throw new Error('Failed to load settings from server');
        const data = await res.json();
        const adminEmail = currentUser?.email || '';
        const merged = { ...DEFAULTS, system_email: adminEmail, ...data };
        setSettings(merged);
        setOriginal(merged);
        setPreferredPage(currentUser?.preferred_page || 'DASHBOARD');
      } catch (e) {
        console.warn('System settings:', e.message);
        const adminEmail = currentUser?.email || '';
        setSettings(s => ({ ...s, system_email: s.system_email || adminEmail }));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    if (activeSection !== 'backup') return;
    apiFetch('/backups')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load backups');
        setBackups(Array.isArray(data) ? data : []);
      })
      .catch(e => setError(e.message));
  }, [activeSection]);

  const sectionTabs = [
    { id: 'organisation', label: 'Organisation', icon: Building2, desc: 'Organization details, logo, and email settings' },
    { id: 'currency', label: 'Currency', icon: DollarSign, desc: 'Currency format and date display settings' },
    { id: 'stock_rules', label: 'Stock Rules', icon: Bell, desc: 'Low stock thresholds and stock flow rules' },
    { id: 'security', label: 'Session & Security', icon: ShieldAlert, desc: 'Session timeout and security defaults' },
    { id: 'password', label: 'Password Policy', icon: KeyRound, desc: 'Password policy and complexity requirements' },
    { id: 'receipts', label: 'Receipt & Invoice', icon: Database, desc: 'Receipt/invoice prefixes, tax, print headers & footers' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences and notification triggers' },
    { id: 'backup', label: 'Backup & Data', icon: Database, desc: 'Data export and backup management' },
    { id: 'about', label: 'Help & About', icon: HelpCircle, desc: 'Version info, documentation, and support' },
  ];

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original) || preferredPage !== (currentUser?.preferred_page || 'DASHBOARD');

  const handleReset = () => setSettings(original);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Logo image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 300, MAX_HEIGHT = 120;
        let width = img.width, height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        set('organization_logo', canvas.toDataURL('image/png'));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/system-settings', { method: 'PUT', body: JSON.stringify(settings) });
      if (res.status === 401) throw new Error('Session expired — please log out and log back in');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const preferenceResponse = await authenticatedApiFetch('/auth/preferred-page', {
        method: 'PUT',
        body: JSON.stringify({ preferred_page: preferredPage })
      });
      if (!preferenceResponse.ok) {
        const preferenceError = await preferenceResponse.json().catch(() => ({}));
        throw new Error(preferenceError.error || 'Failed to save preferred page');
      }
      setOriginal(settings);
      setSavedAt(new Date().toLocaleTimeString());
      window.dispatchEvent(new Event('system_settings_updated'));
      // Refresh backup & audit data if needed

    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch('/backup/export');
      if (!res.ok) throw new Error((await res.json()).error || 'Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `store_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleCreateBackup = async () => {
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch('/backups', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup failed');
      const list = await apiFetch('/backups');
      setBackups(await list.json());
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleRestore = async (backup) => {
    if (!window.confirm(`Restore database backup ${backup.file_name}?`)) return;
    setError('');
    setBackupBusy(true);
    try {
      const res = await apiFetch(`/backups/${backup.id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Delete backup ${backup.file_name}?`)) return;
    setBackupBusy(true);
    try {
      const res = await apiFetch(`/backups/${backup.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setBackups(items => items.filter(item => item.id !== backup.id));
    } catch (e) { setError(e.message); }
    finally { setBackupBusy(false); }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const res = await apiFetch(`/backups/${backup.id}/download`);
      if (!res.ok) throw new Error((await res.json()).error || 'Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-muted)', fontSize: '14px', gap: '10px' }}>
        <Settings size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading settings…
      </div>
    );
  }

  return (
    <div className="settings-shell">
      {/* ── Left nav ── */}
      <aside className="settings-nav-panel">
        <div className="settings-nav-heading">Settings Sections</div>
        <div className="settings-nav-list">
          {sectionTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`settings-nav-item${activeSection === tab.id ? ' active' : ''}`}
                onClick={() => setActiveSection(tab.id)}
              >
                <span className="settings-nav-icon"><Icon size={16} /></span>
                <span className="settings-nav-text">
                  <strong>{tab.label}</strong>
                  <span>{tab.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="settings-panel-summary">
          <h3>Quick summary</h3>
          <p>Editing <strong>{sectionTabs.find(t => t.id === activeSection)?.label}</strong>. Use the menu to switch sections.</p>
          <p style={{ marginTop: '8px' }}><strong>Saved status:</strong> {isDirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : 'No changes yet'}</p>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="settings-main-panel">
        <form onSubmit={handleSave}>

          {/* Top bar */}
          <div className="settings-top-bar">
            <p className="settings-top-bar-desc">
              Configure organisation details, currency, stock rules, and system behaviour
            </p>
            <div className="settings-top-bar-actions">
              {savedAt && !isDirty && (
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={13} /> Saved at {savedAt}
                </span>
              )}
              {!isDirty && !savedAt && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No changes to save</span>
              )}
              {isDirty && (
                <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={saving}>
                  <RotateCcw size={15} /> Reset
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !isDirty}
              >
                <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={15} /> {error}
            </div>
          )}

          {/* ── Organisation ── */}
          {activeSection === 'organisation' && (
            <Section icon={Building2} title="Organisation" color="#6366f1">
              <Field label="Organisation Name" span={2}>
                <input
                  className="form-input"
                  value={settings.organization_name}
                  onChange={e => set('organization_name', e.target.value)}
                  placeholder="Your organisation name"
                />
              </Field>

              <Field label="Organisation Logo" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '60px', height: '44px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '4px' }}>
                    {settings.organization_logo
                      ? <img src={settings.organization_logo} alt="Org Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <Building2 size={24} color="#6366f1" />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="file" ref={logoInputRef} accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Upload size={13} /> Upload Logo
                      </button>
                      {settings.organization_logo && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('organization_logo', '')} style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload PNG or SVG logo for the sidebar &amp; reports</span>
                  </div>
                </div>
              </Field>

              <Field label="System / Notification Email">
                <input
                  className="form-input"
                  type="email"
                  value={settings.system_email}
                  onChange={e => set('system_email', e.target.value)}
                  placeholder={currentUser?.email || 'your-email@example.com'}
                />
              </Field>
              <Field label="Preferred Page">
                <select className="form-select" value={preferredPage} onChange={e => setPreferredPage(e.target.value)}>
                  <option value="DIRECTOR_PANEL">Management Control Center</option>
                  <option value="DASHBOARD">Dashboard</option>
                  <option value="EMPLOYEES">Employees</option>
                  <option value="MATERIALS">Materials</option>
                  <option value="CATEGORIES">Categories</option>
                  <option value="SUPPLIERS">Suppliers</option>
                  <option value="USER_AUDIT">User Audit</option>
                  <option value="WAREHOUSES">Warehouses</option>
                  <option value="REPORTS">Reports</option>
                </select>
              </Field>
              <Field label="Timezone">
                <select className="form-select" value={settings.timezone} onChange={e => set('timezone', e.target.value)}>
                  {['UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+5:30', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC-5', 'UTC-8'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
            </Section>
          )}

          {/* ── Currency ── */}
          {activeSection === 'currency' && (
            <Section icon={DollarSign} title="Currency & Formatting" color="#10b981">
              <Field label="Currency Code">
                <select className="form-select" value={settings.currency} onChange={e => {
                  const map = { USD: '$', EUR: '€', GBP: '£', ETB: 'Br', KES: 'KSh', NGN: '₦', GHS: 'GH₵', ZAR: 'R' };
                  set('currency', e.target.value);
                  set('currency_symbol', map[e.target.value] || e.target.value);
                }}>
                  {[['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['ETB', 'Ethiopian Birr'], ['KES', 'Kenyan Shilling'], ['NGN', 'Nigerian Naira'], ['GHS', 'Ghanaian Cedi'], ['ZAR', 'South African Rand']].map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency Symbol">
                <input className="form-input" value={settings.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} placeholder="$" maxLength={5} />
              </Field>
              <Field label="Date Format">
                <select className="form-select" value={settings.date_format} onChange={e => set('date_format', e.target.value)}>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </Field>
            </Section>
          )}

          {/* ── Stock Rules ── */}
          {activeSection === 'stock_rules' && (
            <Section icon={Bell} title="📦 Stock Rules & Automation" color="#f59e0b">
              <Field label="Low Stock Alert Threshold">
                <input className="form-input" type="number" min="0" value={settings.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} />
              </Field>
              <Field label="Out-of-Stock Threshold">
                <input className="form-input" type="number" min="0" value={settings.out_of_stock_threshold} onChange={e => set('out_of_stock_threshold', e.target.value)} />
              </Field>
              <Field label="Allow Negative Stock" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  {[['false', 'No — Block issue when stock goes below 0'], ['true', 'Yes — Allow negative stock count']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings.allow_negative_stock === val ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="radio" name="allow_negative_stock" value={val} checked={settings.allow_negative_stock === val} onChange={() => set('allow_negative_stock', val)} style={{ accentColor: '#6366f1' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Stock Adjustment Workflow Controls" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['require_reason_stock_adjust', 'Require written reason for physical stock adjustment'],
                    ['require_approval_stock_adjust', 'Require Manager approval for stock adjustment'],
                    ['require_approval_stock_out', 'Require Manager approval for Stock Out'],
                    ['auto_low_stock_alerts', 'Trigger automatic low-stock notifications'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#f59e0b', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Product & Inventory Tracking Attributes" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['track_damaged_products', 'Track damaged products'],
                    ['track_expired_products', 'Track expired products'],
                    ['track_batch_numbers', 'Track batch / lot numbers'],
                    ['track_expiry_dates', 'Track material expiry dates'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#f59e0b', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {/* ── Session / Security ── */}
          {activeSection === 'security' && (
            <Section icon={ShieldAlert} title="🔐 Session & Security Controls" color="#ef4444">
              <Field label="JWT Session Timeout (hours)">
                <select className="form-select" value={settings.session_timeout} onChange={e => set('session_timeout', e.target.value)}>
                  {['1', '2', '4', '8', '12', '24', '48'].map(h => (
                    <option key={h} value={h}>{h} hour{h !== '1' ? 's' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Maximum Failed Login Attempts">
                <input className="form-input" type="number" min="1" max="20" value={settings.max_login_attempts} onChange={e => set('max_login_attempts', e.target.value)} />
              </Field>
              <Field label="Account Lockout Duration (minutes)">
                <input className="form-input" type="number" min="5" max="1440" value={settings.account_lockout_duration} onChange={e => set('account_lockout_duration', e.target.value)} />
              </Field>
              <Field label="Security & Activity Tracking Controls" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['two_factor_auth', 'Enable Two-Factor Authentication (2FA)'],
                    ['multiple_session_control', 'Restrict concurrent multi-device logins'],
                    ['login_activity_tracking', 'Log successful login activity'],
                    ['failed_login_tracking', 'Log failed login attempts'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#ef4444', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {/* ── Password Policy ── */}
          {activeSection === 'password' && (
            <Section icon={KeyRound} title="🔑 Password Policy" color="#8b5cf6">
              <Field label="Minimum Password Length">
                <input className="form-input" type="number" min="4" max="32" value={settings.pwd_min_length} onChange={e => set('pwd_min_length', e.target.value)} />
              </Field>
              <Field label="Password Expiry (days)">
                <input className="form-input" type="number" min="0" max="365" value={settings.pwd_expiry_days} onChange={e => set('pwd_expiry_days', e.target.value)} />
              </Field>
              <Field label="Password History Limit (prevent reused)">
                <input className="form-input" type="number" min="0" max="20" value={settings.pwd_history_limit} onChange={e => set('pwd_history_limit', e.target.value)} />
              </Field>
              <Field label="Complexity Requirements" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['pwd_require_uppercase', 'Require uppercase letter (A–Z)'],
                    ['pwd_require_lowercase', 'Require lowercase letter (a–z)'],
                    ['pwd_require_number', 'Require number (0–9)'],
                    ['pwd_require_special', 'Require special character (!@#$…)'],
                    ['pwd_prevent_reused', 'Prevent reuse of recent passwords'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#8b5cf6', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            </Section>
          )}

          {/* ── Receipt & Invoice ── */}
          {activeSection === 'receipts' && (
            <Section icon={Database} title="🧾 Receipt & Invoice Setup" color="#0284c7">
              <Field label="Receipt Prefix">
                <input className="form-input" value={settings.receipt_prefix} onChange={e => set('receipt_prefix', e.target.value)} placeholder="REC-" />
              </Field>
              <Field label="Invoice Prefix">
                <input className="form-input" value={settings.invoice_prefix} onChange={e => set('invoice_prefix', e.target.value)} placeholder="INV-" />
              </Field>
              <Field label="Next Invoice Sequence #">
                <input className="form-input" type="number" value={settings.next_invoice_num} onChange={e => set('next_invoice_num', e.target.value)} />
              </Field>
              <Field label="Tax Identification Number">
                <input className="form-input" value={settings.tax_number} onChange={e => set('tax_number', e.target.value)} placeholder="TAX-998822" />
              </Field>
              <Field label="Default Tax Rate (%)">
                <input className="form-input" type="number" min="0" max="100" value={settings.tax_rate} onChange={e => set('tax_rate', e.target.value)} />
              </Field>
              <Field label="Print Page Format">
                <select className="form-select" value={settings.print_format} onChange={e => set('print_format', e.target.value)}>
                  <option value="A4">Standard A4 Sheet</option>
                  <option value="A5">A5 Compact Sheet</option>
                  <option value="Thermal">80mm Thermal Receipt</option>
                </select>
              </Field>
              <Field label="Receipt & Invoice Display Fields" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['show_logo_on_receipt', 'Show organization logo on receipts & invoices'],
                    ['show_store_address', 'Show store address'],
                    ['show_cashier_name', 'Show storekeeper name'],
                    ['show_tax_number', 'Display Tax ID on invoice header'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#0284c7', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Receipt Footer Note" span={2}>
                <input className="form-input" value={settings.receipt_footer} onChange={e => set('receipt_footer', e.target.value)} placeholder="Thank you for visiting!" />
              </Field>
              <Field label="Invoice Footer Note" span={2}>
                <input className="form-input" value={settings.invoice_footer} onChange={e => set('invoice_footer', e.target.value)} placeholder="Payment due within 30 days." />
              </Field>
            </Section>
          )}

          {/* ── Notifications ── */}
          {activeSection === 'notifications' && (
            <Section icon={Bell} title="🔔 Notification Triggers & Channels" color="#ec4899">
              <Field label="Active Channels" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {[
                    ['notify_in_app_channel', 'Enable In-App Header Bell Alerts'],
                    ['notify_email_channel', 'Enable Automatic Email Notifications'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#ec4899', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Trigger Preferences" span={2}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[
                    ['notify_low_stock', 'Low stock alerts'],
                    ['notify_out_of_stock', 'Out of stock alerts'],
                    ['notify_expiry', 'Product expiry alerts'],
                    ['notify_orders', 'Purchase Order updates'],
                    ['notify_security', 'Security & account lockout alerts'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: settings[key] === 'true' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={settings[key] === 'true'} onChange={e => set(key, e.target.checked ? 'true' : 'false')} style={{ accentColor: '#ec4899', width: '15px', height: '15px' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Test Email Notification Dispatch" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        const res = await apiFetch('/notifications/test-email', { method: 'POST', body: JSON.stringify({ email: settings.system_email || currentUser?.email }) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed sending test email');
                        alert(data.message || 'Test email notification dispatched successfully!');
                      } catch (err) {
                        alert(`Email error: ${err.message}`);
                      }
                    }}
                  >
                    <Mail size={16} /> Dispatch Test Email Notification
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Sends a test notification to <strong>{settings.system_email || currentUser?.email || 'admin email'}</strong>
                  </span>
                </div>
              </Field>
            </Section>
          )}

          {/* ── Help & About ── */}
          {activeSection === 'about' && (
            <Section icon={HelpCircle} title="❓ System Information & Help" color="#6366f1">
              <Field label="System Details" span={2}>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div><strong>System Name:</strong> Store Management System</div>
                  <div><strong>Version:</strong> v2.5.0</div>
                  <div><strong>Build Number:</strong> 2026.08.20-PROD</div>
                  <div><strong>Database Status:</strong> Connected &amp; Synchronized</div>
                </div>
              </Field>
              <Field label="Documentation & Support Links" span={2}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <a href="#guide" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); alert("System User Guide: Navigate through menu items for full operational instructions."); }}>User Guide</a>
                  <a href="#docs" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); alert("System API Documentation v2.5 available under /api/docs."); }}>Documentation</a>
                  <a href="#privacy" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: All data is stored locally in secured database."); }}>Privacy Policy</a>
                  <a href="#terms" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); alert("Terms & Conditions: Enterprise Store Management License v2.5."); }}>Terms &amp; Conditions</a>
                </div>
              </Field>
            </Section>
          )}

          {activeSection === 'backup' && (
            <Section icon={Database} title="Backup & Data" color="#0ea5e9">
              <Field label="JSON Data Export" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Export current database records for safekeeping.</span>
                  <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={backupBusy}>
                    <Download size={15} /> Export Data
                  </button>
                </div>
              </Field>
              <Field label="SQL Database Backup" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create a server-side backup for download or restore.</span>
                  <button type="button" className="btn btn-primary" onClick={handleCreateBackup} disabled={backupBusy}>
                    <Database size={15} /> Create Backup
                  </button>
                </div>
              </Field>
              <Field label="Available Backups" span={2}>
                {backups.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No backups are available.</p>
                ) : backups.map(backup => (
                  <div key={backup.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{backup.file_name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{backup.created_at ? new Date(backup.created_at).toLocaleString() : 'Date unavailable'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadBackup(backup)} disabled={backupBusy}><Download size={13} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(backup)} disabled={backupBusy}>Restore</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDeleteBackup(backup)} disabled={backupBusy}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </Field>
            </Section>
          )}

          {/* Bottom save bar */}
          <div className="settings-save-all-bar">
            {isDirty && (
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={saving} style={{ marginRight: '10px' }}>
                <RotateCcw size={15} /> Discard Changes
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !isDirty}
            >
              <Save size={15} /> {saving ? 'Saving…' : 'Save All Settings'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
