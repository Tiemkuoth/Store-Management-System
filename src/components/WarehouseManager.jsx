import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { DataContext } from '../contexts/DataContext';
import apiFetch from '../utils/apiFetch';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function WarehouseManager() {
  const { currentUser } = useContext(AuthContext) || {};
  const { fetchData } = useContext(DataContext) || {};
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delId, setDelId] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '', address: '', manager_name: '' });

  const canEdit = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchWarehouses = async () => {
    try {
      const res = await apiFetch('/warehouses');
      if (res.ok) setWarehouses(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWarehouses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editItem ? `/warehouses/${editItem.id}` : '/warehouses';
      const method = editItem ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(formData) });
      if (!res.ok) throw new Error('Failed to save warehouse');

      showToast(editItem ? 'Warehouse updated' : 'Warehouse added');
      setShowModal(false);
      fetchWarehouses();
      fetchData?.(true);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/warehouses/${delId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Warehouse deleted');
      setDelId(null);
      fetchWarehouses();
      fetchData?.(true);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openForm = (w = null) => {
    setEditItem(w);
    setFormData(w || { code: '', name: '', address: '', manager_name: '' });
    setShowModal(true);
  };

  if (loading) return <div>Loading warehouses...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-strong)' }}>Warehouses & Stores</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage physical storage locations</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Warehouse</button>
        )}
      </div>

      <div className="table-responsive-container">
        <table className="data-table table-dense" style={{ width: '100%', minWidth: '580px' }}>
          <thead>
            <tr>
              <th style={{ whiteSpace: 'nowrap' }}>Code</th>
              <th style={{ whiteSpace: 'nowrap' }}>Name</th>
              <th style={{ whiteSpace: 'nowrap' }}>Manager</th>
              <th>Address</th>
              {canEdit && <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No warehouses found.</td></tr>
            ) : warehouses.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{w.code}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{w.name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{w.manager_name || '-'}</td>
                <td>{w.address || '-'}</td>
                {canEdit && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-secondary btn-sm" style={{ marginRight: '6px' }} onClick={() => openForm(w)}><Edit2 size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDelId(w.id)}><Trash2 size={13} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Code *</label>
                  <input type="text" className="form-input" required value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Name *</label>
                  <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Manager Name</label>
                  <input type="text" className="form-input" value={formData.manager_name} onChange={e => setFormData({ ...formData, manager_name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input type="text" className="form-input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444', fontSize: '18px', fontWeight: '700' }}>Delete Warehouse</h3>
              <button onClick={() => setDelId(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body">Are you sure you want to delete this warehouse?</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
