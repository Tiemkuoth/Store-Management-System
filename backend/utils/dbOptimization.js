/**
 * Database Optimization Utilities
 * Helps prevent N+1 queries and optimize common patterns
 */

import { getPool } from '../db/db.js';

// ── Batch Query Helper ─────────────────────────────────────────
/**
 * Load related data for multiple records efficiently
 * Example: batchLoad(userIds, 'users', 'id')
 */
export async function batchLoad(ids, table, keyColumn = 'id') {
  if (!ids || ids.length === 0) return new Map();

  try {
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await getPool().query(
      `SELECT * FROM ${table} WHERE ${keyColumn} IN (${placeholders})`,
      ids
    );

    // Create Map for O(1) lookup
    const map = new Map();
    rows.forEach(row => {
      map.set(row[keyColumn], row);
    });

    return map;
  } catch (error) {
    console.error(`Error batch loading ${table}:`, error);
    return new Map();
  }
}

// ── Join Helper (Denormalize on Read) ──────────────────────────
/**
 * Execute JOIN query efficiently
 * Prevents N+1 by doing all JOINs in one query
 */
export async function joinQuery(baseTable, joins, where = '', params = []) {
  try {
    let query = `SELECT * FROM ${baseTable}`;

    // Add JOINs
    joins.forEach(join => {
      query += ` ${join.type || 'LEFT'} JOIN ${join.table} ON ${join.on}`;
    });

    // Add WHERE clause
    if (where) {
      query += ` WHERE ${where}`;
    }

    const [rows] = await getPool().query(query, params);
    return rows;
  } catch (error) {
    console.error('Error executing join query:', error);
    throw error;
  }
}

// ── Pagination Helper ──────────────────────────────────────────
/**
 * Efficient pagination using keyset approach
 * Avoids expensive OFFSET scans on large datasets
 */
export async function paginateKeyset(
  table,
  limit = 50,
  cursor = null,
  orderBy = 'id DESC',
  whereClause = ''
) {
  try {
    const cursorCheck = cursor ? `AND id < ?` : '';
    const params = cursor ? [cursor, limit + 1] : [limit + 1];

    let query = `SELECT * FROM ${table}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause} ${cursorCheck}`;
    } else if (cursorCheck) {
      query += ` WHERE ${cursorCheck}`;
    }

    query += ` ORDER BY ${orderBy} LIMIT ?`;

    const [rows] = await getPool().query(query, params);

    // Check if there are more rows
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop(); // Remove the extra row

    // Next cursor is the last ID
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;

    return {
      data: rows,
      hasMore,
      nextCursor,
    };
  } catch (error) {
    console.error('Error in keyset pagination:', error);
    throw error;
  }
}

// ── N+1 Query Fixer for Transactions ────────────────────────────
/**
 * Load transactions WITH all related data in single query
 * Instead of: 1 query for transactions + N queries for each material/user
 */
export async function loadTransactionsOptimized(where = '', params = [], limit = 50) {
  try {
    const query = `
      SELECT 
        st.*,
        m.name AS material_name,
        m.material_code,
        m.unit_of_measure,
        s.name AS supplier_name,
        ed.name AS employee_dept_name,
        u1.full_name AS issued_by_name,
        u2.full_name AS approved_by_name
      FROM stock_transactions st
      LEFT JOIN materials m ON st.material_id = m.id
      LEFT JOIN suppliers s ON st.supplier_id = s.id
      LEFT JOIN employees_departments ed ON st.employee_dept_id = ed.id
      LEFT JOIN users u1 ON st.issued_by_id = u1.id
      LEFT JOIN users u2 ON st.approved_by_id = u2.id
      ${where ? `WHERE ${where}` : ''}
      ORDER BY st.transaction_date DESC
      LIMIT ?
    `;

    params.push(limit);
    const [rows] = await getPool().query(query, params);
    return rows;
  } catch (error) {
    console.error('Error loading optimized transactions:', error);
    throw error;
  }
}

// ── N+1 Query Fixer for Materials ──────────────────────────────
/**
 * Load materials WITH category and supplier data
 */
