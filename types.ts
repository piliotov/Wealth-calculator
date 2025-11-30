export type TransactionType = 'income' | 'expense';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'bank' | 'cash' | 'savings';
  currency: 'EUR' | 'BGN' | 'USD';
  balance: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string; // Linked account
  type: TransactionType;
  category: string;
  amount: number; 
  currency: 'EUR' | 'BGN' | 'USD';
  date: string; // ISO string
  description: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export const EXCHANGE_RATES = {
  EUR: 1,
  BGN: 1.95583,
  USD: 1.08
};

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TRANSACTIONS = 'TRANSACTIONS', // Kept for type safety, though merged into Dashboard in UI
  CALCULATOR = 'CALCULATOR',
  PROFILE = 'PROFILE'
}