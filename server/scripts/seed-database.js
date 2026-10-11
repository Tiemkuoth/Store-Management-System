/**
 * Database Seeding Script
 * Inserts sample data for development and testing
 * 
 * Usage:
 *   node server/scripts/seed-database.js [--clean]
 * 
 * Options:
 *   --clean   Delete all data before seeding (WARNING: data loss!)
 *   --help    Show this help message
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.green}${'='.repeat(50)}${colors.reset}\n${colors.green}${msg}${colors.reset}\n${colors.green}${'='.repeat(50)}${colors.reset}\n`),
};

const SEED_DATA = {
  suppliers: [
    {
      supplier_code: 'SUP-001',
      name: 'Construction Materials Ltd',
      contact_person: 'John Supplier',
      email: 'john@construction.et',
      phone: '+251-900-001',
      address: 'Supplier Address 1',
    },
    {
      supplier_code: 'SUP-002',
      name: 'Office Supplies Inc',
      contact_person: 'Jane Office',
      email: 'jane@office.et',
      phone: '+251-900-002',
      address: 'Supplier Address 2',
    },
    {
      supplier_code: 'SUP-003',
      name: 'Safety Equipment Co',
      contact_person: 'Safety Sam',
      email: 'sam@safety.et',
      phone: '+251-900-003',
      address: 'Supplier Address 3',
    },
  ],

  warehouses: [
    {
      code: 'WH-ETH-001',
      name: 'Main Warehouse',
      address: 'Main Warehouse Compound, Addis Ababa',
      manager_name: 'Store Manager',
    },
    {
      code: 'WH-ETH-002',
      name: 'Branch Warehouse',
      address: 'Branch Warehouse Compound, Dire Dawa',
      manager_name: 'Warehouse Manager',
    },
    {
      code: 'WH-SSD-001',
      name: 'Juba Central Warehouse',
      address: 'Central Warehouse Complex, Juba',
      manager_name: 'Warehouse Manager',
    },
    {
      code: 'WH-SSD-002',
      name: 'Juba Branch Store',
      address: 'Branch Store Location, Juba',
      manager_name: 'Storekeeper',
    },
  ],

  employees: [
    {
      type: 'Employee',
      code: 'EMP-001',
      name: 'Employee 001',
      email: 'emp001@store.local',
      contact_number: '+251-123-001',
      department_name: 'Inventory',
    },
    {
      type: 'Employee',
      code: 'EMP-002',
      name: 'Employee 002',
      email: 'emp002@store.local',
      contact_number: '+251-123-002',
      department_name: 'Purchasing',
    },
    {
      type: 'Employee',
      code: 'EMP-003',
      name: 'Employee 003',
      email: 'emp003@store.local',
      contact_number: '+211-123-003',
      department_name: 'Sales',
    },
    {
      type: 'Employee',
      code: 'EMP-004',
      name: 'Employee 004',
      email: 'emp004@store.local',
      contact_number: '+211-123-004',
      department_name: 'Finance',
    },
  ],

  materials: (warehouseIds, supplierIds) => [
    {
      material_code: 'MAT-CEMENT-001',
      name: 'Cement',
      category_id: 1,
      supplier_id: supplierIds[0],
      unit_of_measure: 'Bag',
      current_stock: 50,
      min_stock_level: 10,
      unit_cost: 850.00,
      location: 'Main Warehouse',
    },
    {
      material_code: 'MAT-STEEL-001',
      name: 'Steel Bar 12mm',
      category_id: 1,
      supplier_id: supplierIds[0],
      unit_of_measure: 'Piece',
      current_stock: 20,
      min_stock_level: 5,
      unit_cost: 1250.00,
      location: 'Main Warehouse',
    },
    {
      material_code: 'MAT-PAPER-001',
      name: 'Office Paper A4',
      category_id: 2,
      supplier_id: supplierIds[1],
      unit_of_measure: 'Ream',
      current_stock: 20,
      min_stock_level: 5,
      unit_cost: 650.00,
      location: 'Office Store',
    },
    {
      material_code: 'MAT-INK-001',
      name: 'Printer Ink',
      category_id: 5,
      supplier_id: supplierIds[1],
      unit_of_measure: 'Box',
      current_stock: 0,
      min_stock_level: 5,
      unit_cost: 2400.00,
      location: 'Office Store',
    },
    {
      material_code: 'MAT-GLOVES-001',
      name: 'Safety Gloves',
      category_id: 3,
      supplier_id: supplierIds[2],
      unit_of_measure: 'Pair',
      current_stock: 50,
      min_stock_level: 10,
      unit_cost: 180.00,
      location: 'Warehouse B',
    },
  ],
};

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'store_management_db',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  });
}

async function cleanDatabase(connection) {
  log.warn('Cleaning database...');
  
  const tables = [
    'stock_transactions',
    'stock_transfers',
    'material_disposals',
    'material_requests',
    'po_items',
    'purchase_orders',
    'materials',
    'audit_logs',
    'notifications',
    'messages',
    'system_notifications',
    'password_history',
    'tasks',
    'employees_departments',
    'suppliers',
    'warehouses',
  ];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tables) {
      try {
        await connection.query(`TRUNCATE TABLE ${table}`);
        log.success(`Truncated ${table}`);
      } catch (err) {
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          throw err;
        }
      }
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    log.success('Database cleaned');
  } catch (err) {
    log.error(`Failed to clean database: ${err.message}`);
    throw err;
  }
}

async function seedSuppliers(connection) {
  log.header('Seeding Suppliers');
  
  const supplierIds = [];
  
  for (const supplier of SEED_DATA.suppliers) {
    try {
      const [result] = await connection.query(
        'INSERT INTO suppliers SET ?',
        supplier
      );
      supplierIds.push(result.insertId);
      log.success(`Created supplier: ${supplier.supplier_name} (ID: ${result.insertId})`);
    } catch (err) {
      log.error(`Failed to create supplier ${supplier.supplier_name}: ${err.message}`);
      throw err;
    }
  }
  
  return supplierIds;
}

async function seedWarehouses(connection) {
  log.header('Seeding Warehouses');
  
  const warehouseIds = [];
  
  for (const warehouse of SEED_DATA.warehouses) {
    try {
      const [result] = await connection.query(
        'INSERT INTO warehouses SET ?',
        warehouse
      );
      warehouseIds.push(result.insertId);
      log.success(`Created warehouse: ${warehouse.warehouse_name} (ID: ${result.insertId})`);
    } catch (err) {
      log.error(`Failed to create warehouse ${warehouse.warehouse_name}: ${err.message}`);
      throw err;
    }
  }
  
  return warehouseIds;
}

async function seedEmployees(connection) {
  log.header('Seeding Employees');
  
  for (const employee of SEED_DATA.employees) {
    try {
      const [result] = await connection.query(
        'INSERT INTO employees_departments SET ?',
        employee
      );
      log.success(`Created employee: ${employee.first_name} ${employee.last_name} (ID: ${result.insertId})`);
    } catch (err) {
      log.error(`Failed to create employee ${employee.first_name}: ${err.message}`);
      throw err;
    }
  }
}

async function seedMaterials(connection, warehouseIds, supplierIds) {
  log.header('Seeding Materials');
  
  const materials = SEED_DATA.materials(warehouseIds, supplierIds);
  
  for (const material of materials) {
    try {
      const [result] = await connection.query(
        'INSERT INTO materials SET ?',
        material
      );
      log.success(`Created material: ${material.material_name} (ID: ${result.insertId})`);
    } catch (err) {
      log.error(`Failed to create material ${material.material_name}: ${err.message}`);
      throw err;
    }
  }
}

async function seedStockTransactions(connection) {
  log.header('Seeding Stock Transactions');
  
  // Get first material and warehouse IDs
  try {
    const [materials] = await connection.query('SELECT id FROM materials LIMIT 4');
    
    if (materials.length === 0) {
      log.warn('No materials found, skipping stock transactions');
      return;
    }
    
    const transactions = [
      {
        material_id: materials[0].id,
        warehouse_id: 1,
        transaction_type: 'Stock In',
        quantity: 50,
        transaction_date: new Date(),
        notes: 'Initial stock - Cement',
        issued_by_id: 1,
        status: 'Completed',
      },
      {
        material_id: materials[1].id,
        warehouse_id: 1,
        transaction_type: 'Stock In',
        quantity: 20,
        transaction_date: new Date(),
        notes: 'Initial stock - Steel Bar',
        issued_by_id: 1,
        status: 'Completed',
      },
      {
        material_id: materials[2].id,
        warehouse_id: 2,
        transaction_type: 'Stock In',
        quantity: 20,
        transaction_date: new Date(),
        notes: 'Initial stock - Office Paper',
        issued_by_id: 1,
        status: 'Completed',
      },
      {
        material_id: materials[3].id,
        warehouse_id: 1,
        transaction_type: 'Stock In',
        quantity: 50,
        transaction_date: new Date(),
        notes: 'Initial stock - Safety Gloves',
        issued_by_id: 1,
        status: 'Completed',
      },
    ];
    
    for (const transaction of transactions) {
      try {
        const [result] = await connection.query(
          'INSERT INTO stock_transactions SET ?',
          transaction
        );
        log.success(`Created stock transaction (ID: ${result.insertId})`);
      } catch (err) {
        log.error(`Failed to create stock transaction: ${err.message}`);
      }
    }
  } catch (err) {
    log.error(`Failed to seed stock transactions: ${err.message}`);
  }
}

async function seedAuditLogs(connection) {
  log.header('Seeding Audit Logs');
  
  const auditLogs = [
    {
      user_id: 1,
      action: 'CREATE',
      entity_type: 'Material',
      entity_id: 1,
      old_values: null,
      new_values: JSON.stringify({ name: 'Cement', stock: 50 }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla',
      timestamp: new Date(),
    },
    {
      user_id: 1,
      action: 'CREATE',
      entity_type: 'Warehouse',
      entity_id: 1,
      old_values: null,
      new_values: JSON.stringify({ name: 'Main Warehouse', capacity: 10000 }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla',
      timestamp: new Date(),
    },
    {
      user_id: 1,
      action: 'CREATE',
      entity_type: 'Employee',
      entity_id: 1,
      old_values: null,
      new_values: JSON.stringify({ name: 'Employee 001', position: 'Storekeeper' }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla',
      timestamp: new Date(),
    },
    {
      user_id: 1,
      action: 'CREATE',
      entity_type: 'Supplier',
      entity_id: 1,
      old_values: null,
      new_values: JSON.stringify({ name: 'Construction Materials Ltd' }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla',
      timestamp: new Date(),
    },
  ];
  
  for (const log_entry of auditLogs) {
    try {
      const [result] = await connection.query(
        'INSERT INTO audit_logs SET ?',
        log_entry
      );
      log.success(`Created audit log (ID: ${result.insertId})`);
    } catch (err) {
      log.error(`Failed to create audit log: ${err.message}`);
    }
  }
}

async function showSummary(connection) {
  log.header('Seeding Summary');
  
  try {
    const [counts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM suppliers) AS suppliers,
        (SELECT COUNT(*) FROM warehouses) AS warehouses,
        (SELECT COUNT(*) FROM employees_departments) AS employees,
        (SELECT COUNT(*) FROM materials) AS materials,
        (SELECT COUNT(*) FROM stock_transactions) AS transactions,
        (SELECT COUNT(*) FROM audit_logs) AS audit_logs
    `);
    
    const summary = counts[0];
    console.log(`
  Suppliers:        ${summary.suppliers}
  Warehouses:       ${summary.warehouses}
  Employees:        ${summary.employees}
  Materials:        ${summary.materials}
  Transactions:     ${summary.transactions}
  Audit Logs:       ${summary.audit_logs}
    `);
    
    log.success('Database seeding completed successfully!');
  } catch (err) {
    log.error(`Failed to retrieve summary: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean = args.includes('--clean');
  const shouldShowHelp = args.includes('--help');

  if (shouldShowHelp) {
    console.log(`
Database Seeding Script
Usage: node server/scripts/seed-database.js [--clean] [--help]

Options:
  --clean   Delete all data before seeding (WARNING: data loss!)
  --help    Show this help message
    `);
    process.exit(0);
  }

  let connection;
  
  try {
    log.info('Connecting to database...');
    connection = await getConnection();
    log.success('Database connected');

    if (shouldClean) {
      await cleanDatabase(connection);
    }

    // Seed data
    const supplierIds = await seedSuppliers(connection);
    const warehouseIds = await seedWarehouses(connection);
    await seedEmployees(connection);
    await seedMaterials(connection, warehouseIds, supplierIds);
    await seedStockTransactions(connection);
    await seedAuditLogs(connection);
    
    // Show summary
    await showSummary(connection);

  } catch (err) {
    log.error(`Seeding failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
