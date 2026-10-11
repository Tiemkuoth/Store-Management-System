import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext, apiFetch } from '../contexts/AuthContext';
import { UserCheck, Users, Plus, PackageCheck, Edit2, Trash2, Search, Filter } from 'lucide-react';
import { sanitizeText } from '../utils/displayValue';

// const API_BASE = 'http://localhost:5000/api'; // removed, using relative paths

export default function EmployeeDeptManager() {
  const { employees = [], transactions = [], handleAddEmployee: onAddEmployee, fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [toast, setToast] = useState(null);

  const emptyForm = { type: 'Employee', name: '', department_name: '', position: '', contact_number: '', email: '', gender: '', status: 'Active' };
  const [formData, setFormData] = useState(emptyForm);
  const [editData, setEditData] = useState({ name: '', department_name: '', position: '', contact_number: '', email: '', gender: '' });
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const canEdit = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    const safeMsg = typeof msg === 'string' ? msg : (msg?.message || msg?.error || JSON.stringify(msg));
    setToast({ msg: safeMsg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const error = await onAddEmployee?.(formData);
    if (error) { showToast(error, 'error'); return; }
    setFormData(emptyForm);
    setShowAddModal(false);
    showToast('Recipient registered successfully');
  };

  const openEdit = (emp) => {
    setSelectedRecipient(emp);
    setEditData({ name: emp.name, department_name: emp.department_name || '', position: emp.position || '', contact_number: emp.contact_number || '', email: emp.email || '', gender: emp.gender || '', status: emp.status || 'Active' });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch(`/employees/${selectedRecipient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Update failed');
      setShowEditModal(false);
      onRefresh?.();
      showToast('Recipient updated successfully');
    } catch { showToast('Failed to update recipient', 'error'); }
  };

  const handleToggleStatus = async (emp) => {
    try {
      const nextStatus = emp.status === 'Inactive' ? 'Active' : 'Inactive';
      const response = await apiFetch(`/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: emp.name,
          department_name: emp.department_name || '',
          position: emp.position || '',
          contact_number: emp.contact_number || '',
          email: emp.email || '',
          gender: emp.gender || '',
          status: nextStatus
        })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Update failed');
      onRefresh?.();
      showToast(`Recipient status set to ${nextStatus}`);
    } catch { showToast('Failed to update status', 'error'); }
  };

  const openDelete = (emp) => { setSelectedRecipient(emp); setShowDelConfirm(true); };

  const handleDelete = async () => {
    try {
      const response = await apiFetch(`/employees/${selectedRecipient.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Delete failed');
      setShowDelConfirm(false);
      onRefresh?.();
      showToast(`"${selectedRecipient.name}" deleted`);
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleDocumentUpload = async (empId, file) => {
    if (!file) return;

    setUploadingDocId(empId);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiFetch(`/employees/${empId}/upload-document`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showToast('Document uploaded successfully');
        onRefresh?.();
      } else {
        const data = await response.json().catch(() => ({}));
        const msg = typeof data.error === 'string' ? data.error : data.error?.message || 'Upload failed';
        showToast(msg, 'error');
      }
    } catch (e) {
      showToast('Upload error: ' + e.message, 'error');
    } finally {
      setUploadingDocId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Track material issue accountability per staff or department</p>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Register Employee / Dept
          </button>
        )}
      </div>

      <div className="glass-card" style={{ padding: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={17} color="var(--text-muted)" />
        <input className="form-input" style={{ flex: '1 1 240px' }} placeholder="Search employees or departments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Filter size={17} color="var(--text-muted)" />
        <select className="form-select" style={{ width: '170px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
        </select>
      </div>

      {employees.length === 0 && (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No employees or departments registered yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {employees.filter(emp => {
          const haystack = `${emp.name} ${emp.code} ${emp.department_name || ''} ${emp.position || ''}`.toLowerCase();
          return haystack.includes(searchTerm.toLowerCase()) && (statusFilter === 'ALL' || (emp.status || 'Active') === statusFilter);
        }).map(emp => {
          const issuedTx = transactions.filter(t => t.employee_dept_id == emp.id && t.transaction_type === 'STOCK_OUT');
          const isDept = emp.type === 'Department';
          return (
            <div key={emp.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${isDept ? 'rgba(139,92,246,0.12)' : 'rgba(99,102,241,0.12)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: isDept ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)', color: isDept ? '#8b5cf6' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isDept ? <Users size={20} /> : <UserCheck size={20} />}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-muted-strong)' }}>{emp.name}</h4>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>{emp.code}</span>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-sm" title="Edit" onClick={() => openEdit(emp)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" title="Delete" onClick={() => openDelete(emp)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong style={{ color: 'var(--text-main)' }}>Dept:</strong> {sanitizeText(emp.department_name, 'Department pending')}</div>
                {emp.position && <div><strong style={{ color: 'var(--text-main)' }}>Position:</strong> {emp.position}</div>}
                {emp.gender && <div><strong style={{ color: 'var(--text-main)' }}>Gender:</strong> {emp.gender}</div>}
                <div><strong style={{ color: 'var(--text-main)' }}>Contact:</strong> {sanitizeText(emp.contact_number, 'Contact pending')}</div>
                <div><strong style={{ color: 'var(--text-main)' }}>Email:</strong> {sanitizeText(emp.email, 'Email pending')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ color: 'var(--text-main)' }}>Status:</strong> {emp.status || 'Active'}</div>
                  {canEdit && (
                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => handleToggleStatus(emp)}>
                      {emp.status === 'Inactive' ? 'Activate' : 'Deactivate'}
                    </button>
                  )}
                </div>
                {emp.document_url && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px' }}>
                    <a href={emp.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                      📄 View Document
                    </a>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <PackageCheck size={13} /> {issuedTx.length} items issued
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {canEdit && (
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={e => handleDocumentUpload(emp.id, e.target.files?.[0])}
                        disabled={uploadingDocId === emp.id}
                        style={{ display: 'none' }}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => { e.preventDefault(); e.currentTarget.parentElement.querySelector('input').click(); }}
                        disabled={uploadingDocId === emp.id}
                        style={{ cursor: 'pointer' }}
                      >
                        {uploadingDocId === emp.id ? '⏳' : '📤'} {uploadingDocId === emp.id ? 'Uploading...' : 'Upload Doc'}
                      </button>
                    </label>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowHistoryModal(emp)}>View History</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── HISTORY MODAL ── */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>
                Issue History — {showHistoryModal.name} ({showHistoryModal.code})
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowHistoryModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Tx Code</th><th>Material</th><th>Qty</th><th>Type</th><th>Purpose</th><th>Date</th></tr></thead>
                  <tbody>
                    {transactions.filter(t => t.employee_dept_id == showHistoryModal.id).length === 0
                      ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                      : transactions.filter(t => t.employee_dept_id == showHistoryModal.id).map(t => (
                        <tr key={t.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#818cf8' }}>{t.transaction_code}</td>
                          <td style={{ fontWeight: '700' }}>{t.material_name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{t.quantity}</td>
                          <td><span className="badge badge-warning" style={{ fontSize: '11px' }}>{t.transaction_type}</span></td>
                          <td style={{ fontSize: '12px' }}>{t.purpose}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Register Employee or Department</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Recipient Type</label>
                  <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    <option value="Employee">Individual Employee</option>
                    <option value="Department">Organizational Department</option>
                  </select>
                </div>
                <EmpFields data={formData} onChange={v => setFormData(v)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Recipient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && selectedRecipient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>Edit — {selectedRecipient.name}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <EmpFields data={editData} onChange={v => setEditData(v)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {showDelConfirm && selectedRecipient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete Recipient</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowDelConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Delete <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedRecipient.name} ({selectedRecipient.code})</strong>? Transaction history will remain but without a linked recipient.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDelConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmpFields({ data, onChange }) {
  const f = (key, val) => onChange({ ...data, [key]: val });
  return (
    <>
      <div className="form-group">
        <label className="form-label">Full Name / Dept Title *</label>
        <input type="text" className="form-input" placeholder="e.g. Dawit Bekele or Finance Dept" value={data.name} onChange={e => f('name', e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="form-label">Department</label>
        <input type="text" className="form-input" placeholder="e.g. IT, Finance, Operations" value={data.department_name} onChange={e => f('department_name', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Position / Job Title</label>
        <input type="text" className="form-input" placeholder="e.g. Senior Engineer, Department Head" value={data.position || ''} onChange={e => f('position', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Gender</label>
        <select className="form-select" value={data.gender || ''} onChange={e => f('gender', e.target.value)}>
          <option value="">-- Select Gender --</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Contact Phone</label>
        <input type="text" className="form-input" placeholder="+251-911-000000" value={data.contact_number} onChange={e => f('contact_number', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Email Address</label>
        <input type="email" className="form-input" placeholder="employee@org.com" value={data.email} onChange={e => f('email', e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-select" value={data.status || 'Active'} onChange={e => f('status', e.target.value)}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
    </>
  );
}
