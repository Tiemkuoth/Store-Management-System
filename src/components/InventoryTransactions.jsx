import React, { useState, useContext, useEffect } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Sliders, ArrowLeftRight, History, Search, Trash2, CheckCircle2, Clock, Printer, Camera, XCircle } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import BarcodeScannerModal from './BarcodeScannerModal';

import apiFetch from '../utils/apiFetch';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';

// const API_BASE = 'http://localhost:5000/api'; // removed, using relative paths

export default function InventoryTransactions() {
  const { materials = [], suppliers = [], employees = [], transactions = [], disposals = [], handleStockIn: onStockIn, handleStockOut: onStockOut, handleReturn: onReturn, handleAdjust: onAdjust, fetchData: onRefresh } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('HISTORY');
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('');

  const handleScanSuccess = (barcode) => {
    const mat = materials.find(m => String(m.barcode) === String(barcode));
    if (!mat) {
      toast.error(`⚠️ No material found with barcode: ${barcode}`);
      return;
    }
    toast.success(`✓ Scanned: ${mat.name}`);
    if (scannerTarget === 'in') {
      setStockInData(prev => ({ ...prev, material_id: mat.id, unit_cost: mat.unit_cost }));
    } else if (scannerTarget === 'out') {
      setStockOutData(prev => ({ ...prev, material_id: mat.id }));
    }
  };

  // Form states
  const [stockInData, setStockInData] = useState({
    material_id: '',
    quantity: 1,
    unit_cost: 0,
    payment_method: 'Cash',
    supplier_id: '',
    purpose: 'Procurement Restock',
    store_location: 'Main Warehouse',
    remarks: ''
  });

  const [stockOutData, setStockOutData] = useState({
    material_id: '',
    quantity: 1,
    employee_dept_id: '',
    purpose: 'Operational Equipment Issue',
    remarks: ''
  });

  const [returnData, setReturnData] = useState({
    material_id: '',
    quantity: 1,
    employee_dept_id: '',
    remarks: 'Returned in good condition'
  });

  const [adjustData, setAdjustData] = useState({
    material_id: '',
    new_quantity: 0,
    remarks: 'Annual Physical Stock Audit Reconciliation'
  });

  // Disposal state
  const [disposalData, setDisposalData] = useState({
    material_id: '',
    quantity: 1,
    disposal_type: 'Damaged',
    reason: '',
    remarks: ''
  });
  const [disposalSubmitting, setDisposalSubmitting] = useState(false);
  const [disposalSearch, setDisposalSearch] = useState('');

  // Voucher state — set after a successful stock-in or stock-out to allow printing
  const [lastVoucher, setLastVoucher] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const preselectedId = localStorage.getItem('preselected_material_id');
    const preselectedTab = localStorage.getItem('preselected_transaction_tab');
    if (preselectedId) {
      localStorage.removeItem('preselected_material_id');
      const mat = materials.find(m => String(m.id) === String(preselectedId));
      if (mat) {
        if (preselectedTab === 'ADJUST') {
          setAdjustData(prev => ({ ...prev, material_id: mat.id, new_quantity: mat.current_stock }));
          setActiveTab('ADJUST');
        } else if (preselectedTab === 'STOCK_IN') {
          setStockInData(prev => ({ ...prev, material_id: mat.id, unit_cost: mat.unit_cost }));
          setActiveTab('STOCK_IN');
        } else if (preselectedTab === 'STOCK_OUT') {
          setStockOutData(prev => ({ ...prev, material_id: mat.id }));
          setActiveTab('STOCK_OUT');
        }
      }
    }
    if (preselectedTab) {
      localStorage.removeItem('preselected_transaction_tab');
    }
  }, [materials]);

  const canOperate = ['Director', 'Administrator', 'Manager', 'Storekeeper'].includes(currentUser?.role);
  const canApprove = ['Director', 'Administrator', 'Manager'].includes(currentUser?.role);
  const canDispose = ['Director', 'Administrator', 'Manager', 'Storekeeper'].includes(currentUser?.role);

  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const mat = materials.find(m => m.id == stockInData.material_id);
      const sup = suppliers.find(s => s.id == stockInData.supplier_id);
      const result = await onStockIn(stockInData);
      setLastVoucher({
        type: 'RECEIVING',
        title: 'Goods Received Note (GRN)',
        code: result?.transaction_code || `GRN-${Date.now()}`,
        date: new Date().toLocaleString(),
        material: mat ? `${mat.material_code} — ${mat.name}` : stockInData.material_id,
        quantity: stockInData.quantity,
        unit: mat?.unit_of_measure || '',
        unitCost: stockInData.unit_cost,
        totalCost: (parseFloat(stockInData.unit_cost) || 0) * (parseInt(stockInData.quantity) || 0),
        supplier: sup ? sup.name : 'N/A',
        purpose: stockInData.purpose,
        paymentMethod: stockInData.payment_method,
        location: stockInData.store_location,
        remarks: stockInData.remarks,
        receivedBy: currentUser?.full_name || currentUser?.username,
      });
      toast.success('✅ Stock In transaction recorded successfully!');
      setActiveTab('VOUCHER');
    } catch (err) {
      toast.error(`❌ Failed to record Stock In: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStockOutSubmit = async (e) => {
    e.preventDefault();
    const mat = materials.find(m => m.id == stockOutData.material_id);
    if (mat && mat.current_stock < stockOutData.quantity) {
      toast.error(`⚠️ Insufficient stock! Available: ${mat.current_stock} ${mat.unit_of_measure}`);
      return;
    }
    setSaving(true);
    try {
      const emp = employees.find(e => e.id == stockOutData.employee_dept_id);
      const result = await onStockOut(stockOutData);
      const isPending = result?.status === 'Pending Approval' || currentUser?.role === 'Storekeeper';
      setLastVoucher({
        type: 'ISSUE',
        title: 'Material Issue Voucher (MIV)',
        code: result?.transaction_code || `MIV-${Date.now()}`,
        date: new Date().toLocaleString(),
        material: mat ? `${mat.material_code} — ${mat.name}` : stockOutData.material_id,
        quantity: stockOutData.quantity,
        unit: mat?.unit_of_measure || '',
        unitCost: mat?.unit_cost || 0,
        totalCost: (parseFloat(mat?.unit_cost) || 0) * (parseInt(stockOutData.quantity) || 0),
        issuedTo: emp ? `${emp.name} (${emp.department_name || emp.type})` : 'N/A',
        purpose: stockOutData.purpose,
        remarks: stockOutData.remarks,
        issuedBy: currentUser?.full_name || currentUser?.username,
        status: isPending ? 'Pending Approval' : 'Approved',
      });
      if (isPending) {
        toast.success('✅ Material issued & transaction submitted for approval!');
      } else {
        toast.success('✅ Material issued successfully!');
      }
      onRefresh?.();
      setActiveTab('VOUCHER');
    } catch (err) {
      toast.error(`❌ Failed to issue material: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onReturn(returnData);
      toast.success('✅ Material return recorded successfully!');
      setActiveTab('HISTORY');
    } catch (err) {
      toast.error(`❌ Failed to record return: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onAdjust(adjustData);
      toast.success('✅ Stock level adjusted successfully!');
      setActiveTab('HISTORY');
    } catch (err) {
      toast.error(`❌ Failed to adjust stock level: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisposalSubmit = async (e) => {
    e.preventDefault();
    if (!disposalData.material_id) return toast.error('Please select a material');
    if (!disposalData.reason.trim()) return toast.error('Disposal reason is required');
    setDisposalSubmitting(true);
    try {
      const res = await apiFetch('/disposals', {
        method: 'POST',
        body: JSON.stringify(disposalData)
      });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) {
        toast.error(`❌ ${data?.error || 'Failed to submit disposal'}`);
        return;
      }
      toast.success(`✅ Disposal ${data.disposal_code} submitted for approval`);
      setDisposalData({ material_id: '', quantity: 1, disposal_type: 'Damaged', reason: '', remarks: '' });
      onRefresh?.();
      setActiveTab('DISPOSAL');
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setDisposalSubmitting(false);
    }
  };

  const handleApproveDisposal = async (id) => {
    try {
      const res = await apiFetch(`/disposals/${id}/approve`, { method: 'PUT', body: JSON.stringify({}) });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) { toast.error(`❌ ${data?.error || 'Approval failed'}`); return; }
      toast.success('✅ Disposal approved — stock deducted');
      onRefresh?.();
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const handleRejectDisposal = async (id) => {
    try {
      const res = await apiFetch(`/disposals/${id}/reject`, { method: 'PUT', body: JSON.stringify({}) });
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) { toast.error(`❌ ${data?.error || 'Rejection failed'}`); return; }
      toast.success('Disposal rejected.');
      onRefresh?.();
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  // Transaction Approval Handlers
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showTxRejectModal, setShowTxRejectModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [txRejectionRemark, setTxRejectionRemark] = useState('');

  const handleApproveTx = async (tx) => {
    try {
      const res = await apiFetch(`/transactions/${tx.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: 'Approved' })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Approval failed'); return; }
      toast.success(`Transaction ${tx.transaction_code} approved`);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    }
  };

  const openTxRejectModal = (tx) => {
    setSelectedTx(tx);
    setTxRejectionRemark('');
    setShowTxRejectModal(true);
  };

  const handleRejectTxSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (!txRejectionRemark.trim()) return toast.error('Rejection reason is required');
    try {
      const res = await apiFetch(`/transactions/${selectedTx.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: txRejectionRemark })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Rejection failed'); return; }
      toast.success(`Transaction ${selectedTx.transaction_code} rejected and stock restored`);
      setShowTxRejectModal(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Rejection failed');
    }
  };

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === 'ALL' || tx.transaction_type === filterType;
    const matchesStatus = statusFilter === 'ALL' || (tx.status || 'Approved') === statusFilter;
    const matchesSearch = (tx.material_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.transaction_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.receiver_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const d = tx.transaction_date ? new Date(tx.transaction_date) : null;
    const matchesFrom = !dateFrom || (d && d >= new Date(dateFrom));
    const matchesTo = !dateTo || (d && d <= new Date(dateTo + 'T23:59:59'));
    return matchesType && matchesStatus && matchesSearch && matchesFrom && matchesTo;
  });

  const pendingTxCount = transactions.filter(t => t.status === 'Pending Approval').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Sub-navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Track stock in, stock out, returns, physical stock adjustments, and history</p>
      </div>

      {/* Tabs */}
      <div className="glass-card" style={{ padding: '8px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        <button
          className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          <History size={16} /> Transaction History
          {pendingTxCount > 0 && (
            <span style={{ marginLeft: '4px', background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: '700' }}>
              {pendingTxCount}
            </span>
          )}
        </button>
        {lastVoucher && (
          <button
            className={`btn ${activeTab === 'VOUCHER' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('VOUCHER')}
            style={{ borderColor: activeTab !== 'VOUCHER' ? 'rgba(16,185,129,0.4)' : undefined, color: activeTab !== 'VOUCHER' ? '#10b981' : undefined }}
          >
            <Printer size={16} /> Last Voucher
          </button>
        )}
        {canOperate && (
          <>
            <button
              className={`btn ${activeTab === 'STOCK_IN' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (materials.length > 0 && !stockInData.material_id) {
                  setStockInData({ ...stockInData, material_id: materials[0].id, unit_cost: materials[0].unit_cost });
                }
                setActiveTab('STOCK_IN');
              }}
            >
              <ArrowDownLeft size={16} /> Stock In (Receive)
            </button>
            <button
              className={`btn ${activeTab === 'STOCK_OUT' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (materials.length > 0 && !stockOutData.material_id) {
                  setStockOutData({ ...stockOutData, material_id: materials[0].id });
                }
                setActiveTab('STOCK_OUT');
              }}
            >
              <ArrowUpRight size={16} /> Stock Out (Issue)
            </button>
            <button
              className={`btn ${activeTab === 'RETURN' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (materials.length > 0 && !returnData.material_id) {
                  setReturnData({ ...returnData, material_id: materials[0].id });
                }
                setActiveTab('RETURN');
              }}
            >
              <RotateCcw size={16} /> Material Return
            </button>
            <button
              className={`btn ${activeTab === 'ADJUST' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (materials.length > 0 && !adjustData.material_id) {
                  setAdjustData({ ...adjustData, material_id: materials[0].id, new_quantity: materials[0].current_stock });
                }
                setActiveTab('ADJUST');
              }}
            >
              <Sliders size={16} /> Stock Adjustment
            </button>
          </>
        )}
        {canDispose && (
          <button
            className={`btn ${activeTab === 'DISPOSAL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('DISPOSAL')}
            style={{ borderColor: activeTab === 'DISPOSAL' ? '' : 'rgba(239,68,68,0.4)', color: activeTab === 'DISPOSAL' ? '' : '#f87171' }}
          >
            <Trash2 size={16} /> Disposals
            {disposals.filter(d => d.status === 'Pending Approval').length > 0 && (
              <span style={{ marginLeft: '4px', background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: '700' }}>
                {disposals.filter(d => d.status === 'Pending Approval').length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TABS CONTENT */}

      {/* 1. TRANSACTION HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '10px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '2 1 160px', minWidth: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search code, material, recipient…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '30px', height: '32px', fontSize: '0.78rem' }}
              />
            </div>
            <select className="form-select" style={{ flex: '1 1 110px', minWidth: 0, height: '32px', fontSize: '0.78rem' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="ALL">All Types</option>
              <option value="STOCK_IN">Stock In</option>
              <option value="STOCK_OUT">Stock Out</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
            <select className="form-select" style={{ flex: '1 1 120px', minWidth: 0, height: '32px', fontSize: '0.78rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="Pending Approval">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <input type="date" className="form-input" style={{ flex: '1 1 120px', minWidth: 0, height: '32px', fontSize: '0.78rem' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <input type="date" className="form-input" style={{ flex: '1 1 120px', minWidth: 0, height: '32px', fontSize: '0.78rem' }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
            {(dateFrom || dateTo) && (
              <button className="btn btn-secondary btn-sm" style={{ height: '32px', flexShrink: 0 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            )}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{filteredTransactions.length} records</span>
          </div>

          <div className="table-responsive-container glass-card" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table table-dense" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.74rem' }}>
              <colgroup>
                <col style={{ width: '10%' }} />  {/* Code */}
                <col style={{ width: '9%' }} />   {/* Type */}
                <col style={{ width: '14%' }} />  {/* Material */}
                <col style={{ width: '6%' }} />   {/* Qty */}
                <col style={{ width: '8%' }} />   {/* Total */}
                <col style={{ width: '7%' }} />   {/* Payment */}
                <col style={{ width: '13%' }} />  {/* Source */}
                <col style={{ width: '14%' }} />  {/* Purpose */}
                <col style={{ width: '9%' }} />   {/* Issued By */}
                <col style={{ width: '9%' }} />   {/* Status */}
                <col style={{ width: '11%' }} />  {/* Date */}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Code</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Material</th>
                  <th style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Payment</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Source / Recipient</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Purpose</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Issued By</th>
                  <th style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={canApprove ? 12 : 11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No transaction records found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    let badgeStyle = 'badge-info';
                    if (tx.transaction_type === 'STOCK_IN') badgeStyle = 'badge-success';
                    if (tx.transaction_type === 'STOCK_OUT') badgeStyle = 'badge-danger';
                    if (tx.transaction_type === 'RETURN') badgeStyle = 'badge-warning';

                    const txStatus = tx.status || 'Approved';

                    return (
                      <tr key={tx.id}>
                        {/* Code */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: '600', color: '#818cf8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.transaction_code}>
                            {tx.transaction_code}
                          </span>
                        </td>

                        {/* Type */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <span className={`badge ${badgeStyle}`} style={{ fontSize: '0.58rem', padding: '2px 5px' }}>
                            {tx.transaction_type}
                          </span>
                        </td>

                        {/* Material */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <div
                            style={{ fontWeight: '700', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={tx.material_name}
                          >
                            {tx.material_name}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.material_code}</div>
                        </td>

                        {/* Quantity */}
                        <td style={{ textAlign: 'center', overflow: 'hidden', maxWidth: 0 }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.7rem',
                            color: tx.transaction_type === 'STOCK_OUT' ? 'var(--danger)' : '#10b981',
                            background: tx.transaction_type === 'STOCK_OUT' ? 'rgba(255, 65, 58, 0.08)' : 'rgba(0, 172, 105, 0.08)',
                            padding: '1px 4px', borderRadius: '4px', display: 'inline-block',
                          }}>
                            {tx.transaction_type === 'STOCK_OUT' ? `-${tx.quantity}` : `+${tx.quantity}`}
                          </span>
                        </td>

                        {/* Total Value */}
                        <td style={{ textAlign: 'right', overflow: 'hidden', maxWidth: 0 }}>
                          <span style={{ fontWeight: '700', color: '#10b981', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            {(sanitizeNumber(tx.quantity) * sanitizeNumber(tx.unit_cost)).toLocaleString()} <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>ETB</span>
                          </span>
                        </td>

                        {/* Payment */}
                        <td style={{ textAlign: 'center', overflow: 'hidden', maxWidth: 0 }}>
                          {tx.transaction_type === 'STOCK_IN' ? (
                            <span className="badge badge-info" style={{ fontSize: '0.58rem', padding: '2px 4px' }}>{sanitizeText(tx.payment_method, 'Cash')}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Source / Recipient */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <div
                            style={{ fontSize: '0.7rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={tx.supplier_name ? `Supplier: ${tx.supplier_name}` : tx.receiver_name}
                          >
                            {tx.supplier_name ? `Supplier: ${sanitizeText(tx.supplier_name, '')}` : sanitizeText(tx.receiver_name, 'Department')}
                          </div>
                        </td>

                        {/* Purpose */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <div
                            style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={tx.purpose}
                          >
                            {sanitizeText(tx.purpose, '—')}
                          </div>
                        </td>

                        {/* Issued By */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={tx.issued_by_name}>
                            {sanitizeText(tx.issued_by_name, 'Storekeeper')}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: 'center', overflow: 'hidden', maxWidth: 0 }}>
                          <span className={`badge ${txStatus === 'Approved' ? 'badge-success' : txStatus === 'Rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.58rem', padding: '2px 5px' }}>
                            {txStatus === 'Pending Approval' && <Clock size={9} style={{ marginRight: '1px' }} />}
                            {txStatus === 'Approved' && <CheckCircle2 size={9} style={{ marginRight: '1px' }} />}
                            {txStatus === 'Rejected' && <XCircle size={9} style={{ marginRight: '1px' }} />}
                            {txStatus === 'Pending Approval' ? 'Pending' : txStatus}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td style={{ overflow: 'hidden', maxWidth: 0 }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                            {new Date(tx.transaction_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </td>

                        {/* Actions — removed */}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. STOCK IN FORM */}
      {activeTab === 'STOCK_IN' && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowDownLeft color="#10b981" /> Receive Materials (Stock In)
          </h3>
          <form onSubmit={handleStockInSubmit}>
            <div className="transaction-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Select Material</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    className="form-select"
                    value={stockInData.material_id}
                    onChange={e => {
                      const mat = materials.find(m => m.id == e.target.value);
                      setStockInData({
                        ...stockInData,
                        material_id: e.target.value,
                        unit_cost: mat ? mat.unit_cost : 0
                      });
                    }}
                    required
                    style={{ flex: 1 }}
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_code} - {m.name} (Current Stock: {m.current_stock} {m.unit_of_measure})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={() => { setScannerTarget('in'); setShowScanner(true); }} title="Scan barcode" style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    <Camera size={16} /> Scan
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity Received</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={stockInData.quantity}
                  onChange={e => setStockInData({ ...stockInData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price / Cost (Birr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={stockInData.unit_cost}
                  onChange={e => setStockInData({ ...stockInData, unit_cost: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={stockInData.payment_method}
                  onChange={e => setStockInData({ ...stockInData, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Payment">Mobile Payment</option>
                  <option value="Credit">Credit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Supplier Source</label>
                <select
                  className="form-select"
                  value={stockInData.supplier_id}
                  onChange={e => setStockInData({ ...stockInData, supplier_id: e.target.value })}
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Purpose / Purchase Order #</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. PO #8902 Quarterly Restock"
                  value={stockInData.purpose}
                  onChange={e => setStockInData({ ...stockInData, purpose: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Remarks & Inspection Notes</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Inspected and received in good condition..."
                  value={stockInData.remarks}
                  onChange={e => setStockInData({ ...stockInData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setActiveTab('HISTORY')}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={saving}><ArrowDownLeft size={16} /> {saving ? 'Saving…' : 'Submit Stock In'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. STOCK OUT FORM */}
      {activeTab === 'STOCK_OUT' && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpRight color="#ef4444" /> Issue Materials (Stock Out)
          </h3>
          <form onSubmit={handleStockOutSubmit}>
            <div className="transaction-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Select Material to Issue</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    className="form-select"
                    value={stockOutData.material_id}
                    onChange={e => setStockOutData({ ...stockOutData, material_id: e.target.value })}
                    required
                    style={{ flex: 1 }}
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_code} - {m.name} (Available: {m.current_stock} {m.unit_of_measure})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={() => { setScannerTarget('out'); setShowScanner(true); }} title="Scan barcode" style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    <Camera size={16} /> Scan
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity to Issue</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={stockOutData.quantity}
                  onChange={e => setStockOutData({ ...stockOutData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Recipient (Employee or Department)</label>
                <select
                  className="form-select"
                  value={stockOutData.employee_dept_id}
                  onChange={e => setStockOutData({ ...stockOutData, employee_dept_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Recipient --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      [{e.type}] {e.name} ({e.department_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Purpose of Issue</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. IT Workstation setup, Project deployment..."
                  value={stockOutData.purpose}
                  onChange={e => setStockOutData({ ...stockOutData, purpose: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Remarks & Approval Notes</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Issued by storekeeper, approved by Manager..."
                  value={stockOutData.remarks}
                  onChange={e => setStockOutData({ ...stockOutData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setActiveTab('HISTORY')}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={saving}><ArrowUpRight size={16} /> {saving ? 'Saving…' : 'Confirm Material Issue'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 4. RETURN FORM */}
      {activeTab === 'RETURN' && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw color="#f59e0b" /> Record Material Return
          </h3>
          <form onSubmit={handleReturnSubmit}>
            <div className="transaction-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Material Returned</label>
                <select
                  className="form-select"
                  value={returnData.material_id}
                  onChange={e => setReturnData({ ...returnData, material_id: e.target.value })}
                  required
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.material_code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity Returned</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={returnData.quantity}
                  onChange={e => setReturnData({ ...returnData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Returned By (Employee / Dept)</label>
                <select
                  className="form-select"
                  value={returnData.employee_dept_id}
                  onChange={e => setReturnData({ ...returnData, employee_dept_id: e.target.value })}
                >
                  <option value="">-- Select Employee / Dept --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.department_name})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Condition & Return Remarks</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={returnData.remarks}
                  onChange={e => setReturnData({ ...returnData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setActiveTab('HISTORY')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}><RotateCcw size={16} /> {saving ? 'Saving…' : 'Record Return'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 5. ADJUSTMENT FORM */}
      {activeTab === 'ADJUST' && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders color="#6366f1" /> Physical Stock Count Adjustment
          </h3>
          <form onSubmit={handleAdjustSubmit}>
            <div className="transaction-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Material for Stock Audit Adjustment</label>
                <select
                  className="form-select"
                  value={adjustData.material_id}
                  onChange={e => {
                    const mat = materials.find(m => m.id == e.target.value);
                    setAdjustData({
                      ...adjustData,
                      material_id: e.target.value,
                      new_quantity: mat ? mat.current_stock : 0
                    });
                  }}
                  required
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.material_code} - {m.name} (System Stock: {m.current_stock} {m.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Verified Physical Stock Count</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={adjustData.new_quantity}
                  onChange={e => setAdjustData({ ...adjustData, new_quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Audit Note & Variance Rationale</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Physical audit recount variance explanation..."
                  value={adjustData.remarks}
                  onChange={e => setAdjustData({ ...adjustData, remarks: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setActiveTab('HISTORY')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}><Sliders size={16} /> {saving ? 'Saving…' : 'Reconcile Stock Count'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* 7. VOUCHER TAB */}
      {activeTab === 'VOUCHER' && lastVoucher && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setActiveTab('HISTORY')}>
              ← Back to History
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={15} /> Print Voucher
            </button>
          </div>

          <div className="glass-card" id="printable-voucher" style={{ padding: '32px', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
            {/* Voucher Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--bg-border)' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-muted-strong)', marginBottom: '4px' }}>
                {lastVoucher.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span><strong>Ref #:</strong> {lastVoucher.code}</span>
                <span><strong>Date:</strong> {lastVoucher.date}</span>
              </div>
            </div>

            {/* Voucher Body */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
              <tbody>
                {[
                  ['Material', lastVoucher.material],
                  ['Quantity', `${lastVoucher.quantity} ${lastVoucher.unit}`],
                  ['Unit Cost', formatCurrency(lastVoucher.unitCost)],
                  ['Total Cost', formatCurrency(lastVoucher.totalCost)],
                  lastVoucher.type === 'RECEIVING'
                    ? ['Supplier', lastVoucher.supplier]
                    : ['Issued To', lastVoucher.issuedTo],
                  ['Purpose', lastVoucher.purpose],
                  lastVoucher.type === 'RECEIVING'
                    ? ['Payment Method', lastVoucher.paymentMethod]
                    : null,
                  lastVoucher.type === 'RECEIVING'
                    ? ['Store / Location', lastVoucher.location]
                    : null,
                  ['Remarks', lastVoucher.remarks || '—'],
                  lastVoucher.type === 'RECEIVING'
                    ? ['Received By', lastVoucher.receivedBy]
                    : ['Issued By', lastVoucher.issuedBy],
                ].filter(Boolean).map(([label, value], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                    <td style={{ padding: '10px 0', fontWeight: '600', color: 'var(--text-muted)', width: '140px', verticalAlign: 'top' }}>{label}</td>
                    <td style={{ padding: '10px 0 10px 16px', color: 'var(--text-primary)' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '24px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--bg-border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid var(--text-muted)', paddingBottom: '4px', marginBottom: '6px', minHeight: '32px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {lastVoucher.type === 'RECEIVING' ? 'Received By' : 'Issued By'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid var(--text-muted)', paddingBottom: '4px', marginBottom: '6px', minHeight: '32px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Approved By / Supervisor</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-muted)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              This voucher was generated by the Store Management System. Keep for audit records.
            </div>
          </div>
        </div>
      )}

      {/* 6. DISPOSAL TAB */}
      {activeTab === 'DISPOSAL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Submit new disposal — Storekeeper / Manager / Admin */}
          {canDispose && (
            <div className="glass-card" style={{ padding: '24px', maxWidth: '700px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} color="#ef4444" /> Record Material Disposal
              </h3>
              <form onSubmit={handleDisposalSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Material to Dispose *</label>
                    <select
                      className="form-select"
                      value={disposalData.material_id}
                      onChange={e => setDisposalData({ ...disposalData, material_id: e.target.value })}
                      required
                    >
                      <option value="">-- Select material --</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.material_code} – {m.name} (Stock: {m.current_stock} {m.unit_of_measure})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input
                      type="number" className="form-input" min="1"
                      value={disposalData.quantity}
                      onChange={e => setDisposalData({ ...disposalData, quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Disposal Type *</label>
                    <select
                      className="form-select"
                      value={disposalData.disposal_type}
                      onChange={e => setDisposalData({ ...disposalData, disposal_type: e.target.value })}
                    >
                      <option value="Damaged">Damaged</option>
                      <option value="Expired">Expired</option>
                      <option value="Obsolete">Obsolete</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Reason *</label>
                    <input
                      type="text" className="form-input"
                      placeholder="e.g. Items found broken during stock audit…"
                      value={disposalData.reason}
                      onChange={e => setDisposalData({ ...disposalData, reason: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Additional Remarks</label>
                    <textarea
                      className="form-textarea" rows="2"
                      placeholder="Optional additional notes…"
                      value={disposalData.remarks}
                      onChange={e => setDisposalData({ ...disposalData, remarks: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-danger" disabled={disposalSubmitting}>
                    <Trash2 size={15} /> {disposalSubmitting ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Disposal list with approve button for managers */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-muted-strong)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={15} color="#ef4444" /> Disposal Records
              </span>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: '30px', height: '32px', fontSize: '13px', width: '220px' }}
                  placeholder="Search disposals…"
                  value={disposalSearch}
                  onChange={e => setDisposalSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="table-responsive-container">
              <table className="data-table table-dense" style={{ minWidth: '850px' }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Recorded By</th>
                    <th>Status</th>
                    <th>Date</th>
                    {canApprove && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {disposals.length === 0 ? (
                    <tr><td colSpan={canApprove ? 9 : 8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No disposal records yet.</td></tr>
                  ) : disposals
                    .filter(d =>
                      !disposalSearch ||
                      (d.material_name || '').toLowerCase().includes(disposalSearch.toLowerCase()) ||
                      (d.disposal_code || '').toLowerCase().includes(disposalSearch.toLowerCase()) ||
                      (d.reason || '').toLowerCase().includes(disposalSearch.toLowerCase())
                    )
                    .map(d => (
                      <tr key={d.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#818cf8' }}>{d.disposal_code}</td>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>{d.material_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.material_code}</div>
                        </td>
                        <td style={{ fontWeight: '700', color: '#ef4444' }}>{d.quantity}</td>
                        <td><span className="badge badge-warning">{d.disposal_type}</span></td>
                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{d.reason}</td>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{sanitizeText(d.recorder_name, 'Recorder pending')}</td>
                        <td>
                          {d.status === 'Approved'
                            ? <span className="badge badge-success"><CheckCircle2 size={11} /> Approved</span>
                            : d.status === 'Rejected'
                              ? <span className="badge badge-danger">Rejected</span>
                              : <span className="badge badge-warning"><Clock size={11} /> Pending</span>}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {d.disposal_date ? new Date(d.disposal_date).toLocaleDateString() : '—'}
                        </td>
                        {canApprove && (
                          <td>
                            {d.status === 'Pending Approval' && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleApproveDisposal(d.id)}
                                  style={{ fontSize: '12px', padding: '4px 10px' }}
                                >
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRejectDisposal(d.id)}
                                  style={{ fontSize: '12px', padding: '4px 10px' }}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScannerModal
          onClose={() => setShowScanner(false)}
          onScan={handleScanSuccess}
        />
      )}

      {/* Transaction Rejection Modal */}
      {showTxRejectModal && selectedTx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--danger)' }}>
                Reject Transaction — {selectedTx.transaction_code}
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px' }}
                onClick={() => setShowTxRejectModal(false)}
              >×</button>
            </div>
            <form onSubmit={handleRejectTxSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,65,58,0.06)', border: '1px solid rgba(255,65,58,0.18)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Rejecting transaction for <strong style={{ color: 'var(--text-muted-strong)' }}>{selectedTx.material_name}</strong> × {selectedTx.quantity}. Deducted stock will be restored to inventory.
                </div>
                <div className="form-group">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea
                    className="form-textarea" rows="3"
                    placeholder="Explain why this transaction is being rejected…"
                    value={txRejectionRemark}
                    onChange={e => setTxRejectionRemark(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxRejectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">
                  <XCircle size={14} /> Reject Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
