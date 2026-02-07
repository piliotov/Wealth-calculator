import { Transaction, User, Account, Friend, SharedExpense } from '../types';

const API_URL = '/api';

let authToken: string | null = null;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(authToken && { 'Authorization': `Bearer ${authToken}` })
});

// Handle 401/403 by clearing invalid token and forcing re-login
const handleAuthError = (status: number) => {
  if (status === 401 || status === 403) {
    authToken = null;
    localStorage.removeItem('auth_token');
    // Dispatch a custom event so App.tsx can redirect to login
    window.dispatchEvent(new CustomEvent('auth-expired'));
  }
};

const mapAccount = (row: any): Account => ({
  id: row.id,
  userId: row.user_id ?? row.userId,
  name: row.name,
  type: row.type,
  currency: row.currency,
  balance: row.balance
});

const mapTransaction = (row: any): Transaction => ({
  id: row.id,
  userId: row.user_id ?? row.userId,
  accountId: row.account_id ?? row.accountId,
  type: row.type,
  category: row.category,
  amount: row.amount,
  currency: row.currency,
  date: row.date,
  description: row.description
});

// --- Auth Services ---

export const registerUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    } catch (e) {
      throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  authToken = data.token;
  localStorage.setItem('auth_token', data.token);
  return data;
};

export const loginUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    } catch (e) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  authToken = data.token;
  localStorage.setItem('auth_token', data.token);
  return data;
};

export const logoutUser = () => {
  authToken = null;
  localStorage.removeItem('auth_token');
};

export const getCurrentUser = (): User | null => {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  
  authToken = token;
  
  // Decode JWT to get user info (simple decode, not verification)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
};

// --- User Profile ---

export const fetchUserProfile = async (): Promise<User> => {
  const response = await fetch(`${API_URL}/me`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    handleAuthError(response.status);
    throw new Error('Failed to load profile');
  }

  return response.json();
};

export const updateUserProfile = async (data: { fullName?: string | null; avatarUrl?: string | null; }): Promise<User> => {
  const response = await fetch(`${API_URL}/me`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update profile' }));
    throw new Error(error.error || 'Failed to update profile');
  }

  return response.json();
};

// --- Account Services ---

export const getAccounts = async (): Promise<Account[]> => {
  const response = await fetch(`${API_URL}/accounts`, {
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to fetch accounts');
  const data = await response.json();
  return Array.isArray(data) ? data.map(mapAccount) : [];
};

export const createAccount = async (name: string, currency: 'EUR'|'BGN'|'USD', balance: number = 0): Promise<Account> => {
  const response = await fetch(`${API_URL}/accounts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, currency, balance })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create account' }));
    throw new Error(error.error || 'Failed to create account');
  }
  const data = await response.json();
  return mapAccount(data);
};

export const updateAccountBalance = async (accountId: string | number, newBalance: number): Promise<void> => {
  const response = await fetch(`${API_URL}/accounts/${accountId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ balance: newBalance })
  });

  if (!response.ok) throw new Error('Failed to update account');
};

export const deleteAccount = async (accountId: string | number): Promise<void> => {
  const response = await fetch(`${API_URL}/accounts/${accountId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to delete account');
};

// --- Transaction Services ---

export const addTransaction = async (data: {
  accountId: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
}): Promise<Transaction> => {
  const response = await fetch(`${API_URL}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to add transaction');
  const payload = await response.json();
  return mapTransaction(payload);
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const response = await fetch(`${API_URL}/transactions`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    handleAuthError(response.status);
    throw new Error('Failed to fetch transactions');
  }
  const data = await response.json();
  return Array.isArray(data) ? data.map(mapTransaction) : [];
};

export const updateTransaction = async (txId: number, data: {
  accountId: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
}): Promise<void> => {
  const response = await fetch(`${API_URL}/transactions/${txId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to update transaction' }));
    throw new Error(err.error || 'Failed to update transaction');
  }
};

export const deleteTransaction = async (txId: number): Promise<void> => {
  const response = await fetch(`${API_URL}/transactions/${txId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to delete transaction');
};

export const getLast30DaysTransactions = async (): Promise<Transaction[]> => {
  const all = await getTransactions();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return all.filter(t => new Date(t.date) >= thirtyDaysAgo);
};

// --- Transfers ---

export const transferMoney = async (data: {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  description: string;
  fromCurrency: string;
  toCurrency: string;
  date: string;
}): Promise<void> => {
  const response = await fetch(`${API_URL}/transfers`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to transfer money');
};

// --- Friends Services ---

export const searchUserByNumber = async (userNumber: string): Promise<{ id: string; username: string; fullName: string | null; userNumber: string }> => {
  const response = await fetch(`${API_URL}/users/search?userNumber=${encodeURIComponent(userNumber)}`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'User not found' }));
    throw new Error(error.error || 'User not found');
  }
  return response.json();
};

export const getFriends = async (): Promise<Friend[]> => {
  const response = await fetch(`${API_URL}/friends`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    console.error('Failed to fetch friends:', response.status);
    return [];
  }
  return response.json();
};

export const getPendingFriendRequests = async (): Promise<Array<{
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterFullName: string | null;
  requesterUserNumber: string;
  status: string;
  createdAt: string;
}>> => {
  const response = await fetch(`${API_URL}/friends/pending`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    console.error('Failed to fetch pending requests:', response.status);
    return [];
  }
  return response.json();
};

export const sendFriendRequest = async (userNumber: string): Promise<{ success: boolean; id: number }> => {
  const response = await fetch(`${API_URL}/friends/request`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ userNumber })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to send request' }));
    throw new Error(error.error || 'Failed to send friend request');
  }
  return response.json();
};

