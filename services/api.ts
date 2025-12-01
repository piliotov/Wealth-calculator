import { Transaction, User, Account } from '../types';

const API_URL = 'http://localhost:3001/api';

let authToken: string | null = null;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(authToken && { 'Authorization': `Bearer ${authToken}` })
});

// --- Auth Services ---

export const registerUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
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
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
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
    return { id: payload.id, username: payload.username, passwordHash: '' };
  } catch {
    return null;
  }
};

// --- Account Services ---

export const getAccounts = async (): Promise<Account[]> => {
  const response = await fetch(`${API_URL}/accounts`, {
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
};

export const createAccount = async (name: string, currency: 'EUR'|'BGN'|'USD', balance: number = 0): Promise<Account> => {
  const response = await fetch(`${API_URL}/accounts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, currency, balance })
  });

  if (!response.ok) throw new Error('Failed to create account');
  return response.json();
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
  return response.json();
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const response = await fetch(`${API_URL}/transactions`, {
    headers: getHeaders()
  });

  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
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

  if (!response.ok) throw new Error('Failed to update transaction');
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

// --- Chat AI ---

export const sendChatMessage = async (message: string): Promise<string> => {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI chat failed');
  }

  const data = await response.json();
  return data.response;
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
