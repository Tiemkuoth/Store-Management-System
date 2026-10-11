-- Migration: Add user_id to employees_departments and standardize users.role to 5 roles
ALTER TABLE employees_departments ADD COLUMN IF NOT EXISTS user_id INT NULL;

-- Migrate any obsolete user roles to the 5 standard roles
UPDATE users SET role = 'Director' WHERE role IN ('Grand Director', 'Super Admin');
UPDATE users SET role = 'Manager' WHERE role IN ('Store Manager', 'Assistant Manager', 'Inventory Manager', 'Purchasing Manager');
UPDATE users SET role = 'Storekeeper' WHERE role = 'Inventory Staff';
UPDATE users SET role = 'Employee' WHERE role IN ('Accountant', 'Senior Cashier', 'Cashier', 'Auditor', 'Viewer', 'Read-only User');

-- Modify users.role ENUM definition
ALTER TABLE users MODIFY COLUMN role ENUM('Director', 'Administrator', 'Manager', 'Storekeeper', 'Employee') NOT NULL DEFAULT 'Storekeeper';
