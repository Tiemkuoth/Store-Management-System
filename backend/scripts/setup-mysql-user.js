#!/usr/bin/env node

/**
 * Setup MySQL User and Database
 * Creates storeapp user with proper privileges
 * 
 * Usage:
 *   node backend/scripts/setup-mysql-user.js
 */

import mysql from 'mysql2/promise';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

async function setupMySQLUser() {
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}MySQL User Setup${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);

  let connection;

  try {
    // Step 1: Connect as root
    log.info('Connecting to MySQL as root...');
    
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '', // Default root password is empty
    });
    
    log.success('Connected as root');

    // Step 2: Create database
    log.info('Creating database store_management_db...');
    await connection.query('CREATE DATABASE IF NOT EXISTS store_management_db');
    log.success('Database created/verified');

    // Step 3: Create user
    log.info('Creating user storeapp@localhost...');
    
    try {
      await connection.query(
        "CREATE USER 'storeapp'@'localhost' IDENTIFIED BY 'StoreApp@Secure123'"
      );
      log.success('User created');
    } catch (err) {
      if (err.code === 'ER_USER_EXISTS_ERROR') {
        log.warn('User already exists, updating password...');
        await connection.query(
          "ALTER USER 'storeapp'@'localhost' IDENTIFIED BY 'StoreApp@Secure123'"
        );
        log.success('Password updated');
      } else {
        throw err;
      }
    }

    // Step 4: Grant privileges
    log.info('Granting privileges...');
    await connection.query(
      "GRANT ALL PRIVILEGES ON store_management_db.* TO 'storeapp'@'localhost'"
    );
    await connection.query('FLUSH PRIVILEGES');
    log.success('Privileges granted');

    // Step 5: Verify
    log.info('Verifying user...');
    const [users] = await connection.query(
      "SELECT user, host, authentication_string FROM mysql.user WHERE user='storeapp'"
    );

    if (users.length > 0) {
      log.success('User verified:');
      users.forEach(user => {
        console.log(`  • User: ${user.user}`);
        console.log(`  • Host: ${user.host}`);
        console.log(`  • Has password: ${user.authentication_string ? '✓ Yes' : '✗ No'}`);
      });
    }

    console.log(`\n${colors.green}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.green}Setup Complete!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(50)}${colors.reset}\n`);

    console.log(`${colors.blue}Next steps:${colors.reset}`);
    console.log(`  1. Create the database schema:`);
    console.log(`     npm run test:db`);
    console.log(`  2. Load sample data:`);
    console.log(`     npm run seed`);
    console.log(`  3. Start the application:`);
    console.log(`     npm run dev\n`);

  } catch (err) {
    console.log();
    log.error(`Setup failed: ${err.message}`);
    console.log(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
    
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
      console.log(`  • MySQL is not running`);
      console.log(`  • Start MySQL and try again`);
      console.log(`  • Or use Docker: docker-compose up -d mysql`);
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log(`  • Root password is required`);
      console.log(`  • Edit this script and change: password: ''`);
      console.log(`  • To: password: 'your_root_password'`);
    } else {
      console.log(`  • ${err.message}`);
      console.log(`  • Code: ${err.code}`);
    }
    console.log();
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupMySQLUser();
