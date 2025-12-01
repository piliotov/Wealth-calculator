import React, { useState } from 'react';
import { Account } from '../types';
import { Handshake, Loader2, UserPlus, UserMinus, Check, X } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Loan {
  id: number;
  type: 'lent' | 'borrowed';
  person: string;
  amount: number;
  currency: string;
  accountId: number;
  date: string;
  dueDate?: string;
  description: string;
  settled: boolean;
}

interface Props {
  accounts: Account[];
  onAddLoan: (data: any) => Promise<void>;
}

const LendingTracker: React.FC<Props> = ({ accounts, onAddLoan }) => {
  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !person || !accountId) return;
    
    setLoading(true);
    const selectedAccount = accounts.find(a => a.id === accountId);
    
    // Create two transactions: one for the loan, one to track it
    await onAddLoan({
      type: type === 'lent' ? 'expense' : 'income', // Money out when lending, in when borrowing
      accountId,
      amount: parseFloat(amount),
      category: type === 'lent' ? 'Loan Given' : 'Loan Received',
      description: `${type === 'lent' ? 'Lent to' : 'Borrowed from'} ${person}${description ? ': ' + description : ''}${dueDate ? ` (Due: ${dueDate})` : ''}`,
      currency: selectedAccount?.currency || 'EUR',
      date: new Date().toISOString()
    });
    
    setLoading(false);
    setPerson('');
    setAmount('');
    setDescription('');
    setDueDate('');
    showToast(`Loan ${type === 'lent' ? 'given to' : 'received from'} ${person} recorded`, 'success');
  };

  return (
    <div className="bg-surface p-6 rounded-xl shadow-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <Handshake className="w-5 h-5 text-primary" />
        Money Lending
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Type */}
        <div className="flex gap-4 p-1 bg-slate-900 rounded-lg">
          <button
            type="button"
            onClick={() => setType('lent')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              type === 'lent' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserMinus className="w-4 h-4" />
            I Lent Money
          </button>
          <button
            type="button"
            onClick={() => setType('borrowed')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              type === 'borrowed' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            I Borrowed Money
          </button>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {type === 'lent' ? 'Person you lent to' : 'Person you borrowed from'}
          </label>
          <input
            type="text"
            required
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="e.g., John, Sarah"
          />
        </div>

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
            <label className="block text-xs text-slate-400 mb-1">Due Date (Optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Note (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="e.g., Emergency help, Business loan"
          />
        </div>

        <button
          type="submit"
          disabled={loading || accounts.length === 0}
          className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Record ${type === 'lent' ? 'Loan Given' : 'Loan Received'}`}
        </button>
      </form>

      <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Tip:</strong> {type === 'lent' ? 
            'Money lent will be deducted from your account. When repaid, add it back as income.' : 
            'Money borrowed will be added to your account. When you repay, record it as an expense.'}
        </p>
      </div>
    </div>
  );
};

export default LendingTracker;
