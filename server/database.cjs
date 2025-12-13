const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use /data volume in production (Fly.io), local path in development
const dbDir = process.env.NODE_ENV === 'production' ? '/data' : __dirname;
const dbPath = path.resolve(dbDir, 'finance.db');

console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    )`);

    // Ensure optional profile columns exist (safe to no-op if already added)
    addColumnIfMissing('users', 'full_name', 'TEXT');
    addColumnIfMissing('users', 'avatar_url', 'TEXT');
    addColumnIfMissing('users', 'totp_secret', 'TEXT'); // Encrypted TOTP secret
    addColumnIfMissing('users', 'totp_enabled', 'INTEGER DEFAULT 0'); // 2FA enabled flag
    addColumnIfMissing('users', 'encryption_salt', 'TEXT'); // Salt for E2E encryption

    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      type TEXT,
      currency TEXT,
      balance REAL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Add encrypted flag for accounts
    addColumnIfMissing('accounts', 'encrypted', 'INTEGER DEFAULT 0');

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      account_id INTEGER,
      type TEXT,
      category TEXT,
      amount REAL,
      currency TEXT,
      date TEXT,
      description TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    )`);
    
    // Add encrypted flag for transactions
    addColumnIfMissing('transactions', 'encrypted', 'INTEGER DEFAULT 0');
  });
}

// Add a column only if it does not already exist to avoid migration errors on existing DBs
function addColumnIfMissing(table, column, type) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) {
      console.error(`Failed to inspect table ${table}:`, err.message);
      return;
    }
    const hasColumn = rows.some(r => r.name === column);
    if (!hasColumn) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, alterErr => {
        if (alterErr) {
          console.error(`Failed to add column ${column} to ${table}:`, alterErr.message);
        }
      });
    }
  });
}

module.exports = db;