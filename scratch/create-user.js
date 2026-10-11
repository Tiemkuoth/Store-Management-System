import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createPool } from 'mysql2/promise';

const pool = createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'store_management_db',
  connectionLimit: 2,
});

async function main() {
  const password = 'Gatluak@1200';
  const hash = await bcrypt.hash(password, 10);

  // Check if already exists
  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', ['Gatluak']);
  if (existing.length > 0) {
    console.log('⚠️  User "Gatluak" already exists — resetting password...');
    await pool.query('UPDATE users SET password_hash=?, status=? WHERE username=?', [hash, 'Active', 'Gatluak']);
    console.log('✅ Password reset to: Gatluak@1200');
  } else {
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, role, status, avatar_url, theme_preference, preferred_page, phone_contact, department)
       VALUES (?, ?, ?, ?, ?, 'Active', '/avatars/Gatluak.jpg', 'Light', 'TRANSACTIONS', '9099', 'hr')`,
      ['Gatluak', hash, 'Gatluak James', 'gatluak170@gmail.com', 'Director']
    );
    console.log('✅ User "Gatluak" created successfully!');
  }

  const [rows] = await pool.query('SELECT id, username, full_name, role, status FROM users');
  console.log('\n📋 All users in MySQL:');
  console.table(rows);

  await pool.end();
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
