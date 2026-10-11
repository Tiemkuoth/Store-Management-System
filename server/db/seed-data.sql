-- Seed Data for Store Management System
-- This file contains sample data for development and testing

USE store_management_db;

-- ========== EMPLOYEES ==========
INSERT INTO employees_departments (
  employee_id, first_name, last_name, email, phone, country, 
  department, position, branch, status, created_at
) VALUES
('EMP-001', 'Employee', '001', 'emp001@store.local', '+251-123-001', 'Ethiopia', 
 'Inventory', 'Storekeeper', 'Addis Ababa', 'Active', NOW()),
('EMP-002', 'Employee', '002', 'emp002@store.local', '+251-123-002', 'Ethiopia', 
 'Purchasing', 'Purchasing Officer', 'Addis Ababa', 'Active', NOW()),
('EMP-003', 'Employee', '003', 'emp003@store.local', '+211-123-003', 'South Sudan', 
 'Sales', 'Sales Officer', 'Juba', 'Active', NOW()),
('EMP-004', 'Employee', '004', 'emp004@store.local', '+211-123-004', 'South Sudan', 
 'Finance', 'Accountant', 'Juba', 'Active', NOW());

-- ========== WAREHOUSES ==========
INSERT INTO warehouses (
  warehouse_code, warehouse_name, manager_name, country, city, 
  address, capacity, status, created_at
) VALUES
('WH-ETH-001', 'Main Warehouse', 'Store Manager', 'Ethiopia', 'Addis Ababa', 
 'Main Warehouse Compound', 10000, 'Active', NOW()),
('WH-ETH-002', 'Branch Warehouse', 'Warehouse Manager', 'Ethiopia', 'Dire Dawa', 
 'Branch Warehouse Compound', 5000, 'Active', NOW()),
('WH-SSD-001', 'Juba Central Warehouse', 'Warehouse Manager', 'South Sudan', 'Juba', 
 'Central Warehouse Complex', 8000, 'Active', NOW()),
('WH-SSD-002', 'Juba Branch Store', 'Storekeeper', 'South Sudan', 'Juba', 
 'Branch Store Location', 3000, 'Active', NOW());

-- ========== MATERIALS ==========
-- Get warehouse IDs (assuming they're sequential starting from 1)
INSERT INTO materials (
  material_code, material_name, category_id, supplier_id, warehouse_id,
  unit_of_measure, current_stock, min_stock_level, unit_cost, 
  stock_status, created_at
) VALUES
-- Cement (Construction)
('MAT-CEMENT-001', 'Cement', 1, 1, 1, 'Bag', 50, 10, 850.00, 'In Stock', NOW()),
-- Steel Bar (Construction)
('MAT-STEEL-001', 'Steel Bar 12mm', 1, 1, 1, 'Piece', 20, 5, 1250.00, 'Low Stock', NOW()),
-- Office Paper (Stationery)
('MAT-PAPER-001', 'Office Paper A4', 2, 2, 2, 'Ream', 20, 5, 650.00, 'In Stock', NOW()),
-- Printer Ink (Office Supplies)
('MAT-INK-001', 'Printer Ink', 5, 2, 2, 'Box', 0, 5, 2400.00, 'Out of Stock', NOW()),
-- Safety Gloves (Safety Equipment)
('MAT-GLOVES-001', 'Safety Gloves', 3, 3, 1, 'Pair', 50, 10, 180.00, 'In Stock', NOW());

-- ========== SUPPLIERS ==========
INSERT INTO suppliers (
  supplier_name, supplier_code, contact_person, email, phone, 
  country, city, address, status, created_at
) VALUES
('Construction Materials Ltd', 'SUP-001', 'John Supplier', 'john@construction.et', '+251-900-001', 
 'Ethiopia', 'Addis Ababa', 'Supplier Address 1', 'Active', NOW()),
('Office Supplies Inc', 'SUP-002', 'Jane Office', 'jane@office.et', '+251-900-002', 
 'Ethiopia', 'Addis Ababa', 'Supplier Address 2', 'Active', NOW()),
('Safety Equipment Co', 'SUP-003', 'Safety Sam', 'sam@safety.et', '+251-900-003', 
 'Ethiopia', 'Addis Ababa', 'Supplier Address 3', 'Active', NOW());

-- ========== STOCK TRANSACTIONS ==========
-- Record initial stock entries for materials
INSERT INTO stock_transactions (
  material_id, warehouse_id, transaction_type, quantity, 
  transaction_date, notes, issued_by_id, status, created_at
) VALUES
-- Cement initial stock
(1, 1, 'Stock In', 50, NOW(), 'Initial stock - Cement', 1, 'Completed', NOW()),
-- Steel Bar initial stock
(2, 1, 'Stock In', 20, NOW(), 'Initial stock - Steel Bar', 1, 'Completed', NOW()),
-- Office Paper initial stock
(3, 2, 'Stock In', 20, NOW(), 'Initial stock - Office Paper', 2, 'Completed', NOW()),
-- Safety Gloves initial stock
(5, 1, 'Stock In', 50, NOW(), 'Initial stock - Safety Gloves', 1, 'Completed', NOW());

-- ========== AUDIT LOGS ==========
INSERT INTO audit_logs (
  user_id, action, entity_type, entity_id, old_values, new_values, 
  ip_address, user_agent, timestamp
) VALUES
(1, 'CREATE', 'Material', 1, NULL, '{"name":"Cement","stock":50}', '127.0.0.1', 'Mozilla', NOW()),
(1, 'CREATE', 'Warehouse', 1, NULL, '{"name":"Main Warehouse","capacity":10000}', '127.0.0.1', 'Mozilla', NOW()),
(1, 'CREATE', 'Employee', 1, NULL, '{"name":"Employee 001","position":"Storekeeper"}', '127.0.0.1', 'Mozilla', NOW()),
(1, 'CREATE', 'Supplier', 1, NULL, '{"name":"Construction Materials Ltd"}', '127.0.0.1', 'Mozilla', NOW());

-- ========== SUMMARY ==========
-- Successfully inserted:
-- - 4 Employees
-- - 4 Warehouses
-- - 5 Materials
-- - 3 Suppliers
-- - 4 Stock Transactions
-- - 4 Audit Log Entries

SELECT 'Seed data loaded successfully' AS status,
  (SELECT COUNT(*) FROM employees_departments) AS employee_count,
  (SELECT COUNT(*) FROM warehouses) AS warehouse_count,
  (SELECT COUNT(*) FROM materials) AS material_count,
  (SELECT COUNT(*) FROM suppliers) AS supplier_count,
  (SELECT COUNT(*) FROM stock_transactions) AS transaction_count;
