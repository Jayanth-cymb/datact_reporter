const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv/config');

const isPkg = !!process.pkg;

// When running as a packaged .exe, store the DB next to the executable
// so it persists across runs. In dev, store it in the server folder.
const dataDir = isPkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, '..');
const dbFile = process.env.DB_FILE || path.join(dataDir, 'data.sqlite');

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// schema.sql is bundled inside the pkg snapshot — fs.readFileSync still works
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Auto-seed admin on first run if no users exist
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const bcrypt = require('bcryptjs');
  const email = process.env.ADMIN_EMAIL || 'admin@datact.com';
  const password = process.env.ADMIN_PASSWORD || 'admin@1234';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (email, password_hash, name, role, active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(email, hash, 'Administrator', 'admin', Date.now());
  console.log(`Seeded admin user on first run: ${email} / ${password}`);
}

module.exports = db;
module.exports.db = db;
