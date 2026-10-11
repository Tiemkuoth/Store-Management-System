import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { Tag, Plus, Edit2, Trash2, Check, X, Search, Filter } from 'lucide-react';
import apiFetch from '../utils/apiFetch';

// const API_BASE = 'http://localhost:5000/api'; // removed, using relative paths

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function CategoryManager() {
  const { categories = [], materials = [], fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const [newName, setNewName]       = useState('');
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [delId, setDelId]           = useState(null);
  const [toast, setToast]           = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const canEdit = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to add category');
      }
      setNewName('');
      onRefresh?.();
      showToast('Category added');
    } catch (err) { showToast(err.message || 'Failed to add category', 'error'); }
  };

  const startEdit = (cat) => { setEditingId(cat.id); setEditName(cat.name); };
  const cancelEdit = ()  => { setEditingId(null); setEditName(''); };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      const res = await apiFetch(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim() })
      });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to rename');
      }
      setEditingId(null);
      onRefresh?.();
      showToast('Category renamed');
    } catch (err) { showToast(err.message || 'Failed to rename', 'error'); }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/categories/${delId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await parseJsonSafe(res);
        throw new Error(d?.error || 'Failed to delete');
      }
      setDelId(null);
      onRefresh?.();
      showToast('Category deleted');
    } catch (err) { showToast(err.message || 'Failed to delete', 'error'); }
  };

  const handleToggleStatus = async (category) => {
    try {
      const nextStatus = category.status === 'Inactive' ? 'Active' : 'Inactive';
      const res = await apiFetch(`/categories/${category.id}`, { method: 'PUT', body: JSON.stringify({ name: category.name, description: category.description || '', status: nextStatus }) });
      if (!res.ok) throw new Error((await parseJsonSafe(res))?.error || 'Failed to update status');
      onRefresh?.();
      showToast(`Category ${nextStatus.toLowerCase()}`);
    } catch (err) { showToast(err.message || 'Failed to update status', 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage the categories used to organise materials in the registry</p>

      <div className="glass-card" style={{ padding: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={17} color="var(--text-muted)" />
        <input className="form-input" style={{ flex: '1 1 240px' }} placeholder="Search categories..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Filter size={17} color="var(--text-muted)" />
        <select className="form-select" style={{ width: '170px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Add form */}
      {canEdit && (
        <form onSubmit={handleAdd} className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag size={18} color="#6366f1" style={{ flexShrink: 0 }} />
          <input
            type="text" className="form-input" placeholder="New category name…"
            value={newName} onChange={e => setNewName(e.target.value)}
            style={{ flex: '1 1 200px', minWidth: 0 }} required
          />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Add Category
          </button>
        </form>
      )}

      {/* Category list */}
      <div className="glass-card" style={{ padding: '8px' }}>
        {categories.length === 0 && (
          <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No categories yet.</p>
        )}
        {(() => {
          const [expandedCatId, setExpandedCatId] = React.useState(null);
          return categories.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()) && (statusFilter === 'ALL' || (cat.status || 'Active') === statusFilter)).map((cat, i) => {
            // Ensure proper type comparison for category_id
            const associated = materials.filter(material => {
              const matCatId = material.category_id ? Number(material.category_id) : null;
              const catId = Number(cat.id);
              return matCatId === catId;
            });
            const isExpanded = expandedCatId === cat.id;
            return (
              <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: i < categories.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                  padding: '12px 14px', borderRadius: '8px',
                }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tag size={15} color="#6366f1" />
                  </div>

                  {editingId === cat.id ? (
                    <div style={{ display: 'flex', gap: '8px', flex: '1 1 240px', alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
                      <input
                        type="text" className="form-input" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ flex: '1 1 160px', minWidth: 0 }} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') cancelEdit(); }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => handleRename(cat.id)}><Check size={13} /></button>
                      <button className="btn btn-secondary btn-sm" onClick={cancelEdit}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <span style={{ flex: '1 1 180px', fontWeight: '600', color: 'var(--text-muted-strong)', minWidth: 0 }}>{cat.name}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                        <button 
                          type="button" 
                          className="badge badge-info" 
                          style={{ cursor: 'pointer', border: 'none', background: 'rgba(51,102,255,0.15)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}
                          onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                        >
                          {associated.length} materials (click to {isExpanded ? 'hide' : 'view'})
                        </button>
                        <span className={`badge ${cat.status === 'Inactive' ? 'badge-warning' : 'badge-success'}`}>{cat.status || 'Active'}</span>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleStatus(cat)}>{cat.status === 'Inactive' ? 'Activate' : 'Deactivate'}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(cat)} title="Edit"><Edit2 size={13} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDelId(cat.id)} title="Delete"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {isExpanded && (
                  <div style={{ padding: '0 16px 12px 60px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Associated Materials:</div>
                    {associated.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No materials in this category.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {associated.map(mat => (
                          <div key={mat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 8px', background: 'var(--bg-hover)', borderRadius: '4px', transition: 'all 0.2s ease' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: '600' }}>{mat.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: '8px', fontSize: '11px' }}>{mat.material_code} ({mat.current_stock} {mat.unit_of_measure})</span>
                            </div>
                            {canEdit && (
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                  try {
                                    const res = await apiFetch(`/materials/${mat.id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({
                                        name: mat.name,
                                        category_id: null,
                                        unit_of_measure: mat.unit_of_measure,
                                        specifications: mat.specifications || '',
                                        min_stock_level: mat.min_stock_level,
                                        unit_cost: mat.unit_cost,
                                        supplier_id: mat.supplier_id || null,
                                        location: mat.location || 'Main Warehouse',
                                        current_stock: mat.current_stock
                                      })
                                    });
                                    if (!res.ok) {
                                      const d = await parseJsonSafe(res);
                                      throw new Error(d?.error || 'Failed to remove');
                                    }
                                    onRefresh?.();
                                    showToast(`Removed "${mat.name}" from category`);
                                  } catch (err) { showToast(err.message || 'Failed to remove from category', 'error'); }
                                }}
                                style={{ minWidth: '100px' }}
                              >
                                Remove from categories
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Delete confirm */}
      {delId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete Category</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setDelId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Delete <strong style={{ color: 'var(--text-muted-strong)' }}>{categories.find(c => c.id === delId)?.name}</strong>? Materials in this category will become uncategorised.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
