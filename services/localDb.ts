import { Transaction, User, Account, ChatMessage, EXCHANGE_RATES } from '../types';

// Keys for LocalStorage
const USERS_KEY = 'wt_users';
const TRANSACTIONS_KEY = 'wt_transactions';
const ACCOUNTS_KEY = 'wt_accounts';
const SESSION_KEY = 'wt_session';
const CHAT_KEY = 'wt_chat_history';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Auth Services ---

export const registerUser = async (username: string, password: string): Promise<User> => {
  await delay(500);
  const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  
  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    username,
    passwordHash: `mock_hash_${password}` 
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Initialize Default Accounts
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  const defaultAccounts: Account[] = [
    { id: crypto.randomUUID(), userId: newUser.id, name: 'German Bank', type: 'bank', currency: 'EUR', balance: 0 },
    { id: crypto.randomUUID(), userId: newUser.id, name: 'BG Bank', type: 'bank', currency: 'BGN', balance: 0 },
    { id: crypto.randomUUID(), userId: newUser.id, name: 'Revolut', type: 'bank', currency: 'EUR', balance: 0 },
  ];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, ...defaultAccounts]));

  return newUser;
};

export const loginUser = async (username: string, password: string): Promise<User> => {
  await delay(500);
  const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const user = users.find(u => u.username === username && u.passwordHash === `mock_hash_${password}`);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

// --- Account Services ---

export const getAccounts = async (userId: string): Promise<Account[]> => {
  await delay(200);
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  return accounts.filter(a => a.userId === userId);
};

export const createAccount = async (userId: string, name: string, currency: 'EUR'|'BGN'|'USD'): Promise<Account> => {
  await delay(200);
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  const newAccount: Account = {
    id: crypto.randomUUID(),
    userId,
    name,
    type: 'bank',
    currency,
    balance: 0
  };
  accounts.push(newAccount);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return newAccount;
};

export const updateAccountBalance = async (accountId: string, newBalance: number): Promise<void> => {
  await delay(200);
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  const index = accounts.findIndex(a => a.id === accountId);
  if (index !== -1) {
    accounts[index].balance = newBalance;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
};

export const deleteAccount = async (accountId: string): Promise<void> => {
  // CRITICAL FIX: Save the filtered array back to localStorage
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  const filtered = accounts.filter(a => a.id !== accountId);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));
}

// --- Transaction Services ---

export const addTransaction = async (
  userId: string, 
  data: Omit<Transaction, 'id' | 'userId'>
): Promise<Transaction> => {
  await delay(300);
  const transactions: Transaction[] = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  
  const newTx: Transaction = {
    id: crypto.randomUUID(),
    userId,
    ...data
  };

  transactions.push(newTx);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

  // Update Account Balance
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  const accIndex = accounts.findIndex(a => a.id === data.accountId);
  if (accIndex !== -1) {
    if (data.type === 'income') {
      accounts[accIndex].balance += data.amount;
    } else {
      accounts[accIndex].balance -= data.amount;
    }
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  return newTx;
};

export const updateTransaction = async (userId: string, updatedTx: Transaction): Promise<void> => {
  await delay(200);
  const transactions: Transaction[] = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const accounts: Account[] = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');

  const oldTxIndex = transactions.findIndex(t => t.id === updatedTx.id);
  if (oldTxIndex === -1) return;

  const oldTx = transactions[oldTxIndex];

  // 1. Revert Old Balance
  const oldAccIndex = accounts.findIndex(a => a.id === oldTx.accountId);
  if (oldAccIndex !== -1) {
    if (oldTx.type === 'income') {
      accounts[oldAccIndex].balance -= oldTx.amount;
    } else {
      accounts[oldAccIndex].balance += oldTx.amount;
    }
  }

  // 2. Apply New Balance
  const newAccIndex = accounts.findIndex(a => a.id === updatedTx.accountId);
  if (newAccIndex !== -1) {
    if (updatedTx.type === 'income') {
      accounts[newAccIndex].balance += updatedTx.amount;
    } else {
      accounts[newAccIndex].balance -= updatedTx.amount;
    }
  }

  // 3. Save Changes
  transactions[oldTxIndex] = updatedTx;
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  await delay(300);
  const transactions: Transaction[] = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  return transactions
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getLast30DaysTransactions = async (userId: string): Promise<Transaction[]> => {
  const all = await getTransactions(userId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return all.filter(t => new Date(t.date) >= thirtyDaysAgo);
};

// --- Chat Persistence ---

export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
  const history = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}');
  return history[userId] || [];
};

export const saveChatHistory = async (userId: string, messages: ChatMessage[]): Promise<void> => {
  const history = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}');
  history[userId] = messages;
  localStorage.setItem(CHAT_KEY, JSON.stringify(history));
};