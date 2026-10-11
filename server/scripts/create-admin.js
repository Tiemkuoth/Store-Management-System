import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getPool } from '../db/db.js';

async function createAdmin() {
  try {
    // Initialize database connection
    await initializeDatabase();
    const pool = getPool();

    const username = 'gatluak.james';
    const password = 'Admin123!@#';
    const fullName = 'Gatluak James';
    const email = 'gatluak.james@admin.com';
    const role = 'Director';

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert admin user
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [username, hash, fullName, email, role, 'Active']
    );

    console.log('\n✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Username:  ' + username);
    console.log('Password:  ' + password);
    console.log('Full Name: ' + fullName);
    console.log('Email:     ' + email);
    console.log('Role:      ' + role);
    console.log('User ID:   ' + result.insertId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 Login with these credentials at: http://localhost:5173\n');
    console.log('📌 Note: All data inserted by you will be persistent in the database.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   The username already exists. Try a different username.\n');
    }
    process.exit(1);
  }
}

createAdmin();
