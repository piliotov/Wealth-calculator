const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.supabase') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('Checking Supabase data...\n');

  const tables = ['users', 'accounts', 'transactions', 'friends', 'shared_expenses'];
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' });
    
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: ${data.length} rows`);
    }
  }

  // Check which transactions are missing
  console.log('\n--- Checking for issues ---');
  
  const { data: txns } = await supabase.from('transactions').select('id');
  const txnIds = txns ? txns.map(t => t.id) : [];
  console.log(`Transaction IDs in Supabase: ${txnIds.join(', ')}`);
}

checkData();
