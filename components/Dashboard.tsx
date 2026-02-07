import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Account, TransactionType, Currency } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, Building2, Pencil, X, Save, Trash2, Check } from 'lucide-react';
import { updateTransaction, deleteTransaction, addTransaction } from '../services/api';
import { useToast } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';
import { fetchExchangeRates, getExchangeRates, toEUR, type ExchangeRates } from '../services/exchangeRates';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onUpdate: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<Props> = ({ transactions, accounts, onUpdate }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; txId?: number; loan?: Transaction } | null>(null);
  const [rates, setRates] = useState<ExchangeRates>(getExchangeRates());
  const { showToast } = useToast();

  // Fetch live exchange rates on mount
  useEffect(() => {
    fetchExchangeRates().then(setRates).catch(console.warn);
  }, []);

  const isTransferCategory = (category: string) => category.toLowerCase().includes('transfer');
  const isLoanCategory = (category: string) => category.toLowerCase().includes('loan');
  const isLoanRepaidCategory = (category: string) => category.toLowerCase().includes('loan repaid');
  const isReimbursableCategory = (category: string) => category.toLowerCase() === 'reimbursable';

  const nonTransferTransactions = useMemo(
    () => transactions.filter(t => !isTransferCategory(t.category) && !isLoanRepaidCategory(t.category)),
    [transactions]
  );

  // Track which loans have already been repaid by matching repayment descriptions
  const repaidLoanIds = useMemo(() => {
    const repaidIds = new Set<string>();
    const repaymentTxs = transactions.filter(t => isLoanRepaidCategory(t.category));
    
    transactions.forEach(loan => {
      if (loan.category === 'Loan Given' || loan.category === 'Loan Received') {
        // Check if there's a repayment transaction that matches this loan
        const hasRepayment = repaymentTxs.some(repay => 
          repay.description === `Repayment: ${loan.description}` &&
          repay.amount === loan.amount &&
          repay.accountId === loan.accountId
        );
        if (hasRepayment) {
          repaidIds.add(loan.id);
        }
      }
    });
    return repaidIds;
  }, [transactions]);
  
  const stats = useMemo(() => {
    // 1. Calculate Net Worth in EUR
    let totalNetWorthEUR = 0;
    accounts.forEach(acc => {
      const amountInEUR = toEUR(acc.balance, acc.currency as Currency, rates);
      totalNetWorthEUR += amountInEUR;
    });

    // 2. Recent Spending stats (Last 30 days) - Displayed in EUR approximation for aggregate
    const income = transactions.filter(t => t.type === 'income' && !isReimbursableCategory(t.category)).reduce((acc, t) => {
      return acc + toEUR(t.amount, t.currency as Currency, rates);
    }, 0);
    
    const expenses = transactions.filter(t => t.type === 'expense' && !isTransferCategory(t.category) && !isLoanCategory(t.category) && !isReimbursableCategory(t.category)).reduce((acc, t) => {
      return acc + toEUR(t.amount, t.currency as Currency, rates);
    }, 0);

    // 3. Category Breakdown (Expenses) - Exclude transfers, loans, and reimbursables
    const categories: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense' && !isTransferCategory(t.category) && !isLoanCategory(t.category) && !isReimbursableCategory(t.category)).forEach(t => {
      const amountInEUR = toEUR(t.amount, t.currency as Currency, rates);
      categories[t.category] = (categories[t.category] || 0) + amountInEUR;
    });
    
    const pieData = Object.entries(categories).map(([name, value]) => ({ name, value }));

    // 3b. Income Categories - Exclude transfers, loans, and reimbursables
    const incomeCategories: Record<string, number> = {};
    transactions.filter(t => t.type === 'income' && !isTransferCategory(t.category) && !isLoanCategory(t.category) && !isReimbursableCategory(t.category)).forEach(t => {
      const amountInEUR = toEUR(t.amount, t.currency as Currency, rates);
      incomeCategories[t.category] = (incomeCategories[t.category] || 0) + amountInEUR;
    });
    
    const incomePieData = Object.entries(incomeCategories).map(([name, value]) => ({ name, value }));

    // 4. Timeline Data
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningWorth = totalNetWorthEUR; 
    const historyPoints = [];
    const reversedTx = [...sortedTx].reverse();
    
    historyPoints.push({ date: new Date().toLocaleDateString(), balance: runningWorth });

    for (const t of reversedTx) {
      const amountInEUR = toEUR(t.amount, t.currency as Currency, rates);
      if (t.type === 'income') runningWorth -= amountInEUR;
      else runningWorth += amountInEUR;
      
      historyPoints.push({ date: new Date(t.date).toLocaleDateString(), balance: runningWorth });
    }
    
    return { 
      income, 
      expenses, 
      netWorthEUR: totalNetWorthEUR, 
      pieData,
      incomePieData, 
      chartData: historyPoints.reverse() 
    };
  }, [transactions, accounts, rates]);

  const formatEUR = (val: number) => 
    new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }).format(val);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
        await updateTransaction(editingTx.id, {
          accountId: editingTx.accountId,
          type: editingTx.type,
          category: editingTx.category,
          amount: editingTx.amount,
          currency: editingTx.currency,
          date: editingTx.date,
          description: editingTx.description
        });
        setEditingTx(null);
        onUpdate();
        showToast('Transaction updated successfully', 'success');
    }
  };

  const handleDelete = async (txId: number) => {
    setConfirmDialog({ isOpen: true, txId });
  };

  const confirmDelete = async () => {
    if (confirmDialog?.txId) {
      await deleteTransaction(confirmDialog.txId);
      onUpdate();
      showToast('Transaction deleted successfully', 'success');
    }
  };

  const handleRepayLoan = async (loan: Transaction) => {
    setConfirmDialog({ isOpen: true, loan });
  };

  const confirmRepayLoan = async () => {
    if (confirmDialog?.loan) {
      const loan = confirmDialog.loan;
      const isLent = loan.category === 'Loan Given';
      await addTransaction({
        accountId: loan.accountId,
        type: isLent ? 'income' : 'expense',
        category: isLent ? 'Loan Repaid (Received)' : 'Loan Repaid (Paid)',
        amount: loan.amount,
        currency: loan.currency,
        date: new Date().toISOString(),
        description: `Repayment: ${loan.description}`
      });
      onUpdate();
      showToast(`Loan marked as repaid`, 'success');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      
      {/* Net Worth Summary - Clean card */}
      <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total Balance</p>
            <h2 className="text-3xl font-bold text-white mt-1">
              {formatEUR(stats.netWorthEUR)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Combined across all accounts</p>
          </div>
          <div className="p-3 bg-teal-600/20 rounded-xl">
            <Wallet className="text-teal-500 w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Account Cards - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex-shrink-0 w-[200px] md:w-auto">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="text-slate-500 w-4 h-4" />
              <p className="text-slate-400 text-sm font-medium truncate">{acc.name}</p>
            </div>
            <h3 className="text-xl font-semibold text-white">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.currency }).format(acc.balance)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{acc.type}</p>
          </div>
        ))}
      </div>

      {/* Charts - Stack on mobile */}
      <div className="space-y-4 mt-4">
        
        {/* Net Worth Chart */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-500" />
            Balance History
          </h3>
          <div style={{ width: '100%', minHeight: 200 }}>
            <ResponsiveContainer width="100%" height={200} debounce={50}>
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val/1000}k`} width={50} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => formatEUR(value)}
                />
                <Area type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Charts - Side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Income Sources</h3>
          <div style={{ width: '100%', minHeight: 160 }} className="flex items-center justify-center">
            {stats.incomePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160} debounce={50}>
                <PieChart>
                  <Pie
                    data={stats.incomePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    fill="#8884d8"
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                  >
                    {stats.incomePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                     formatter={(value: number) => formatEUR(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500">No income recorded yet.</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {stats.incomePieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-300">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name}
              </div>
            ))}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Expense Breakdown</h3>
          <div style={{ width: '100%', minHeight: 160 }} className="flex items-center justify-center">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160} debounce={50}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    fill="#8884d8"
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                     formatter={(value: number) => formatEUR(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm">No expenses yet</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {stats.pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="truncate max-w-[80px]">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300">Recent Activity</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
            {[...nonTransferTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
              const isLoan = t.category === 'Loan Given' || t.category === 'Loan Received';
              const isRepaid = repaidLoanIds.has(t.id);
              return (
            <div key={t.id} className="p-3 md:p-4 border-b border-slate-700/30 last:border-0 active:bg-slate-700/30 md:hover:bg-slate-700/20 transition-colors group">
                <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium truncate">{t.category}</p>
                      {isLoan && (
                        <span className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${isRepaid ? 'bg-teal-500/15 text-teal-400 border-teal-500/20' : 'bg-orange-500/15 text-orange-400 border-orange-500/20'}`}>
                          {isRepaid ? 'Repaid' : (t.category === 'Loan Given' ? 'Lent' : 'Borrowed')}
                        </span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                        {accounts.find(a => a.id === t.accountId)?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                    <span className={`text-sm font-semibold text-right whitespace-nowrap ${t.type === 'income' ? 'text-teal-400' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} {t.currency}
                    </span>
                    {/* Action buttons - larger touch targets on mobile, compact on desktop hover */}
                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {isLoan && !isRepaid && (
                        <button 
                          onClick={() => handleRepayLoan(t)}
                          className="p-2 md:p-1.5 text-slate-400 hover:text-teal-400 active:text-teal-500 bg-slate-800/80 rounded-lg touch-manipulation"
                          title="Mark as Repaid"
                        >
                          <Check className="w-5 h-5 md:w-4 md:h-4" />
                        </button>
                      )}
                      <button 
                          onClick={() => setEditingTx(t)}
                          className="p-2 md:p-1.5 text-slate-400 hover:text-white active:text-white bg-slate-800/80 rounded-lg touch-manipulation"
                          title="Edit"
                      >
                          <Pencil className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                      <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-2 md:p-1.5 text-slate-400 hover:text-red-400 active:text-red-500 bg-slate-800/80 rounded-lg touch-manipulation"
                          title="Delete"
                      >
                          <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                    </div>
                </div>
                </div>
            </div>
            )})}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700/50 rounded-t-2xl md:rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-slate-700/50">
                    <h3 className="text-base font-semibold text-white">Edit Transaction</h3>
                    <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-white p-2 -mr-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleEditSave} className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Amount ({editingTx.currency})</label>
                        <input 
                            type="number" step="0.01" 
                            value={editingTx.amount}
                            onChange={(e) => setEditingTx({...editingTx, amount: parseFloat(e.target.value)})}
                            className="w-full h-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 text-white text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Account</label>
                        <select
                            value={editingTx.accountId}
                            onChange={(e) => setEditingTx({...editingTx, accountId: parseInt(e.target.value)})}
                            className="w-full h-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 text-white text-base"
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="bg-slate-900">
                                    {acc.name} ({acc.currency})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Description</label>
                        <input 
                            type="text" 
                            value={editingTx.description}
                            onChange={(e) => setEditingTx({...editingTx, description: e.target.value})}
                            className="w-full h-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 text-white text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Category</label>
                        <input 
                            type="text" 
                            value={editingTx.category}
                            onChange={(e) => setEditingTx({...editingTx, category: e.target.value})}
                            className="w-full h-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 text-white text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Date</label>
                        <input 
                            type="date" 
                            value={editingTx.date ? new Date(editingTx.date).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditingTx({...editingTx, date: new Date(e.target.value + 'T12:00:00').toISOString()})}
                            className="w-full h-12 bg-slate-800/50 border border-slate-700 rounded-lg px-3 text-white text-base"
                        />
                    </div>
                    
                    <button type="submit" className="w-full h-12 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg flex justify-center items-center gap-2 font-medium mt-6">
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog?.isOpen || false}
        title={confirmDialog?.loan ? 'Mark Loan as Repaid?' : 'Delete Transaction?'}
        message={
          confirmDialog?.loan
            ? `This will ${confirmDialog.loan.category === 'Loan Given' ? 'add' : 'deduct'} ${confirmDialog.loan.amount} ${confirmDialog.loan.currency} ${confirmDialog.loan.category === 'Loan Given' ? 'to' : 'from'} your account to reflect the repayment.`
            : 'This will permanently delete the transaction and update your account balance accordingly.'
        }
        confirmText={confirmDialog?.loan ? 'Mark as Repaid' : 'Delete'}
        onConfirm={confirmDialog?.loan ? confirmRepayLoan : confirmDelete}
        onCancel={() => setConfirmDialog(null)}
        type={confirmDialog?.loan ? 'info' : 'danger'}
      />
    </div>
  );
};

export default Dashboard;