-- MySQL Database Schema for Store Management System

CREATE DATABASE IF NOT EXISTS store_management_db;
USE store_management_db;

-- Roles: Grand Director (SUPREME), Administrator, Store Manager, Storekeeper, Auditor, Viewer
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  role ENUM('Grand Director','Director','Super Admin','Administrator', 'Store Manager', 'Assistant Manager', 'Cashier', 'Senior Cashier', 'Inventory Manager', 'Inventory Staff', 'Purchasing Manager', 'Accountant', 'Auditor', 'Storekeeper', 'Viewer', 'Read-only User') NOT NULL DEFAULT 'Storekeeper',
  status ENUM('Active', 'Inactive', 'Locked') DEFAULT 'Active',
  avatar_url MEDIUMTEXT,
  theme_preference ENUM('Light','Dark','System Default') NOT NULL DEFAULT 'Light',
  preferred_page VARCHAR(40) DEFAULT 'DASHBOARD',
  failed_login_attempts INT DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  force_password_change BOOLEAN DEFAULT FALSE,
  password_expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── ROLE DEFINITIONS ──────────────────────────────────────────
-- Centralized role definitions with hierarchy and metadata
CREATE TABLE IF NOT EXISTS role_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  authority_level INT NOT NULL,
  is_system_role BOOLEAN DEFAULT TRUE,
  access_level VARCHAR(50) DEFAULT 'LIMITED',
  permissions_json JSON,
  can_create_users BOOLEAN DEFAULT FALSE,
  can_manage_roles BOOLEAN DEFAULT FALSE,
  can_override_permissions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_authority_level (authority_level),
  INDEX idx_role_name (role_name)
);

-- ── ROLE PERMISSIONS ──────────────────────────────────────────
-- Fine-grained permission management per role
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_permission (role_id, permission_name),
  FOREIGN KEY (role_id) REFERENCES role_definitions(id) ON DELETE CASCADE
);

-- ── USER ROLE ASSIGNMENTS ─────────────────────────────────────
-- Track role changes and assignments to users
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_by_id INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES role_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_assigned_at (assigned_at)
);

