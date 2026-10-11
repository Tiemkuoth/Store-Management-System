import React, { useState, useContext, useEffect } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { MoveRight, Plus, Search, X, ArrowRight } from 'lucide-react';
import { sanitizeText } from '../utils/displayValue';
import apiFetch from '../utils/apiFetch';

export default function StockTransfers({ readOnly = false }) {
  const { transfers = [], materials = [], handleTransfer: onTransfer } = useContext(DataContext) || {};
  const { currentUser: _currentUser } = useContext(AuthContext) || {};
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [form, setForm] = useState({
    material_id: '', quantity: '',
    source_location: '', destination_location: '', remarks: ''
  });

  useEffect(() => { fetchWarehouses(); }, []);

  const handleOpenForm = () => {
    setShowForm(true);
    setError('');
    if (warehouses.length === 0) fetchWarehouses();
  };

  const fetchWarehouses = async () => {
    try {
      setWarehousesLoading(true);
      const res = await apiFetch('/warehouses');
      if (res.ok) setWarehouses((await res.json()) || []);
    } catch (e) {
      console.error('Failed to fetch warehouses:', e);
    } finally {
      setWarehousesLoading(false);
    }
  };

  const filtered = transfers.filter(t =>
    [t.material_name, t.material_code, t.transfer_code, t.source_location, t.destination_location]
      .some(v => (v || '').toLowerCase().includes(search.toLowerCase()))
  );

  const selectedMaterial = materials.find(m => m.id == form.material_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.material_id) return setError('Please select a material');
    if (!form.quantity || parseInt(form.quantity) <= 0) return setError('Quantity must be greater than 0');
    if (!form.source_location) return setError('Source location is required');
    if (!form.destination_location) return setError('Destination location is required');
    if (form.source_location === form.destination_location) return setError('Source and destination must be different');

    setSubmitting(true);
    const err = await onTransfer({
      material_id: form.material_id,
      quantity: parseInt(form.quantity),
      source_location: form.source_location,
      destination_location: form.destination_location,
      remarks: form.remarks
    });
    setSubmitting(false);
    if (err) { setError(err); }
    else {
      setForm({ material_id: '', quantity: '', source_location: '', destination_location: '', remarks: '' });
      setShowForm(false);
    }
  };

  /* ─── column definitions ─── */
  const cols = [
    { key: 'transfer_code', label: 'Code', style: { color: '#6366f1', fontFamily: 'var(--font-mono)', fontWeight: 600, whiteSpace: 'nowrap' } },
    {
      key: '_material', label: 'Material', render: t => (
        <span>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>{t.material_name}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t.material_code}</span>
        </span>
      )
    },
    { key: 'quantity', label: 'Qty', style: { color: '#10b981', fontWeight: 700, whiteSpace: 'nowrap' } },
    {
      key: '_route', label: 'From → To', render: t => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: '0.72rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t.source_location || '—'}</span>
          <ArrowRight size={11} color="#6366f1" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text-primary)' }}>{t.destination_location || '—'}</span>
        </span>
      )
    },
    { key: 'transferred_by_name', label: 'By', style: { color: 'var(--text-muted)', whiteSpace: 'nowrap' } },
    { key: '_date', label: 'Date', render: t => <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '—'}</span> },
    { key: 'remarks', label: 'Remarks', render: t => <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }} title={t.remarks}>{sanitizeText(t.remarks, '—')}</span> },
  ];

  const getCellValue = (col, row) => {
    if (col.render) return col.render(row);
    return <span style={col.style}>{row[col.key] ?? '—'}</span>;
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ width: '100%', paddingLeft: 30, paddingRight: search ? 28 : 10 }}
            placeholder="Search transfers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              <X size={12} />
            </button>
          )}
        </div>
        {!readOnly && (
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={handleOpenForm}>
            <Plus size={14} /> New Transfer
          </button>
        )}
      </div>

      {/* ── Read-only banner ── */}
      {readOnly && (
        <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)', fontSize: '0.78rem', color: '#f59e0b' }}>
          Read-only mode — contact an Administrator or Manager to create transfers.
        </div>
      )}

      {/* ── New Transfer Modal ── */}
      {showForm && !readOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 12 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, width: 'min(100%, 520px)', maxHeight: 'min(92vh, 680px)', overflowY: 'auto', border: '1px solid var(--bg-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>

            {/* modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '16px 18px 0', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-muted-strong)' }}>New Stock Transfer</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Move inventory between locations.</p>
              </div>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 1 }}>
                <X size={16} />
              </button>
            </div>

            {/* modal body */}
            <div style={{ padding: '14px 18px 18px', flex: 1, overflowY: 'auto' }}>
              {error && (
                <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '0.78rem', marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Material */}
                <div className="form-group">
                  <label className="form-label">Material *</label>
                  <select className="form-select" value={form.material_id} onChange={e => {
                    const mat = materials.find(m => m.id == e.target.value);
                    setForm(f => ({ ...f, material_id: e.target.value, source_location: mat?.location || '' }));
                  }}>
                    <option value="">Select material…</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.material_code}) — Stock: {m.current_stock}</option>
                    ))}
                  </select>
                  {selectedMaterial && (
                    <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Location: <strong style={{ color: 'var(--text-primary)' }}>{selectedMaterial.location}</strong>
                      &nbsp;·&nbsp;Available: <strong style={{ color: '#10b981' }}>{selectedMaterial.current_stock}</strong>
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1"
                    max={selectedMaterial?.current_stock || 9999}
                    placeholder="0" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>

                {/* From / To — stacked on narrow, side-by-side when wide */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div className="form-group">
                    <label className="form-label">From *</label>
                    <select className="form-select" value={form.source_location}
                      onChange={e => setForm(f => ({ ...f, source_location: e.target.value }))}
                      disabled={warehousesLoading}>
                      <option value="">{warehousesLoading ? 'Loading…' : 'Select…'}</option>
                      {warehouses.map(w => <option key={w.id} value={w.name}>{w.code} – {w.name}</option>)}
                      {!warehousesLoading && warehouses.length === 0 && <option disabled>No warehouses found</option>}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">To *</label>
                    <select className="form-select" value={form.destination_location}
                      onChange={e => setForm(f => ({ ...f, destination_location: e.target.value }))}
                      disabled={warehousesLoading}>
                      <option value="">{warehousesLoading ? 'Loading…' : 'Select…'}</option>
                      {warehouses.map(w => <option key={w.id} value={w.name}>{w.code} – {w.name}</option>)}
                      {!warehousesLoading && warehouses.length === 0 && <option disabled>No warehouses found</option>}
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <textarea className="form-textarea" rows={3}
                    placeholder="Optional notes…" value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    style={{ resize: 'vertical', minHeight: 72 }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    <MoveRight size={14} /> {submitting ? 'Transferring…' : 'Confirm Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer History card ── */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--bg-border)', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>

        {/* card header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bg-border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <MoveRight size={14} color="#6366f1" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted-strong)' }}>Transfer History</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>Past stock moves between locations.</span>
          <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', fontSize: '0.68rem', fontWeight: 700 }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* empty state */}
        {filtered.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No transfers found.
            {!readOnly && <> Click <strong style={{ color: '#6366f1' }}>New Transfer</strong> to get started.</>}
          </div>
        ) : (
          /* ── table: allow horizontal scroll only as last resort ── */
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '9%' }} />  {/* Code      */}
                <col style={{ width: '18%' }} />  {/* Material  */}
                <col style={{ width: '6%' }} />  {/* Qty       */}
                <col style={{ width: '27%' }} />  {/* From→To   */}
                <col style={{ width: '13%' }} />  {/* By        */}
                <col style={{ width: '10%' }} />  {/* Date      */}
                <col style={{ width: '17%' }} />  {/* Remarks   */}
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-surface-muted)' }}>
                  {cols.map(c => (
                    <th key={c.key} style={{ padding: '7px 10px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', borderBottom: '2px solid var(--bg-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--bg-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    {cols.map(c => (
                      <td key={c.key} style={{ padding: '7px 10px', verticalAlign: 'middle', overflow: 'hidden', maxWidth: 0 }}>
                        {getCellValue(c, t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
