import React, { useState } from 'react';
import { Lock, Mail, KeyRound, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, Send } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function PasswordResetPage({ onBack }) {
  const [step, setStep] = useState(1); // 1: Email, 2: Verification, 3: Reset, 4: Success
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Step 1: Request password reset
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could not process request.');
        setLoading(false);
        return;
      }

      setUserEmail(email);
      setResetCode(data.development_code || '');
      setStep(2);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
      setLoading(false);
    }
  };

  // Step 2: Verify code and reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          reset_code: resetCode,
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could not reset password. Check the code and try again.');
        setLoading(false);
        return;
      }

      setStep(3);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
      setLoading(false);
    }
  };

  // Step 1: Email entry
  if (step === 1) {
    return (
      <div className="password-reset-shell">
        <div className="password-reset-orb orb-one" />
        <div className="password-reset-orb orb-two" />
        <div className="password-reset-dots dots-one" />
        <div className="password-reset-dots dots-two" />
        <div className="password-reset-card password-reset-request-card">
          <div className="password-reset-header">
            <div className="password-reset-lock"><KeyRound size={28} /></div>
            <h2>Reset Your Password</h2>
            <p>Enter your email address and we'll send you</p>
            <span>a reset code to help you access your account.</span>
            <div className="password-reset-accent"><i /></div>
          </div>

          {error && (
            <div className="password-reset-error">
              {error}
            </div>
          )}

          <form onSubmit={handleRequestReset} className="password-reset-form">
            <div className="password-reset-group">
              <label>Email Address</label>
              <div className="password-reset-input">
                <Mail className="password-reset-input-icon" size={17} />
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="password-reset-submit"
              disabled={loading}
            >
              {loading ? 'Sending reset code...' : 'Send Reset Code'} <Send size={15} />
            </button>
          </form>

          <div className="password-reset-divider"><span>OR</span></div>
          <button type="button" className="password-reset-change-email" onClick={onBack}>
            <ArrowLeft size={15} /> Back to Sign In
          </button>
          <div className="password-reset-security"><Lock size={27} /><div><strong>Security is our priority</strong><span>Your information is safe and will never be shared.</span></div><div className="security-illustration"><ShieldCheck size={24} /></div></div>
        </div>
      </div>
    );
  }

  // Step 2: Code verification and password reset
  if (step === 2) {
    return (
      <div className="password-reset-shell">
        <div className="password-reset-orb orb-one" />
        <div className="password-reset-orb orb-two" />
        <div className="password-reset-dots dots-one" />
        <div className="password-reset-dots dots-two" />
        <div className="password-reset-card">
          <div className="password-reset-header">
            <div className="password-reset-lock"><Lock size={27} /></div>
            <h2>Set New Password</h2>
            <p>We've sent a reset code to <strong>{userEmail}</strong></p>
            <span>Enter the code and create a new, strong password for your account.</span>
          </div>

          {error && (
            <div className="password-reset-error">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="password-reset-form">
            <div className="password-reset-group">
              <label>Reset Code</label>
              <div className="password-reset-input">
                <KeyRound className="password-reset-input-icon" size={16} />
                <input
                  type="text"
                  placeholder="Enter the 6-digit reset code"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  maxLength={10}
                />
                <span className="password-reset-input-suffix">123</span>
              </div>
              <small>Check your email inbox for the 6-digit code.</small>
            </div>

            <div className="password-reset-group">
              <label>New Password</label>
              <div className="password-reset-input">
                <Lock className="password-reset-input-icon" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Choose a strong password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button type="button" className="password-reset-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="password-strength"><i /><i /><i /><i /><b>Strong</b></div>
              <small className="password-hint">Use at least 8 characters with a mix of letters, numbers &amp; symbols.</small>
            </div>

            <div className="password-reset-group">
              <label>Confirm Password</label>
              <div className="password-reset-input">
                <Lock className="password-reset-input-icon" size={16} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button type="button" className="password-reset-toggle" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="password-reset-submit"
              disabled={loading}
            >
              <Lock size={15} /> {loading ? 'Resetting password...' : 'Reset Password'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="password-reset-divider"><span>or</span></div>
          <button type="button" className="password-reset-change-email" onClick={() => { setStep(1); setError(''); setResetCode(''); setNewPassword(''); setConfirmPassword(''); }}>
            <ArrowLeft size={15} /> Try a different email
          </button>
          <div className="password-reset-security"><ShieldCheck size={30} /><div><strong>Your security is our priority</strong><span>Your password is encrypted and your information is always safe with us.</span></div><div className="security-illustration"><ShieldCheck size={25} /></div></div>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (step === 3) {
    return (
      <div className="modern-auth-shell">
        <div className="modern-auth-bg" />
        <div className="modern-auth-container">
          <div className="modern-auth-card compact">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
              <CheckCircle2 size={48} color="#10b981" />
              <h2 style={{ color: '#10b981', fontSize: '20px', fontWeight: '700', textAlign: 'center' }}>Password Reset Successful!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
                Your password has been changed. You can now sign in with your new password.
              </p>
            </div>

          </div>
        </div>
      </div>
    );
  }
}