CREATE TABLE IF NOT EXISTS backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  status ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
  size_bytes BIGINT DEFAULT 0,
  type ENUM('Manual', 'Auto') DEFAULT 'Manual',
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Material Categories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees & Departments receiving materials
CREATE TABLE IF NOT EXISTS employees_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('Employee', 'Department') NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  department_name VARCHAR(100),
  position VARCHAR(100),
  contact_number VARCHAR(50),
  email VARCHAR(100),
  gender ENUM('Male', 'Female', 'Other', 'Not Specified') DEFAULT 'Not Specified',
  document_url MEDIUMTEXT,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materials / Items in Store
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id INT,
  unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'Pcs',
  specifications TEXT,
  min_stock_level INT NOT NULL DEFAULT 5,
  current_stock INT NOT NULL DEFAULT 0,
  status ENUM('In Stock', 'Low Stock', 'Out of Stock') DEFAULT 'In Stock',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  supplier_id INT,
  location VARCHAR(100) DEFAULT 'Main Warehouse',
  barcode VARCHAR(100),
  batch_number VARCHAR(100),
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Inventory Transactions (Stock In, Stock Out, Returns, Adjustments)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(50) UNIQUE NOT NULL,
  transaction_type ENUM('STOCK_IN', 'STOCK_OUT', 'RETURN', 'ADJUSTMENT') NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) DEFAULT 0.00,
  supplier_id INT,
  employee_dept_id INT,
  purpose VARCHAR(255),
  issued_by_id INT,
  approved_by_id INT,
  store_location VARCHAR(100) DEFAULT 'Main Warehouse',
  remarks TEXT,
  payment_method ENUM('Cash', 'Bank Transfer', 'Mobile Payment', 'Credit', 'Other') DEFAULT 'Cash',
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_dept_id) REFERENCES employees_departments(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Stock Transfers between locations/warehouses
CREATE TABLE IF NOT EXISTS stock_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transfer_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  source_location VARCHAR(100) NOT NULL,
  destination_location VARCHAR(100) NOT NULL,
  transferred_by_id INT,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (transferred_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(100),
  user_role VARCHAR(50),
  action_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(50) DEFAULT '127.0.0.1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Material Requests (Storekeeper or Store Manager submits, Store Manager or Admin approves)
CREATE TABLE IF NOT EXISTS material_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  purpose VARCHAR(255),
  priority ENUM('Low', 'Normal', 'High', 'Urgent') DEFAULT 'Normal',
  remarks TEXT,
  status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  requested_by_id INT,
  approved_by_id INT,
  approval_remarks TEXT,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Material Disposals (Damaged / Expired materials)
CREATE TABLE IF NOT EXISTS material_disposals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  disposal_code VARCHAR(50) UNIQUE NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  disposal_type ENUM('Damaged', 'Expired', 'Obsolete', 'Other') DEFAULT 'Damaged',
  reason VARCHAR(255),
  remarks TEXT,
  status ENUM('Pending Approval', 'Approved', 'Rejected') DEFAULT 'Pending Approval',
  recorded_by_id INT,
  approved_by_id INT,
  disposal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Warehouses / Locations
CREATE TABLE IF NOT EXISTS warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  manager_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  status ENUM('Draft', 'Issued', 'Partially Received', 'Completed', 'Cancelled') DEFAULT 'Draft',
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  expected_date DATE,
  remarks TEXT,
  created_by_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Purchase Order Line Items
CREATE TABLE IF NOT EXISTS po_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  material_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ── Migrations: add new ENUM values to existing tables ───────
-- These run safely on existing databases (IF NOT EXISTS logic is handled by the MODIFY)
-- Add 'Grand Director' as the supreme role, 'Locked' to users.status if not already present
ALTER TABLE users MODIFY COLUMN role ENUM('Grand Director','Director','Super Admin','Administrator','Store Manager','Assistant Manager','Cashier','Senior Cashier','Inventory Manager','Inventory Staff','Purchasing Manager','Accountant','Auditor','Storekeeper','Viewer','Read-only User') NOT NULL DEFAULT 'Storekeeper';
ALTER TABLE users MODIFY COLUMN status ENUM('Active','Inactive','Locked') DEFAULT 'Active';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Inactive') DEFAULT 'Active';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Inactive') DEFAULT 'Active';
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS status ENUM('Active', 'Inactive') DEFAULT 'Active';
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS gender ENUM('Male', 'Female', 'Other', 'Not Specified') DEFAULT 'Not Specified';
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS document_url MEDIUMTEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS status ENUM('In Stock', 'Low Stock', 'Out of Stock') DEFAULT 'In Stock';

-- Task Assignments
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('Pending','In Progress','Completed','Cancelled') DEFAULT 'Pending',
  priority ENUM('Low','Normal','High','Urgent') DEFAULT 'Normal',
  assigned_to_id INT,
  assigned_by_id INT,
  due_date DATE,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- In-App System Notifications
CREATE TABLE IF NOT EXISTS system_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  sender_id INT NULL,
  sender_name VARCHAR(255) NULL,
  sender_avatar VARCHAR(255) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Migration: Add missing columns if they don't exist
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS sender_id INT NULL;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255) NULL;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS sender_avatar VARCHAR(255) NULL;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info';

-- In-App User Messages (Direct Communication)
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  subject VARCHAR(255),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recipient_id (recipient_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);

-- ── PERFORMANCE OPTIMIZATION: Pagination Indexes ───────────────────
-- These indexes improve pagination performance for list endpoints
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees_departments(status);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);


-- ── PERFORMANCE OPTIMIZATION: Foreign Key Column Indexes ─────────────
-- These indexes dramatically improve JOIN performance for common queries
-- Used by: transactions, transfers, disposals, material_requests, etc.
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material_id ON stock_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_issued_by_id ON stock_transactions(issued_by_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_approved_by_id ON stock_transactions(approved_by_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type_date ON stock_transactions(transaction_type, transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_material_id ON stock_transfers(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_location ON stock_transfers(source_location);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination_location ON stock_transfers(destination_location);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_transferred_by ON stock_transfers(transferred_by_id);

CREATE INDEX IF NOT EXISTS idx_material_disposals_material_id ON material_disposals(material_id);
CREATE INDEX IF NOT EXISTS idx_material_disposals_status ON material_disposals(status);
CREATE INDEX IF NOT EXISTS idx_material_disposals_recorded_by ON material_disposals(recorded_by_id);
CREATE INDEX IF NOT EXISTS idx_material_disposals_approved_by ON material_disposals(approved_by_id);

CREATE INDEX IF NOT EXISTS idx_material_requests_requested_by ON material_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_material_id ON material_requests(material_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_materials_category_id ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_materials_stock_level ON materials(current_stock, min_stock_level);

CREATE INDEX IF NOT EXISTS idx_po_items_material_id ON po_items(material_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON po_items(po_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON system_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON system_notifications(sender_id);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);




