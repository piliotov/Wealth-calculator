const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./database.cjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy - required when behind Fly.io proxy
app.set('trust proxy', 1);

// Security: Helmet - Sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Parse JSON bodies BEFORE other middleware
app.use(express.json({ limit: '10mb' })); // Limit payload size

// Security: CORS - Restrict origins in production
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || true) // Allow same origin in production
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security: Rate limiting - Prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Limit login attempts (increased from 5)
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);

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
app.post('/api/register', authLimiter, (req, res) => {
  const { username, password } = req.body;
  
  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  const hash = bcrypt.hashSync(password, 10); // Increased from 8 to 10 rounds
  
  const sql = 'INSERT INTO users (username, password_hash, full_name, avatar_url) VALUES (?, ?, NULL, NULL)';
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
        const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: userId, username, fullName: null, avatarUrl: null } });
    });
  });
});

app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, hasPassword: !!password, bodyKeys: Object.keys(req.body) });
  
  if (!username || !password) {
    console.log('Missing credentials');
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(400).json({ error: 'User not found' });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        fullName: user.full_name || null,
        avatarUrl: user.avatar_url || null
      } 
    });
  });
});

// --- User Profile ---
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, avatar_url FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name || null,
      avatarUrl: user.avatar_url || null
    });
  });
});

app.put('/api/me', authenticateToken, (req, res) => {
  const { fullName, avatarUrl } = req.body;
  const trimmedName = typeof fullName === 'string' ? fullName.trim() : null;
  const trimmedAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : null;

  if (trimmedName && trimmedName.length > 120) {
    return res.status(400).json({ error: 'Name is too long' });
  }

  db.run(
    'UPDATE users SET full_name = ?, avatar_url = ? WHERE id = ?',
    [trimmedName || null, trimmedAvatar || null, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT id, username, full_name, avatar_url FROM users WHERE id = ?', [req.user.id], (selectErr, user) => {
        if (selectErr || !user) return res.status(404).json({ error: 'User not found' });
        res.json({
          id: user.id,
          username: user.username,
          fullName: user.full_name || null,
          avatarUrl: user.avatar_url || null
        });
      });
    }
  );
});

// --- Two-Factor Authentication ---
app.post('/api/2fa/enable', authenticateToken, (req, res) => {
  const { totpSecret } = req.body;
  
  if (!totpSecret) {
    return res.status(400).json({ error: 'TOTP secret required' });
  }

  db.run(
    'UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?',
    [totpSecret, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to enable 2FA' });
      res.json({ message: '2FA enabled successfully' });
    }
  );
});

app.post('/api/2fa/disable', authenticateToken, (req, res) => {
  db.run(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?',
    [req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to disable 2FA' });
      res.json({ message: '2FA disabled successfully' });
    }
  );
});

app.get('/api/2fa/status', authenticateToken, (req, res) => {
  db.get('SELECT totp_enabled, totp_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ 
      enabled: user.totp_enabled === 1,
      hasSecret: !!user.totp_secret
    });
  });
});

app.post('/api/2fa/verify', authenticateToken, (req, res) => {
  const { code } = req.body;
  
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid code format' });
  }

  db.get('SELECT totp_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_secret) return res.status(400).json({ error: '2FA not enabled' });

    // Verify TOTP code server-side
    const otpauth = require('otpauth');
    const totp = new otpauth.TOTP({
      secret: user.totp_secret,
      digits: 6,
      period: 30
    });

    const isValid = totp.validate({ token: code, window: 1 }) !== null;
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    res.json({ message: '2FA verified successfully' });
  });
});

// --- End-to-End Encryption ---
app.post('/api/encryption/setup', authenticateToken, (req, res) => {
  const { salt } = req.body;
  
  if (!salt) {
    return res.status(400).json({ error: 'Encryption salt required' });
  }

  db.run(
    'UPDATE users SET encryption_salt = ? WHERE id = ?',
    [salt, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to setup encryption' });
      res.json({ message: 'Encryption setup complete' });
    }
  );
});

app.get('/api/encryption/salt', authenticateToken, (req, res) => {
  db.get('SELECT encryption_salt FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ salt: user.encryption_salt });
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
  console.log('Creating account:', { user_id: req.user.id, name, currency, balance });
  const sql = 'INSERT INTO accounts (user_id, name, currency, type, balance) VALUES (?, ?, ?, ?, ?)';
  
  db.run(sql, [req.user.id, name, currency, 'bank', balance], function(err) {
    if (err) {
      console.error('Account creation error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('Account created successfully:', this.lastID);
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

    // Build prompt
    const assetsSummary = accounts.map(a => 
      `- ${a.name}: ${(a.balance || 0).toFixed(2)} ${a.currency}`
    ).join('\n');

    const txSummary = transactions.map(t => 
      `- ${t.date}: ${t.type.toUpperCase()} of ${(t.amount || 0).toFixed(2)} ${t.currency} for ${t.category} (${t.description || 'No description'})`
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

    // Call Gemini via REST to avoid SDK/model version mismatches
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GOOGLE_API_KEY/GEMINI_API_KEY on the server' });
    }

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}]
      })
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('Gemini HTTP error', resp.status, errBody);
      return res.status(500).json({
        error: 'Failed to generate AI response',
        details: errBody
      });
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from model';
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

// Serve static files from the React app (must be after API routes)
const path = require('path');
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't match API routes or static files,
// send back the index.html file for client-side routing
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});