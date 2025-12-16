export type TransactionType = 'income' | 'expense';
export type Currency = 'EUR' | 'USD' | 'BGN' | 'RSD' | 'HUF';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'bank' | 'cash' | 'savings';
  currency: Currency;
  balance: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string; // Linked account
  type: TransactionType;
  category: string;
  amount: number; 
  currency: Currency;
  date: string; // ISO string
  description: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// Legacy export - prefer using exchangeRates service for live rates
export const EXCHANGE_RATES = {
  EUR: 1,
  BGN: 1.95583,
  USD: 1.08,
  RSD: 117.25,
  HUF: 395.50
};

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TRANSACTIONS = 'TRANSACTIONS', // Kept for type safety, though merged into Dashboard in UI
  CALCULATOR = 'CALCULATOR',
  BUDGET = 'BUDGET',
  PROFILE = 'PROFILE',
  GOALS = 'GOALS',
  RECURRING = 'RECURRING',
  INSIGHTS = 'INSIGHTS'
}