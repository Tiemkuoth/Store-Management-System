-- ════════════════════════════════════════════════════════════════════════
-- DATABASE PERFORMANCE OPTIMIZATION SCRIPT
-- ════════════════════════════════════════════════════════════════════════

-- ── MISSING INDEXES ────────────────────────────────────────────────────
-- These indexes significantly improve query performance

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Password history indexes
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at DESC);

-- Materials indexes
CREATE INDEX IF NOT EXISTS idx_materials_material_code ON materials(material_code);
CREATE INDEX IF NOT EXISTS idx_materials_category_id ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_materials_current_stock ON materials(current_stock);
CREATE INDEX IF NOT EXISTS idx_materials_location ON materials(location);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);

-- Stock transactions indexes
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material_id ON stock_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_issued_by ON stock_transactions(issued_by_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_approved_by ON stock_transactions(approved_by_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_supplier_id ON stock_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_emp_dept ON stock_transactions(employee_dept_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_code ON stock_transactions(transaction_code);
-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material_date ON stock_transactions(material_id, transaction_date DESC);

-- Stock transfers indexes
CREATE INDEX IF NOT EXISTS idx_stock_transfers_material_id ON stock_transfers(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_date ON stock_transfers(transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_location ON stock_transfers(source_location, destination_location);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_code ON stock_transfers(transfer_code);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Suppliers indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);

-- Employees/Departments indexes
CREATE INDEX IF NOT EXISTS idx_emp_dept_code ON employees_departments(code);
CREATE INDEX IF NOT EXISTS idx_emp_dept_type ON employees_departments(type);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
-- Composite index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, created_at DESC);

-- Messages table indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read ON messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_pair_date ON messages(sender_id, recipient_id, created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON system_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON system_notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON system_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON system_notifications(is_read);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Role tables indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id);

-- ── QUERY ANALYSIS & OPTIMIZATION ──────────────────────────────────
-- Use EXPLAIN to analyze query performance:
-- EXPLAIN SELECT * FROM stock_transactions WHERE material_id = 5;
-- Look for: rows examined, type (should be 'ref', not 'ALL'), possible_keys

-- ── VIEW FOR OPTIMIZED TRANSACTIONS WITH JOINS ─────────────────────
-- Prevents N+1 queries by combining related data in one view
CREATE OR REPLACE VIEW transactions_with_details AS
SELECT 
  st.id,
  st.transaction_code,
  st.transaction_type,
  st.material_id,
  m.name AS material_name,
  m.material_code,
  st.quantity,
  st.unit_cost,
  st.supplier_id,
  s.name AS supplier_name,
  st.employee_dept_id,
  ed.name AS employee_dept_name,
  st.issued_by_id,
  u1.full_name AS issued_by_name,
  st.approved_by_id,
  u2.full_name AS approved_by_name,
  st.transaction_date,
  st.remarks,
  st.store_location,
  st.purpose
FROM stock_transactions st
LEFT JOIN materials m ON st.material_id = m.id
LEFT JOIN suppliers s ON st.supplier_id = s.id
LEFT JOIN employees_departments ed ON st.employee_dept_id = ed.id
LEFT JOIN users u1 ON st.issued_by_id = u1.id
LEFT JOIN users u2 ON st.approved_by_id = u2.id;

-- ── VIEW FOR MATERIALS WITH CATEGORY & SUPPLIER ─────────────────────
CREATE OR REPLACE VIEW materials_with_details AS
SELECT 
  m.id,
  m.material_code,
  m.name,
  m.category_id,
  c.name AS category_name,
  m.unit_of_measure,
  m.specifications,
  m.min_stock_level,
  m.current_stock,
  m.unit_cost,
  m.supplier_id,
  s.name AS supplier_name,
  m.location,
  m.barcode,
  m.batch_number,
  m.expiry_date,
  m.created_at,
  m.updated_at,
  CASE 
    WHEN m.current_stock <= m.min_stock_level THEN 'LOW'
    WHEN m.current_stock > m.min_stock_level * 3 THEN 'HIGH'
    ELSE 'NORMAL'
  END AS stock_status
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN suppliers s ON m.supplier_id = s.id;

-- ── MATERIALIZED AGGREGATES ───────────────────────────────────────
-- Track summary statistics to avoid expensive COUNT queries

CREATE TABLE IF NOT EXISTS material_stock_summary (
  material_id INT PRIMARY KEY,
  total_in INT DEFAULT 0,
  total_out INT DEFAULT 0,
  total_adjustments INT DEFAULT 0,
  current_stock INT DEFAULT 0,
  last_transaction_date TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_material_stock_summary_stock ON material_stock_summary(current_stock);

-- Procedure to update stock summary (call after each transaction)
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS UpdateMaterialStockSummary(IN p_material_id INT)
BEGIN
  -- Aggregate transaction data
  WITH transaction_summary AS (
    SELECT 
      material_id,
      SUM(CASE WHEN transaction_type = 'STOCK_IN' THEN quantity ELSE 0 END) AS total_in,
      SUM(CASE WHEN transaction_type = 'STOCK_OUT' THEN quantity ELSE 0 END) AS total_out,
      SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity ELSE 0 END) AS total_adj,
      MAX(transaction_date) AS last_date
    FROM stock_transactions
    WHERE material_id = p_material_id
    GROUP BY material_id
  )
  INSERT INTO material_stock_summary (material_id, total_in, total_out, total_adjustments, current_stock, last_transaction_date)
  SELECT 
    ts.material_id,
    ts.total_in,
    ts.total_out,
    ts.total_adj,
    (ts.total_in - ts.total_out + ts.total_adj) AS current_stock,
    ts.last_date
  FROM transaction_summary ts
  ON DUPLICATE KEY UPDATE 
    total_in = VALUES(total_in),
    total_out = VALUES(total_out),
    total_adjustments = VALUES(total_adjustments),
    current_stock = VALUES(current_stock),
    last_transaction_date = VALUES(last_transaction_date);
END$$
DELIMITER ;

-- ── PAGINATION OPTIMIZATION ───────────────────────────────────────
-- Use keyset pagination for large datasets instead of OFFSET

-- ❌ SLOW: OFFSET pagination
-- SELECT * FROM stock_transactions 
-- ORDER BY id DESC 
-- LIMIT 50 OFFSET 10000;
-- Problem: Scans first 10050 rows even if using index

-- ✅ FAST: Keyset pagination
-- SELECT * FROM stock_transactions 
-- WHERE id < ? 
-- ORDER BY id DESC 
-- LIMIT 50;
-- Problem: Requires tracking last_id from previous page

-- Helper table for pagination cursors
CREATE TABLE IF NOT EXISTS pagination_cursors (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  cursor_position INT,
  entity_type VARCHAR(50),
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pagination_cursors_user ON pagination_cursors(user_id);

-- ── QUERY STATISTICS TABLE ────────────────────────────────────────
-- Track slow queries for monitoring
CREATE TABLE IF NOT EXISTS query_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_hash VARCHAR(64),
  query_description VARCHAR(255),
  avg_execution_ms DECIMAL(10,2),
  max_execution_ms DECIMAL(10,2),
  execution_count INT,
  rows_examined BIGINT,
  last_executed TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── CACHING OPTIMIZATION ──────────────────────────────────────────
-- Cache frequently accessed data with TTL

CREATE TABLE IF NOT EXISTS cache_store (
  cache_key VARCHAR(255) PRIMARY KEY,
  cache_value LONGTEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_store(expires_at);

-- Auto-cleanup expired cache
DELETE FROM cache_store WHERE expires_at < NOW();

-- ────────────────────────────────────────────────────────────────────
-- PERFORMANCE MONITORING QUERIES
-- ────────────────────────────────────────────────────────────────────

-- Find missing indexes (5.7+)
-- SELECT * FROM sys.schema_unused_indexes;

-- Find full table scans
-- SELECT * FROM sys.statements_with_full_table_scans;

-- Top 10 slowest queries
-- SELECT * FROM sys.statements_with_runtimes_in_95th_percentile;

-- Table size analysis
-- SELECT 
--   TABLE_NAME,
--   ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
-- FROM information_schema.TABLES
-- WHERE TABLE_SCHEMA = 'store_management_db'
-- ORDER BY (data_length + index_length) DESC;

-- Index statistics
-- SELECT 
--   OBJECT_SCHEMA,
--   OBJECT_NAME,
--   INDEX_NAME,
--   COUNT_READ,
--   COUNT_WRITE
-- FROM performance_schema.table_io_waits_summary_by_index_usage
-- ORDER BY COUNT_READ DESC;
