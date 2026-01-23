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
      connectSrc: ["'self'", "https://api.exchangerate-api.com"],
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

// Generate unique user number (8 digits)
function generateUserNumber() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

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
  
  const sql = 'INSERT INTO users (username, password_hash, full_name, avatar_url, user_number) VALUES (?, ?, NULL, NULL, ?)';
  const userNumber = generateUserNumber();
  db.run(sql, [username, hash, userNumber], function(err) {
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
        res.json({ token, user: { id: userId, username, fullName: null, avatarUrl: null, userNumber } });
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
        avatarUrl: user.avatar_url || null,
        userNumber: user.user_number || null
      } 
    });
  });
});

// --- User Profile ---
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, full_name, avatar_url, user_number FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    
    // Generate user number if missing (for existing users)
    if (!user.user_number) {
      const newUserNumber = generateUserNumber();
      db.run('UPDATE users SET user_number = ? WHERE id = ?', [newUserNumber, req.user.id], () => {
        res.json({
          id: user.id,
          username: user.username,
          fullName: user.full_name || null,
          avatarUrl: user.avatar_url || null,
          userNumber: newUserNumber
        });
      });
    } else {
      res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name || null,
        avatarUrl: user.avatar_url || null,
        userNumber: user.user_number
      });
    }
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
  const newAccountId = parseInt(accountId, 10);
  const newAmount = parseFloat(amount);
  
  // First, get the old transaction to revert its balance effect
  db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, oldTx) => {
    if (err || !oldTx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Step 1: Revert old balance from old account
    const revertSql = oldTx.type === 'income'
      ? 'UPDATE accounts SET balance = balance - ? WHERE id = ?'
      : 'UPDATE accounts SET balance = balance + ? WHERE id = ?';
    
    db.run(revertSql, [oldTx.amount, oldTx.account_id], (revertErr) => {
      if (revertErr) return res.status(500).json({ error: 'Failed to revert old balance: ' + revertErr.message });
      
      // Step 2: Update transaction record
      const updateSql = `UPDATE transactions SET account_id = ?, type = ?, category = ?, amount = ?, currency = ?, date = ?, description = ? WHERE id = ? AND user_id = ?`;
      db.run(updateSql, [newAccountId, type, category, newAmount, currency, date, description, req.params.id, req.user.id], function(updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to update transaction: ' + updateErr.message });
        
        // Step 3: Apply new balance to account (use new accountId and new amount)
        const applySql = type === 'income'
          ? 'UPDATE accounts SET balance = balance + ? WHERE id = ?'
          : 'UPDATE accounts SET balance = balance - ? WHERE id = ?';
        
        db.run(applySql, [newAmount, newAccountId], (applyErr) => {
          if (applyErr) return res.status(500).json({ error: 'Failed to apply new balance: ' + applyErr.message });
          res.json({ success: true, id: req.params.id });

          // Check for linked shared expense and update it
          db.get('SELECT * FROM shared_expenses WHERE linked_transaction_id = ?', [req.params.id], (err, sharedExpense) => {
            if (sharedExpense) {
              const isCreator = sharedExpense.creator_id === req.user.id;
              
              if (isCreator) {
                  db.run('UPDATE shared_expenses SET total_amount = ?, creator_paid = ? WHERE id = ?', 
                      [amount, amount, sharedExpense.id]);
              } else {
                  db.run('UPDATE shared_expenses SET total_amount = ?, friend_paid = ? WHERE id = ?', 
                      [amount, amount, sharedExpense.id]);
              }
            }
          });
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
  
  // Exchange rate conversion - Updated to support more currencies
  const RATES = { 
    EUR: 1, 
    BGN: 1.95583, 
    USD: 1.08,
    RSD: 117.25,  // Serbian Dinar
    HUF: 395.50   // Hungarian Forint
  };
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

// --- Friends ---
// Search user by user number
app.get('/api/users/search', authenticateToken, (req, res) => {
  const { userNumber } = req.query;
  if (!userNumber) return res.status(400).json({ error: 'User number required' });
  
  db.get('SELECT id, username, full_name, user_number FROM users WHERE user_number = ? AND id != ?', 
    [userNumber, req.user.id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        userNumber: user.user_number
      });
    });
});

// Get friends list
app.get('/api/friends', authenticateToken, (req, res) => {
  const sql = `
    SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at,
           u.username as friend_username, u.full_name as friend_full_name, u.user_number as friend_user_number
    FROM friends f
    JOIN users u ON (
      CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END = u.id
    )
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
  `;
  
  db.all(sql, [req.user.id, req.user.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Calculate balance for each friend
    const friendsWithBalance = rows.map(f => {
      const friendId = f.user_id === req.user.id ? f.friend_id : f.user_id;
      return {
        id: f.id,
        odUserId: req.user.id,
        friendId: friendId,
        friendUsername: f.friend_username,
        friendFullName: f.friend_full_name,
        friendUserNumber: f.friend_user_number,
        status: f.status,
        createdAt: f.created_at
      };
    });
    
    res.json(friendsWithBalance);
  });
});

// Get pending friend requests
app.get('/api/friends/pending', authenticateToken, (req, res) => {
  const sql = `
    SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at,
           u.username as requester_username, u.full_name as requester_full_name, u.user_number as requester_user_number
    FROM friends f
    JOIN users u ON f.user_id = u.id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `;
  
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      requesterId: r.user_id,
      requesterUsername: r.requester_username,
      requesterFullName: r.requester_full_name,
      requesterUserNumber: r.requester_user_number,
      status: r.status,
      createdAt: r.created_at
    })));
  });
});

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  const { userNumber } = req.body;
  
  if (!userNumber) return res.status(400).json({ error: 'User number required' });
  
  // Find user by user number
  db.get('SELECT id FROM users WHERE user_number = ?', [userNumber], (err, friend) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!friend) return res.status(404).json({ error: 'User not found' });
    if (friend.id === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    
    // Check if already friends or pending
    db.get('SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.user.id, friend.id, friend.id, req.user.id], (checkErr, existing) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message });
        if (existing) return res.status(400).json({ error: 'Friend request already exists or already friends' });
        
        // Create friend request
        db.run('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)',
          [req.user.id, friend.id, 'pending'], function(insertErr) {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            res.json({ success: true, id: this.lastID });
          });
      });
  });
});

