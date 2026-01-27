import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// Generate unique user number (8 digits)
function generateUserNumber() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Middleware: Authenticate JWT token
function authenticateToken(authHeader) {
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const { method, url } = req;
  const path = url.replace('/api', '');
  const db = getSupabase();

  try {
    // ==================== HEALTH ====================
    if (path === '/health' && method === 'GET') {
      return res.json({ status: 'ok', message: 'Server is running', database: 'Supabase' });
    }

    // ==================== AUTH ====================
    if (path === '/register' && method === 'POST') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      
      const hash = bcrypt.hashSync(password, 10);
      const userNumber = generateUserNumber();
      
      const { data: user, error: userError } = await db
        .from('users')
        .insert({ username, password_hash: hash, user_number: userNumber })
        .select('id, username, full_name, avatar_url, user_number')
        .single();
      
      if (userError) {
        console.error('Registration error:', userError);
        if (userError.code === '23505') {
          return res.status(400).json({ error: 'User already exists' });
        }
        return res.status(500).json({ error: 'Registration failed: ' + userError.message });
      }
      
      // Create default accounts
      await db.from('accounts').insert([
        { user_id: user.id, name: 'German Bank', currency: 'EUR', type: 'bank', balance: 0 },
        { user_id: user.id, name: 'BG Bank', currency: 'BGN', type: 'bank', balance: 0 },
        { user_id: user.id, name: 'Revolut', currency: 'EUR', type: 'bank', balance: 0 }
      ]);
      
      const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: user.id, username, fullName: null, avatarUrl: null, userNumber } });
    }

    if (path === '/login' && method === 'POST') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }
      
      const { data: user, error } = await db
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
      return res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username,
          fullName: user.full_name || null,
          avatarUrl: user.avatar_url || null,
          userNumber: user.user_number || null
        } 
      });
    }

    // ==================== PROTECTED ROUTES ====================
    const authUser = authenticateToken(req.headers.authorization);
    
    // ==================== USER PROFILE ====================
    if (path === '/me' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { data: user, error } = await db
        .from('users')
        .select('id, username, full_name, avatar_url, user_number')
        .eq('id', authUser.id)
        .single();
      
      if (error || !user) return res.status(404).json({ error: 'User not found' });
      
      if (!user.user_number) {
        const newUserNumber = generateUserNumber();
        await db.from('users').update({ user_number: newUserNumber }).eq('id', authUser.id);
        user.user_number = newUserNumber;
      }
      
      return res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name || null,
        avatarUrl: user.avatar_url || null,
        userNumber: user.user_number
      });
    }

    if (path === '/me' && method === 'PUT') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { fullName, avatarUrl } = req.body;
      const trimmedName = typeof fullName === 'string' ? fullName.trim() : null;
      const trimmedAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : null;

      if (trimmedName && trimmedName.length > 120) {
        return res.status(400).json({ error: 'Name is too long' });
      }

      await db.from('users').update({ full_name: trimmedName || null, avatar_url: trimmedAvatar || null }).eq('id', authUser.id);
      
      const { data: user } = await db.from('users').select('id, username, full_name, avatar_url').eq('id', authUser.id).single();
      
      return res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name || null,
        avatarUrl: user.avatar_url || null
      });
    }

    // ==================== 2FA ====================
    if (path === '/2fa/enable' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { totpSecret } = req.body;
      if (!totpSecret) return res.status(400).json({ error: 'TOTP secret required' });
      await db.from('users').update({ totp_secret: totpSecret, totp_enabled: 1 }).eq('id', authUser.id);
      return res.json({ message: '2FA enabled successfully' });
    }

    if (path === '/2fa/disable' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      await db.from('users').update({ totp_secret: null, totp_enabled: 0 }).eq('id', authUser.id);
      return res.json({ message: '2FA disabled successfully' });
    }

    if (path === '/2fa/status' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { data: user } = await db.from('users').select('totp_enabled, totp_secret').eq('id', authUser.id).single();
      return res.json({ enabled: user?.totp_enabled === 1, hasSecret: !!user?.totp_secret });
    }

    if (path === '/2fa/verify' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { code } = req.body;
      if (!code || code.length !== 6) return res.status(400).json({ error: 'Invalid code format' });
      
      const { data: user } = await db.from('users').select('totp_secret').eq('id', authUser.id).single();
      if (!user?.totp_secret) return res.status(400).json({ error: '2FA not enabled' });
      
      const { TOTP } = await import('otpauth');
      const totp = new TOTP({ secret: user.totp_secret, digits: 6, period: 30 });
      const isValid = totp.validate({ token: code, window: 1 }) !== null;
      
      if (!isValid) return res.status(401).json({ error: 'Invalid 2FA code' });
      return res.json({ message: '2FA verified successfully' });
    }

    // ==================== ENCRYPTION ====================
    if (path === '/encryption/setup' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { salt } = req.body;
      if (!salt) return res.status(400).json({ error: 'Encryption salt required' });
      await db.from('users').update({ encryption_salt: salt }).eq('id', authUser.id);
      return res.json({ message: 'Encryption setup complete' });
    }

    if (path === '/encryption/salt' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { data: user } = await db.from('users').select('encryption_salt').eq('id', authUser.id).single();
      return res.json({ salt: user?.encryption_salt });
    }

    // ==================== ACCOUNTS ====================
    if (path === '/accounts' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { data } = await db.from('accounts').select('*').eq('user_id', authUser.id);
      return res.json(data || []);
    }

    if (path === '/accounts' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { name, currency, balance = 0 } = req.body;
      const { data, error } = await db.from('accounts').insert({ user_id: authUser.id, name, currency, type: 'bank', balance }).select().single();
      if (error) throw error;
      return res.json(data);
    }

    // Account by ID
    const accountMatch = path.match(/^\/accounts\/(\d+)$/);
    if (accountMatch) {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const accountId = accountMatch[1];
      
      if (method === 'PUT') {
        const { balance } = req.body;
        await db.from('accounts').update({ balance }).eq('id', accountId).eq('user_id', authUser.id);
        return res.json({ success: true });
      }
      
      if (method === 'DELETE') {
        await db.from('accounts').delete().eq('id', accountId).eq('user_id', authUser.id);
        return res.json({ success: true });
      }
    }

    // ==================== TRANSACTIONS ====================
    if (path === '/transactions' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { data } = await db.from('transactions').select('*').eq('user_id', authUser.id).order('date', { ascending: false });
      return res.json(data || []);
    }

    if (path === '/transactions' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { accountId, type, category, amount, currency, date, description } = req.body;
      
      const { data: tx, error } = await db.from('transactions')
        .insert({ user_id: authUser.id, account_id: accountId, type, category, amount, currency, date, description })
        .select().single();
      
      if (error) throw error;
      
      const { data: account } = await db.from('accounts').select('balance').eq('id', accountId).single();
      const newBalance = type === 'income' ? account.balance + amount : account.balance - amount;
      await db.from('accounts').update({ balance: newBalance }).eq('id', accountId);
      
      return res.json(tx);
    }

    // Transaction by ID
    const txMatch = path.match(/^\/transactions\/(\d+)$/);
    if (txMatch) {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const txId = txMatch[1];
      
      if (method === 'PUT') {
        try {
          const { accountId, type, category, amount, currency, date, description } = req.body;
          
          // Validate input
          if (!accountId || !type || !category || amount === undefined || !currency || !date) {
            return res.status(400).json({ error: 'Missing required fields', received: { accountId, type, category, amount, currency, date } });
          }
          
          const newAccountId = parseInt(accountId, 10);
          const newAmount = parseFloat(amount);
          
          if (isNaN(newAccountId) || isNaN(newAmount)) {
            return res.status(400).json({ error: 'Invalid accountId or amount', accountId, amount });
          }
          
          // Get old transaction
          const { data: oldTx, error: oldTxError } = await db.from('transactions').select('*').eq('id', txId).eq('user_id', authUser.id).single();
          if (oldTxError) return res.status(404).json({ error: 'Transaction not found', details: oldTxError.message });
          if (!oldTx) return res.status(404).json({ error: 'Transaction not found' });
          
          // Get old account balance
          const { data: oldAccount, error: oldAccError } = await db.from('accounts').select('balance').eq('id', oldTx.account_id).eq('user_id', authUser.id).single();
          if (oldAccError) return res.status(404).json({ error: 'Original account not found', details: oldAccError.message });
          if (!oldAccount) return res.status(404).json({ error: 'Original account not found' });
          
          // Calculate and apply reverted balance
          const revertedBalance = oldTx.type === 'income' ? oldAccount.balance - oldTx.amount : oldAccount.balance + oldTx.amount;
          const { error: revertError } = await db.from('accounts').update({ balance: revertedBalance }).eq('id', oldTx.account_id);
          if (revertError) return res.status(500).json({ error: 'Failed to revert account balance', details: revertError.message });
          
          // Update transaction record
          const { error: updateError } = await db.from('transactions').update({ account_id: newAccountId, type, category, amount: newAmount, currency, date, description }).eq('id', txId).eq('user_id', authUser.id);
          if (updateError) return res.status(500).json({ error: 'Failed to update transaction record', details: updateError.message });
          
          // Calculate new balance - if same account, use reverted balance; otherwise fetch fresh
          let currentBalance;
          const oldAccountId = Number(oldTx.account_id);
          if (newAccountId === oldAccountId) {
            // Same account - use the reverted balance we just set
            currentBalance = revertedBalance;
          } else {
            // Different account - fetch its current balance
            const { data: newAccount, error: newAccError } = await db.from('accounts').select('balance').eq('id', newAccountId).eq('user_id', authUser.id).single();
            if (newAccError) return res.status(404).json({ error: 'New account not found', details: newAccError.message });
            if (!newAccount) return res.status(404).json({ error: 'New account not found' });
            currentBalance = newAccount.balance;
          }
          
          // Apply new transaction amount to account
          const newBalance = type === 'income' ? currentBalance + newAmount : currentBalance - newAmount;
          const { error: applyError } = await db.from('accounts').update({ balance: newBalance }).eq('id', newAccountId);
          if (applyError) return res.status(500).json({ error: 'Failed to apply new balance', details: applyError.message });
          
          return res.json({ success: true, id: txId });
        } catch (putError) {
          console.error('PUT transaction error:', putError);
          return res.status(500).json({ error: 'Transaction update failed', details: putError.message });
        }
      }
      
      if (method === 'DELETE') {
        const { data: tx } = await db.from('transactions').select('*').eq('id', txId).eq('user_id', authUser.id).single();
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        
        const { data: account } = await db.from('accounts').select('balance').eq('id', tx.account_id).single();
        const revertedBalance = tx.type === 'income' ? account.balance - tx.amount : account.balance + tx.amount;
        await db.from('accounts').update({ balance: revertedBalance }).eq('id', tx.account_id);
        
        await db.from('transactions').delete().eq('id', txId).eq('user_id', authUser.id);
        return res.json({ success: true });
      }
    }

    // ==================== TRANSFERS ====================
    if (path === '/transfers' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { fromAccountId, toAccountId, amount, description, fromCurrency, toCurrency } = req.body;
      
      const RATES = { EUR: 1, BGN: 1.95583, USD: 1.08, RSD: 117.25, HUF: 395.50 };
      const amountInEUR = amount / RATES[fromCurrency];
      const convertedAmount = amountInEUR * RATES[toCurrency];
      const now = new Date().toISOString();
      
      const { data: fromAccount } = await db.from('accounts').select('balance').eq('id', fromAccountId).eq('user_id', authUser.id).single();
      const { data: toAccount } = await db.from('accounts').select('balance').eq('id', toAccountId).eq('user_id', authUser.id).single();
      
      await db.from('accounts').update({ balance: fromAccount.balance - amount }).eq('id', fromAccountId);
      await db.from('accounts').update({ balance: toAccount.balance + convertedAmount }).eq('id', toAccountId);
      
      await db.from('transactions').insert([
        { user_id: authUser.id, account_id: fromAccountId, type: 'expense', category: 'Transfer Out', amount, currency: fromCurrency, date: now, description },
        { user_id: authUser.id, account_id: toAccountId, type: 'income', category: 'Transfer In', amount: convertedAmount, currency: toCurrency, date: now, description }
      ]);
      
      return res.json({ success: true });
    }

    // ==================== FRIENDS ====================
    if (path === '/users/search' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const userNumber = req.query.userNumber;
      if (!userNumber) return res.status(400).json({ error: 'User number required' });
      
      const { data: user } = await db.from('users').select('id, username, full_name, user_number').eq('user_number', userNumber).neq('id', authUser.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      return res.json({ id: user.id, username: user.username, fullName: user.full_name, userNumber: user.user_number });
    }

    if (path === '/friends' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { data: friendships } = await db.from('friends').select('id, user_id, friend_id, status, created_at')
        .or(`user_id.eq.${authUser.id},friend_id.eq.${authUser.id}`).eq('status', 'accepted');
      
      if (!friendships || friendships.length === 0) return res.json([]);
      
      const friendIds = friendships.map(f => f.user_id === authUser.id ? f.friend_id : f.user_id);
      const { data: users } = await db.from('users').select('id, username, full_name, user_number').in('id', friendIds);
      
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);
      
      return res.json(friendships.map(f => {
        const friendId = f.user_id === authUser.id ? f.friend_id : f.user_id;
        return {
          id: f.id, odUserId: authUser.id, friendId,
          friendUsername: usersMap[friendId]?.username,
          friendFullName: usersMap[friendId]?.full_name,
          friendUserNumber: usersMap[friendId]?.user_number,
          status: f.status, createdAt: f.created_at
        };
      }));
    }

    if (path === '/friends/pending' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { data: requests } = await db.from('friends').select('id, user_id, friend_id, status, created_at')
        .eq('friend_id', authUser.id).eq('status', 'pending');
      
      if (!requests || requests.length === 0) return res.json([]);
      
      const requesterIds = requests.map(r => r.user_id);
      const { data: users } = await db.from('users').select('id, username, full_name, user_number').in('id', requesterIds);
      
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);
      
      return res.json(requests.map(r => ({
        id: r.id, requesterId: r.user_id,
        requesterUsername: usersMap[r.user_id]?.username,
        requesterFullName: usersMap[r.user_id]?.full_name,
        requesterUserNumber: usersMap[r.user_id]?.user_number,
        status: r.status, createdAt: r.created_at
      })));
    }

    if (path === '/friends/request' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { userNumber } = req.body;
      if (!userNumber) return res.status(400).json({ error: 'User number required' });
      
      const { data: friend } = await db.from('users').select('id').eq('user_number', userNumber).single();
      if (!friend) return res.status(404).json({ error: 'User not found' });
      if (friend.id === authUser.id) return res.status(400).json({ error: 'Cannot add yourself' });
      
      const { data: existing } = await db.from('friends').select('id')
        .or(`and(user_id.eq.${authUser.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${authUser.id})`);
      
      if (existing && existing.length > 0) return res.status(400).json({ error: 'Friend request already exists' });
      
      const { data } = await db.from('friends').insert({ user_id: authUser.id, friend_id: friend.id, status: 'pending' }).select().single();
      return res.json({ success: true, id: data.id });
    }

    // Friend by ID
    const friendMatch = path.match(/^\/friends\/(\d+)$/);
    if (friendMatch) {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const friendId = friendMatch[1];
      
      if (method === 'PUT') {
        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
        await db.from('friends').update({ status }).eq('id', friendId).eq('friend_id', authUser.id);
        return res.json({ success: true });
      }
      
      if (method === 'DELETE') {
        await db.from('friends').delete().eq('id', friendId).or(`user_id.eq.${authUser.id},friend_id.eq.${authUser.id}`);
        return res.json({ success: true });
      }
    }

    // ==================== SHARED EXPENSES ====================
    if (path === '/shared-expenses' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      let query = db.from('shared_expenses').select('*').or(`creator_id.eq.${authUser.id},friend_id.eq.${authUser.id}`);
      
      if (req.query.friendId) query = query.or(`creator_id.eq.${req.query.friendId},friend_id.eq.${req.query.friendId}`);
      if (req.query.settled !== undefined) query = query.eq('settled', req.query.settled === 'true' ? 1 : 0);
      
      const { data: expenses } = await query.order('created_at', { ascending: false });
      if (!expenses || expenses.length === 0) return res.json([]);
      
      const userIds = [...new Set(expenses.flatMap(e => [e.creator_id, e.friend_id]))];
      const { data: users } = await db.from('users').select('id, username, full_name').in('id', userIds);
      
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);
      
      return res.json(expenses.map(r => ({
        id: r.id, creatorId: r.creator_id, friendId: r.friend_id,
        creatorUsername: usersMap[r.creator_id]?.username, creatorFullName: usersMap[r.creator_id]?.full_name,
        friendUsername: usersMap[r.friend_id]?.username, friendFullName: usersMap[r.friend_id]?.full_name,
        description: r.description, totalAmount: r.total_amount, currency: r.currency,
        creatorPaid: r.creator_paid, friendPaid: r.friend_paid, splitType: r.split_type,
        creatorShare: r.creator_share, settled: r.settled === 1, createdAt: r.created_at,
        settledAt: r.settled_at, linkedTransactionId: r.linked_transaction_id
      })));
    }

    if (path === '/shared-expenses' && method === 'POST') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { friendId, description, totalAmount, currency, creatorPaid, friendPaid, splitType, creatorShare, linkedTransactionId } = req.body;
      
      if (!friendId || !description || !totalAmount || !currency) return res.status(400).json({ error: 'Missing required fields' });
      
      const { data: friendship } = await db.from('friends').select('id')
        .or(`and(user_id.eq.${authUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${authUser.id})`)
        .eq('status', 'accepted');
      
      if (!friendship || friendship.length === 0) return res.status(400).json({ error: 'Not friends with this user' });
      
      const { data } = await db.from('shared_expenses').insert({
        creator_id: authUser.id, friend_id: friendId, description, total_amount: totalAmount, currency,
        creator_paid: creatorPaid || 0, friend_paid: friendPaid || 0, split_type: splitType || 'equal',
        creator_share: creatorShare || 50, linked_transaction_id: linkedTransactionId || null
      }).select().single();
      
      return res.json({ success: true, id: data.id });
    }

    if (path === '/shared-expenses/balances' && method === 'GET') {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      
      const { data: expenses } = await db.from('shared_expenses').select('*')
        .or(`creator_id.eq.${authUser.id},friend_id.eq.${authUser.id}`).eq('settled', 0);
      
      if (!expenses || expenses.length === 0) return res.json([]);
      
      const balances = {};
      expenses.forEach(se => {
        const isCreator = se.creator_id === authUser.id;
        const fId = isCreator ? se.friend_id : se.creator_id;
        if (!balances[fId]) balances[fId] = 0;
        if (isCreator) balances[fId] += se.creator_paid - (se.total_amount * se.creator_share / 100);
        else balances[fId] += se.friend_paid - (se.total_amount * (100 - se.creator_share) / 100);
      });
      
      const friendIds = Object.keys(balances).map(Number);
      const { data: users } = await db.from('users').select('id, username, full_name').in('id', friendIds);
      
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);
      
      return res.json(friendIds.map(fid => ({
        friendId: fid, friendUsername: usersMap[fid]?.username, friendFullName: usersMap[fid]?.full_name, balance: balances[fid]
      })));
    }

    // Shared expense by ID
    const seMatch = path.match(/^\/shared-expenses\/(\d+)$/);
    if (seMatch) {
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const seId = seMatch[1];
      
      if (method === 'PUT') {
        const { creatorPaid, friendPaid, settled } = req.body;
        
        const updates = {};
        if (creatorPaid !== undefined) updates.creator_paid = creatorPaid;
        if (friendPaid !== undefined) updates.friend_paid = friendPaid;
        if (settled !== undefined) {
          updates.settled = settled ? 1 : 0;
          if (settled) updates.settled_at = new Date().toISOString();
        }
        
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates provided' });
        
        await db.from('shared_expenses').update(updates).eq('id', seId);
        return res.json({ success: true });
      }
      
      if (method === 'DELETE') {
        await db.from('shared_expenses').delete().eq('id', seId).eq('creator_id', authUser.id);
        return res.json({ success: true });
      }
    }

    // Not found
    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
