#!/usr/bin/env node

/**
 * SQLite to Supabase Migration Script
 * 
 * Usage:
 * 1. Set up .env.supabase with SUPABASE_URL and SUPABASE_SERVICE_KEY
 * 2. Run: node scripts/migrate-to-supabase.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.supabase') });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.supabase');
  console.error('Create .env.supabase with these variables first!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Open SQLite database - Use PRODUCTION database from Fly.io
const dbPath = path.resolve(__dirname, '..', 'server', 'finance-prod.db');
console.log('Using database:', dbPath);
const db = new sqlite3.Database(dbPath);

const log = {
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`)
};

async function getAllRows(table) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function migrateTable(tableName, rows) {
  if (rows.length === 0) {
    log.info(`Skipping ${tableName} (empty)`);
    return;
  }

  try {
    // Map SQLite column names to Supabase format
    const mappedRows = rows.map(row => {
      const mappedRow = {};
      for (const [key, value] of Object.entries(row)) {
        // Convert snake_case SQLite columns if needed
        mappedRow[key] = value;
      }
      return mappedRow;
    });

    console.log(`Attempting to insert ${rows.length} rows into ${tableName}...`);
    
    const { data, error } = await supabase
      .from(tableName)
      .insert(mappedRows, { count: 'exact' });

    if (error) {
      log.error(`${tableName}: ${error.message}`);
      console.error('Full error:', error);
      return false;
    }

    log.success(`${tableName}: ${rows.length} rows inserted`);
    return true;
  } catch (err) {
    log.error(`${tableName}: ${err.message}`);
    console.error('Full error:', err);
    return false;
  }
}

async function migrate() {
  log.info('Starting Supabase migration...\n');

  try {
    // Order matters: users first (referenced by other tables)
    const tables = ['users', 'accounts', 'transactions', 'friends', 'shared_expenses'];

    for (const table of tables) {
      try {
        const rows = await getAllRows(table);
        await migrateTable(table, rows);
      } catch (err) {
        log.error(`Failed to read ${table}: ${err.message}`);
      }
    }

    log.success('\n✨ Migration complete!');
    log.info('Please verify data in Supabase dashboard');

  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
