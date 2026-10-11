import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Download, RefreshCw, Filter, ChevronDown, Eye, AlertCircle } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

export function getLogModule(log) {
  if (!log) return 'System';
  if (log.module && log.module !== '–' && log.module !== 'N/A') return log.module;

  const action = String(log.action_type || '').toUpperCase();
  const desc = String(log.description || '').toUpperCase();
  const text = `${action} ${desc}`;

  if (/LOGIN|LOGOUT|PASSWORD|PROFILE|AVATAR|AUTH|SESSION|2FA/i.test(text)) return 'Security & Auth';
  if (/EMPLOYEE|DEPT|DEPARTMENT/i.test(text)) return 'Employees';
  if (/MATERIAL|STOCK|INVENTORY|RECEIPT/i.test(text)) return 'Inventory';
  if (/CATEGORY/i.test(text)) return 'Categories';
  if (/SUPPLIER/i.test(text)) return 'Suppliers';
  if (/USER|ROLE|PERMISSION/i.test(text)) return 'User Management';
  if (/SETTING|CONFIG|POLICY|BACKUP/i.test(text)) return 'System Settings';
  if (/PURCHASE|ORDER|PO_/i.test(text)) return 'Procurement';
  if (/DISPOSAL/i.test(text)) return 'Disposals';
  if (/TRANSFER|WAREHOUSE/i.test(text)) return 'Warehouses';

  return 'System';
}

