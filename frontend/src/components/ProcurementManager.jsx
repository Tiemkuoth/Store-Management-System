import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import apiFetch from '../utils/apiFetch';
import { ShoppingCart, Plus, X, Send, CheckCircle } from 'lucide-react';

export default function ProcurementManager() {
  const { currentUser } = useContext(AuthContext) || {};
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const [oRes, sRes, mRes] = await Promise.all([
        apiFetch('/purchase-orders'),
        apiFetch('/suppliers'),
        apiFetch('/materials'),
      ]);
      if (oRes.ok) { const d = await oRes.json(); setOrders(Array.isArray(d) ? d : d.data || []); }
      if (sRes.ok) { const d = await sRes.json(); setSuppliers(Array.isArray(d) ? d : d.data || []); }
      if (mRes.ok) { const d = await mRes.json(); setMaterials(Array.isArray(d) ? d : d.data || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = () => {
    setSupplierId(''); setExpectedDate(''); setRemarks('');
    setItems([{ material_id: '', quantity_ordered: 1, unit_cost: 0 }]);
    setShowModal(true);
  };

  const addItemRow = () =>
    setItems(prev => [...prev, { material_id: '', quantity_ordered: 1, unit_cost: 0 }]);

  const updateItem = (i, field, value) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== i) return row;
      const updated = { ...row, [field]: value };
      if (field === 'material_id') {
        const mat = materials.find(m => String(m.id) === String(value));
        if (mat) updated.unit_cost = mat.unit_cost ?? 0;
      }
      return updated;
    }));
  };

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId) return showToast('Please select a supplier', 'error');
    if (items.length === 0) return showToast('Add at least one item', 'error');
    if (items.some(it => !it.material_id || Number(it.quantity_ordered) <= 0))
      return showToast('All items need a material and quantity > 0', 'error');

    setSubmitting(true);
    try {
      const res = await apiFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: supplierId,
          expected_date: expectedDate || null,
          remarks,
          items: items.map(it => ({
            material_id: it.material_id,
            quantity_ordered: Number(it.quantity_ordered),
            unit_cost: Number(it.unit_cost) || 0,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create Purchase Order');
      showToast(`Purchase Order ${data.po_number} created`);
      setShowModal(false);
      fetchData();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/purchase-orders/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(`Status updated to ${status}`);
      fetchData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const sendEmailPO = async (id) => {
    try {
      const res = await apiFetch(`/purchase-orders/${id}/send-email`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to send email');
      }
      showToast('Purchase Order emailed to supplier!');
      fetchData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const totalAmount = items.reduce(
    (sum, it) => sum + Number(it.quantity_ordered || 0) * Number(it.unit_cost || 0), 0
  );

  const statusStyle = (s) => ({
    padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
    background: s === 'Completed' ? 'rgba(16,185,129,.12)' : s === 'Cancelled' ? 'rgba(239,68,68,.12)' : s === 'Draft' ? 'rgba(100,116,139,.12)' : 'rgba(99,102,241,.12)',
    color: s === 'Completed' ? '#059669' : s === 'Cancelled' ? '#dc2626' : s === 'Draft' ? '#475569' : '#4338ca',
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '10px 18px', borderRadius: 9, fontWeight: 600, fontSize: '0.82rem', boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem,2vw,1.25rem)', fontWeight: 800, color: 'var(--text-muted-strong)' }}>
            Procurement (Purchase Orders)
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Create and manage purchase orders to suppliers
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={15} /> Create PO
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.8rem' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              {canEdit && <col style={{ width: '20%' }} />}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-surface-muted)' }}>
                {['PO Number', 'Supplier', 'Total Amount', 'Expected Date', 'Status', canEdit ? 'Actions' : null]
                  .filter(Boolean).map(h => (
                    <th key={h} style={{ padding: '8px 11px', textAlign: h === 'Actions' ? 'right' : 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '2px solid var(--bg-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={canEdit ? 6 : 5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No purchase orders found.
                </td></tr>
              ) : orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '8px 11px', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.po_number}</td>
                  <td style={{ padding: '8px 11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.supplier_name}</td>
                  <td style={{ padding: '8px 11px', fontWeight: 700, color: '#10b981' }}>
                    {Number(o.total_amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td style={{ padding: '8px 11px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {o.expected_date ? new Date(o.expected_date).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px 11px' }}>
                    <span style={statusStyle(o.status)}>{o.status}</span>
                  </td>
                  {canEdit && (
                    <td style={{ padding: '6px 11px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {o.status === 'Draft' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(o.id, 'Issued')}>
                            <Send size={12} /> Issue
                          </button>
                        )}
                        {o.status === 'Issued' && (
                          <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none' }} onClick={() => sendEmailPO(o.id)}>
                            Email Supplier
                          </button>
                        )}
                        {['Issued', 'Partially Received', 'Sent'].includes(o.status) && (
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'Completed')}>
                            <CheckCircle size={12} /> Complete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create PO Modal ── */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1400 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, width: 'min(100%, 680px)', maxHeight: 'min(92vh, 780px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.22)', border: '1px solid var(--bg-border)' }}>

            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-muted-strong)' }}>Create Purchase Order</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fill in supplier, items, and quantities</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 1 }}>
                <X size={18} />
              </button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <form id="po-form" onSubmit={handleSubmit} style={{ display: 'contents' }}>

                {/* Supplier + Date row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Supplier *</label>
                    <select className="form-select" required value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                      <option value="">— Select Supplier —</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Delivery Date</label>
                    <input type="date" className="form-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Notes</label>
                  <input type="text" className="form-input" placeholder="Optional notes for this order…" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>

                {/* Items section */}
                <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      PO Items *
                    </span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                      <Plus size={13} /> Add Item
                    </button>
                  </div>

                  {items.length === 0 && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                      No items yet — click "Add Item" to begin.
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 36px', gap: 8, alignItems: 'end' }}>
                        <div className="form-group" style={{ gap: 3 }}>
                          {idx === 0 && <label className="form-label">Material</label>}
                          <select className="form-select" required value={item.material_id} onChange={e => updateItem(idx, 'material_id', e.target.value)}>
                            <option value="">— Select —</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.material_code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ gap: 3 }}>
                          {idx === 0 && <label className="form-label">Qty</label>}
                          <input type="number" className="form-input" min="1" placeholder="Qty" required
                            value={item.quantity_ordered}
                            onChange={e => updateItem(idx, 'quantity_ordered', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ gap: 3 }}>
                          {idx === 0 && <label className="form-label">Unit Cost</label>}
                          <input type="number" className="form-input" min="0" step="0.01" placeholder="0.00" required
                            value={item.unit_cost}
                            onChange={e => updateItem(idx, 'unit_cost', e.target.value)} />
                        </div>
                        <div style={{ paddingBottom: 1 }}>
                          {idx === 0 && <div style={{ height: 20 }} />}
                          <button type="button" className="btn btn-danger btn-sm" style={{ padding: '6px 8px' }} onClick={() => removeItem(idx)}>
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {items.length > 0 && (
                    <div style={{ marginTop: 10, textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Total: <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </strong>
                    </div>
                  )}
                </div>

              </form>
            </div>

            {/* footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--bg-border)', background: 'var(--bg-surface-muted)', flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="po-form" className="btn btn-primary" disabled={submitting}>
                <ShoppingCart size={14} /> {submitting ? 'Creating…' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