// Accept/reject friend request
app.put('/api/friends/:id', authenticateToken, (req, res) => {
  const { status } = req.body; // 'accepted' or 'rejected'
  
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  db.run('UPDATE friends SET status = ? WHERE id = ? AND friend_id = ?',
    [status, req.params.id, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Friend request not found' });
      res.json({ success: true });
    });
});

// Remove friend
app.delete('/api/friends/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)',
    [req.params.id, req.user.id, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

// --- Shared Expenses ---
// Get shared expenses with a specific friend or all
app.get('/api/shared-expenses', authenticateToken, (req, res) => {
  const { friendId, settled } = req.query;
  
  let sql = `
    SELECT se.*, 
           uc.username as creator_username, uc.full_name as creator_full_name,
           uf.username as friend_username, uf.full_name as friend_full_name
    FROM shared_expenses se
    JOIN users uc ON se.creator_id = uc.id
    JOIN users uf ON se.friend_id = uf.id
    WHERE (se.creator_id = ? OR se.friend_id = ?)
  `;
  const params = [req.user.id, req.user.id];
  
  if (friendId) {
    sql += ' AND (se.creator_id = ? OR se.friend_id = ?)';
    params.push(friendId, friendId);
  }
  
  if (settled !== undefined) {
    sql += ' AND se.settled = ?';
    params.push(settled === 'true' ? 1 : 0);
  }
  
  sql += ' ORDER BY se.created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      id: r.id,
      creatorId: r.creator_id,
      friendId: r.friend_id,
      creatorUsername: r.creator_username,
      creatorFullName: r.creator_full_name,
      friendUsername: r.friend_username,
      friendFullName: r.friend_full_name,
      description: r.description,
      totalAmount: r.total_amount,
      currency: r.currency,
      creatorPaid: r.creator_paid,
      friendPaid: r.friend_paid,
      splitType: r.split_type,
      creatorShare: r.creator_share,
      settled: r.settled === 1,
      createdAt: r.created_at,
      settledAt: r.settled_at,
      linkedTransactionId: r.linked_transaction_id
    })));
  });
});

