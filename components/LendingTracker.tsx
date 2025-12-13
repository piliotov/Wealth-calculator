import React, { useState } from 'react';
import { Account } from '../types';
import { Handshake, Loader2, UserPlus, UserMinus, Plus } from 'lucide-react';
import { useToast } from './ToastContainer';

interface Props {
  accounts: Account[];
  onAddLoan: (data: any) => Promise<void>;
}

const LendingTracker: React.FC<Props> = ({ accounts, onAddLoan }) => {
  const [type, setType] = useState<'lent' | 'borrowed'>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id?.toString() || '');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id?.toString() === accountId)) {
      setAccountId(accounts[0].id.toString());
    }
  }, [accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !person || !accountId) return;
    
    setLoading(true);
    const selectedAccount = accounts.find(a => a.id.toString() === accountId);
    
    await onAddLoan({
      type: type === 'lent' ? 'expense' : 'income',
      accountId: Number(accountId),
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
    setIsExpanded(false);
    showToast(`Loan ${type === 'lent' ? 'given to' : 'received from'} ${person} recorded`, 'success');
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Money Lending</h3>
            <p className="text-xs text-slate-500">Track loans given or received</p>
          </div>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-45' : ''}`}>
          <Plus className="w-5 h-5 text-slate-500" />
        </div>
      </button>
      
      {/* Expandable form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
          {/* Toggle Type */}
          <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl">
            <button
              type="button"
              onClick={() => setType('lent')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                type === 'lent' ? 'bg-orange-600 text-white' : 'text-slate-400'
              }`}
            >
              <UserMinus className="w-4 h-4" />
              I Lent
            </button>
            <button
              type="button"
              onClick={() => setType('borrowed')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                type === 'borrowed' ? 'bg-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              I Borrowed
            </button>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              {type === 'lent' ? 'Person you lent to' : 'Person you borrowed from'}
            </label>
            <input
              type="text"
              required
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g., John, Sarah"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Amount</label>
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
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Due Date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Note (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Reason"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || accounts.length === 0 || !person || !amount}
            className={`w-full font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 ${
              type === 'lent' 
                ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            } disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Record ${type === 'lent' ? 'Loan Given' : 'Loan Received'}`}
          </button>
        </form>
      )}
    </div>
  );
};

export default LendingTracker;
