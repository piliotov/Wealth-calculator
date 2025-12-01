const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database.cjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const hash = bcrypt.hashSync(password, 8);
  
  const sql = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
  db.run(sql, [username, hash], function(err) {
    if (err) return res.status(400).json({ error: 'User already exists' });
    
    // Create Default Accounts
    const userId = this.lastID;
    const accountsSql = `INSERT INTO accounts (user_id, name, currency, type, balance) VALUES 
      (?, 'German Bank', 'EUR', 'bank', 0),
      (?, 'BG Bank', 'BGN', 'bank', 0),
      (?, 'Revolut', 'EUR', 'bank', 0)`;
    
    db.run(accountsSql, [userId, userId, userId], (accErr) => {
        if(accErr) console.error("Error creating default accounts");
        const token = jwt.sign({ id: userId, username }, JWT_SECRET);
        res.json({ token, user: { id: userId, username } });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});

// --- Accounts ---
app.get('/api/accounts', authenticateToken, (req, res) => {
    db.all('SELECT * FROM accounts WHERE user_id = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});

app.post('/api/accounts', authenticateToken, (req, res) => {
  const { name, currency, balance = 0 } = req.body;
  const sql = 'INSERT INTO accounts (user_id, name, currency, type, balance) VALUES (?, ?, ?, ?, ?)';
  
  db.run(sql, [req.user.id, name, currency, 'bank', balance], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, user_id: req.user.id, name, currency, type: 'bank', balance });
  });
});

app.put('/api/accounts/:id', authenticateToken, (req, res) => {
  const { balance } = req.body;
  const sql = 'UPDATE accounts SET balance = ? WHERE id = ? AND user_id = ?';
  
  db.run(sql, [balance, req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/accounts/:id', authenticateToken, (req, res) => {
  const sql = 'DELETE FROM accounts WHERE id = ? AND user_id = ?';
  
  db.run(sql, [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Transactions ---
app.get('/api/transactions', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC';
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
  const { accountId, type, category, amount, currency, date, description } = req.body;
  const sql = `INSERT INTO transactions (user_id, account_id, type, category, amount, currency, date, description) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [req.user.id, accountId, type, category, amount, currency, date, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Update Account Balance
    const balanceSql = type === 'income' 
        ? 'UPDATE accounts SET balance = balance + ? WHERE id = ?'
        : 'UPDATE accounts SET balance = balance - ? WHERE id = ?';
    
    db.run(balanceSql, [amount, accountId], (updateErr) => {
        res.json({ id: this.lastID, ...req.body });
    });
  });
});

app.put('/api/transactions/:id', authenticateToken, (req, res) => {
  const { accountId, type, category, amount, currency, date, description } = req.body;
  
  // First, get the old transaction to revert its balance effect
  db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, oldTx) => {
    if (err || !oldTx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Revert old balance
    const revertSql = oldTx.type === 'income'
      ? 'UPDATE accounts SET balance = balance - ? WHERE id = ?'
      : 'UPDATE accounts SET balance = balance + ? WHERE id = ?';
    
    db.run(revertSql, [oldTx.amount, oldTx.account_id], (revertErr) => {
      if (revertErr) return res.status(500).json({ error: revertErr.message });
      
      // Update transaction
      const updateSql = `UPDATE transactions SET account_id = ?, type = ?, category = ?, amount = ?, currency = ?, date = ?, description = ? WHERE id = ? AND user_id = ?`;
      db.run(updateSql, [accountId, type, category, amount, currency, date, description, req.params.id, req.user.id], function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        // Apply new balance
        const applySql = type === 'income'
          ? 'UPDATE accounts SET balance = balance + ? WHERE id = ?'
          : 'UPDATE accounts SET balance = balance - ? WHERE id = ?';
        
        db.run(applySql, [amount, accountId], (applyErr) => {
          res.json({ success: true, id: req.params.id });
        });
      });
    });
  });
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
  // Get transaction first to revert balance
  db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, tx) => {
    if (err || !tx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Revert balance
    const revertSql = tx.type === 'income'
      ? 'UPDATE accounts SET balance = balance - ? WHERE id = ?'
      : 'UPDATE accounts SET balance = balance + ? WHERE id = ?';
    
    db.run(revertSql, [tx.amount, tx.account_id], (revertErr) => {
      if (revertErr) return res.status(500).json({ error: revertErr.message });
      
      // Delete transaction
      db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (delErr) => {
        if (delErr) return res.status(500).json({ error: delErr.message });
        res.json({ success: true });
      });
    });
  });
});

// --- Transfers ---
app.post('/api/transfers', authenticateToken, (req, res) => {
  const { fromAccountId, toAccountId, amount, description, fromCurrency, toCurrency } = req.body;
  
  // Exchange rate conversion (simplified - you can improve this)
  const RATES = { EUR: 1, BGN: 1.95583, USD: 1.1 };
  const amountInEUR = amount / RATES[fromCurrency];
  const convertedAmount = amountInEUR * RATES[toCurrency];
  
  db.serialize(() => {
    // Deduct from source account
    db.run('UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?', 
      [amount, fromAccountId, req.user.id]);
    
    // Add to destination account
    db.run('UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?', 
      [convertedAmount, toAccountId, req.user.id]);
    
    // Record as expense from source
    db.run(`INSERT INTO transactions (user_id, account_id, type, category, amount, currency, date, description) 
            VALUES (?, ?, 'expense', 'Transfer Out', ?, ?, ?, ?)`,
      [req.user.id, fromAccountId, amount, fromCurrency, new Date().toISOString(), description]);
    
    // Record as income to destination
    db.run(`INSERT INTO transactions (user_id, account_id, type, category, amount, currency, date, description) 
            VALUES (?, ?, 'income', 'Transfer In', ?, ?, ?, ?)`,
      [req.user.id, toAccountId, convertedAmount, toCurrency, new Date().toISOString(), description], function() {
        res.json({ success: true });
      });
  });
});

// --- AI Chat ---
app.post('/api/chat', authenticateToken, async (req, res) => {
  const { message } = req.body;
  
  try {
    // Get user's accounts
    const accounts = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM accounts WHERE user_id = ?', [req.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get last 20 transactions
    const transactions = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 20',
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Use Gemini AI
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    
    const assetsSummary = accounts.map(a => 
      `- ${a.name}: ${a.balance.toFixed(2)} ${a.currency}`
    ).join('\n');

    const txSummary = transactions.map(t => 
      `- ${t.date}: ${t.type.toUpperCase()} of ${t.amount.toFixed(2)} ${t.currency} for ${t.category} (${t.description})`
    ).join('\n');

    const prompt = `
You are an expert Virtual CFO and financial advisor.

Current Financial Snapshot (Assets):
${assetsSummary || "No accounts found."}

Recent Activity (Last 20 Transactions):
${txSummary || "No transactions found."}

User Question: "${message}"

Instructions:
1. Analyze the spending patterns AND the current account balances.
2. If the user asks about affordability, check if they have enough balance in the relevant currency/account.
3. Provide a concise, friendly, and actionable answer.
4. Format the response with Markdown for readability.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    console.error('AI Chat Error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate AI response', 
      details: error.message,
      hint: 'Check that your GOOGLE_API_KEY is valid and the Gemini API is enabled'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});