import React, { useState, useEffect, useMemo } from 'react';
import { User, Friend, SharedExpense, Currency } from '../types';
import { 
  Users, UserPlus, Search, Check, X, DollarSign, 
  Plus, Trash2, Clock, Copy, AlertCircle
} from 'lucide-react';
import { 
  getFriends, getPendingFriendRequests, sendFriendRequest, respondToFriendRequest,
  removeFriend, getSharedExpenses, createSharedExpense, updateSharedExpense, 
  deleteSharedExpense, searchUserByNumber
} from '../services/api';
import { useToast } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  currentUser: User;
  onUpdate: () => void;
}

interface PendingRequest {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterFullName: string | null;
  requesterUserNumber: string;
  status: string;
  createdAt: string;
}

interface FriendTotal {
  name: string;
  myPaid: number;
  theirPaid: number;
  currency: Currency;
  myExpenses: number;
  theirExpenses: number;
}

const CURRENCIES: Currency[] = ['EUR', 'USD', 'BGN', 'RSD', 'HUF'];

const SharedExpenses: React.FC<Props> = ({ currentUser, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'friends'>('expenses');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add friend form
  const [friendNumber, setFriendNumber] = useState('');
  const [searchResult, setSearchResult] = useState<{ id: string; username: string; fullName: string | null; userNumber: string } | null>(null);
  const [searchError, setSearchError] = useState('');
  
  // Add expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    friendId: '',
    description: '',
    amount: '',
    currency: 'EUR' as Currency,
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: string; id?: string } | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string>('');
  
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsResult, pendingResult, expensesResult] = await Promise.allSettled([
        getFriends(),
        getPendingFriendRequests(),
        getSharedExpenses()
      ]);
      
      if (friendsResult.status === 'fulfilled') setFriends(friendsResult.value);
      if (pendingResult.status === 'fulfilled') setPendingRequests(pendingResult.value);
      if (expensesResult.status === 'fulfilled') setExpenses(expensesResult.value);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!friendNumber.trim()) return;
    setSearchError('');
    setSearchResult(null);
    
    try {
      const user = await searchUserByNumber(friendNumber.trim());
      setSearchResult(user);
    } catch (err: any) {
      setSearchError(err.message || 'User not found');
    }
  };

  const handleSendFriendRequest = async () => {
    if (!searchResult) return;
    
    try {
      await sendFriendRequest(searchResult.userNumber);
      showToast('Friend request sent!', 'success');
      setFriendNumber('');
      setSearchResult(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send request', 'error');
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    try {
      await respondToFriendRequest(requestId, accept ? 'accepted' : 'rejected');
      showToast(accept ? 'Friend added!' : 'Request declined', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to respond to request', 'error');
    }
  };

  const handleRemoveFriend = async () => {
    if (!confirmDialog?.id) return;
    try {
      await removeFriend(confirmDialog.id);
      showToast('Friend removed', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to remove friend', 'error');
    }
  };

  // Simple expense creation - only YOUR payment
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(expenseForm.amount) || 0;
    
    if (amount <= 0) {
      showToast('Enter an amount', 'error');
      return;
    }

    if (!expenseForm.friendId) {
      showToast('Select a friend', 'error');
      return;
    }
    
    try {
      // Only record what YOU paid - friend's payment is 0 (they add their own)
      await createSharedExpense({
        friendId: expenseForm.friendId,
        description: expenseForm.description,
        totalAmount: amount,
        currency: expenseForm.currency,
        creatorPaid: amount,  // YOU paid this
        friendPaid: 0,        // Friend adds their own expenses separately
        splitType: 'custom',
        creatorShare: 50
      });
      showToast('Expense added!', 'success');
      setShowExpenseForm(false);
      setExpenseForm({
        friendId: '',
        description: '',
        amount: '',
        currency: 'EUR',
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create expense', 'error');
    }
  };

  const handleDeleteExpense = async () => {
    if (!confirmDialog?.id) return;
    try {
      await deleteSharedExpense(confirmDialog.id);
      showToast('Expense deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete expense', 'error');
    }
  };

  const copyUserNumber = () => {
    if (currentUser.userNumber) {
      navigator.clipboard.writeText(currentUser.userNumber);
      showToast('User number copied!', 'success');
    }
  };

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter(e => showSettled ? e.settled : !e.settled);
    if (selectedFriendFilter) {
      filtered = filtered.filter(e => 
        e.friendId === selectedFriendFilter || e.creatorId === selectedFriendFilter
      );
    }
    return filtered;
  }, [expenses, showSettled, selectedFriendFilter]);

  // Calculate totals per friend - each person's expenses are tracked from THEIR creator_paid
  const friendTotals = useMemo((): Record<string, FriendTotal> => {
    const totals: Record<string, FriendTotal> = {};

    expenses.filter(e => !e.settled).forEach(expense => {
      const isCreator = expense.creatorId === currentUser.id;
      const friendId = isCreator ? expense.friendId : expense.creatorId;
      const friendName = isCreator 
        ? (expense.friendFullName || expense.friendUsername)
        : (expense.creatorFullName || expense.creatorUsername);
      
      if (!totals[friendId]) {
        totals[friendId] = { 
          name: friendName, 
          myPaid: 0, 
          theirPaid: 0, 
          currency: expense.currency, 
          myExpenses: 0,
          theirExpenses: 0
        };
      }
      
      // If I created the expense, I paid creatorPaid
      // If they created the expense, they paid creatorPaid
      if (isCreator) {
        totals[friendId].myPaid += expense.creatorPaid;
        totals[friendId].myExpenses += 1;
      } else {
        totals[friendId].theirPaid += expense.creatorPaid;
        totals[friendId].theirExpenses += 1;
      }
    });

    return totals;
  }, [expenses, currentUser.id]);

  // Overall summary with 50/50 split calculation
  const overallSummary = useMemo(() => {
    let totalIPaid = 0;
    let totalTheyPaid = 0;
    
    (Object.values(friendTotals) as FriendTotal[]).forEach(ft => {
      totalIPaid += ft.myPaid;
      totalTheyPaid += ft.theirPaid;
    });
    
    // 50/50 split: difference is what you overpaid beyond your fair share
    const totalSpent = totalIPaid + totalTheyPaid;
    const fairShare = totalSpent / 2;
    const netOwed = totalIPaid - fairShare; // Positive = they owe you
    
    return { totalIPaid, totalTheyPaid, difference: netOwed };
  }, [friendTotals]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header with user number */}
      <div className="bg-gradient-to-r from-teal-600/20 to-cyan-600/20 p-4 rounded-xl border border-teal-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Your User Number</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">{currentUser.userNumber || 'Loading...'}</p>
            <p className="text-xs text-slate-500 mt-1">Share this to let friends add you</p>
          </div>
          <button
            onClick={copyUserNumber}
            className="p-3 bg-teal-600/30 rounded-xl hover:bg-teal-600/50 transition-colors"
          >
            <Copy className="text-teal-400 w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Overall Summary Card */}
      {Object.keys(friendTotals).length > 0 && (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Overall Balance</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">You Paid</p>
              <p className="text-lg font-bold text-teal-400">{formatCurrency(overallSummary.totalIPaid, 'EUR')}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">They Paid</p>
              <p className="text-lg font-bold text-amber-400">{formatCurrency(overallSummary.totalTheyPaid, 'EUR')}</p>
            </div>
            <div className={`rounded-lg p-3 ${
              overallSummary.difference > 0 ? 'bg-green-500/20' : 
              overallSummary.difference < 0 ? 'bg-red-500/20' : 'bg-slate-900/50'
            }`}>
              <p className="text-xs text-slate-500 mb-1">Difference</p>
              <p className={`text-lg font-bold ${
                overallSummary.difference > 0 ? 'text-green-400' : 
                overallSummary.difference < 0 ? 'text-red-400' : 'text-slate-400'
              }`}>
                {overallSummary.difference >= 0 ? '+' : ''}{formatCurrency(overallSummary.difference, 'EUR')}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            {overallSummary.difference > 0 
              ? `You're owed ${formatCurrency(overallSummary.difference, 'EUR')} in total`
              : overallSummary.difference < 0 
                ? `You owe ${formatCurrency(Math.abs(overallSummary.difference), 'EUR')} in total`
                : 'All balanced! 🎉'}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800/30 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
            ${activeTab === 'expenses' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <DollarSign className="w-4 h-4" />
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
            ${activeTab === 'friends' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Users className="w-4 h-4" />
          Friends ({friends.length})
          {pendingRequests.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{pendingRequests.length}</span>
          )}
        </button>
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Per-Friend Summary Cards */}
          {Object.entries(friendTotals).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400">Balance with Friends</h3>
              {(Object.entries(friendTotals) as [string, FriendTotal][]).map(([friendId, data]) => {
                // 50/50 split: each person's share is half of the total
                const totalSpent = data.myPaid + data.theirPaid;
                const fairShare = totalSpent / 2;
                // Positive = they owe me, Negative = I owe them
                const diff = data.myPaid - fairShare;
                return (
                  <div 
                    key={friendId}
                    className={`bg-slate-800/40 p-4 rounded-xl border ${
                      selectedFriendFilter === friendId ? 'border-teal-500' : 'border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-white text-lg">{data.name}</p>
                      <button
                        onClick={() => setSelectedFriendFilter(selectedFriendFilter === friendId ? '' : friendId)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                      >
                        {selectedFriendFilter === friendId ? 'Show all' : 'Filter'}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">You paid ({data.myExpenses} items)</p>
                        <p className="text-xl font-bold text-teal-400">{formatCurrency(data.myPaid, data.currency)}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">{data.name} paid ({data.theirExpenses} items)</p>
                        <p className="text-xl font-bold text-amber-400">{formatCurrency(data.theirPaid, data.currency)}</p>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-lg text-center ${
                      diff > 0 ? 'bg-green-500/20' : diff < 0 ? 'bg-red-500/20' : 'bg-slate-700/50'
                    }`}>
                      {diff > 0 ? (
                        <p className="text-green-400 font-medium">
                          {data.name} owes you {formatCurrency(diff, data.currency)}
                        </p>
                      ) : diff < 0 ? (
                        <p className="text-red-400 font-medium">
                          You owe {data.name} {formatCurrency(Math.abs(diff), data.currency)}
                        </p>
                      ) : (
                        <p className="text-slate-400 font-medium">All settled up! 🎉</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Expense Button */}
          {!showExpenseForm && (
            <button
              onClick={() => setShowExpenseForm(true)}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add My Expense
            </button>
          )}

          {friends.length === 0 && !showExpenseForm && (
            <div className="bg-slate-800/30 p-4 rounded-xl text-center">
              <p className="text-slate-400 text-sm">💡 Add friends in the Friends tab to share expenses with them</p>
            </div>
          )}

          {/* Add Expense Form - Simple: only YOUR payment */}
          {showExpenseForm && (
            <form onSubmit={handleCreateExpense} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white">Add Your Expense</h3>
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-slate-400 -mt-2">
                Record what YOU paid. Your friend will add what THEY paid from their account.
              </p>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Share with</label>
                {friends.length > 0 ? (
                  <select
                    value={expenseForm.friendId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, friendId: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    required
                  >
                    <option value="">Select friend...</option>
                    {friends.map(f => (
                      <option key={f.friendId} value={f.friendId}>
                        {f.friendFullName || f.friendUsername}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-slate-700/30 border border-slate-600 rounded-lg px-3 py-2 text-slate-400 text-sm">
                    No friends yet - add friends in the Friends tab first
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">What for?</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g., Dinner, Groceries, Rent..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Amount YOU paid</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-3 text-white text-xl font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Currency</label>
                <div className="flex gap-2 flex-wrap">
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setExpenseForm({ ...expenseForm, currency: c })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        expenseForm.currency === c 
                          ? 'bg-teal-600 text-white' 
                          : 'bg-slate-700/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!expenseForm.friendId || !expenseForm.amount}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Add Expense
              </button>
            </form>
          )}

          {/* Expense History */}
          {expenses.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-6">
                <h3 className="text-sm font-medium text-slate-300">
                  {showSettled ? 'Settled History' : 'Recent Expenses'}
                  {selectedFriendFilter && ` (filtered)`}
                </h3>
                <div className="flex gap-2">
                  {selectedFriendFilter && (
                    <button
                      onClick={() => setSelectedFriendFilter('')}
                      className="text-sm text-slate-500 hover:text-slate-400"
                    >
                      Clear filter
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettled(!showSettled)}
                    className="text-sm text-teal-500 hover:text-teal-400"
                  >
                    {showSettled ? 'Show Active' : 'Show History'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredExpenses.map(expense => {
                  const isCreator = expense.creatorId === currentUser.id;
                  const otherName = isCreator 
                    ? (expense.friendFullName || expense.friendUsername)
                    : (expense.creatorFullName || expense.creatorUsername);
                  const paidBy = isCreator ? 'You' : otherName;
                  const amount = expense.creatorPaid; // The creator paid this amount

                  return (
                    <div 
                      key={expense.id}
                      className={`bg-slate-800/40 p-3 rounded-xl border ${
                        expense.settled ? 'border-green-500/30 opacity-60' : 'border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{expense.description}</h4>
                            {expense.settled && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Settled</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            {paidBy} paid • shared with {isCreator ? otherName : 'you'}
                          </p>
                        </div>
                        
                        <div className="text-right flex items-center gap-3">
                          <p className={`text-lg font-semibold ${isCreator ? 'text-teal-400' : 'text-amber-400'}`}>
                            {formatCurrency(amount, expense.currency)}
                          </p>
                          {isCreator && !expense.settled && (
                            <button
                              onClick={() => setConfirmDialog({ isOpen: true, type: 'expense', id: expense.id })}
                              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredExpenses.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No {showSettled ? 'settled' : 'active'} expenses</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {/* Add Friend */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-500" />
              Add Friend by User Number
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={friendNumber}
                onChange={(e) => setFriendNumber(e.target.value)}
                placeholder="Enter 8-digit user number"
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
              <button
                onClick={handleSearchUser}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            
            {searchError && (
              <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {searchError}
              </p>
            )}
            
            {searchResult && (
              <div className="mt-3 p-3 bg-slate-700/30 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{searchResult.fullName || searchResult.username}</p>
                  <p className="text-slate-400 text-sm">@{searchResult.username}</p>
                </div>
                <button
                  onClick={handleSendFriendRequest}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Send Request
                </button>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-amber-500/30">
              <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Requests ({pendingRequests.length})
              </h3>
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{req.requesterFullName || req.requesterUsername}</p>
                      <p className="text-slate-400 text-sm">#{req.requesterUserNumber}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondToRequest(req.id, true)}
                        className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(req.id, false)}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-500" />
              Your Friends ({friends.length})
            </h3>
            
            {friends.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No friends yet</p>
                <p className="text-sm">Add friends using their user number</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(friend => {
                  const totals = friendTotals[friend.friendId];
                  const diff = totals ? totals.myPaid - totals.theirPaid : 0;
                  return (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{friend.friendFullName || friend.friendUsername}</p>
                        <p className="text-slate-400 text-sm">#{friend.friendUserNumber}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {totals && diff !== 0 && (
                          <span className={`text-sm font-medium ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff, totals.currency)}
                          </span>
                        )}
                        <button
                          onClick={() => setConfirmDialog({ isOpen: true, type: 'friend', id: friend.id })}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog?.isOpen || false}
        title={confirmDialog?.type === 'friend' ? 'Remove Friend' : 'Delete Expense'}
        message={confirmDialog?.type === 'friend' 
          ? 'Are you sure you want to remove this friend?'
          : 'Are you sure you want to delete this expense?'
        }
        confirmText={confirmDialog?.type === 'friend' ? 'Remove' : 'Delete'}
        onConfirm={() => {
          if (confirmDialog?.type === 'friend') {
            handleRemoveFriend();
          } else {
            handleDeleteExpense();
          }
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default SharedExpenses;
