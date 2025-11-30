const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});