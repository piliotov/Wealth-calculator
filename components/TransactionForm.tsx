import React, { useState, useEffect } from 'react';
import { Account, Friend } from '../types';
import { Plus, Loader2, Users } from 'lucide-react';
import { useToast } from './ToastContainer';
import { getFriends, createSharedExpense } from '../services/api';

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

  // Split expense state
  const [shareWithFriend, setShareWithFriend] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');

  // Load friends when component mounts
  useEffect(() => {
    getFriends().then(setFriends).catch(console.error);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id?.toString() === accountId)) {
      setAccountId(accounts[0].id.toString());
    }
  }, [accounts, accountId]);

  useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Food');
    if (type === 'income') {
      setShareWithFriend(false);
    }
  }, [type]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(',', '.');
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    
    setLoading(true);
    const selectedAccount = accounts.find(a => a.id.toString() === accountId);
    const parsedAmount = parseFloat(amount);
    
    try {
      // Add the transaction
      await onAdd({
        type,
        accountId: Number(accountId),
        amount: parsedAmount,
        category,
        description: shareWithFriend && selectedFriendId ? `[Shared] ${description}` : description,
        currency: selectedAccount?.currency || 'EUR',
        date: new Date().toISOString()
      });

      // If sharing with friend, create a shared expense (only YOUR payment)
      if (shareWithFriend && selectedFriendId && type === 'expense') {
        await createSharedExpense({
          friendId: selectedFriendId,
          description: description || category,
          totalAmount: parsedAmount,
          currency: selectedAccount?.currency || 'EUR',
          creatorPaid: parsedAmount,  // YOU paid this
          friendPaid: 0,              // They add their own
          splitType: 'custom',
          creatorShare: 50
        });
        showToast(`Expense added & shared!`, 'success');
      } else {
        showToast(`${type === 'income' ? 'Income' : 'Expense'} added`, 'success');
      }
      
      // Reset form
      setAmount('');
      setDescription('');
      setCategory(type === 'income' ? 'Salary' : 'Food');
      setShareWithFriend(false);
      setSelectedFriendId('');
    } catch (err) {
      showToast('Failed to add transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categories = type === 'income'
    ? ['Salary', 'Freelance', 'Investment', 'Other']
    : ['Food', 'Housing', 'Transport', 'Entertainment', 'Utilities', 'Shopping', 'Health', 'Travel', 'Reimbursable', 'Other'];

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

        {/* Amount */}
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

        {/* Share with Friend - Only for expenses */}
        {type === 'expense' && friends.length > 0 && (
          <div className="border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShareWithFriend(!shareWithFriend)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                shareWithFriend ? 'bg-teal-600/20' : 'bg-slate-900/30 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${shareWithFriend ? 'text-teal-400' : 'text-slate-400'}`} />
                <span className={`text-sm font-medium ${shareWithFriend ? 'text-teal-400' : 'text-slate-400'}`}>
                  Share with Friend
                </span>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${shareWithFriend ? 'bg-teal-600' : 'bg-slate-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${shareWithFriend ? 'translate-x-4' : ''}`} />
              </div>
            </button>
            
            {shareWithFriend && (
              <div className="p-4 bg-slate-900/30 border-t border-slate-700/50">
                <label className="block text-xs text-slate-500 mb-1.5">Select Friend</label>
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  required={shareWithFriend}
                >
                  <option value="">Choose a friend...</option>
                  {friends.map(f => (
                    <option key={f.friendId} value={f.friendId}>
                      {f.friendFullName || f.friendUsername}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  This will record that YOU paid this amount. Your friend adds what THEY paid.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || accounts.length === 0 || !amount || (shareWithFriend && !selectedFriendId)}
          className={`w-full font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 ${
            type === 'expense'
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : shareWithFriend && selectedFriendId ? (
            <>
              <Users className="w-4 h-4" />
              Add & Share
            </>
          ) : (
            `Add ${type === 'income' ? 'Income' : 'Expense'}`
          )}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
