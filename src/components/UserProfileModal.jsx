import React, { useEffect, useRef, useState } from 'react';
import {
  Lock, Eye, EyeOff, Save, X, CheckCircle, Camera, User, Mail, Shield,
  AlertCircle, Edit3, Loader, HelpCircle, Calendar, Clock, Crown, ShieldCheck, ArrowRight,
  FileText, Upload, Trash2, Download, File
} from 'lucide-react';
import apiFetch from '../utils/apiFetch';

export default function UserProfileModal({ currentUser, onClose, onProfileUpdated }) {
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const [tab, setTab] = useState('ACCOUNT');
  const [profileData, setProfileData] = useState({
    full_name: currentUser.full_name || '',
    email: currentUser.email || '',
    phone_contact: currentUser.phone_contact || '',
    department: currentUser.department || '',
    avatar_url: currentUser.avatar_url || '',
    document_url: currentUser.document_url || '',
  });
  const [previewDoc, setPreviewDoc] = useState(null);   // { dataUrl, name, size, type }
  const [docToDelete, setDocToDelete] = useState(false); // user clicked "Remove"
  const [pwdData, setPwdData] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [usernameData, setUsernameData] = useState({ new_username: '', current_password: '' });
  const [showPasswordUsername, setShowPasswordUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);

  const hasProfileChanges =
    profileData.full_name !== (currentUser.full_name || '') ||
    profileData.email !== (currentUser.email || '') ||
    profileData.phone_contact !== (currentUser.phone_contact || '') ||
    profileData.department !== (currentUser.department || '') ||
    previewAvatar !== null ||
    previewDoc !== null ||
    docToDelete;

  const getPasswordStrength = (value) => {
    if (!value) return '';
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (score <= 1) return 'Weak';
    if (score === 2) return 'Fair';
    return 'Strong';
  };

  useEffect(() => {
    setProfileData({
      full_name: currentUser.full_name || '',
      email: currentUser.email || '',
      phone_contact: currentUser.phone_contact || '',
      department: currentUser.department || '',
      avatar_url: currentUser.avatar_url || '',
      document_url: currentUser.document_url || '',
    });
    setPreviewDoc(null);
    setDocToDelete(false);
  }, [currentUser]);

  const flash = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const processImageFile = async (file) => {
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type.toLowerCase())) {
      flash('Only JPEG, PNG, WebP, or GIF images are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('Image must be under 5 MB.', 'error');
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (ev) => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      setPreviewAvatar(dataUrl);
      setProfileData(p => ({ ...p, avatar_url: dataUrl }));
      flash('Photo preview ready. Click "Save Changes" to apply.');
    } catch {
      flash('Could not process photo.', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => processImageFile(e.target.files?.[0]);

  const handleDocumentSelect = (e) => {
    const file = e.target.files?.[0];
    if (docInputRef.current) docInputRef.current.value = '';
    if (!file) return;

    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      flash('Unsupported file type. Accepted: PDF, DOC, DOCX, JPEG, PNG, WebP.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      flash('Document must be under 10 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => flash('Could not read file.', 'error');
    reader.onload = (ev) => {
      setPreviewDoc({ dataUrl: ev.target.result, name: file.name, size: file.size, type: file.type });
      setDocToDelete(false);
      flash('Document ready. Click "Save Changes" to upload.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDocument = () => {
    setPreviewDoc(null);
    setDocToDelete(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!hasProfileChanges) {
      flash('No changes to save', 'info');
      return;
    }
    if (!profileData.full_name?.trim()) {
      flash('Full name is required', 'error');
      return;
    }
    setLoading(true);
    try {
      // 1. Upload avatar if changed
      let finalAvatarUrl = profileData.avatar_url;
      if (previewAvatar) {
        const upRes = await apiFetch('/auth/upload-avatar', {
          method: 'POST',
          body: JSON.stringify({ avatar_data_url: previewAvatar }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData?.error || 'Failed to upload photo');
        finalAvatarUrl = upData.avatar_url || previewAvatar;
      }

      // 2. Handle document: upload new, delete existing, or keep current
      let finalDocumentUrl = profileData.document_url || null;
      if (previewDoc) {
        const docRes = await apiFetch('/auth/upload-document', {
          method: 'POST',
          body: JSON.stringify({ document_data: previewDoc.dataUrl, filename: previewDoc.name }),
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData?.error || 'Failed to upload document');
        finalDocumentUrl = docData.document_url;
      } else if (docToDelete) {
        await apiFetch('/auth/delete-document', { method: 'DELETE' });
        finalDocumentUrl = null;
      }

      // 3. Save all profile fields together
      const res = await apiFetch('/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: profileData.full_name.trim(),
          email: profileData.email,
          phone_contact: profileData.phone_contact,
          department: profileData.department,
          avatar_url: finalAvatarUrl || null,
          document_url: finalDocumentUrl || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');

      const updatedUser = {
        ...currentUser,
        full_name: profileData.full_name.trim(),
        email: profileData.email,
        phone_contact: profileData.phone_contact,
        department: profileData.department,
        avatar_url: finalAvatarUrl || currentUser.avatar_url || null,
        document_url: finalDocumentUrl,
      };
      setPreviewAvatar(null);
      setPreviewDoc(null);
      setDocToDelete(false);
      setProfileData(p => ({ ...p, avatar_url: updatedUser.avatar_url, document_url: updatedUser.document_url || '' }));
      localStorage.setItem('current_user', JSON.stringify(updatedUser));
      onProfileUpdated?.(updatedUser);
      flash('Profile saved successfully!');
    } catch (err) {
      flash(err.message || 'Unable to save profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdData.next !== pwdData.confirm) {
      flash('New passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: pwdData.current,
          new_password: pwdData.next,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Password change failed');
      setPwdData({ current: '', next: '', confirm: '' });
      flash('Password changed successfully');
    } catch (err) {
      flash(err.message || 'Unable to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setLoading(true);
    const trimmedUsername = usernameData.new_username.trim();

    try {
      if (!trimmedUsername) return flash('Please enter a new username', 'error');
      if (!usernameData.current_password) return flash('Please enter your password', 'error');
      if (trimmedUsername === currentUser.username) return flash('Username must be different', 'error');

      const res = await apiFetch('/auth/change-username', {
        method: 'PUT',
        body: JSON.stringify({
          new_username: trimmedUsername,
          current_password: usernameData.current_password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        flash(data?.error || 'Failed to change username', 'error');
      } else {
        flash('Username changed! Please log in again.');
        setUsernameData({ new_username: '', current_password: '' });
      }
    } catch (err) {
      flash(err.message || 'Failed to change username', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formattedMemberSince = currentUser.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Jan 12, 2024';

  const formattedLastLogin = currentUser.last_login
    ? new Date(currentUser.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'May 21, 2025 • 10:45 AM';

  const accountIdFormatted = `#${currentUser.role ? currentUser.role.slice(0, 3).toUpperCase() : 'USR'}-${currentUser.id || 1024}`;

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.container}>
        {/* Toast Alert */}
        {toast && (
          <div style={{ ...styles.toast, background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4', borderColor: toast.type === 'error' ? '#fecaca' : '#bbf7d0', color: toast.type === 'error' ? '#991b1b' : '#166534' }}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Modal Close Icon */}
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">
          <X size={18} color="#64748b" />
        </button>

        {/* ── TOP HEADER PANEL ── */}
        <div style={styles.headerRow}>
          {/* Avatar with Camera badge */}
          <div style={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()} title="Click to change photo">
            <img
              src={profileData.avatar_url || currentUser.avatar_url || '/default-avatar.jpg'}
              alt={currentUser.username}
              style={styles.avatarImg}
              onError={(e) => { e.target.src = '/default-avatar.jpg'; }}
            />
            <button style={styles.cameraBadge} type="button">
              <Camera size={14} color="#fff" />
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
          </div>

          {/* User Info & Badges */}
          <div style={styles.headerInfo}>
            <div style={styles.nameBadgeRow}>
              <h1 style={styles.userName}>{profileData.full_name || currentUser.username}</h1>
              <span style={styles.roleBadge}>
                <Crown size={13} color="#6938ef" style={{ marginRight: 4 }} />
                {currentUser.role || 'Director'}
              </span>
              <span style={styles.statusBadge}>
                <i style={styles.greenDot} />
                {currentUser.status || 'Active'}
              </span>
            </div>

            <div style={styles.subMetaRow}>
              <span style={styles.metaItem}>
                <User size={14} color="#64748b" />
                <strong style={styles.metaLabel}>Username</strong>
                <span style={styles.metaValue}>@{currentUser.username}</span>
              </span>
              <span style={styles.metaItem}>
                <Mail size={14} color="#64748b" />
                <strong style={styles.metaLabel}>Email</strong>
                <span style={styles.metaValue}>{currentUser.email || 'superadmin@store.org'}</span>
              </span>
            </div>
          </div>

          {/* Top Right Action Button */}
          <button style={styles.changePhotoBtn} onClick={() => fileInputRef.current?.click()} type="button">
            <Camera size={16} /> Change Photo
          </button>
        </div>

        {/* ── MAIN THREE-COLUMN BODY ── */}
        <div style={styles.mainGrid} className="upm-main-grid">
          {/* ── LEFT SIDEBAR TABS ── */}
          <div style={styles.leftSidebar} className="upm-left-sidebar">
            <div style={styles.navGroup} className="upm-nav-group">
              <button
                type="button"
                onClick={() => setTab('ACCOUNT')}
                style={{ ...styles.navItem, ...(tab === 'ACCOUNT' ? styles.navItemActive : {}) }}
              >
                <User size={17} color={tab === 'ACCOUNT' ? '#155eef' : '#64748b'} />
                Account Details
              </button>
              <button
                type="button"
                onClick={() => setTab('SECURITY')}
                style={{ ...styles.navItem, ...(tab === 'SECURITY' ? styles.navItemActive : {}) }}
              >
                <Shield size={17} color={tab === 'SECURITY' ? '#155eef' : '#64748b'} />
                Security Settings
              </button>
              <button
                type="button"
                onClick={() => setTab('USERNAME')}
                style={{ ...styles.navItem, ...(tab === 'USERNAME' ? styles.navItemActive : {}) }}
              >
                <Edit3 size={17} color={tab === 'USERNAME' ? '#155eef' : '#64748b'} />
                Change Username
              </button>
            </div>

            {/* Need Help Card */}
            <div style={styles.helpCard}>
              <div style={styles.helpIconCircle}>
                <HelpCircle size={18} color="#6938ef" />
              </div>
              <strong style={styles.helpTitle}>Need Help?</strong>
              <p style={styles.helpText}>If you need assistance managing your account.</p>
              <a href="#support" onClick={(e) => { e.preventDefault(); alert('For support, contact support@store.org'); }} style={styles.helpLink}>
                Contact Support <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* ── MIDDLE FORM PANEL ── */}
          <div style={styles.middlePanel}>
            {tab === 'ACCOUNT' && (
              <form onSubmit={handleSaveProfile} style={styles.form}>
                <div style={styles.formHeader}>
                  <div style={styles.sectionIconCircle}>
                    <User size={18} color="#155eef" />
                  </div>
                  <div>
                    <h2 style={styles.sectionTitle}>Personal Information</h2>
                    <p style={styles.sectionSubtitle}>Update your personal details and contact information.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Full Name</label>
                    <div style={styles.inputWrapper}>
                      <User size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                      <input
                        type="text"
                        value={profileData.full_name}
                        onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                        placeholder="Enter your full name"
                        style={styles.input}
                        required
                      />
                      <CheckCircle size={18} color="#12b76a" style={styles.fieldIconRight} />
                    </div>
                  </div>

                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Username</label>
                    <div style={{ ...styles.inputWrapper, background: '#f8fafc' }}>
                      <User size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                      <input
                        type="text"
                        value={currentUser.username}
                        readOnly
                        style={{ ...styles.input, color: '#344054' }}
                      />
                      <CheckCircle size={18} color="#12b76a" style={styles.fieldIconRight} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Email Address</label>
                    <div style={styles.inputWrapper}>
                      <Mail size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                        placeholder="name@company.com"
                        style={styles.input}
                        required
                      />
                      <CheckCircle size={18} color="#12b76a" style={styles.fieldIconRight} />
                    </div>
                  </div>

                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Phone Contact</label>
                    <div style={styles.inputWrapper}>
                      <input
                        type="text"
                        value={profileData.phone_contact}
                        onChange={e => setProfileData({ ...profileData, phone_contact: e.target.value })}
                        placeholder="e.g. +1 234 567 890"
                        style={{ ...styles.input, paddingLeft: 14 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Department</label>
                    <div style={styles.inputWrapper}>
                      <input
                        type="text"
                        value={profileData.department}
                        onChange={e => setProfileData({ ...profileData, department: e.target.value })}
                        placeholder="e.g. Sales, HR"
                        style={{ ...styles.input, paddingLeft: 14 }}
                      />
                    </div>
                  </div>

                  {/* Document Upload */}
                  <div style={{ ...styles.inputGroup, marginBottom: 0 }}>
                    <label style={styles.label}>Document</label>
                    <input
                      type="file"
                      ref={docInputRef}
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                      onChange={handleDocumentSelect}
                    />
                    {/* No document and not staging one */}
                    {!previewDoc && !profileData.document_url && !docToDelete && (
                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        style={styles.docUploadBtn}
                      >
                        <Upload size={15} color="#155eef" />
                        <span>Upload PDF / DOC</span>
                      </button>
                    )}
                    {/* New file staged, not yet saved */}
                    {previewDoc && (
                      <div style={styles.docPreviewRow}>
                        <FileText size={18} color="#155eef" style={{ flexShrink: 0 }} />
                        <div style={styles.docPreviewInfo}>
                          <span style={styles.docFileName}>{previewDoc.name}</span>
                          <span style={styles.docFileMeta}>{(previewDoc.size / 1024).toFixed(0)} KB — pending save</span>
                        </div>
                        <button type="button" title="Change file" onClick={() => docInputRef.current?.click()} style={styles.docActionBtn}>
                          <Upload size={14} color="#155eef" />
                        </button>
                        <button type="button" title="Remove" onClick={handleRemoveDocument} style={styles.docActionBtn}>
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                    )}
                    {/* Existing saved document */}
                    {!previewDoc && profileData.document_url && !docToDelete && (
                      <div style={styles.docPreviewRow}>
                        <File size={18} color="#10b981" style={{ flexShrink: 0 }} />
                        <div style={styles.docPreviewInfo}>
                          <span style={styles.docFileName}>{profileData.document_url.split('/').pop()}</span>
                          <span style={{ ...styles.docFileMeta, color: '#10b981' }}>Uploaded</span>
                        </div>
                        <a
                          href={`http://localhost:5000${profileData.document_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View document"
                          style={styles.docActionBtn}
                        >
                          <Download size={14} color="#155eef" />
                        </a>
                        <button type="button" title="Replace" onClick={() => docInputRef.current?.click()} style={styles.docActionBtn}>
                          <Upload size={14} color="#155eef" />
                        </button>
                        <button type="button" title="Remove" onClick={handleRemoveDocument} style={styles.docActionBtn}>
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                    )}
                    {/* Marked for deletion — show undo option */}
                    {docToDelete && (
                      <div style={{ ...styles.docPreviewRow, opacity: 0.6 }}>
                        <Trash2 size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span style={{ ...styles.docFileName, color: '#ef4444', fontSize: 12 }}>Will be removed on save</span>
                        <button
                          type="button"
                          style={styles.docActionBtn}
                          title="Undo"
                          onClick={() => { setDocToDelete(false); setProfileData(p => ({ ...p, document_url: currentUser.document_url || '' })); }}
                        >
                          <X size={14} color="#64748b" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.infoBanner}>
                  <span style={styles.infoBannerIcon}>i</span>
                  <span>Use the "Change Username" tab to change your username.</span>
                </div>

                <div style={styles.formActions}>
                  <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
                  <button type="submit" style={styles.saveBtn} disabled={loading || !hasProfileChanges}>
                    <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'SECURITY' && (
              <form onSubmit={handleChangePassword} style={styles.form}>
                <div style={styles.formHeader}>
                  <div style={styles.sectionIconCircle}>
                    <Shield size={18} color="#155eef" />
                  </div>
                  <div>
                    <h2 style={styles.sectionTitle}>Security Settings</h2>
                    <p style={styles.sectionSubtitle}>Ensure your account is using a strong password.</p>
                  </div>
                </div>

                {/* Current Password */}
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="#98a2b3" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={pwdData.current}
                      onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                      placeholder="Enter current password"
                      className="form-input"
                      style={{ paddingLeft: 38, paddingRight: 40 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}
                      aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="#98a2b3" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={showNext ? 'text' : 'password'}
                      value={pwdData.next}
                      onChange={e => setPwdData({ ...pwdData, next: e.target.value })}
                      placeholder="Enter new password"
                      className="form-input"
                      style={{ paddingLeft: 38, paddingRight: 40 }}
                      minLength={4}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNext(!showNext)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}
                      aria-label={showNext ? 'Hide password' : 'Show password'}
                    >
                      {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {pwdData.next && (() => {
                    const strength = getPasswordStrength(pwdData.next);
                    const levels = { Weak: 1, Fair: 2, Strong: 3 };
                    const level = levels[strength] || 0;
                    const colors = { Weak: '#ef4444', Fair: '#f59e0b', Strong: '#10b981' };
                    const color = colors[strength] || '#e2e8f0';
                    return (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[1, 2, 3].map(i => (
                            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= level ? color : '#e2e8f0', transition: 'background 0.2s' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color }}>
                          {strength} password
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Confirm Password */}
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="#98a2b3" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={pwdData.confirm}
                      onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                      placeholder="Confirm new password"
                      className="form-input"
                      style={{
                        paddingLeft: 38,
                        paddingRight: 40,
                        ...(pwdData.confirm && pwdData.next !== pwdData.confirm
                          ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                          : pwdData.confirm && pwdData.next === pwdData.confirm
                            ? { borderColor: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.12)' }
                            : {}),
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pwdData.confirm && pwdData.next !== pwdData.confirm && (
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} /> Passwords do not match
                    </span>
                  )}
                  {pwdData.confirm && pwdData.next === pwdData.confirm && (
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} /> Passwords match
                    </span>
                  )}
                </div>

                <div style={styles.formActions}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={loading || !pwdData.current || !pwdData.next || pwdData.next !== pwdData.confirm}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Lock size={14} /> {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'USERNAME' && (
              <form onSubmit={handleChangeUsername} style={styles.form}>
                <div style={styles.formHeader}>
                  <div style={styles.sectionIconCircle}>
                    <Edit3 size={18} color="#155eef" />
                  </div>
                  <div>
                    <h2 style={styles.sectionTitle}>Change Username</h2>
                    <p style={styles.sectionSubtitle}>Choose a new username for your account.</p>
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Current Username</label>
                  <div style={{ ...styles.inputWrapper, background: '#f8fafc' }}>
                    <User size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                    <input type="text" value={currentUser.username} readOnly style={styles.input} />
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>New Username</label>
                  <div style={styles.inputWrapper}>
                    <Edit3 size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                    <input
                      type="text"
                      value={usernameData.new_username}
                      onChange={e => setUsernameData({ ...usernameData, new_username: e.target.value })}
                      placeholder="Enter new username"
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Current Password (verification)</label>
                  <div style={styles.inputWrapper}>
                    <Lock size={16} color="#98a2b3" style={styles.fieldIconLeft} />
                    <input
                      type={showPasswordUsername ? 'text' : 'password'}
                      value={usernameData.current_password}
                      onChange={e => setUsernameData({ ...usernameData, current_password: e.target.value })}
                      placeholder="Enter password"
                      style={styles.input}
                      required
                    />
                    <button type="button" style={styles.toggleShowBtn} onClick={() => setShowPasswordUsername(!showPasswordUsername)}>
                      {showPasswordUsername ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                    </button>
                  </div>
                </div>

                <div style={styles.formActions}>
                  <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
                  <button type="submit" style={styles.saveBtn} disabled={loading || !usernameData.new_username.trim() || !usernameData.current_password}>
                    {loading ? <Loader size={16} className="animate-spin" /> : <Edit3 size={16} />}
                    {loading ? 'Changing...' : 'Change Username'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT PANEL: ACCOUNT OVERVIEW ── */}
          <div style={styles.rightOverview} className="upm-right-column">
            <div style={styles.overviewCard}>
              <div style={styles.overviewHeader}>
                <div style={styles.overviewShieldIcon}>
                  <ShieldCheck size={26} color="#155eef" />
                </div>
                <h3 style={styles.overviewTitle}>Account Overview</h3>
                <p style={styles.overviewSubtitle}>Key information about your account</p>
              </div>

              <div style={styles.overviewList}>
                <div style={styles.overviewRow}>
                  <User size={18} color="#64748b" />
                  <span style={styles.rowLabel}>Status</span>
                  <span style={styles.statusActive}>
                    <i style={styles.greenDot} /> Active
                  </span>
                </div>

                <div style={styles.overviewRow}>
                  <Crown size={18} color="#6938ef" />
                  <span style={styles.rowLabel}>Role</span>
                  <span style={styles.rolePurple}>{currentUser.role || 'Director'}</span>
                </div>

                <div style={styles.overviewRow}>
                  <Calendar size={18} color="#64748b" />
                  <span style={styles.rowLabel}>Member Since</span>
                  <span style={styles.rowValue}>{formattedMemberSince}</span>
                </div>

                <div style={styles.overviewRow}>
                  <Clock size={18} color="#64748b" />
                  <span style={styles.rowLabel}>Last Login</span>
                  <span style={styles.rowValueSmall}>{formattedLastLogin}</span>
                </div>

                <div style={styles.overviewRow}>
                  <User size={18} color="#64748b" />
                  <span style={styles.rowLabel}>Account ID</span>
                  <strong style={styles.rowValueBold}>{accountIdFormatted}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(16, 24, 40, 0.58)',
    backdropFilter: 'blur(4px)',
    zIndex: 1400,
    display: 'grid',
    placeItems: 'center',
    padding: 12
  },
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '900px',
    maxHeight: 'min(92vh, 780px)',
    overflowY: 'auto',
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 50px -12px rgba(16, 24, 40, 0.22)',
    display: 'flex',
    flexDirection: 'column'
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    zIndex: 10
  },
  toast: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 14px',
    borderRadius: 99,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 600,
    zIndex: 100,
    boxShadow: '0 6px 16px rgba(0,0,0,0.08)'
  },

  /* Top Header Row */
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: '#ffffff',
    flexWrap: 'wrap'
  },
  avatarWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
    cursor: 'pointer',
    flexShrink: 0
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #f8fafc',
    boxShadow: '0 3px 8px rgba(0,0,0,0.08)'
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#155eef',
    border: '2px solid #ffffff',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(21,94,239,0.3)'
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
    minWidth: 'min(100%, 220px)'
  },
  nameBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  userName: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#101828',
    letterSpacing: '-0.3px'
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: 99,
    background: '#f4f0ff',
    color: '#6938ef',
    fontSize: 11,
    fontWeight: 700
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 9px',
    borderRadius: 99,
    background: '#ecfdf3',
    color: '#12b76a',
    fontSize: 11,
    fontWeight: 700
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#12b76a'
  },
  subMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    color: '#475467',
    fontSize: 12
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5
  },
  metaLabel: {
    color: '#64748b',
    fontWeight: 500
  },
  metaValue: {
    color: '#101828',
    fontWeight: 700
  },
  changePhotoBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 13px',
    borderRadius: 8,
    border: '1px solid #155eef',
    color: '#155eef',
    background: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: 0,
    transition: 'all 0.18s ease'
  },

  /* 3-Column Main Grid */
  mainGrid: {
    minHeight: 380,
    background: '#ffffff'
  },

  /* Left Sidebar */
  leftSidebar: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px 12px',
    borderRight: '1px solid #f1f5f9',
    background: '#ffffff'
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  navItem: {
    appearance: 'none',
    width: '100%',
    border: 'none',
    borderLeft: '3px solid transparent',
    borderRadius: '0 6px 6px 0',
    padding: '9px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: 'transparent',
    color: '#475467',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.18s ease'
  },
  navItemActive: {
    borderLeftColor: '#155eef',
    background: '#eff4ff',
    color: '#155eef',
    fontWeight: 700
  },

  /* Need Help Card */
  helpCard: {
    background: '#f8fafc',
    border: '1px solid #f1f5f9',
    borderRadius: 10,
    padding: 12,
    marginTop: 14
  },
  helpIconCircle: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#f4f0ff',
    display: 'grid',
    placeItems: 'center',
    marginBottom: 8
  },
  helpTitle: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#101828',
    marginBottom: 3
  },
  helpText: {
    margin: 0,
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.4
  },
  helpLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    color: '#155eef',
    fontSize: 11,
    fontWeight: 700,
    textDecoration: 'none'
  },

  /* Middle Form Panel */
  middlePanel: {
    padding: '16px 20px',
    borderRight: '1px solid #f1f5f9'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 13
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#eff4ff',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#101828'
  },
  sectionSubtitle: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#64748b'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#344054'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%'
  },
  fieldIconLeft: {
    position: 'absolute',
    left: 12
  },
  fieldIconRight: {
    position: 'absolute',
    right: 12
  },
  input: {
    width: '100%',
    height: 38,
    padding: '0 36px 0 36px',
    border: '1px solid #d0d5dd',
    borderRadius: 8,
    background: '#ffffff',
    color: '#101828',
    fontSize: 13,
    outline: 'none'
  },
  toggleShowBtn: {
    position: 'absolute',
    right: 10,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer'
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 13px',
    borderRadius: 8,
    background: '#eff4ff',
    color: '#155eef',
    fontSize: 11,
    fontWeight: 500,
    marginTop: 2
  },
  infoBannerIcon: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#155eef',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0
  },
  strengthText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10
  },
  cancelBtn: {
    padding: '7px 16px',
    borderRadius: 7,
    border: '1px solid #d0d5dd',
    background: '#ffffff',
    color: '#344054',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    borderRadius: 7,
    border: 'none',
    background: '#155eef',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },

  /* Right Overview Column */
  rightOverview: {
    padding: '16px 14px',
    background: '#ffffff'
  },
  overviewCard: {
    border: '1px solid #eaecf0',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#ffffff'
  },
  overviewHeader: {
    background: 'linear-gradient(180deg, #eef4ff 0%, #ffffff 100%)',
    padding: '16px 14px 12px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  overviewShieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#ffffff',
    boxShadow: '0 3px 10px rgba(21,94,239,0.12)',
    display: 'grid',
    placeItems: 'center',
    marginBottom: 8
  },
  overviewTitle: {
    margin: '0 0 3px',
    fontSize: 13,
    fontWeight: 700,
    color: '#101828'
  },
  overviewSubtitle: {
    margin: 0,
    fontSize: 11,
    color: '#64748b'
  },
  overviewList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 14px 14px'
  },
  overviewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 12
  },
  rowLabel: {
    color: '#64748b',
    fontWeight: 500
  },
  statusActive: {
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: '#12b76a',
    fontWeight: 700,
    fontSize: 12
  },
  rolePurple: {
    marginLeft: 'auto',
    color: '#6938ef',
    fontWeight: 700,
    fontSize: 12
  },
  rowValue: {
    marginLeft: 'auto',
    color: '#101828',
    fontWeight: 600,
    fontSize: 12
  },
  rowValueSmall: {
    marginLeft: 'auto',
    color: '#344054',
    fontSize: 11,
    fontWeight: 500
  },
  rowValueBold: {
    marginLeft: 'auto',
    color: '#101828',
    fontSize: 12,
    fontWeight: 700
  },
  // ── Document upload styles ────────────────────────────────────
  docUploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 14px',
    border: '1.5px dashed #93c5fd',
    borderRadius: 8,
    background: '#eff6ff',
    color: '#155eef',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  docPreviewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#f8fafc',
    minHeight: 42,
  },
  docPreviewInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  docFileName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1e293b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docFileMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  docActionBtn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    cursor: 'pointer',
    padding: 0,
    color: '#64748b',
    textDecoration: 'none',
  },
};