export async function loadMaterialsOptimized(where = '', params = [], limit = 100) {
  try {
    const query = `
      SELECT 
        m.*,
        c.name AS category_name,
        s.name AS supplier_name,
        CASE 
          WHEN m.current_stock <= m.min_stock_level THEN 'LOW'
          WHEN m.current_stock > m.min_stock_level * 3 THEN 'HIGH'
          ELSE 'NORMAL'
        END AS stock_status
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      ${where ? `WHERE ${where}` : ''}
      ORDER BY m.created_at DESC
      LIMIT ?
    `;

    params.push(limit);
    const [rows] = await getPool().query(query, params);
    return rows;
  } catch (error) {
    console.error('Error loading optimized materials:', error);
    throw error;
  }
}

// ── Count Query Optimization ───────────────────────────────────
/**
 * Efficient COUNT query (cached if available)
 */
export async function countRows(table, where = '', params = [], cache = false) {
  try {
    const cacheKey = `count:${table}:${where}`;

    // Check cache first
    if (cache) {
      const cached = await getFromCache(cacheKey);
      if (cached !== null) return cached;
    }

    let query = `SELECT COUNT(*) as total FROM ${table}`;
    if (where) {
      query += ` WHERE ${where}`;
    }

    const [[{ total }]] = await getPool().query(query, params);

    // Cache for 5 minutes
    if (cache) {
      await setCache(cacheKey, total, 300);
    }

    return total;
  } catch (error) {
    console.error('Error counting rows:', error);
    return 0;
  }
}

// ── Aggregation Helper ────────────────────────────────────────
/**
 * Efficient aggregation queries
 */
export async function aggregate(
  table,
  aggregations,
  groupBy = null,
  where = '',
  params = []
) {
  try {
    let query = 'SELECT ';

    // Build aggregation fields
    const fields = aggregations
      .map(agg => `${agg.function}(${agg.field}) AS ${agg.alias}`)
      .join(', ');

    query += fields;
    if (groupBy) {
      query += `, ${groupBy}`;
    }

    query += ` FROM ${table}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }

    const [rows] = await getPool().query(query, params);
    return rows;
  } catch (error) {
    console.error('Error in aggregate query:', error);
    throw error;
  }
}

// ── Simple Caching Layer ───────────────────────────────────────
const cache = new Map();

export async function setCache(key, value, ttlSeconds = 300) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export async function clearCache(pattern = null) {
  if (!pattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ── Query Performance Monitor ──────────────────────────────────
const queryStats = new Map();

export function recordQueryTime(queryDescription, executionMs) {
  if (!queryStats.has(queryDescription)) {
    queryStats.set(queryDescription, {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      minMs: Infinity,
    });
  }

  const stats = queryStats.get(queryDescription);
  stats.count++;
  stats.totalMs += executionMs;
  stats.maxMs = Math.max(stats.maxMs, executionMs);
  stats.minMs = Math.min(stats.minMs, executionMs);
}

export function getQueryStats() {
  const stats = {};

  for (const [query, data] of queryStats.entries()) {
    stats[query] = {
      count: data.count,
      avgMs: (data.totalMs / data.count).toFixed(2),
      maxMs: data.maxMs,
      minMs: data.minMs,
    };
  }

  return stats;
}

export function clearQueryStats() {
  queryStats.clear();
}

// ── Batch Insert Helper ────────────────────────────────────────
/**
 * Efficient bulk insert
 */
export async function batchInsert(table, rows, chunkSize = 100) {
  if (!rows || rows.length === 0) return 0;

  let inserted = 0;

  try {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const columns = Object.keys(chunk[0]);
      const placeholders = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
      const values = chunk.flatMap(row => columns.map(col => row[col]));

      const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`;
      const [result] = await getPool().query(query, values);
      inserted += result.affectedRows;
    }

    return inserted;
  } catch (error) {
    console.error('Error in batch insert:', error);
    throw error;
  }
}

// ── Explain Query Plan ────────────────────────────────────────
/**
 * Get EXPLAIN output for debugging
 */
export async function explainQuery(query, params = []) {
  try {
    const [explanation] = await getPool().query(`EXPLAIN ${query}`, params);
    return explanation;
  } catch (error) {
    console.error('Error explaining query:', error);
    return null;
  }
}
