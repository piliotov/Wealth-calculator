const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.supabase') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = path.resolve(__dirname, '..', 'server', 'finance-prod.db');
const db = new sqlite3.Database(dbPath);

async function fixTransactions() {
  console.log('Getting existing data from Supabase...');
  
  // Get existing transaction IDs
  const { data: existingTxns } = await supabase.from('transactions').select('id');
  const existingIds = new Set(existingTxns ? existingTxns.map(t => t.id) : []);
  console.log(`Existing transactions in Supabase: ${existingIds.size}`);

  // Get valid account IDs
  const { data: accounts } = await supabase.from('accounts').select('id');
  const validAccountIds = new Set(accounts ? accounts.map(a => a.id) : []);
  console.log(`Valid account IDs: ${Array.from(validAccountIds).join(', ')}`);

  db.all('SELECT * FROM transactions', async (err, rows) => {
    if (err) {
      console.error('Error reading transactions:', err);
      db.close();
      return;
    }

    console.log(`\nTotal transactions in SQLite: ${rows.length}`);
    
    // Filter: only missing ones, with valid account_id
    const toInsert = rows.filter(row => {
      if (existingIds.has(row.id)) return false; // Already exists
      if (!row.account_id) {
        console.log(`Skipping txn ${row.id}: NULL account_id`);
        return false;
      }
      if (!validAccountIds.has(row.account_id)) {
        console.log(`Skipping txn ${row.id}: Invalid account_id ${row.account_id}`);
        return false;
      }
      return true;
    });

    console.log(`\nTransactions to insert: ${toInsert.length}`);

    if (toInsert.length === 0) {
      console.log('Nothing to insert!');
      db.close();
      return;
    }

    // Insert one by one to see which fail
    let success = 0;
    let failed = 0;
    
    for (const row of toInsert) {
      const { error } = await supabase.from('transactions').insert(row);
      if (error) {
        console.log(`Failed txn ${row.id}: ${error.message}`);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`\n✅ Done! Success: ${success}, Failed: ${failed}`);
    db.close();
  });
}

fixTransactions();
