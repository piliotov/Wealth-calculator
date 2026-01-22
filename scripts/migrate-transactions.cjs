const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.supabase') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = path.resolve(__dirname, '..', 'server', 'finance-prod.db');
const db = new sqlite3.Database(dbPath);

async function migrateTransactions() {
  console.log('Migrating transactions...\n');

  db.all('SELECT * FROM transactions', async (err, rows) => {
    if (err) {
      console.error('Error reading transactions:', err);
      db.close();
      return;
    }

    console.log(`Found ${rows.length} transactions to migrate`);

    // Insert in batches of 50 to avoid timeouts
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('transactions')
        .insert(batch);

      if (error) {
        console.error(`Batch ${i / batchSize + 1} error:`, error.message);
      } else {
        console.log(`Batch ${i / batchSize + 1}: ${batch.length} rows inserted`);
      }
    }

    console.log('\n✅ Transactions migration complete!');
    db.close();
  });
}

migrateTransactions();
