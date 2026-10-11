import React, { useState, useEffect } from 'react';
import { FileText, Search, Printer, Calendar, User, Eye, ArrowLeft } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { formatCurrency } from '../utils/currency';

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  const fetchReceipts = async () => {
    try {
      const res = await apiFetch('/receipts');
      if (res.ok) {
        const result = await res.json();
        setReceipts(result.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch receipts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const filteredReceipts = receipts.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      (r.transaction_code || '').toLowerCase().includes(term) ||
      (r.material_name || '').toLowerCase().includes(term) ||
      (r.receiver_name || '').toLowerCase().includes(term) ||
      (r.purpose || '').toLowerCase().includes(term)
    );
  });

  if (selectedReceipt) {
    const unitCostVal = parseFloat(selectedReceipt.unit_cost) || parseFloat(selectedReceipt.material_unit_cost) || 0;
    const totalCost = Number(selectedReceipt.quantity) * unitCostVal;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedReceipt(null)}>
            <ArrowLeft size={15} /> Back to Receipts
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={15} /> Print Receipt
          </button>
        </div>

        <div className="glass-card" id="printable-voucher" style={{ padding: '32px', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-primary)', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--bg-border)' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-muted-strong)', marginBottom: '4px' }}>
              STOCK OUT RECEIPT
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              <span><strong>Ref #:</strong> {selectedReceipt.transaction_code}</span>
              <span><strong>Date:</strong> {new Date(selectedReceipt.transaction_date).toLocaleString()}</span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
            <tbody>
              {[
                ['Material Code', selectedReceipt.material_code],
                ['Material Name', selectedReceipt.material_name],
                ['Quantity Sold / Issued', `${selectedReceipt.quantity} ${selectedReceipt.unit_of_measure || ''}`],
                ['Unit Cost', formatCurrency(selectedReceipt.unit_cost || selectedReceipt.material_unit_cost || 0)],
                ['Total Value', formatCurrency(totalCost)],
                ['Issued To / Employee', selectedReceipt.receiver_name ? `${selectedReceipt.receiver_name} (${selectedReceipt.receiver_department || ''})` : '—'],
                ['Purpose', selectedReceipt.purpose || '—'],
                ['Remarks', selectedReceipt.remarks || '—'],
                ['Issued By', selectedReceipt.issued_by_name || '—']
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: '600', color: 'var(--text-muted)', width: '160px', verticalAlign: 'top' }}>{label}</td>
                  <td style={{ padding: '10px 0 10px 16px', color: 'var(--text-primary)' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '20px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--bg-border)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid var(--text-muted)', paddingBottom: '4px', marginBottom: '6px', minHeight: '32px' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Issued By</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid var(--text-muted)', paddingBottom: '4px', marginBottom: '6px', minHeight: '32px' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Received By / Authorized Representative</div>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-muted)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            This receipt was generated by the Store Management System. Keep for audit records.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: 'min(100%, 280px)' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '30px', height: '36px', fontSize: '13px', width: '100%' }}
            placeholder="Search receipts…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive-container">
        <table className="data-table table-dense" style={{ minWidth: '780px' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Receipt Code</th>
                <th style={{ whiteSpace: 'nowrap' }}>Material</th>
                <th style={{ whiteSpace: 'nowrap' }}>Quantity</th>
                <th style={{ whiteSpace: 'nowrap' }}>Total Value</th>
                <th style={{ whiteSpace: 'nowrap' }}>Issued To</th>
                <th style={{ whiteSpace: 'nowrap' }}>Issued By</th>
                <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ whiteSpace: 'nowrap' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading receipts…</td></tr>
              ) : filteredReceipts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No receipts found.</td></tr>
              ) : filteredReceipts.map(receipt => {
                const unitCostVal = parseFloat(receipt.unit_cost) || parseFloat(receipt.material_unit_cost) || 0;
                const totalCost = Number(receipt.quantity) * unitCostVal;
                return (
                  <tr key={receipt.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#818cf8', whiteSpace: 'nowrap' }}>
                      {receipt.transaction_code}
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>{receipt.material_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{receipt.material_code}</div>
                    </td>
                    <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                      {receipt.quantity} {receipt.unit_of_measure}
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(totalCost)}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted-strong)', whiteSpace: 'nowrap' }}>{receipt.receiver_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{receipt.receiver_department || ''}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {receipt.issued_by_name || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(receipt.transaction_date).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setSelectedReceipt(receipt)}>
                        <Eye size={12} /> View Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
  );
}