// Create shared expense
app.post('/api/shared-expenses', authenticateToken, (req, res) => {
  const { friendId, description, totalAmount, currency, creatorPaid, friendPaid, splitType, creatorShare, linkedTransactionId } = req.body;
  
  if (!friendId || !description || !totalAmount || !currency) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Verify friendship exists
  db.get('SELECT * FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = ?',
    [req.user.id, friendId, friendId, req.user.id, 'accepted'], (err, friendship) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!friendship) return res.status(400).json({ error: 'Not friends with this user' });
      
      const sql = `INSERT INTO shared_expenses 
        (creator_id, friend_id, description, total_amount, currency, creator_paid, friend_paid, split_type, creator_share, linked_transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      db.run(sql, [
        req.user.id, friendId, description, totalAmount, currency,
        creatorPaid || 0, friendPaid || 0, splitType || 'equal', creatorShare || 50, linkedTransactionId || null
      ], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.json({ success: true, id: this.lastID });
      });
    });
});

// Update shared expense (mark payment or settle)
app.put('/api/shared-expenses/:id', authenticateToken, (req, res) => {
  const { creatorPaid, friendPaid, settled } = req.body;
  
  // Verify ownership
  db.get('SELECT * FROM shared_expenses WHERE id = ? AND (creator_id = ? OR friend_id = ?)',
    [req.params.id, req.user.id, req.user.id], (err, expense) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!expense) return res.status(404).json({ error: 'Shared expense not found' });
      
      const updates = [];
      const params = [];
      
      if (creatorPaid !== undefined) {
        updates.push('creator_paid = ?');
        params.push(creatorPaid);
      }
      if (friendPaid !== undefined) {
        updates.push('friend_paid = ?');
        params.push(friendPaid);
      }
      if (settled !== undefined) {
        updates.push('settled = ?');
        params.push(settled ? 1 : 0);
        if (settled) {
          updates.push('settled_at = ?');
          params.push(new Date().toISOString());
        }
      }
      
      if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });
      
      params.push(req.params.id);
      
      db.run(`UPDATE shared_expenses SET ${updates.join(', ')} WHERE id = ?`, params, function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true });
      });
    });
});

// Delete shared expense
app.delete('/api/shared-expenses/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM shared_expenses WHERE id = ? AND creator_id = ?',
    [req.params.id, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Shared expense not found or not authorized' });
      res.json({ success: true });
    });
});

// Get balance summary with all friends
app.get('/api/shared-expenses/balances', authenticateToken, (req, res) => {
  const sql = `
    SELECT 
      CASE WHEN se.creator_id = ? THEN se.friend_id ELSE se.creator_id END as other_user_id,
      u.username as other_username,
      u.full_name as other_full_name,
      SUM(
        CASE 
          WHEN se.creator_id = ? THEN 
            (se.creator_paid - (se.total_amount * se.creator_share / 100))
          ELSE 
            (se.friend_paid - (se.total_amount * (100 - se.creator_share) / 100))
        END
      ) as balance
    FROM shared_expenses se
    JOIN users u ON (CASE WHEN se.creator_id = ? THEN se.friend_id ELSE se.creator_id END = u.id)
    WHERE (se.creator_id = ? OR se.friend_id = ?) AND se.settled = 0
    GROUP BY other_user_id
  `;
  
  db.all(sql, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      friendId: r.other_user_id,
      friendUsername: r.other_username,
      friendFullName: r.other_full_name,
      balance: r.balance // Positive = they owe you, Negative = you owe them
    })));
  });
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