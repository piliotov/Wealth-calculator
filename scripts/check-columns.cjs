const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'server', 'finance-prod.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(transactions)", (err, columns) => {
  console.log('Transactions table columns:');
  columns.forEach(col => console.log(`  ${col.name}: ${col.type}`));
  
  db.all("SELECT DISTINCT encrypted FROM transactions", (err, rows) => {
    console.log('\nEncrypted values:', rows);
    db.close();
  });
});
