import React, { useState } from 'react';
import { TransactionType, Account } from '../types';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Props {
  accounts: Account[];
  onAdd: (data: any) => Promise<void>;
}

const TransactionForm: React.FC<Props> = ({ accounts, onAdd }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Update account selection if accounts change and current selection is invalid
  React.useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  // Update category when type changes
  React.useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    
    setLoading(true);
    const selectedAccount = accounts.find(a => a.id === accountId);
    
    await onAdd({
      type,
      accountId,
      amount: parseFloat(amount),
      category,
      description,
      currency: selectedAccount?.currency || 'EUR',
      date: new Date().toISOString()
    });
    
    setLoading(false);
    setAmount('');
    setDescription('');
    // Reset category to default for the current type
    setCategory(type === 'income' ? 'Salary' : 'Food');
    showToast(`${type === 'income' ? 'Income' : 'Expense'} added successfully`, 'success');
  };

  const categories = type === 'income' 
    ? ['Salary', 'Freelance', 'Investment', 'Transfer In', 'Loan Received', 'Other'] 
    : ['Food', 'Housing', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Travel', 'Transfer Out', 'Loan Given', 'Other'];

  return (
    <div className="bg-surface p-6 rounded-xl shadow-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <PlusCircle className="w-5 h-5 text-primary" />
        Add Transaction
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Type */}
        <div className="flex gap-4 p-1 bg-slate-900 rounded-lg">
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              type === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              type === 'expense' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Expense
          </button>
        </div>

        {/* Account Selector */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="e.g., Groceries"
          />
        </div>

        <button
          type="submit"
          disabled={loading || accounts.length === 0}
          className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Transaction'}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;