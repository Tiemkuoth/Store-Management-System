import { getPool, initializeDatabase } from '../backend/db/db.js';

async function testAutoSync() {
  console.log('Testing Employee Auto-Sync functionality...');
  await initializeDatabase();
  const pool = getPool();

  // Clean up any previous test user/employee
  await pool.query('DELETE FROM users WHERE username="test_sync_user"');
  await pool.query('DELETE FROM employees_departments WHERE email="test_sync@store.local"');

  // 1. Create a Storekeeper user
  console.log('1. Creating Storekeeper user...');
  const [res] = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
    ['test_sync_user', 'hash', 'Test Sync User', 'test_sync@store.local', 'Storekeeper']
  );
  const userId = res.insertId;

  // Verify NOT in employees_departments
  let [emps] = await pool.query('SELECT * FROM employees_departments WHERE user_id = ? OR email = "test_sync@store.local"', [userId]);
  console.log(`Storekeeper employee count: ${emps.length} (Expected: 0)`);
  if (emps.length !== 0) throw new Error('Storekeeper should not be in employees_departments!');

  // 2. Demote to Employee
  console.log('2. Demoting to Employee role...');
  // Simulate PUT /api/users/:id logic
  const [target] = await pool.query('SELECT id, role, email, full_name FROM users WHERE id=?', [userId]);
  await pool.query('UPDATE users SET role="Employee" WHERE id=?', [userId]);

  // Execute sync
  const code = `EMP-${Math.floor(100 + Math.random() * 900)}`;
  await pool.query(
    'INSERT INTO employees_departments (type, code, name, department_name, position, contact_number, email, gender, document_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['Employee', code, target[0].full_name, 'General', 'Employee', '', target[0].email, 'Not Specified', null, userId]
  );

  [emps] = await pool.query('SELECT * FROM employees_departments WHERE user_id = ? OR email = "test_sync@store.local"', [userId]);
  console.log(`Demoted Employee count: ${emps.length} (Expected: 1)`);
  if (emps.length !== 1) throw new Error('Employee should be automatically present in employees_departments!');
  console.log('Found employee record:', emps[0].name, emps[0].code, emps[0].user_id);

  // 3. Promote to Manager
  console.log('3. Promoting to Manager role...');
  await pool.query('UPDATE users SET role="Manager" WHERE id=?', [userId]);
  await pool.query('DELETE FROM employees_departments WHERE user_id = ? OR (email = "test_sync@store.local" AND type = "Employee")', [userId]);

  [emps] = await pool.query('SELECT * FROM employees_departments WHERE user_id = ? OR email = "test_sync@store.local"', [userId]);
  console.log(`Promoted Manager employee count: ${emps.length} (Expected: 0)`);
  if (emps.length !== 0) throw new Error('Promoted user should be automatically removed from employees_departments!');

  // Cleanup
  await pool.query('DELETE FROM users WHERE id=?', [userId]);
  console.log('✅ ALL AUTO-SYNC TESTS PASSED!');
  process.exit(0);
}

testAutoSync().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
