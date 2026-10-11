import React, { useState, useEffect } from 'react';
import apiFetch from '../utils/apiFetch';
import {
  FileText,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Shield,
  Activity,
} from 'lucide-react';

export const AuditLogViewer = ({ currentUser, isGrandDirector = false }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const [filters, setFilters] = useState({
    searchText: '',
    actionType: '',
    dateFrom: '',
    dateTo: '',
    username: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    fetchAuditLogs();
  }, [page, limit]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let endpoint = '/audit-logs';
      if (isGrandDirector) {
        endpoint = '/director/audit-logs';
      }

      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')),
      });

      const response = await apiFetch(`${endpoint}?${query.toString()}`);
      const data = await response.json();

      setLogs(data.data || []);
      applyFilters(data.data || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data) => {
    let filtered = data;

    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(search) ||
          log.username.toLowerCase().includes(search) ||
          log.action_type.toLowerCase().includes(search)
      );
    }

    if (filters.actionType) {
      filtered = filtered.filter((log) =>
        log.action_type.includes(filters.actionType)
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(
        (log) => new Date(log.created_at) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(
        (log) => new Date(log.created_at) <= new Date(filters.dateTo)
      );
    }

    if (filters.username) {
      filtered = filtered.filter((log) =>
        log.username.toLowerCase().includes(filters.username.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(logs);
  };

  const exportLogs = () => {
    const csvContent = [
      ['ID', 'User', 'Role', 'Action', 'Description', 'IP Address', 'Timestamp'],
      ...filteredLogs.map((log) => [
        log.id,
        log.username,
        log.user_role,
        log.action_type,
        log.description,
        log.ip_address,
        log.created_at,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent)
    );
    element.setAttribute('download', `audit-logs-${new Date().toISOString()}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getActionIcon = (actionType) => {
    if (actionType.includes('CREATE')) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (actionType.includes('UPDATE')) return <Activity className="w-4 h-4 text-blue-600" />;
    if (actionType.includes('DELETE')) return <AlertCircle className="w-4 h-4 text-red-600" />;
    if (actionType.includes('LOGIN')) return <User className="w-4 h-4 text-purple-600" />;
    return <FileText className="w-4 h-4 text-gray-600" />;
  };

  const getActionColor = (actionType) => {
    if (actionType.includes('CREATE')) return 'bg-green-50 border-green-200';
    if (actionType.includes('UPDATE')) return 'bg-blue-50 border-blue-200';
    if (actionType.includes('DELETE')) return 'bg-red-50 border-red-200';
    if (actionType.includes('LOGIN')) return 'bg-purple-50 border-purple-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Audit Logs</h2>
        </div>
        <p className="text-slate-100 text-sm">
          {isGrandDirector
            ? 'Complete audit trail with advanced search and filtering'
            : 'System activity and transaction records'}
        </p>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 p-6 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={filters.searchText}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
            </select>
          </div>

          {/* Username */}
          {isGrandDirector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                placeholder="Filter by user..."
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilters({
              searchText: '',
              actionType: '',
              dateFrom: '',
              dateTo: '',
              username: '',
            })}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Reset Filters
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-gray-600">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No audit logs found</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`border-l-4 ${getActionColor(log.action_type)}`}
            >
              <button
                onClick={() =>
                  setExpandedLog(expandedLog === log.id ? null : log.id)
                }
                className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{getActionIcon(log.action_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">
                          {log.action_type}
                        </span>
                        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                          {log.username}
                        </span>
                        {log.user_role === 'Director' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">
                            DIRECTOR
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {log.description}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>IP: {log.ip_address}</span>
                        <span>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedLog === log.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedLog === log.id && (
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">User Information</p>
                      <div className="bg-white p-3 rounded border border-gray-200 space-y-1">
                        <p>
                          <span className="font-medium">ID:</span> {log.user_id}
                        </p>
                        <p>
                          <span className="font-medium">Username:</span>{' '}
                          {log.username}
                        </p>
                        <p>
                          <span className="font-medium">Role:</span>{' '}
                          {log.user_role}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Request Details</p>
                      <div className="bg-white p-3 rounded border border-gray-200 space-y-1">
                        <p>
                          <span className="font-medium">Action:</span>{' '}
                          {log.action_type}
                        </p>
                        <p>
                          <span className="font-medium">IP Address:</span>{' '}
                          {log.ip_address}
                        </p>
                        <p>
                          <span className="font-medium">Timestamp:</span>{' '}
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-semibold text-gray-900 mb-2">Full Description</p>
                    <div className="bg-white p-3 rounded border border-gray-200 font-mono text-xs text-gray-700 max-h-40 overflow-auto">
                      {log.description}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, filteredLogs.length)} of {filteredLogs.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={filteredLogs.length < limit}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
