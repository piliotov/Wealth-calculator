const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'server', 'finance-prod.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  console.log('Connected to production database\n');
  
  // List tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
      db.close();
      return;
    }
    
    console.log('Tables found:');
    tables.forEach(t => console.log('  -', t.name));
    console.log('');
    
    // Count rows in each table
    let pending = tables.length;
    tables.forEach(table => {
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
        if (err) {
          console.log(`  ${table.name}: Error - ${err.message}`);
        } else {
          console.log(`  ${table.name}: ${result.count} rows`);
        }
        pending--;
        if (pending === 0) {
          db.close();
        }
      });
    });
  });
});
