import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { FileText, Download, FileSpreadsheet, Printer, Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';

export default function ReportsCenter() {
  const {
    materials = [], categories = [], transactions = [],
    suppliers = [], employees = [], transfers = [], disposals = []
  } = useContext(DataContext) || {};

  const [activeReport, setActiveReport] = useState('CURRENT_STOCK');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [navOpen, setNavOpen] = useState(false); // mobile nav toggle
  const pageSize = 20;

  const reportTypes = [
    { id: 'CURRENT_STOCK', name: 'Current Stock' },
    { id: 'STOCK_IN', name: 'Stock In (Receiving)' },
    { id: 'STOCK_OUT', name: 'Stock Out (Issue)' },
    { id: 'RETURNS', name: 'Returns' },
    { id: 'ADJUSTMENTS', name: 'Adjustments' },
    { id: 'MATERIAL_BALANCE', name: 'Material Balance' },
    { id: 'LOW_STOCK', name: 'Low Stock Alert' },
    { id: 'TRANSFERS', name: 'Transfers' },
    { id: 'DISPOSALS', name: 'Disposals' },
    { id: 'EMPLOYEE_ISSUE', name: 'Employee Issue' },
    { id: 'DEPT_CONSUMPTION', name: 'Dept Consumption' },
    { id: 'SUPPLIER_REPORT', name: 'Supplier Summary' },
    { id: 'TRANSACTION_HISTORY', name: 'Transaction History' },
    { id: 'FIFO_VALUATION', name: 'FIFO Valuation' },
  ];

  const activeLabel = reportTypes.find(r => r.id === activeReport)?.name ?? activeReport;

  /* ─── date / category filtered sets ─── */
  const filteredMaterials = materials.filter(m =>
    selectedCategory === 'ALL' || m.category_id == selectedCategory || m.category_name === selectedCategory
  );

  const filteredTransactions = transactions.filter(t => {
    const d = t.transaction_date ? new Date(t.transaction_date) : null;
    if (dateFrom && d && d < new Date(dateFrom)) return false;
    if (dateTo && d && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  /* ─── report data builders ─── */
  const getReportData = () => {
    switch (activeReport) {
      case 'CURRENT_STOCK':
        return filteredMaterials.map(m => ({
          'Code': sanitizeText(m.material_code, 'N/A'),
          'Name': sanitizeText(m.name, 'Unknown'),
          'Category': sanitizeText(m.category_name, 'N/A'),
          'Stock': sanitizeNumber(m.current_stock),
          'UOM': sanitizeText(m.unit_of_measure, 'N/A'),
          'Unit Cost': formatCurrency(sanitizeNumber(m.unit_cost)),
          'Total': formatCurrency(sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost)),
          'Location': sanitizeText(m.location, 'N/A'),
        }));

      case 'STOCK_IN':
        return filteredTransactions.filter(t => t.transaction_type === 'STOCK_IN').map(t => ({
          'Code': t.transaction_code,
          'Material': t.material_name,
          'Qty': sanitizeNumber(t.quantity),
          'Unit Cost': formatCurrency(sanitizeNumber(t.unit_cost)),
          'Total': formatCurrency(sanitizeNumber(t.unit_cost) * sanitizeNumber(t.quantity)),
          'Payment': sanitizeText(t.payment_method, 'Cash'),
          'Supplier': sanitizeText(t.supplier_name, 'N/A'),
          'By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleDateString(),
        }));

      case 'STOCK_OUT':
        return filteredTransactions.filter(t => t.transaction_type === 'STOCK_OUT').map(t => ({
          'Code': t.transaction_code,
          'Material': t.material_name,
          'Qty': sanitizeNumber(t.quantity),
          'Issued To': sanitizeText(t.receiver_name, 'Dept'),
          'Purpose': sanitizeText(t.purpose, 'Issue'),
          'By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleDateString(),
        }));

      case 'RETURNS':
        return filteredTransactions.filter(t => t.transaction_type === 'RETURN').map(t => ({
          'Code': t.transaction_code,
          'Material': t.material_name,
          'Qty': sanitizeNumber(t.quantity),
          'Returned By': sanitizeText(t.receiver_name, 'Employee'),
          'Remarks': sanitizeText(t.remarks || t.purpose, 'Return'),
          'By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleDateString(),
        }));

      case 'ADJUSTMENTS':
        return filteredTransactions.filter(t => t.transaction_type === 'ADJUSTMENT').map(t => ({
          'Code': t.transaction_code,
          'Material': t.material_name,
          'Adj Qty': t.quantity,
          'Note': sanitizeText(t.purpose, '—'),
          'By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleDateString(),
        }));

      case 'MATERIAL_BALANCE':
        return filteredMaterials.map(m => {
          const totalIn = filteredTransactions.filter(t => t.material_id == m.id && t.transaction_type === 'STOCK_IN').reduce((a, c) => a + c.quantity, 0);
          const totalOut = filteredTransactions.filter(t => t.material_id == m.id && t.transaction_type === 'STOCK_OUT').reduce((a, c) => a + c.quantity, 0);
          return {
            'Code': m.material_code,
            'Name': m.name,
            'Total In': totalIn,
            'Total Out': totalOut,
            'Balance': sanitizeNumber(m.current_stock),
            'Unit Cost': formatCurrency(sanitizeNumber(m.unit_cost)),
            'Valuation': formatCurrency(sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost)),
          };
        });

      case 'LOW_STOCK':
        return filteredMaterials.filter(m => m.current_stock <= m.min_stock_level).map(m => ({
          'Code': m.material_code,
          'Name': m.name,
          'Category': sanitizeText(m.category_name, 'N/A'),
          'Stock': sanitizeNumber(m.current_stock),
          'Min': sanitizeNumber(m.min_stock_level),
          'Shortage': Math.max(0, sanitizeNumber(m.min_stock_level) - sanitizeNumber(m.current_stock)),
          'Supplier': sanitizeText(m.supplier_name, 'N/A'),
        }));

      case 'EMPLOYEE_ISSUE':
        return employees.map(emp => {
          const issued = filteredTransactions.filter(t => t.employee_dept_id == emp.id && t.transaction_type === 'STOCK_OUT');
          return {
            'Code': emp.code,
            'Name': emp.name,
            'Type': emp.type,
            'Dept': sanitizeText(emp.department_name, 'Unassigned'),
            'Tx Count': issued.length,
            'Total Qty': issued.reduce((a, c) => a + c.quantity, 0),
            'Contact': sanitizeText(emp.contact_number, 'N/A'),
          };
        });

      case 'DEPT_CONSUMPTION': {
        const deptMap = {};
        filteredTransactions.filter(t => t.transaction_type === 'STOCK_OUT').forEach(t => {
          const emp = employees.find(e => e.id == t.employee_dept_id);
          const dept = emp?.department_name || sanitizeText(t.receiver_name, 'Unknown');
          if (!deptMap[dept]) deptMap[dept] = { tx: 0, qty: 0, val: 0 };
          deptMap[dept].tx += 1;
          deptMap[dept].qty += sanitizeNumber(t.quantity);
          deptMap[dept].val += sanitizeNumber(t.quantity) * sanitizeNumber(t.unit_cost);
        });
        return Object.entries(deptMap).sort((a, b) => b[1].qty - a[1].qty).map(([dept, d]) => ({
          'Department': dept,
          'Transactions': d.tx,
          'Total Qty': d.qty,
          'Total Value': formatCurrency(d.val),
        }));
      }

      case 'TRANSFERS':
        return transfers.map(t => ({
          'Code': t.transfer_code,
          'Material': sanitizeText(t.material_name, '—'),
          'Qty': sanitizeNumber(t.quantity),
          'From': t.source_location,
          'To': t.destination_location,
          'By': sanitizeText(t.transferred_by_name, '—'),
          'Date': t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '—',
        }));

      case 'DISPOSALS':
        return disposals.map(d => ({
          'Code': d.disposal_code,
          'Material': sanitizeText(d.material_name, '—'),
          'Qty': sanitizeNumber(d.quantity),
          'Type': sanitizeText(d.disposal_type, '—'),
          'Reason': sanitizeText(d.reason, '—'),
          'Status': d.status,
          'By': sanitizeText(d.recorder_name, '—'),
          'Date': d.disposal_date ? new Date(d.disposal_date).toLocaleDateString() : '—',
        }));

      case 'SUPPLIER_REPORT':
        return suppliers.map(sup => ({
          'Code': sup.supplier_code,
          'Company': sanitizeText(sup.name, 'Unnamed'),
          'Contact': sanitizeText(sup.contact_person, 'N/A'),
          'Email': sanitizeText(sup.email, 'N/A'),
          'Phone': sanitizeText(sup.phone, 'N/A'),
          'Materials': materials.filter(m => m.supplier_id == sup.id).length,
        }));

      case 'TRANSACTION_HISTORY':
        return filteredTransactions.map(t => ({
          'Code': t.transaction_code,
          'Type': t.transaction_type,
          'Material': t.material_name,
          'Qty': t.quantity,
          'Value': formatCurrency(sanitizeNumber(t.unit_cost) * sanitizeNumber(t.quantity)),
          'Payment': t.transaction_type === 'STOCK_IN' ? sanitizeText(t.payment_method, 'Cash') : '—',
          'Party': t.supplier_name ? sanitizeText(t.supplier_name, 'N/A') : sanitizeText(t.receiver_name, 'N/A'),
          'By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleDateString(),
        }));

      case 'FIFO_VALUATION':
        return filteredMaterials.map(mat => {
          const stockIns = transactions
            .filter(t => (t.material_id == mat.id || t.material_code === mat.material_code) && t.transaction_type === 'STOCK_IN')
            .sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
          const totalOut = transactions
            .filter(t => (t.material_id == mat.id || t.material_code === mat.material_code) && t.transaction_type === 'STOCK_OUT')
            .reduce((s, t) => s + (Number(t.quantity) || 0), 0);
          let deduct = totalOut, fifoVal = 0, fifoQty = 0;
          stockIns.forEach(b => {
            const bq = Number(b.quantity) || 0, bc = Number(b.unit_cost) || Number(mat.unit_cost) || 0;
            if (deduct >= bq) { deduct -= bq; }
            else { const r = bq - deduct; deduct = 0; fifoQty += r; fifoVal += r * bc; }
          });
          const cur = Number(mat.current_stock) || 0;
          if (fifoQty < cur) { fifoVal += (cur - fifoQty) * (Number(mat.unit_cost) || 0); fifoQty = cur; }
          const fifoUnit = cur > 0 ? fifoVal / cur : 0;
          return {
            'Code': mat.material_code,
            'Name': mat.name,
            'Category': mat.category_name || 'General',
            'Stock': `${cur} ${mat.unit_of_measure || ''}`.trim(),
            'FIFO Value': formatCurrency(fifoVal),
            'FIFO Unit': formatCurrency(fifoUnit),
            'Std Unit': formatCurrency(mat.unit_cost || 0),
            'Variance': formatCurrency(fifoVal - (cur * (mat.unit_cost || 0))),
          };
        });

      default: return [];
    }
  };

  const reportData = getReportData();

  const processedData = activeReport === 'TRANSACTION_HISTORY'
    ? reportData.filter(row => {
      const matchSearch = Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === 'ALL' || row['Type'] === typeFilter;
      return matchSearch && matchType;
    })
    : reportData;

  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = activeReport === 'TRANSACTION_HISTORY'
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData;

  const txTypeColor = { STOCK_IN: '#d1fae5', STOCK_OUT: '#fee2e2', RETURN: '#fef3c7', ADJUSTMENT: '#dbeafe' };

  /* ─── Export CSV ─── */
  const handleExportExcel = () => {
    if (!reportData.length) return;
    const headers = Object.keys(reportData[0]);
    const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [headers, ...reportData.map(r => headers.map(h => r[h]))].map(r => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), { href: url, download: `${activeReport}_${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  /* ─── Export PDF ─── */
  const handleExportPDF = async () => {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Store Management — ${activeLabel}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    if (reportData.length) {
      doc.autoTable({ startY: 25, head: [Object.keys(reportData[0])], body: reportData.map(r => Object.values(r)), theme: 'striped', headStyles: { fillColor: [99, 102, 241] }, styles: { fontSize: 7 } });
    }
    doc.save(`${activeReport}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ─── styles ─── */
  const s = {
    shell: { width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 },
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    btnRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
    layout: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, alignItems: 'start' },
    navCard: { background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 8, overflow: 'hidden' },
    navTitle: { padding: '7px 10px', fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface-muted)' },
    navBtn: (active) => ({
      display: 'block', width: '100%', textAlign: 'left',
      padding: '6px 10px', border: 'none', cursor: 'pointer',
      fontSize: '0.72rem', fontWeight: active ? 700 : 400, lineHeight: 1.3,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-primary)',
      transition: 'background 0.12s ease, color 0.12s ease',
      borderLeft: 'none',
    }),
    rightCol: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
    filterCard: { background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 8, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    tableWrap: { background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 8, overflow: 'hidden', width: '100%', minWidth: 0 },
  };

  return (
    <div style={s.shell}>

      {/* ── Top action bar ── */}
      <div style={s.topBar}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Generate and export real-time reports to PDF &amp; Excel
        </p>
        <div style={s.btnRow}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
            <FileSpreadsheet size={13} color="#10b981" /> CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      {/* ── Mobile report picker (collapsed on small screens) ── */}
      <div style={{ display: 'none' }} className="reports-mobile-picker">
        <button
          onClick={() => setNavOpen(o => !o)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
          {activeLabel}
          {navOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {navOpen && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            {reportTypes.map(r => (
              <button key={r.id} style={s.navBtn(activeReport === r.id)} onClick={() => { setActiveReport(r.id); setCurrentPage(1); setNavOpen(false); }}>
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div style={s.layout} className="reports-layout-grid">

        {/* Left nav */}
        <div style={s.navCard} className="reports-nav-panel">
          <div style={s.navTitle}>Report Type</div>
          <div>
            {reportTypes.map(r => (
              <button
                key={r.id}
                style={s.navBtn(activeReport === r.id)}
                onMouseEnter={e => { if (activeReport !== r.id) e.currentTarget.style.background = 'var(--bg-surface-muted)'; }}
                onMouseLeave={e => { if (activeReport !== r.id) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setActiveReport(r.id); setCurrentPage(1); }}>
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div style={s.rightCol}>

          {/* Filters */}
          <div style={s.filterCard}>
            <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>Filter:</span>

            <select className="form-select" style={{ flex: '1 1 120px', minWidth: 0, maxWidth: 160 }}
              value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="ALL">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: '1 1 auto' }}>
              <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="date" className="form-input" style={{ flex: '1 1 110px', minWidth: 0, maxWidth: 130 }}
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>–</span>
              <input type="date" className="form-input" style={{ flex: '1 1 110px', minWidth: 0, maxWidth: 130 }}
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}
                  onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Clear
                </button>
              )}
            </div>

            {activeReport === 'TRANSACTION_HISTORY' && (
              <>
                <input type="text" placeholder="Search…" className="form-input"
                  style={{ flex: '1 1 100px', minWidth: 0, maxWidth: 140 }}
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <select className="form-select" style={{ flex: '1 1 100px', minWidth: 0, maxWidth: 130 }}
                  value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="ALL">All Types</option>
                  <option value="STOCK_IN">Stock In</option>
                  <option value="STOCK_OUT">Stock Out</option>
                  <option value="RETURN">Return</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </>
            )}

            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
              {processedData.length} rows
            </span>
          </div>

          {/* Table */}
          <div style={s.tableWrap}>
            {paginatedData.length === 0 ? (
              <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No records for this report.
              </div>
            ) : (() => {
              const cols = Object.keys(paginatedData[0]);
              const n = cols.length;
              const colW = `${(100 / n).toFixed(2)}%`;
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.75rem' }}>
                  <colgroup>
                    {cols.map((_, i) => <col key={i} style={{ width: colW }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-muted)' }}>
                      {cols.map((h, i) => (
                        <th key={i} style={{
                          padding: '7px 10px',
                          textAlign: 'left',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid var(--bg-border)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, ri) => (
                      <tr key={ri} style={{
                        borderBottom: '1px solid var(--bg-border)',
                        background: activeReport === 'TRANSACTION_HISTORY'
                          ? (txTypeColor[row['Type']] ?? 'transparent')
                          : 'transparent',
                      }}>
                        {Object.entries(row).map(([key, val], ci) => (
                          <td key={ci}
                            title={String(val)}
                            style={{
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 0,
                            }}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}

            {/* Pagination */}
            {activeReport === 'TRANSACTION_HISTORY' && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 14px', gap: 8, borderTop: '1px solid var(--bg-border)' }}>
                <button className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>
                  ← Prev
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button className="btn btn-secondary btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
