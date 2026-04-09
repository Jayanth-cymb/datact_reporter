require('dotenv/config');
const bcrypt = require('bcryptjs');
const db = require('./db.js');

const email = process.env.ADMIN_EMAIL || 'admin@datact.com';
const password = process.env.ADMIN_PASSWORD || 'admin@1234';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  console.log(`Admin user already exists: ${email}`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (email, password_hash, name, role, active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(email, hash, 'Administrator', 'admin', Date.now());
  console.log(`Seeded admin user: ${email} / ${password}`);
  console.log('CHANGE THIS PASSWORD AFTER FIRST LOGIN.');
}
