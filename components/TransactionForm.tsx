import React, { useState } from 'react';
import { Account } from '../types';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Props {
  accounts: Account[];
  onAdd: (data: any) => Promise<void>;
}

const TransactionForm: React.FC<Props> = ({ accounts, onAdd }) => {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id?.toString() || '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id?.toString() === accountId)) {
      setAccountId(accounts[0].id.toString());
    }
  }, [accounts, accountId]);

  React.useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
  }, [type]);

  // Handle amount input - convert comma to dot for decimal
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(',', '.');
    // Only allow numbers and one decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    
    setLoading(true);
    const selectedAccount = accounts.find(a => a.id.toString() === accountId);
    
    await onAdd({
      type,
      accountId: Number(accountId),
      amount: parseFloat(amount),
      category,
      description,
      currency: selectedAccount?.currency || 'EUR',
      date: new Date().toISOString()
    });
    
    setLoading(false);
    setAmount('');
    setDescription('');
    setCategory(type === 'income' ? 'Salary' : 'Food');
    showToast(`${type === 'income' ? 'Income' : 'Expense'} added`, 'success');
  };

  const categories = type === 'income'
    ? ['Salary', 'Freelance', 'Investment', 'Other']
    : ['Food', 'Housing', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Travel', 'Other'];

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/30">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          type === 'expense' ? 'bg-red-600/20' : 'bg-green-600/20'
        }`}>
          <Plus className={`w-5 h-5 ${
            type === 'expense' ? 'text-red-400' : 'text-green-400'
          }`} />
        </div>
        <div>
          <h3 className="font-medium text-white">Add Transaction</h3>
          <p className="text-xs text-slate-500">Track income & expenses</p>
        </div>
      </div>
      
      {/* Form - always visible */}
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-400'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              type === 'income' ? 'bg-green-500 text-white' : 'text-slate-400'
            }`}
          >
            Income
          </button>
        </div>

        {/* Amount - big and prominent */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Amount</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            required
            value={amount}
            onChange={handleAmountChange}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-xl text-white font-medium focus:outline-none focus:border-blue-500"
            placeholder="0.00"
          />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id.toString()}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="What's this for?"
            />
          </div>

          <button
            type="submit"
            disabled={loading || accounts.length === 0 || !amount}
            className={`w-full font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 ${
              type === 'expense'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            } disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          </button>
        </form>
    </div>
  );
};

export default TransactionForm;