export const respondToFriendRequest = async (requestId: string, status: 'accepted' | 'rejected'): Promise<void> => {
  const response = await fetch(`${API_URL}/friends/${requestId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ status })
  });

  if (!response.ok) throw new Error('Failed to respond to friend request');
};

export const removeFriend = async (friendshipId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/friends/${friendshipId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to remove friend');
};

// --- Shared Expenses Services ---

export const getSharedExpenses = async (options?: { friendId?: string; settled?: boolean }): Promise<SharedExpense[]> => {
  const params = new URLSearchParams();
  if (options?.friendId) params.set('friendId', options.friendId);
  if (options?.settled !== undefined) params.set('settled', String(options.settled));
  
  const url = `${API_URL}/shared-expenses${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, {
    headers: getHeaders()
  });

  if (!response.ok) {
    console.error('Failed to fetch shared expenses:', response.status);
    return [];
  }
  return response.json();
};

export const createSharedExpense = async (data: {
  friendId: string;
  description: string;
  totalAmount: number;
  currency: string;
  creatorPaid: number;
  friendPaid: number;
  splitType: 'equal' | 'custom' | 'full';
  creatorShare: number;
  linkedTransactionId?: string;
}): Promise<{ success: boolean; id: number }> => {
  const response = await fetch(`${API_URL}/shared-expenses`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create shared expense' }));
    throw new Error(error.error || 'Failed to create shared expense');
  }
  return response.json();
};

export const updateSharedExpense = async (expenseId: string, data: {
  creatorPaid?: number;
  friendPaid?: number;
  settled?: boolean;
}): Promise<void> => {
  const response = await fetch(`${API_URL}/shared-expenses/${expenseId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to update shared expense');
};

export const deleteSharedExpense = async (expenseId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/shared-expenses/${expenseId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to delete shared expense');
};

export const getSharedExpenseBalances = async (): Promise<Array<{
  friendId: string;
  friendUsername: string;
  friendFullName: string | null;
  balance: number;
}>> => {
  const response = await fetch(`${API_URL}/shared-expenses/balances`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    console.error('Failed to fetch balances:', response.status);
    return [];
  }
  return response.json();
};

// --- Goals Services ---

interface GoalData {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string | null;
  category: string;
  color: string;
  createdAt: string;
}

export const getGoals = async (): Promise<GoalData[]> => {
  const response = await fetch(`${API_URL}/goals`, {
    headers: getHeaders()
  });

  if (!response.ok) {
    console.error('Failed to fetch goals:', response.status);
    return [];
  }
  return response.json();
};

export const createGoal = async (data: {
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string | null;
  category: string;
  color: string;
}): Promise<GoalData> => {
  const response = await fetch(`${API_URL}/goals`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create goal' }));
    throw new Error(error.error || 'Failed to create goal');
  }
  return response.json();
};

export const updateGoal = async (goalId: string, data: {
  currentAmount?: number;
  name?: string;
  targetAmount?: number;
  deadline?: string | null;
}): Promise<void> => {
  const response = await fetch(`${API_URL}/goals/${goalId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error('Failed to update goal');
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/goals/${goalId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to delete goal');
};
