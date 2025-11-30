import React, { useMemo, useState } from 'react';
import { Transaction, Account, EXCHANGE_RATES, TransactionType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, Building2, Pencil, X, Save } from 'lucide-react';
import { updateTransaction } from '../services/localDb';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onUpdate: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<Props> = ({ transactions, accounts, onUpdate }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
  const stats = useMemo(() => {
    // 1. Calculate Net Worth in EUR
    let totalNetWorthEUR = 0;
    accounts.forEach(acc => {
      const rate = acc.currency === 'BGN' ? (1/EXCHANGE_RATES.BGN) : acc.currency === 'USD' ? (1/EXCHANGE_RATES.USD) : 1;
      totalNetWorthEUR += acc.balance * rate;
    });

    // 2. Recent Spending stats (Last 30 days) - Displayed in EUR approximation for aggregate
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => {
      const rate = t.currency === 'BGN' ? (1/EXCHANGE_RATES.BGN) : t.currency === 'USD' ? (1/EXCHANGE_RATES.USD) : 1;
      return acc + (t.amount * rate);
    }, 0);
    
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      const rate = t.currency === 'BGN' ? (1/EXCHANGE_RATES.BGN) : t.currency === 'USD' ? (1/EXCHANGE_RATES.USD) : 1;
      return acc + (t.amount * rate);
    }, 0);

    // 3. Category Breakdown (Expenses)
    const categories: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const rate = t.currency === 'BGN' ? (1/EXCHANGE_RATES.BGN) : t.currency === 'USD' ? (1/EXCHANGE_RATES.USD) : 1;
      categories[t.category] = (categories[t.category] || 0) + (t.amount * rate);
    });
    
    const pieData = Object.entries(categories).map(([name, value]) => ({ name, value }));

    // 4. Timeline Data
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningWorth = totalNetWorthEUR; 
    const historyPoints = [];
    const reversedTx = [...sortedTx].reverse();
    
    historyPoints.push({ date: new Date().toLocaleDateString(), balance: runningWorth });

    for (const t of reversedTx) {
      const rate = t.currency === 'BGN' ? (1/EXCHANGE_RATES.BGN) : t.currency === 'USD' ? (1/EXCHANGE_RATES.USD) : 1;
      if (t.type === 'income') runningWorth -= (t.amount * rate);
      else runningWorth += (t.amount * rate);
      
      historyPoints.push({ date: new Date(t.date).toLocaleDateString(), balance: runningWorth });
    }
    
    return { 
      income, 
      expenses, 
      netWorthEUR: totalNetWorthEUR, 
      pieData, 
      chartData: historyPoints.reverse() 
    };
  }, [transactions, accounts]);

  const formatEUR = (val: number) => 
    new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }).format(val);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTx) {
        await updateTransaction(editingTx.userId, editingTx);
        setEditingTx(null);
        onUpdate();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Account Breakdown Cards */}
      <h3 className="text-lg font-semibold text-white">Accounts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-surface p-4 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">{acc.name}</p>
              <p className="text-xs text-slate-500">{acc.type}</p>
              <h2 className="text-xl font-bold text-white mt-1">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.currency }).format(acc.balance)}
              </h2>
            </div>
            <div className="p-3 bg-slate-800 rounded-full">
              <Building2 className="text-primary w-6 h-6" />
            </div>
          </div>
        ))}
        {/* Total Net Worth Card */}
         <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-4 rounded-xl border border-indigo-500/30 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-indigo-300 text-xs uppercase tracking-wider font-bold">Total Net Worth</p>
              <p className="text-xs text-indigo-400/70">Estimated in EUR</p>
              <h2 className="text-2xl font-bold text-white mt-1">
                {formatEUR(stats.netWorthEUR)}
              </h2>
            </div>
            <div className="p-3 bg-indigo-500/20 rounded-full">
              <Wallet className="text-indigo-400 w-6 h-6" />
            </div>
          </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        
        {/* Net Worth Chart */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Net Worth Trend (EUR)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `€${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
                  formatter={(value: number) => formatEUR(value)}
                />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Expense Distribution</h3>
          <div className="h-64 w-full flex items-center justify-center">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={false} // HIDDEN to prevent unreadable black text
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
                     formatter={(value: number) => formatEUR(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500">No expenses recorded yet.</p>
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {stats.pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-300">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List with Edit Capability */}
      <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
            <h3 className="font-semibold text-sm text-slate-300">Detailed Activity</h3>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
            {transactions.map(t => (
            <div key={t.id} className="p-4 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors group">
                <div className="flex justify-between items-center">
                <div className="flex-1">
                    <p className="text-white text-sm font-medium">{t.category}</p>
                    <p className="text-xs text-slate-500">{t.description || 'No description'}</p>
                    <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 bg-slate-800 px-1.5 rounded">
                        {accounts.find(a => a.id === t.accountId)?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-600">{new Date(t.date).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} {t.currency}
                    </span>
                    <button 
                        onClick={() => setEditingTx(t)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-white transition-opacity bg-slate-800 rounded-full"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                </div>
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-surface border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Edit Transaction</h3>
                    <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleEditSave} className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Amount ({editingTx.currency})</label>
                        <input 
                            type="number" step="0.01" 
                            value={editingTx.amount}
                            onChange={(e) => setEditingTx({...editingTx, amount: parseFloat(e.target.value)})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">Modifying amount updates account balance.</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Description</label>
                        <input 
                            type="text" 
                            value={editingTx.description}
                            onChange={(e) => setEditingTx({...editingTx, description: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Category</label>
                        <input 
                            type="text" 
                            value={editingTx.category}
                            onChange={(e) => setEditingTx({...editingTx, category: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                        />
                    </div>
                    
                    <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white py-2 rounded-lg flex justify-center items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;