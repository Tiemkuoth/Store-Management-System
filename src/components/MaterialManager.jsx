import React, { useState, useContext, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import apiFetch from '../utils/apiFetch';
import { Plus, Search, Filter, QrCode, Edit2, Trash2, AlertCircle, Package, FileSpreadsheet, History, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';

export default function MaterialManager() {
  const { materials = [], categories = [], suppliers = [], transactions = [], handleAddMaterial: onAddMaterial, handleEditMaterial: onEditMaterial, handleDeleteMaterial: onDeleteMaterial } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState(null);
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (showBarcodeModal && selectedMaterial && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, selectedMaterial.barcode || '0000000000', {
          format: 'CODE128',
          width: 2,
          height: 70,
          displayValue: false,
          margin: 0,
          background: 'transparent',
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [showBarcodeModal, selectedMaterial]);

  // Form states
  const [formData, setFormData] = useState({
    material_code: '',
    name: '',
    category_id: '',
    unit_of_measure: 'Pcs',
    specifications: '',
    min_stock_level: 5,
    current_stock: 0,
    unit_cost: 0,
    supplier_id: '',
    location: 'Main Warehouse',
    barcode: ''
  });

  const canEdit = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);
  const canDelete = ['Director', 'Administrator'].includes(currentUser?.role);
  const canViewCost = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);

  const filteredMaterials = materials.filter(mat => {
    const matchesSearch = mat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mat.material_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || mat.category_id == selectedCategory || mat.category_name === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = async () => {
    let nextCode = `MAT-${Math.floor(1000 + Math.random() * 9000)}`;
    let nextBarcode = `890123${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      const res = await apiFetch('/materials/next-code');
      if (res.ok) {
        const data = await res.json();
        if (data.nextCode) nextCode = data.nextCode;
        if (data.nextBarcode) nextBarcode = data.nextBarcode;
      }
    } catch (e) {
      console.error('Error fetching next code/barcode:', e);
    }

    setFormData({
      material_code: nextCode,
      name: '',
      category_id: categories[0]?.id || '',
      unit_of_measure: 'Pcs',
      specifications: '',
      min_stock_level: 5,
      current_stock: 0,
      unit_cost: 0,
      supplier_id: suppliers[0]?.id || '',
      location: 'Main Warehouse',
      barcode: nextBarcode
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (mat) => {
    setSelectedMaterial(mat);
    setFormData({
      material_code: mat.material_code,
      name: mat.name,
      category_id: mat.category_id || '',
      unit_of_measure: mat.unit_of_measure || 'Pcs',
      specifications: mat.specifications || '',
      min_stock_level: mat.min_stock_level,
      current_stock: mat.current_stock,
      unit_cost: mat.unit_cost,
      supplier_id: mat.supplier_id || '',
      location: sanitizeText(mat.location, 'Main Warehouse'),
      barcode: sanitizeText(mat.barcode, ''),
      status: mat.status || 'In Stock',
    });
    setShowEditModal(true);
  };

  const handleOpenBarcode = (mat) => {
    setSelectedMaterial(mat);
    setShowBarcodeModal(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    const error = await onAddMaterial?.(formData);
    if (error) { setActionMessage({ type: 'error', text: error }); return; }
    setShowAddModal(false);
    setActionMessage({ type: 'success', text: 'Material registered successfully.' });
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    const error = await onEditMaterial?.(selectedMaterial.id, formData);
    if (error) { setActionMessage({ type: 'error', text: error }); return; }
    setShowEditModal(false);
    setActionMessage({ type: 'success', text: 'Material updated successfully.' });
  };

  const handleExportExcel = () => {
    const data = filteredMaterials.map(m => ({
      'Material Code': m.material_code,
      'Name': m.name,
      'Category': sanitizeText(m.category_name, 'General'),
      'UOM': m.unit_of_measure,
      'Current Stock': m.current_stock,
      'Min Stock': m.min_stock_level,
      'Unit Cost': m.unit_cost,
      'Total Value': sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost),
      'Supplier': sanitizeText(m.supplier_name, '—'),
      'Location': sanitizeText(m.location, '—'),
      'Barcode': m.barcode || '—',
      'Specifications': m.specifications || '—',
    }));
    const headers = Object.keys(data[0] || {});
    const escapeCsv = value => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [headers, ...data.map(row => headers.map(header => row[header]))]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Materials_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openHistory = (mat) => {
    setHistoryMaterial(mat);
    setShowHistoryModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {actionMessage && (
        <div role="status" style={{ padding: '12px 16px', borderRadius: '8px', background: actionMessage.type === 'error' ? '#fef2f2' : '#ecfdf5', color: actionMessage.type === 'error' ? '#b91c1c' : '#047857', border: `1px solid ${actionMessage.type === 'error' ? '#fecaca' : '#a7f3d0'}` }}>
          {actionMessage.text}
        </div>
      )}
      {/* Top Header & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage all stock items, specifications, unit costs, and categories</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Export materials to Excel">
            <FileSpreadsheet size={15} color="#10b981" /> Export Excel
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> Register Material
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px', maxWidth: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by material code or name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '38px', minWidth: '0' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', minWidth: '180px' }}>
          <Filter size={18} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-select"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Materials Data Table */}
      <div className="table-responsive-container glass-card inventory-table-container">
        <table className="data-table table-dense inventory-table" style={{ width: '100%', minWidth: '920px' }}>
          <thead>
            <tr>
              <th className="col-code">Code</th>
              <th className="col-name">Material Name</th>
              <th className="col-category">Category</th>
              <th className="col-stock">Stock Status</th>
              <th className="col-uom">UOM</th>
              {canViewCost && <th className="col-unit">Unit Cost</th>}
              {canViewCost && <th className="col-total">Total Valuation</th>}
              <th className="col-location">Location</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No materials found matching criteria.
                </td>
              </tr>
            ) : (
              filteredMaterials.map(mat => {
                const isLow = sanitizeNumber(mat.current_stock) <= sanitizeNumber(mat.min_stock_level);
                const totalVal = sanitizeNumber(mat.current_stock) * sanitizeNumber(mat.unit_cost);
                return (
                  <tr key={mat.id}>
                    <td className="col-code">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#818cf8' }}>
                        {mat.material_code}
                      </span>
                    </td>
                    <td className="col-name wrap">
                      <div style={{ fontWeight: '700', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }} title={mat.name}>{mat.name}</div>
                      {mat.specifications && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }} title={mat.specifications}>
                          {mat.specifications}
                        </div>
                      )}
                    </td>
                    <td className="col-category">
                      <span className="badge badge-info">{sanitizeText(mat.category_name, 'General')}</span>
                    </td>
                    <td className="col-stock">
                      {(() => {
                        const stock = sanitizeNumber(mat.current_stock);
                        const minStock = sanitizeNumber(mat.min_stock_level);
                        const isOut = stock === 0;
                        const isLow = !isOut && stock <= minStock;
                        const isGood = stock > minStock * 2;
                        const pct = minStock > 0 ? Math.min(100, Math.round((stock / (minStock * 3)) * 100)) : 100;

                        const color = isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
                        const bg = isOut ? 'rgba(239,68,68,0.08)' : isLow ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
                        const border = isOut ? 'rgba(239,68,68,0.25)' : isLow ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)';
                        const label = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock';
                        const dot = isOut ? '●' : isLow ? '▲' : '✔';

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              background: bg, border: `1px solid ${border}`,
                              borderRadius: '6px', padding: '3px 8px',
                              fontSize: '12px', fontWeight: '700', color,
                            }}>
                              <span style={{ fontSize: '9px' }}>{dot}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{stock}</span>
                              <span style={{ fontWeight: '500', fontSize: '11px', opacity: 0.85 }}>{mat.unit_of_measure || 'pcs'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: color, transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '10px', color, fontWeight: '600', whiteSpace: 'nowrap' }}>{label}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="col-uom" style={{ color: 'var(--text-muted)' }}>{sanitizeText(mat.unit_of_measure, 'Unit')}</td>
                    {canViewCost && <td className="col-unit" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(mat.unit_cost)}</td>}
                    {canViewCost && (
                    <td className="col-total" style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#10b981' }}>
                      {formatCurrency(totalVal)}
                    </td>
                    )}
                    <td className="col-location" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{sanitizeText(mat.location, 'Main Store')}</td>
                    <td className="col-actions">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" title="View transaction history" onClick={() => openHistory(mat)}>
                          <History size={14} />
                        </button>
                        <button className="btn btn-secondary btn-sm" title="Barcode Label" onClick={() => handleOpenBarcode(mat)}>
                          <QrCode size={14} />
                        </button>
                        {canEdit && (
                          <button className="btn btn-secondary btn-sm" title="Edit Material" onClick={() => handleOpenEdit(mat)}>
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" title="Delete Material" onClick={() => { setSelectedMaterial(mat); setShowDeleteConfirm(true); }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD MATERIAL MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Register New Material</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitAdd}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Material Code</label>
                  <input type="text" className="form-input" value={formData.material_code} onChange={e => setFormData({ ...formData, material_code: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Dell Latitude 5430" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit of Measure (UOM)</label>
                  <input type="text" className="form-input" placeholder="Pcs, Box, Kg, Set..." value={formData.unit_of_measure} onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Min Stock Threshold</label>
                  <input type="number" className="form-input" min="1" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Stock Qty</label>
                  <input type="number" className="form-input" min="0" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value })} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit Cost (Birr)</label>
                  <input type="number" step="0.01" className="form-input" value={formData.unit_cost} onChange={e => setFormData({ ...formData, unit_cost: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Supplier</label>
                  <select className="form-select" value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}>
                    <option value="">-- Optional Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Store Rack / Location</label>
                  <input type="text" className="form-input" placeholder="e.g. Rack A-12, Shelf B-04" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Specifications & Remarks</label>
                  <textarea className="form-textarea" rows="3" placeholder="Technical specs, model number, dimensions..." value={formData.specifications} onChange={e => setFormData({ ...formData, specifications: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MATERIAL MODAL */}
      {showEditModal && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header" style={{ padding: '10px 16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Edit Material — {selectedMaterial.material_code}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitEdit}>
              <div className="modal-body" style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Material Code <span style={{ color: 'var(--color-warning)' }}>(locked)</span></label>
                  <input type="text" className="form-input" value={selectedMaterial.material_code} readOnly
                    style={{ opacity: 0.5, cursor: 'not-allowed', height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Barcode <span style={{ color: 'var(--color-warning)' }}>(locked)</span></label>
                  <input type="text" className="form-input" value={sanitizeText(selectedMaterial.barcode, 'Barcode pending')} readOnly
                    style={{ opacity: 0.5, cursor: 'not-allowed', height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Material Name</label>
                  <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Category</label>
                  <select className="form-select" value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} style={{ height: '28px', fontSize: '12px', padding: '0 6px' }}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Unit of Measure (UOM)</label>
                  <input type="text" className="form-input" value={formData.unit_of_measure} onChange={e => setFormData({ ...formData, unit_of_measure: e.target.value })} required style={{ height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Min Stock Threshold</label>
                  <input type="number" className="form-input" min="1" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} required style={{ height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Unit Cost (Birr)</label>
                  <input type="number" step="0.01" className="form-input" value={formData.unit_cost} onChange={e => setFormData({ ...formData, unit_cost: e.target.value })} required style={{ height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Supplier</label>
                  <select className="form-select" value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })} style={{ height: '28px', fontSize: '12px', padding: '0 6px' }}>
                    <option value="">— No Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Material Status</label>
                  <select className="form-select" value={formData.status || 'In Stock'} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ height: '28px', fontSize: '12px', padding: '0 6px' }}>
                    <option value="In Stock">In Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Under Repair">Under Repair</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Store Rack / Location</label>
                  <input type="text" className="form-input" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} style={{ height: '28px', fontSize: '12px', padding: '0 8px' }} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '10px', marginBottom: '2px' }}>Specifications &amp; Technical Details</label>
                  <textarea className="form-textarea" rows="2" value={formData.specifications} onChange={e => setFormData({ ...formData, specifications: e.target.value })} style={{ fontSize: '12px', resize: 'vertical', padding: '5px 8px' }} />
                </div>

              </div>
              <div className="modal-footer" style={{ padding: '7px 16px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Update Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE MODAL */}
      {showBarcodeModal && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Material Barcode Label</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }} onClick={() => setShowBarcodeModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>

              {/* Printable label area */}
              <div id="barcode-print-area" style={{ background: '#fff', color: '#000', border: '2px dashed #d1d5db', borderRadius: '10px', padding: '24px 20px', display: 'inline-block', minWidth: '300px' }}>
                <div style={{ fontWeight: '800', fontSize: '15px', color: '#111', marginBottom: '2px' }}>{selectedMaterial.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '14px' }}>{selectedMaterial.material_code} &nbsp;|&nbsp; {sanitizeText(selectedMaterial.location, 'Main Warehouse')}</div>

                {/* Real SVG barcode */}
                <svg ref={barcodeRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />

                <div style={{ fontFamily: 'monospace', fontWeight: '700', letterSpacing: '3px', fontSize: '14px', marginTop: '8px', color: '#111' }}>
                  {selectedMaterial.barcode || '0000000000'}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                ✂️ Cut along the dashed border after printing
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowBarcodeModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                const printArea = document.getElementById('barcode-print-area');
                const win = window.open('', '_blank', 'width=450,height=350');
                win.document.write(`
                  <html><head><title>Barcode - ${selectedMaterial.name}</title>
                  <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
                    .label { text-align: center; padding: 24px 20px; border: 2px dashed #ccc; border-radius: 10px; }
                    @media print { body { margin: 0; } .label { border: 2px dashed #999; page-break-inside: avoid; } }
                  </style></head><body>
                  <div class="label">${printArea.innerHTML}</div>
                  </body></html>
                `);
                win.document.close();
                // Use requestAnimationFrame to avoid forced reflow during print
                requestAnimationFrame(() => {
                  win.focus();
                  setTimeout(() => { win.print(); win.close(); }, 400);
                });
              }}>
                🖨️ Print Label
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm && selectedMaterial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#ef4444' }}>Delete Material</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Permanently delete <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedMaterial.name}</strong> ({selectedMaterial.material_code})?
              </p>
              <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>
                This will also delete all stock transaction history for this material. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={deletingMaterial} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deletingMaterial}
                onClick={async () => {
                  setDeletingMaterial(true);
                  try {
                    const error = await onDeleteMaterial?.(selectedMaterial.id);
                    if (error) { setActionMessage({ type: 'error', text: error }); }
                    else {
                      setShowDeleteConfirm(false);
                      setActionMessage({ type: 'success', text: 'Material deleted successfully.' });
                    }
                  } catch (err) {
                    setActionMessage({ type: 'error', text: err.message || 'Delete failed' });
                  } finally {
                    setDeletingMaterial(false);
                  }
                }}
              >
                <Trash2 size={14} /> {deletingMaterial ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && historyMaterial && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700' }}>
                Transaction History — {historyMaterial.material_code} · {historyMaterial.name}
              </h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }} onClick={() => setShowHistoryModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {(() => {
                const matTxns = transactions.filter(t => t.material_id == historyMaterial.id || t.material_code === historyMaterial.material_code);
                if (matTxns.length === 0) {
                  return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No transaction history found for this material.</p>;
                }
                return (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Code</th><th>Type</th><th>Qty</th><th>Unit Cost</th><th>Source / Recipient</th><th>Purpose</th><th>Issued By</th><th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matTxns.slice().sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)).map(t => {
                          const badgeMap = { STOCK_IN: 'badge-success', STOCK_OUT: 'badge-danger', RETURN: 'badge-warning', ADJUSTMENT: 'badge-info' };
                          return (
                            <tr key={t.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#818cf8' }}>{t.transaction_code}</td>
                              <td><span className={`badge ${badgeMap[t.transaction_type] || 'badge-secondary'}`}>{t.transaction_type}</span></td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{t.transaction_type === 'STOCK_OUT' ? `-${t.quantity}` : `+${t.quantity}`}</td>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(t.unit_cost)}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sanitizeText(t.supplier_name || t.receiver_name, '—')}</td>
                              <td style={{ fontSize: '12px' }}>{sanitizeText(t.purpose, '—')}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sanitizeText(t.issued_by_name, '—')}</td>
                              <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
