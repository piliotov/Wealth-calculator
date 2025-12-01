import React, { useState } from 'react';
import { Account } from '../types';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Props {
  accounts: Account[];
  onTransfer: (data: any) => Promise<void>;
}

const TransferForm: React.FC<Props> = ({ accounts, onTransfer }) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (accounts.length > 0) {
      if (!fromAccountId) setFromAccountId(accounts[0].id.toString());
      if (!toAccountId && accounts.length > 1) setToAccountId(accounts[1].id.toString());
    }
  }, [accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || fromAccountId === toAccountId) return;
    
    setLoading(true);
    const fromAccount = accounts.find(a => a.id === fromAccountId);
    const toAccount = accounts.find(a => a.id === toAccountId);
    
    await onTransfer({
      fromAccountId,
      toAccountId,
      amount: parseFloat(amount),
      description: description || `Transfer from ${fromAccount?.name} to ${toAccount?.name}`,
      fromCurrency: fromAccount?.currency || 'EUR',
      toCurrency: toAccount?.currency || 'EUR',
      date: new Date().toISOString()
    });
    
    setLoading(false);
    setAmount('');
    setDescription('');
    showToast(`Transfer completed successfully`, 'success');
  };

  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const toAccount = accounts.find(a => a.id === toAccountId);
  const needsConversion = fromAccount?.currency !== toAccount?.currency;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-lg border border-slate-700">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5 text-primary" />
        Transfer Between Accounts
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">From Account</label>
          <select
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency}) - {a.balance.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center">
          <ArrowRightLeft className="w-5 h-5 text-slate-500" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">To Account</label>
          <select
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Amount {fromAccount && `(${fromAccount.currency})`}
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="0.00"
          />
          {needsConversion && (
            <p className="text-xs text-amber-400 mt-1">
              ⚠ Different currencies - conversion at market rate
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Note (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
            placeholder="e.g., Monthly savings"
          />
        </div>

        <button
          type="submit"
          disabled={loading || accounts.length < 2 || fromAccountId === toAccountId}
          className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transfer Money'}
        </button>
        {fromAccountId === toAccountId && (
          <p className="text-xs text-red-400 text-center">Cannot transfer to the same account</p>
        )}
      </form>
    </div>
  );
};

export default TransferForm;
