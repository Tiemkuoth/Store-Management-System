import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, KeyRound, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import PasswordResetPage from './PasswordResetPage';

const API_BASE = 'http://localhost:5000/api';

export default function LoginModal({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /* screen: 'login' | 'forgot' | 'forceChange' */
  const [screen, setScreen] = useState('login');

  /* force-change state */
  const [userId, setUserId] = useState(null);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    onLogin(username, password, (err, meta) => {
      setLoading(false);
      if (meta?.requirePasswordChange) {
        setUserId(meta.userId);
        setCurrentPwd(password);
        setScreen('forceChange');
        setError('');
      } else if (err) {
        setError(err);
      }
    });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPwd !== confirmPwd) return setError('Passwords do not match.');
    if (newPwd.length < 6) return setError('Password must be at least 6 characters.');
    setChanging(true);
    try {
      const res = await fetch(`${API_BASE}/auth/force-change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, current_password: currentPwd, new_password: newPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || 'Failed to change password.'); setChanging(false); return; }
      setChanged(true); setChanging(false);
      setTimeout(() => onLogin(username, newPwd, (err) => { if (err) setError(err); }), 1400);
    } catch (ex) { setError(ex.message || 'Server unreachable.'); setChanging(false); }
  };

  /* ── forgot password screen ── */
  if (screen === 'forgot') {
    return <PasswordResetPage onBack={() => { setScreen('login'); setError(''); }} />;
  }

  /* ── force change screen ── */
  if (screen === 'forceChange') {
    return (
      <div className="lp-shell">
        <div className="lp-card" style={{ gridTemplateColumns: '1fr', maxWidth: 440 }}>
          <div className="lp-form-panel">

            <div className="lp-header-block">
              <div className="lp-icon-badge lp-icon-badge--amber">
                <KeyRound size={24} />
              </div>
              <h2 className="lp-title">Set a new password</h2>
              <p className="lp-subtitle">Your account requires a password change before you can sign in.</p>
            </div>

            {changed ? (
              <div className="lp-success">
                <CheckCircle2 size={38} color="#10b981" />
                <span>Password changed! Signing you in…</span>
              </div>
            ) : (
              <>
                {error && <div className="lp-error">{error}</div>}

                <form onSubmit={handleChangePassword} className="lp-form">
                  <div className="lp-field">
                    <label className="lp-label">New password</label>
                    <div className="lp-input-wrap">
                      <Lock size={16} className="lp-input-icon" />
                      <input type={showNew ? 'text' : 'password'} className="lp-input lp-input--icon" placeholder="Min. 6 characters"
                        value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={6} />
                      <button type="button" className="lp-eye" onClick={() => setShowNew(v => !v)}>
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="lp-field">
                    <label className="lp-label">Confirm password</label>
                    <div className="lp-input-wrap">
                      <Lock size={16} className="lp-input-icon" />
                      <input type={showConfirm ? 'text' : 'password'} className="lp-input lp-input--icon" placeholder="Repeat password"
                        value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                      <button type="button" className="lp-eye" onClick={() => setShowConfirm(v => !v)}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="lp-submit" disabled={changing}>
                    {changing ? 'Saving…' : 'Set password & sign in'}
                    {!changing && <ArrowRight size={16} />}
                  </button>
                </form>

                <button type="button" className="lp-back" onClick={() => { setScreen('login'); setError(''); }}>
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── main sign-in ── */
  return (
    <div className="lp-shell">
      <div className="lp-card">

        {/* ── Left brand panel ── */}
        <div className="lp-brand">
          {/* Animated background elements */}
          <div className="lp-orb lp-orb--1" />
          <div className="lp-orb lp-orb--2" />
          <div className="lp-orb lp-orb--3" />
          <div className="lp-glow-ring" />

          {/* Content */}
          <div className="lp-brand-content">
            <div className="lp-brand-body">
              <h1 className="lp-brand-title">
                Store Management<br />systems.
              </h1>
              <p className="lp-brand-desc">
                Inventory, people, suppliers & decisions — all in one place.
              </p>
            </div>

          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="lp-form-panel">

          {/* Logo + heading */}
          <div className="lp-header-block">
            <div className="lp-logo-wrap">
              <img src="/logo.jpg" alt="Store Management" />
            </div>
            <h2 className="lp-title">Welcome back</h2>
            <p className="lp-subtitle">Sign in to your account to continue</p>
          </div>

          {error && <div className="lp-error">{error}</div>}

          <form onSubmit={handleSubmit} className="lp-form">

            <div className="lp-field">
              <label className="lp-label">Username</label>
              <div className="lp-input-wrap">
                <User size={16} className="lp-input-icon" />
                <input
                  type="text"
                  className="lp-input lp-input--icon"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="lp-field">
              <div className="lp-field-row">
                <label className="lp-label">Password</label>
                <button type="button" className="lp-forgot" onClick={() => { setError(''); setScreen('forgot'); }}>
                  Forgot?
                </button>
              </div>
              <div className="lp-input-wrap">
                <Lock size={16} className="lp-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input lp-input--icon"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="lp-eye" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="lp-remember">
              <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(v => !v)} />
              <span>Remember me</span>
            </label>

            <button type="submit" className="lp-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lp-spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>

          </form>

          <div className="lp-secure">
            <ShieldCheck size={13} />
            <span>Secured with 256-bit encryption</span>
          </div>
        </div>

      </div>
    </div>
  );
}
