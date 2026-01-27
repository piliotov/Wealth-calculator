const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Connected to Supabase');

// Trust proxy - required when behind proxy
app.set('trust proxy', 1);

// Security: Helmet - Sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.exchangerate-api.com", supabaseUrl],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Security: CORS
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || true)
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
  res.json({ status: 'ok', message: 'Server is running', database: 'Supabase' });
});

// Middleware: Authenticate JWT token
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

// ==================== AUTH ====================

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    const userNumber = generateUserNumber();
    
    // Insert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({ username, password_hash: hash, user_number: userNumber })
      .select('id, username, full_name, avatar_url, user_number')
      .single();
    
    if (userError) {
      if (userError.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'User already exists' });
      }
      throw userError;
    }
    
    // Create default accounts
    await supabase.from('accounts').insert([
      { user_id: user.id, name: 'German Bank', currency: 'EUR', type: 'bank', balance: 0 },
      { user_id: user.id, name: 'BG Bank', currency: 'BGN', type: 'bank', balance: 0 },
      { user_id: user.id, name: 'Revolut', currency: 'EUR', type: 'bank', balance: 0 }
    ]);
    
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username, 
        fullName: null, 
        avatarUrl: null, 
        userNumber 
      } 
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !user) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== USER PROFILE ====================

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, user_number')
      .eq('id', req.user.id)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    
    // Generate user number if missing
    if (!user.user_number) {
      const newUserNumber = generateUserNumber();
      await supabase
        .from('users')
        .update({ user_number: newUserNumber })
        .eq('id', req.user.id);
      user.user_number = newUserNumber;
    }
    
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name || null,
      avatarUrl: user.avatar_url || null,
      userNumber: user.user_number
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/me', authenticateToken, async (req, res) => {
  try {
    const { fullName, avatarUrl } = req.body;
    const trimmedName = typeof fullName === 'string' ? fullName.trim() : null;
    const trimmedAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : null;

    if (trimmedName && trimmedName.length > 120) {
      return res.status(400).json({ error: 'Name is too long' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name: trimmedName || null, avatar_url: trimmedAvatar || null })
      .eq('id', req.user.id);
    
    if (updateError) throw updateError;
    
    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url')
      .eq('id', req.user.id)
      .single();
    
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name || null,
      avatarUrl: user.avatar_url || null
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== TWO-FACTOR AUTH ====================

app.post('/api/2fa/enable', authenticateToken, async (req, res) => {
  try {
    const { totpSecret } = req.body;
    if (!totpSecret) return res.status(400).json({ error: 'TOTP secret required' });

    const { error } = await supabase
      .from('users')
      .update({ totp_secret: totpSecret, totp_enabled: 1 })
      .eq('id', req.user.id);
    
    if (error) throw error;
    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

app.post('/api/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ totp_secret: null, totp_enabled: 0 })
      .eq('id', req.user.id);
    
    if (error) throw error;
    res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

app.get('/api/2fa/status', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('totp_enabled, totp_secret')
      .eq('id', req.user.id)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ 
      enabled: user.totp_enabled === 1,
      hasSecret: !!user.totp_secret
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

app.post('/api/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('totp_secret')
      .eq('id', req.user.id)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (!user.totp_secret) return res.status(400).json({ error: '2FA not enabled' });

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
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// ==================== ENCRYPTION ====================

app.post('/api/encryption/setup', authenticateToken, async (req, res) => {
  try {
    const { salt } = req.body;
    if (!salt) return res.status(400).json({ error: 'Encryption salt required' });

    const { error } = await supabase
      .from('users')
      .update({ encryption_salt: salt })
      .eq('id', req.user.id);
    
    if (error) throw error;
    res.json({ message: 'Encryption setup complete' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to setup encryption' });
  }
});

app.get('/api/encryption/salt', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('encryption_salt')
      .eq('id', req.user.id)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ salt: user.encryption_salt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get encryption salt' });
  }
});

// ==================== ACCOUNTS ====================

app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const { name, currency, balance = 0 } = req.body;
    
    const { data, error } = await supabase
      .from('accounts')
      .insert({ user_id: req.user.id, name, currency, type: 'bank', balance })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.put('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { balance } = req.body;
    
    const { error } = await supabase
      .from('accounts')
      .update({ balance })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ==================== TRANSACTIONS ====================

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { accountId, type, category, amount, currency, date, description } = req.body;
    
    // Insert transaction
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({ 
        user_id: req.user.id, 
        account_id: accountId, 
        type, 
        category, 
        amount, 
        currency, 
        date, 
        description 
      })
      .select()
      .single();
    
    if (txError) throw txError;
    
    // Update account balance
    const { data: account } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single();
    
    const newBalance = type === 'income' 
      ? account.balance + amount 
      : account.balance - amount;
    
    await supabase
      .from('accounts')
      .update({ balance: newBalance })
      .eq('id', accountId);
    
    res.json(tx);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { accountId, type, category, amount, currency, date, description } = req.body;
    const newAccountId = parseInt(accountId, 10);
    const newAmount = parseFloat(amount);
    
    // Get old transaction
    const { data: oldTx, error: getError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (getError || !oldTx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Revert old balance from old account
    const { data: oldAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', oldTx.account_id)
      .single();
    
    const revertedBalance = oldTx.type === 'income' 
      ? oldAccount.balance - oldTx.amount 
      : oldAccount.balance + oldTx.amount;
    
    await supabase
      .from('accounts')
      .update({ balance: revertedBalance })
      .eq('id', oldTx.account_id);
    
    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        account_id: newAccountId, 
        type, 
        category, 
        amount: newAmount, 
        currency, 
        date, 
        description 
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (updateError) throw updateError;
    
    // Apply new balance to new account (get fresh balance in case account changed)
    const { data: newAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', newAccountId)
      .eq('user_id', req.user.id)
      .single();
    
    const newBalance = type === 'income' 
      ? newAccount.balance + newAmount 
      : newAccount.balance - newAmount;
    
    await supabase
      .from('accounts')
      .update({ balance: newBalance })
      .eq('id', newAccountId);
    
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    // Get transaction first
    const { data: tx, error: getError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    
    if (getError || !tx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Revert balance
    const { data: account } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', tx.account_id)
      .single();
    
    const revertedBalance = tx.type === 'income' 
      ? account.balance - tx.amount 
      : account.balance + tx.amount;
    
    await supabase
      .from('accounts')
      .update({ balance: revertedBalance })
      .eq('id', tx.account_id);
    
    // Delete transaction
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (deleteError) throw deleteError;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// ==================== TRANSFERS ====================

app.post('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description, fromCurrency, toCurrency } = req.body;
    
    // Exchange rates
    const RATES = { 
      EUR: 1, 
      BGN: 1.95583, 
      USD: 1.08,
      RSD: 117.25,
      HUF: 395.50
    };
    const amountInEUR = amount / RATES[fromCurrency];
    const convertedAmount = amountInEUR * RATES[toCurrency];
    const now = new Date().toISOString();
    
    // Get both accounts
    const { data: fromAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', fromAccountId)
      .eq('user_id', req.user.id)
      .single();
    
    const { data: toAccount } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', toAccountId)
      .eq('user_id', req.user.id)
      .single();
    
    // Update balances
    await supabase
      .from('accounts')
      .update({ balance: fromAccount.balance - amount })
      .eq('id', fromAccountId);
    
    await supabase
      .from('accounts')
      .update({ balance: toAccount.balance + convertedAmount })
      .eq('id', toAccountId);
    
    // Record transactions
    await supabase.from('transactions').insert([
      { user_id: req.user.id, account_id: fromAccountId, type: 'expense', category: 'Transfer Out', amount, currency: fromCurrency, date: now, description },
      { user_id: req.user.id, account_id: toAccountId, type: 'income', category: 'Transfer In', amount: convertedAmount, currency: toCurrency, date: now, description }
    ]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Failed to transfer money' });
  }
});

// ==================== FRIENDS ====================

app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { userNumber } = req.query;
    if (!userNumber) return res.status(400).json({ error: 'User number required' });
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, user_number')
      .eq('user_number', userNumber)
      .neq('id', req.user.id)
      .single();
    
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      userNumber: user.user_number
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    // Get all friendships where user is involved and status is accepted
    const { data: friendships, error } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status, created_at')
      .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`)
      .eq('status', 'accepted');
    
    if (error) throw error;
    
    // Get friend details
    const friendIds = friendships.map(f => f.user_id === req.user.id ? f.friend_id : f.user_id);
    
    if (friendIds.length === 0) return res.json([]);
    
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, user_number')
      .in('id', friendIds);
    
    const usersMap = {};
    users.forEach(u => usersMap[u.id] = u);
    
    const result = friendships.map(f => {
      const friendId = f.user_id === req.user.id ? f.friend_id : f.user_id;
      const friend = usersMap[friendId];
      return {
        id: f.id,
        odUserId: req.user.id,
        friendId: friendId,
        friendUsername: friend?.username,
        friendFullName: friend?.full_name,
        friendUserNumber: friend?.user_number,
        status: f.status,
        createdAt: f.created_at
      };
    });
    
    res.json(result);
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

app.get('/api/friends/pending', authenticateToken, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status, created_at')
      .eq('friend_id', req.user.id)
      .eq('status', 'pending');
    
    if (error) throw error;
    
    if (requests.length === 0) return res.json([]);
    
    const requesterIds = requests.map(r => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, user_number')
      .in('id', requesterIds);
    
    const usersMap = {};
    users.forEach(u => usersMap[u.id] = u);
    
    res.json(requests.map(r => ({
      id: r.id,
      requesterId: r.user_id,
      requesterUsername: usersMap[r.user_id]?.username,
      requesterFullName: usersMap[r.user_id]?.full_name,
      requesterUserNumber: usersMap[r.user_id]?.user_number,
      status: r.status,
      createdAt: r.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pending requests' });
  }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { userNumber } = req.body;
    if (!userNumber) return res.status(400).json({ error: 'User number required' });
    
    // Find user
    const { data: friend, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('user_number', userNumber)
      .single();
    
    if (findError || !friend) return res.status(404).json({ error: 'User not found' });
    if (friend.id === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });
    
    // Check existing
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${req.user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${req.user.id})`);
    
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Friend request already exists or already friends' });
    }
    
    // Create request
    const { data, error } = await supabase
      .from('friends')
      .insert({ user_id: req.user.id, friend_id: friend.id, status: 'pending' })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

app.put('/api/friends/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const { error } = await supabase
      .from('friends')
      .update({ status })
      .eq('id', req.params.id)
      .eq('friend_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update friend request' });
  }
});

app.delete('/api/friends/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', req.params.id)
      .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// ==================== SHARED EXPENSES ====================

app.get('/api/shared-expenses', authenticateToken, async (req, res) => {
  try {
    const { friendId, settled } = req.query;
    
    let query = supabase
      .from('shared_expenses')
      .select('*')
      .or(`creator_id.eq.${req.user.id},friend_id.eq.${req.user.id}`);
    
    if (friendId) {
      query = query.or(`creator_id.eq.${friendId},friend_id.eq.${friendId}`);
    }
    
    if (settled !== undefined) {
      query = query.eq('settled', settled === 'true' ? 1 : 0);
    }
    
    const { data: expenses, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get user details
    const userIds = [...new Set(expenses.flatMap(e => [e.creator_id, e.friend_id]))];
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name')
      .in('id', userIds);
    
    const usersMap = {};
    users.forEach(u => usersMap[u.id] = u);
    
    res.json(expenses.map(r => ({
      id: r.id,
      creatorId: r.creator_id,
      friendId: r.friend_id,
      creatorUsername: usersMap[r.creator_id]?.username,
      creatorFullName: usersMap[r.creator_id]?.full_name,
      friendUsername: usersMap[r.friend_id]?.username,
      friendFullName: usersMap[r.friend_id]?.full_name,
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
  } catch (err) {
    console.error('Get shared expenses error:', err);
    res.status(500).json({ error: 'Failed to get shared expenses' });
  }
});

app.post('/api/shared-expenses', authenticateToken, async (req, res) => {
  try {
    const { friendId, description, totalAmount, currency, creatorPaid, friendPaid, splitType, creatorShare, linkedTransactionId } = req.body;
    
    if (!friendId || !description || !totalAmount || !currency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify friendship
    const { data: friendship } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${req.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${req.user.id})`)
      .eq('status', 'accepted');
    
    if (!friendship || friendship.length === 0) {
      return res.status(400).json({ error: 'Not friends with this user' });
    }
    
    const { data, error } = await supabase
      .from('shared_expenses')
      .insert({
        creator_id: req.user.id,
        friend_id: friendId,
        description,
        total_amount: totalAmount,
        currency,
        creator_paid: creatorPaid || 0,
        friend_paid: friendPaid || 0,
        split_type: splitType || 'equal',
        creator_share: creatorShare || 50,
        linked_transaction_id: linkedTransactionId || null
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Create shared expense error:', err);
    res.status(500).json({ error: 'Failed to create shared expense' });
  }
});

app.put('/api/shared-expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { creatorPaid, friendPaid, settled } = req.body;
    
    // Verify ownership
    const { data: expense, error: getError } = await supabase
      .from('shared_expenses')
      .select('*')
      .eq('id', req.params.id)
      .or(`creator_id.eq.${req.user.id},friend_id.eq.${req.user.id}`)
      .single();
    
    if (getError || !expense) return res.status(404).json({ error: 'Shared expense not found' });
    
    const updates = {};
    if (creatorPaid !== undefined) updates.creator_paid = creatorPaid;
    if (friendPaid !== undefined) updates.friend_paid = friendPaid;
    if (settled !== undefined) {
      updates.settled = settled ? 1 : 0;
      if (settled) updates.settled_at = new Date().toISOString();
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    const { error } = await supabase
      .from('shared_expenses')
      .update(updates)
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shared expense' });
  }
});

app.delete('/api/shared-expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('shared_expenses')
      .delete()
      .eq('id', req.params.id)
      .eq('creator_id', req.user.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete shared expense' });
  }
});

app.get('/api/shared-expenses/balances', authenticateToken, async (req, res) => {
  try {
    // Get all unsettled shared expenses for this user
    const { data: expenses, error } = await supabase
      .from('shared_expenses')
      .select('*')
      .or(`creator_id.eq.${req.user.id},friend_id.eq.${req.user.id}`)
      .eq('settled', 0);
    
    if (error) throw error;
    
    // Calculate balances per friend
    const balances = {};
    
    expenses.forEach(se => {
      const isCreator = se.creator_id === req.user.id;
      const friendId = isCreator ? se.friend_id : se.creator_id;
      
      if (!balances[friendId]) balances[friendId] = 0;
      
      if (isCreator) {
        balances[friendId] += se.creator_paid - (se.total_amount * se.creator_share / 100);
      } else {
        balances[friendId] += se.friend_paid - (se.total_amount * (100 - se.creator_share) / 100);
      }
    });
    
    // Get friend details
    const friendIds = Object.keys(balances).map(Number);
    if (friendIds.length === 0) return res.json([]);
    
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name')
      .in('id', friendIds);
    
    const usersMap = {};
    users.forEach(u => usersMap[u.id] = u);
    
    res.json(friendIds.map(fid => ({
      friendId: fid,
      friendUsername: usersMap[fid]?.username,
      friendFullName: usersMap[fid]?.full_name,
      balance: balances[fid]
    })));
  } catch (err) {
    console.error('Get balances error:', err);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

// ==================== STATIC FILES ====================

app.use(express.static(path.join(__dirname, '../dist')));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database: Supabase (${supabaseUrl})`);
});
