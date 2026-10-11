import React from 'react';

/**
 * ResponsiveTable - Renders a data table inside a responsive scroll container
 * On small screens: Horizontal scrolling strictly inside the table container,
 * with sticky headers, compact readable font/padding, and accessible actions.
 * On large screens: Uses available width smoothly without excessive stretching.
 *
 * Props:
 *   columns: Array of { key, label, width?, render? }
 *   rows: Array of row data objects
 *   keyField: Field to use as unique key (default: 'id')
 *   onRowClick: Optional callback when row is clicked
 *   className: Optional CSS class
 *   loading: Show loading state
 *   emptyMessage: Message when no rows
 */
export default function ResponsiveTable({
  columns,
  rows = [],
  keyField = 'id',
  onRowClick,
  className = '',
  loading = false,
  emptyMessage = 'No data available.',
  tableStyle = {},
}) {
  if (loading) {
    return (
      <div className="table-responsive-container" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner" />
        Loading…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="table-responsive-container" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`table-responsive-container ${className}`}>
      <table className="data-table" style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width, minWidth: col.width } : {}}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[keyField]}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((col) => (
                <td key={`${row[keyField]}-${col.key}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
