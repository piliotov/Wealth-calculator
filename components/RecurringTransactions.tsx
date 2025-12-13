import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Trash2, Calendar, Play, Pause, Sparkles } from 'lucide-react';
import { useToast } from './ToastContainer';

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  currency: 'EUR' | 'BGN' | 'USD';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  category: string;
  nextDate: string;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  userId: string;
  onTriggerTransaction?: (transaction: Omit<RecurringTransaction, 'id' | 'nextDate' | 'isActive' | 'createdAt'>) => void;
}

const EXPENSE_CATEGORIES = [
  'Rent/Mortgage', 'Utilities', 'Subscriptions', 'Insurance', 'Phone/Internet',
  'Gym', 'Transportation', 'Loan Payment', 'Other'
];

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investments', 'Rental Income', 'Other'];

const RecurringTransactions: React.FC<Props> = ({ userId, onTriggerTransaction }) => {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newTx, setNewTx] = useState({
    description: '',
    amount: '',
    type: 'expense' as const,
    currency: 'EUR' as const,
    frequency: 'monthly' as const,
    category: 'Rent/Mortgage',
    nextDate: new Date().toISOString().split('T')[0],
  });
  const { showToast } = useToast();

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`recurring_${userId}`);
    if (saved) {
      setTransactions(JSON.parse(saved));
    }
  }, [userId]);

  // Save to localStorage
  const saveTx = (updated: RecurringTransaction[]) => {
    setTransactions(updated);
    localStorage.setItem(`recurring_${userId}`, JSON.stringify(updated));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;

    const tx: RecurringTransaction = {
      id: crypto.randomUUID(),
      description: newTx.description,
      amount: parseFloat(newTx.amount),
      type: newTx.type,
      currency: newTx.currency,
      frequency: newTx.frequency,
      category: newTx.category,
      nextDate: newTx.nextDate,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    saveTx([...transactions, tx]);
    setNewTx({
      description: '',
      amount: '',
      type: 'expense',
      currency: 'EUR',
      frequency: 'monthly',
      category: 'Rent/Mortgage',
      nextDate: new Date().toISOString().split('T')[0],
    });
    setShowForm(false);
    showToast('Recurring transaction added! 🔄', 'success');
  };

  const toggleActive = (id: string) => {
    const updated = transactions.map(t =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    saveTx(updated);
  };

  const deleteTx = (id: string) => {
    saveTx(transactions.filter(t => t.id !== id));
    showToast('Recurring transaction deleted', 'success');
  };

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Every 2 weeks',
      monthly: 'Monthly',
      yearly: 'Yearly',
    };
    return labels[freq] || freq;
  };

  const getDaysUntil = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  const getMonthlyTotal = (type: 'income' | 'expense') => {
    return transactions
      .filter(t => t.type === type && t.isActive)
      .reduce((sum, t) => {
        let monthly = t.amount;
        switch (t.frequency) {
          case 'daily': monthly = t.amount * 30; break;
          case 'weekly': monthly = t.amount * 4; break;
          case 'biweekly': monthly = t.amount * 2; break;
          case 'yearly': monthly = t.amount / 12; break;
        }
        return sum + monthly;
      }, 0);
  };

  const monthlyIncome = getMonthlyTotal('income');
  const monthlyExpenses = getMonthlyTotal('expense');
  const categories = newTx.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-violet-400" />
          Recurring Transactions
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Recurring
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <p className="text-xs text-emerald-400 mb-1">Monthly Income (est.)</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(monthlyIncome, 'EUR')}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-xs text-red-400 mb-1">Monthly Expenses (est.)</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(monthlyExpenses, 'EUR')}</p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input
                type="text"
                required
                value={newTx.description}
                onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                placeholder="e.g., Netflix subscription"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={newTx.type}
                onChange={(e) => setNewTx({ ...newTx, type: e.target.value as any, category: e.target.value === 'expense' ? 'Rent/Mortgage' : 'Salary' })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                placeholder="12.99"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select
                value={newTx.currency}
                onChange={(e) => setNewTx({ ...newTx, currency: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="EUR">EUR</option>
                <option value="BGN">BGN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frequency</label>
              <select
                value={newTx.frequency}
                onChange={(e) => setNewTx({ ...newTx, frequency: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={newTx.category}
                onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Next Due Date</label>
              <input
                type="date"
                value={newTx.nextDate}
                onChange={(e) => setNewTx({ ...newTx, nextDate: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg">
              Add
            </button>
          </div>
        </form>
      )}

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No recurring transactions</p>
          <p className="text-sm text-slate-500">Add subscriptions, bills, and regular income</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime()).map(tx => (
            <div
              key={tx.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                tx.isActive 
                  ? 'bg-slate-900/50 border-slate-700' 
                  : 'bg-slate-900/20 border-slate-800 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  tx.type === 'income' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                  <RefreshCw className={`w-5 h-5 ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">{tx.description}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{tx.category}</span>
                    <span>•</span>
                    <span>{getFrequencyLabel(tx.frequency)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar size={10} />
                    {getDaysUntil(tx.nextDate)}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(tx.id)}
                    className={`p-2 rounded-lg ${tx.isActive ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-slate-500 hover:bg-slate-700'}`}
                    title={tx.isActive ? 'Pause' : 'Resume'}
                  >
                    {tx.isActive ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={() => deleteTx(tx.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringTransactions;
