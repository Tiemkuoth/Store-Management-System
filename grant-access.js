import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function grantAccess() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'stor_db',
    });

    console.log('Connected to database...');

    // Grant Director access to Tiemkuoth (ID: 5)
    const [result] = await connection.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      ['Director', 5]
    );

    console.log(`✅ Updated user: ${result.affectedRows} row(s) affected`);
    console.log('✅ Tiemkuoth now has Director access');

    await connection.end();
    console.log('✅ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

grantAccess();
