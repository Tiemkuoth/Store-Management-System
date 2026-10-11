import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, CheckCircle2, Clock, AlertTriangle, X, User, Calendar, Flag } from 'lucide-react';
import apiFetch from '../utils/apiFetch';
import ResponsiveTable from './ResponsiveTable';

const PRIORITY_COLORS = {
  Low: { bg: 'rgba(34,197,94,0.10)', color: '#16a34a', border: 'rgba(34,197,94,0.3)' },
  Normal: { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  High: { bg: 'rgba(245,158,11,0.10)', color: '#d97706', border: 'rgba(245,158,11,0.3)' },
  Urgent: { bg: 'rgba(239,68,68,0.10)', color: '#dc2626', border: 'rgba(239,68,68,0.3)' },
};

const STATUS_COLORS = {
  Pending: { bg: 'rgba(245,158,11,0.10)', color: '#d97706', icon: Clock },
  'In Progress': { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', icon: Clock },
  Completed: { bg: 'rgba(34,197,94,0.10)', color: '#16a34a', icon: CheckCircle2 },
  Cancelled: { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', icon: X },
};

export default function TaskManager() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', assigned_to_id: '', priority: 'Normal', due_date: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTasks = async () => {
    try {
      const res = await apiFetch('/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) { console.error('Failed to fetch tasks:', e); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const response = await res.json();
        // API returns { data: [...], total, page, limit, pages }
        const usersArray = response.data || response || [];
        setUsers(usersArray.filter(u => u.status === 'Active'));
      }
    } catch (e) { console.error('Failed to fetch users:', e); }
  };

  useEffect(() => { fetchTasks(); fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...formData };
      if (!payload.assigned_to_id) delete payload.assigned_to_id;
      if (!payload.due_date) delete payload.due_date;

      let res;
      if (editingTask) {
        res = await apiFetch(`/tasks/${editingTask.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...payload, status: editingTask.status })
        });
      } else {
        res = await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save task');
        return;
      }
      setShowForm(false);
      setEditingTask(null);
      setFormData({ title: '', description: '', assigned_to_id: '', priority: 'Normal', due_date: '' });
      fetchTasks();
    } catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await apiFetch(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          assigned_to_id: task.assigned_to_id,
          status: newStatus,
          priority: task.priority,
          due_date: task.due_date ? task.due_date.split('T')[0] : null
        })
      });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assigned_to_id: task.assigned_to_id || '',
      priority: task.priority || 'Normal',
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    });
    setShowForm(true);
    setError('');
  };

  const openNew = () => {
    setEditingTask(null);
    setFormData({ title: '', description: '', assigned_to_id: '', priority: 'Normal', due_date: '' });
    setShowForm(true);
    setError('');
  };

  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (t.title || '').toLowerCase().includes(term) ||
        (t.assigned_to_name || '').toLowerCase().includes(term) ||
        (t.assigned_by_name || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const statusCounts = {
    ALL: tasks.length,
    Pending: tasks.filter(t => t.status === 'Pending').length,
    'In Progress': tasks.filter(t => t.status === 'In Progress').length,
    Completed: tasks.filter(t => t.status === 'Completed').length,
    Cancelled: tasks.filter(t => t.status === 'Cancelled').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '30px', height: '36px', fontSize: '13px', width: '260px' }}
              placeholder="Search tasks…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['ALL', 'Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(s)}
            style={{ fontSize: '12px', padding: '5px 14px' }}
          >
            {s} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="glass-card" style={{ padding: '24px', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} color="#4f46e5" />
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </h3>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: '13px', marginBottom: '14px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Task Title *</label>
                <input
                  type="text" className="form-input"
                  placeholder="e.g. Restock cleaning supplies"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea" rows="3"
                  placeholder="Optional task details…"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select
                  className="form-select"
                  value={formData.assigned_to_id}
                  onChange={e => setFormData({ ...formData, assigned_to_id: e.target.value })}
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date" className="form-input"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              {editingTask && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editingTask.status}
                    onChange={e => setEditingTask({ ...editingTask, status: e.target.value })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingTask(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks List */}
      <div className="glass-card" style={{ padding: '0', overflow: 'visible' }}>
        <ResponsiveTable
          columns={[
            {
              key: 'title', label: 'Task', render: (val, row) => (
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-muted-strong)' }}>{val}</div>
                  {row.description && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }} title={row.description}>
                      {row.description}
                    </div>
                  )}
                </div>
              )
            },
            {
              key: 'assigned_to_name', label: 'Assigned To', render: (val) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted-strong)' }}>{val || 'Unassigned'}</span>
                </div>
              )
            },
            {
              key: 'assigned_by_name', label: 'Assigned By', render: (val) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{val || '—'}</span>
                </div>
              )
            },
            {
              key: 'priority', label: 'Priority', render: (val) => {
                const priorityStyle = PRIORITY_COLORS[val] || PRIORITY_COLORS.Normal;
                return (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                    background: priorityStyle.bg, color: priorityStyle.color, border: `1px solid ${priorityStyle.border}`
                  }}>
                    {val}
                  </span>
                );
              }
            },
            {
              key: 'status', label: 'Status', render: (val) => {
                const statusStyle = STATUS_COLORS[val] || STATUS_COLORS.Pending;
                const StatusIcon = statusStyle.icon;
                return (
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                    background: statusStyle.bg, color: statusStyle.color,
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    <StatusIcon size={11} /> {val}
                  </span>
                );
              }
            },
            { key: 'due_date', label: 'Due Date', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
            { key: 'created_at', label: 'Created', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
            {
              key: 'actions', label: 'Actions', render: (_, row) => (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {row.status === 'Pending' && (
                    <button className="btn btn-sm" style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(59,130,246,0.10)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }}
                      onClick={() => handleStatusChange(row.id, 'In Progress')}
                    >Start</button>
                  )}
                  {row.status === 'In Progress' && (
                    <button className="btn btn-sm btn-success" style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => handleStatusChange(row.id, 'Completed')}
                    >Complete</button>
                  )}
                  <button className="btn btn-sm btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => openEdit(row)}
                  >Edit</button>
                  <button className="btn btn-sm" style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}
                    onClick={() => handleDelete(row.id)}
                  >Delete</button>
                </div>
              )
            },
          ]}
          rows={filteredTasks}
          keyField="id"
          loading={loading}
          emptyMessage={tasks.length === 0 ? 'No tasks yet. Create one to get started.' : 'No tasks match your filter.'}
          className="tasks-table"
          tableStyle={{ minWidth: '860px' }}
        />
      </div>
    </div>
  );
}