export default function UserAudit({ currentUser }) {
  const toast = useToast();
  const isMountedRef = useRef(true);

  // State
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date-desc');

  const ITEMS_PER_PAGE = 50;

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/audit-logs?limit=1000`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      const logsArray = Array.isArray(data) ? data : (data.data || []);
      
      if (isMountedRef.current) {
        setLogs(logsArray);
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(e.message);
        toast.error(`Error: ${e.message}`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [toast.error]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLogs();
    return () => { isMountedRef.current = false; };
  }, [fetchLogs]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = logs.filter(log => {
      // Exclude background navigation preference logs unless explicitly searching for them
      if (filterAction !== 'UPDATE_PREFERRED_PAGE' && search === '' && log.action_type === 'UPDATE_PREFERRED_PAGE') {
        return false;
      }

      const matchSearch = search === '' || 
        (log.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.action_type || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.description || '').toLowerCase().includes(search.toLowerCase());
      
      const matchUser = filterUser === '' || (log.username || '').toLowerCase() === filterUser.toLowerCase();
      const matchAction = filterAction === '' || (log.action_type || '').toLowerCase() === filterAction.toLowerCase();
      const matchModule = filterModule === '' || getLogModule(log).toLowerCase() === filterModule.toLowerCase();
      
      return matchSearch && matchUser && matchAction && matchModule;
    });

    // Apply sorting
    if (sortBy === 'date-desc') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'date-asc') {
      filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === 'user-asc') {
      filtered.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    } else if (sortBy === 'action-asc') {
      filtered.sort((a, b) => (a.action_type || '').localeCompare(b.action_type || ''));
    }

    setFilteredLogs(filtered);
    setPage(1);
  }, [logs, search, filterUser, filterAction, filterModule, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Get unique values for filters
  const users = [...new Set(logs.map(l => l.username).filter(Boolean))].sort();
  const actions = [...new Set(logs.map(l => l.action_type).filter(Boolean))].sort();
  const modules = [...new Set(logs.map(l => getLogModule(l)).filter(Boolean))].sort();

  // Export to CSV
  const handleExport = () => {
    const headers = ['Date', 'Time', 'User', 'Action', 'Module', 'Description', 'Status'];
    const rows = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleDateString(),
      new Date(log.created_at).toLocaleTimeString(),
      log.username || 'N/A',
      log.action_type || 'N/A',
      getLogModule(log),
      log.description || 'N/A',
      log.status || 'Success'
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('✓ Exported to CSV');
  };

  const clearFilters = () => {
    setSearch('');
    setFilterUser('');
    setFilterAction('');
    setFilterModule('');
    setSortBy('date-desc');
    setPage(1);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-main)' }}>
      <ToastContainer />

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>User Audit & Activity</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>View system actions and user activity logs</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchLogs} 
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'var(--accent-color)', color: '#fff', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'var(--success-color)', color: '#fff', border: 'none',
              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredLogs.length === 0 ? 0.5 : 1
            }}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        alignItems: 'end'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-muted)' }}>Search</label>
          <input
            type="text"
            placeholder="User, action, description…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-main)', fontSize: '13px'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-muted)' }}>User</label>
          <select
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-main)', fontSize: '13px'
            }}
          >
            <option value="">All Users</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-muted)' }}>Action</label>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-main)', fontSize: '13px'
            }}
          >
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-muted)' }}>Module</label>
          <select
            value={filterModule}
            onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-main)', fontSize: '13px'
            }}
          >
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--text-muted)' }}>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-main)', fontSize: '13px'
            }}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="user-asc">User (A-Z)</option>
            <option value="action-asc">Action (A-Z)</option>
          </select>
        </div>

        <button
          onClick={clearFilters}
          style={{
            padding: '8px 16px', borderRadius: '8px',
            background: 'var(--bg-muted)', border: '1px solid var(--border-color)',
            color: 'var(--text-main)', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
          }}
        >
          <Filter size={14} style={{ marginRight: '6px', display: 'inline' }} />
          Clear Filters
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Logs</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-color)' }}>{logs.length}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Filtered</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-color)' }}>{filteredLogs.length}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Unique Users</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-color)' }}>{users.length}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Unique Actions</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-color)' }}>{actions.length}</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', color: '#c00' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchLogs} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c00', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '24px' }}>⟳</div>
          <p style={{ marginTop: '12px' }}>Loading audit logs…</p>
        </div>
      )}

      {/* Table */}
      {!loading && filteredLogs.length > 0 && (
        <>
          <div className="table-responsive-container" style={{ marginBottom: '20px' }}>
            <table className="data-table table-dense" style={{ width: '100%', minWidth: '780px' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Date &amp; Time</th>
                  <th style={{ whiteSpace: 'nowrap' }}>User</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Action</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Module</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--accent-color)', whiteSpace: 'nowrap' }}>{log.username || '–'}</td>
                    <td style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{log.action_type || '–'}</td>
                    <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{getLogModule(log)}</td>
                    <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }} title={log.description}>{log.description || '–'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '4px' }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: page === 1 ? 'var(--bg-muted)' : 'var(--bg-surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}
              >
                ← Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page</span>
                <input
                  type="number"
                  value={page}
                  onChange={(e) => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                  min="1"
                  max={totalPages}
                  style={{ width: '50px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center', fontSize: '13px' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>of {totalPages}</span>
              </div>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: page >= totalPages ? 'var(--bg-muted)' : 'var(--bg-surface)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && filteredLogs.length === 0 && logs.length > 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Filter size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: '600' }}>No audit logs match your filters</p>
          <button onClick={clearFilters} style={{ marginTop: '12px', color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}>Clear filters and try again</button>
        </div>
      )}

      {/* No Data */}
      {!loading && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: '600' }}>No audit logs available</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>Start using the system and logs will appear here</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Audit Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>User</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-color)' }}>{selectedLog.username || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Action</div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedLog.action_type || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Module</div>
                <div style={{ fontSize: '14px' }}>{getLogModule(selectedLog)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Date & Time</div>
                <div style={{ fontSize: '14px' }}>{new Date(selectedLog.created_at).toLocaleString()}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</div>
                <div style={{ fontSize: '14px', padding: '12px', background: 'var(--bg-muted)', borderRadius: '6px', wordBreak: 'break-word' }}>{selectedLog.description || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
