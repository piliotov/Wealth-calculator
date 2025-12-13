import React, { useState } from 'react';
import { Account } from '../types';
import { ArrowRightLeft, Loader2, Plus } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (accounts.length > 0) {
      if (!fromAccountId) setFromAccountId(accounts[0].id.toString());
      if (!toAccountId && accounts.length > 1) setToAccountId(accounts[1].id.toString());
    }
  }, [accounts, fromAccountId, toAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || fromAccountId === toAccountId) return;
    
    setLoading(true);
    const fromAccount = accounts.find(a => a.id.toString() === fromAccountId);
    const toAccount = accounts.find(a => a.id.toString() === toAccountId);
    
    await onTransfer({
      fromAccountId: Number(fromAccountId),
      toAccountId: Number(toAccountId),
      amount: parseFloat(amount),
      description: description || `Transfer from ${fromAccount?.name} to ${toAccount?.name}`,
      fromCurrency: fromAccount?.currency || 'EUR',
      toCurrency: toAccount?.currency || 'EUR',
      date: new Date().toISOString()
    });
    
    setLoading(false);
    setAmount('');
    setDescription('');
    setIsExpanded(false);
    showToast(`Transfer completed successfully`, 'success');
  };

  const fromAccount = accounts.find(a => a.id.toString() === fromAccountId);
  const toAccount = accounts.find(a => a.id.toString() === toAccountId);
  const needsConversion = fromAccount?.currency !== toAccount?.currency;

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Transfer Money</h3>
            <p className="text-xs text-slate-500">Move between accounts</p>
          </div>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-45' : ''}`}>
          <Plus className="w-5 h-5 text-slate-500" />
        </div>
      </button>
      
      {/* Expandable form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">From Account</label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id.toString()}>
                  {a.name} ({a.currency}) - {a.balance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-slate-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">To Account</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id.toString()}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Amount {fromAccount && `(${fromAccount.currency})`}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-xl text-white font-medium focus:outline-none focus:border-blue-500"
              placeholder="0.00"
            />
            {needsConversion && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Different currencies - conversion at market rate
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g., Monthly savings"
            />
          </div>

          <button
            type="submit"
            disabled={loading || accounts.length < 2 || fromAccountId === toAccountId}
            className="w-full font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transfer Money'}
          </button>
          {fromAccountId === toAccountId && (
            <p className="text-xs text-red-400 text-center">Cannot transfer to the same account</p>
          )}
        </form>
      )}
    </div>
  );
};

export default TransferForm;
