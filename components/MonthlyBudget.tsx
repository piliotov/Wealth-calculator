import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Account, Currency } from '../types';
import { Calendar, TrendingDown, TrendingUp, AlertCircle, CheckCircle, Edit2, Save, X, Wallet, Target, AlertTriangle, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchExchangeRates, toEUR, getExchangeRates, type ExchangeRates } from '../services/exchangeRates';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
}

interface Budget {
  category: string;
  limit: number;
}

const DEFAULT_BUDGETS: Budget[] = [
  { category: 'Shopping', limit: 300 },
  { category: 'Food', limit: 400 },
  { category: 'Transport', limit: 100 },
  { category: 'Entertainment', limit: 150 },
  { category: 'Utilities', limit: 200 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MonthlyBudget: React.FC<Props> = ({ transactions, accounts }) => {
  const [rates, setRates] = useState<ExchangeRates>(getExchangeRates());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchExchangeRates().then(setRates).catch(console.warn);
  }, []);
  
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('monthly_budgets');
    let loadedBudgets = saved ? JSON.parse(saved) : DEFAULT_BUDGETS;
    
    // Migrate old "Groceries" to "Food"
    loadedBudgets = loadedBudgets.map((b: Budget) => 
      b.category === 'Groceries' ? { ...b, category: 'Food' } : b
    );
    
    // Save migrated data
    if (saved && loadedBudgets.some((b: Budget) => b.category === 'Food')) {
      localStorage.setItem('monthly_budgets', JSON.stringify(loadedBudgets));
    }
    
    return loadedBudgets;
  });
  
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Get available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    
    // Add current month if not present
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    months.add(currentMonth);
    
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Calculate spending for selected month
  const monthlyData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    
    // Helper to identify reimbursable transactions (excluded from budget)
    const isReimbursable = (category: string) => category.toLowerCase() === 'reimbursable';
    
    const monthTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getFullYear() === year && 
             txDate.getMonth() + 1 === month &&
             t.type === 'expense' &&
             t.category !== 'Transfer Out' &&
             !isReimbursable(t.category);
    });

    // Calculate spending per category in EUR
    const categorySpending: Record<string, number> = {};
    monthTransactions.forEach(t => {
      const amountEUR = toEUR(t.amount, t.currency as Currency, rates);
      categorySpending[t.category] = (categorySpending[t.category] || 0) + amountEUR;
    });

    // Match with budgets
    const budgetData = budgets.map(budget => {
      const spent = categorySpending[budget.category] || 0;
      const remaining = budget.limit - spent;
      const percentage = (spent / budget.limit) * 100;
      
      return {
        category: budget.category,
        limit: budget.limit,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentage: Math.min(Math.round(percentage), 100),
        status: spent > budget.limit ? 'over' : spent > budget.limit * 0.8 ? 'warning' : 'good'
      };
    });

    // Add categories with spending but no budget
    Object.keys(categorySpending).forEach(category => {
      if (!budgets.find(b => b.category === category)) {
        const spent = categorySpending[category];
        budgetData.push({
          category,
          limit: 0,
          spent: Math.round(spent * 100) / 100,
          remaining: 0,
          percentage: 100,
          status: 'no-budget' as any
        });
      }
    });

    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
    const totalSpent = budgetData.reduce((sum, b) => sum + b.spent, 0);

    // Pie chart data
    const pieData = budgetData
      .filter(b => b.spent > 0)
      .map(b => ({ name: b.category, value: b.spent }));

    return {
      budgetData,
      totalBudget,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalRemaining: Math.round((totalBudget - totalSpent) * 100) / 100,
      pieData
    };
  }, [selectedMonth, transactions, budgets, rates]);

  const handleEditBudget = (category: string, currentLimit: number) => {
    setEditingBudget(category);
    setEditValue(currentLimit.toString());
  };

  const handleSaveBudget = (category: string) => {
    const newLimit = parseFloat(editValue);
    if (isNaN(newLimit) || newLimit < 0) return;
    
    // Check if budget exists for this category
    const existingIndex = budgets.findIndex(b => b.category === category);
    
    let updated;
    if (existingIndex >= 0) {
      // Update existing budget
      updated = budgets.map(b => 
        b.category === category ? { ...b, limit: newLimit } : b
      );
    } else {
      // Add new budget for category
      updated = [...budgets, { category, limit: newLimit }];
    }
    
    setBudgets(updated);
    localStorage.setItem('monthly_budgets', JSON.stringify(updated));
    setEditingBudget(null);
  };

  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }, [selectedMonth]);

  // ===== Financial Insights (merged from FinancialInsights) =====
  const insights = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);

    // Transactions for the selected month
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    const isReimbursable = (category: string) => category.toLowerCase() === 'reimbursable';

    const income = monthTx
      .filter(t => t.type === 'income' && t.category !== 'Transfer In' && !isReimbursable(t.category))
      .reduce((sum, t) => sum + toEUR(t.amount, t.currency as Currency, rates), 0);

    const expenses = monthTx
      .filter(t => t.type === 'expense' && t.category !== 'Transfer Out' && !isReimbursable(t.category))
      .reduce((sum, t) => sum + toEUR(t.amount, t.currency as Currency, rates), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Total balance across all accounts
    const totalBalance = accounts.reduce((sum, acc) => sum + toEUR(acc.balance, acc.currency as Currency, rates), 0);

    // Days in this month for avg daily
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
    const avgDailySpending = daysElapsed > 0 ? expenses / daysElapsed : 0;

    // Previous month comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth;
    });
    const prevMonthExpenses = prevMonthTx
      .filter(t => t.type === 'expense' && t.category !== 'Transfer Out' && !isReimbursable(t.category))
      .reduce((sum, t) => sum + toEUR(t.amount, t.currency as Currency, rates), 0);
    const expenseChange = prevMonthExpenses > 0
      ? ((expenses - prevMonthExpenses) / prevMonthExpenses) * 100
      : 0;

    // Largest expense
    const largestExpense = monthTx
      .filter(t => t.type === 'expense' && t.category !== 'Transfer Out' && !isReimbursable(t.category))
      .sort((a, b) => toEUR(b.amount, b.currency as Currency, rates) - toEUR(a.amount, a.currency as Currency, rates))[0];

    // Top spending categories
    const catBreakdown: Record<string, number> = {};
    monthTx
      .filter(t => t.type === 'expense' && t.category !== 'Transfer Out' && !isReimbursable(t.category))
      .forEach(t => {
        const eur = toEUR(t.amount, t.currency as Currency, rates);
        catBreakdown[t.category] = (catBreakdown[t.category] || 0) + eur;
      });
    const topCategories = Object.entries(catBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Account health
    const accountHealth = accounts.map(acc => {
      const balEUR = toEUR(acc.balance, acc.currency as Currency, rates);
      return {
        name: acc.name,
        balance: acc.balance,
        currency: acc.currency,
        health: balEUR > 1000 ? 'good' as const : balEUR > 0 ? 'warning' as const : 'critical' as const,
      };
    });

    const transactionCount = monthTx.length;

    return { totalBalance, income, expenses, savingsRate, avgDailySpending, expenseChange, largestExpense, topCategories, accountHealth, transactionCount };
  }, [selectedMonth, transactions, accounts, rates]);

  const formatCurrency = (amount: number, currency: string = 'EUR') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const [showInsights, setShowInsights] = useState(true);

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          Monthly Budget Tracker
        </h2>
        
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
        >
          {availableMonths.map(month => {
            const [year, monthNum] = month.split('-');
            const label = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            });
            return <option key={month} value={month}>{label}</option>;
          })}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-white">€{monthlyData.totalBudget.toFixed(2)}</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Spent</p>
          <p className={`text-2xl font-bold ${
            monthlyData.totalSpent > monthlyData.totalBudget ? 'text-red-400' : 'text-emerald-400'
          }`}>€{monthlyData.totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Remaining</p>
          <p className={`text-2xl font-bold ${
            monthlyData.totalRemaining < 0 ? 'text-red-400' : 'text-emerald-400'
          }`}>€{monthlyData.totalRemaining.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Category Budgets
          </h3>
          
          {monthlyData.budgetData.map((item, idx) => (
            <div 
              key={item.category} 
              className="bg-slate-900 p-4 rounded-lg border border-slate-800"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="font-semibold text-white">{item.category}</span>
                  {item.status === 'over' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {item.status === 'good' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                
                {editingBudget === item.category ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveBudget(item.category)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingBudget(null)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">
                      {item.limit > 0 ? `€${item.limit}` : 'No budget'}
                    </span>
                    <button
                      onClick={() => handleEditBudget(item.category, item.limit)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Set budget"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Spent</span>
                  <span className={item.status === 'over' ? 'text-red-400 font-semibold' : 'text-white'}>
                    €{item.spent.toFixed(2)}
                  </span>
                </div>
                
                {item.limit > 0 && (
                  <>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          item.status === 'over' ? 'bg-red-500' :
                          item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{item.percentage}% used</span>
                      <span className={item.remaining < 0 ? 'text-red-400' : ''}>
                        €{Math.abs(item.remaining).toFixed(2)} {item.remaining < 0 ? 'over' : 'left'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Spending Distribution
          </h3>
          
          {monthlyData.pieData.length > 0 ? (
            <div className="min-h-[300px]">
              <ResponsiveContainer width="100%" height={300} minWidth={200} minHeight={300}>
                <PieChart>
                  <Pie
                    data={monthlyData.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {monthlyData.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `€${value.toFixed(2)}`}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              <div className="text-center">
                <TrendingDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No expenses in {monthName}</p>
              </div>
            </div>
          )}
          
          {/* Legend */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {monthlyData.pieData.map((item, idx) => {
              const total = monthlyData.pieData.reduce((s, i) => s + i.value, 0);
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
              return (
                <div key={item.name} className="flex items-center justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-slate-400 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-slate-500">{pct}%</span>
                    <span className="text-white font-mono text-sm">€{item.value.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financial Insights Section */}
      <div className="mt-8">
        <button
          onClick={() => setShowInsights(!showInsights)}
          className="flex items-center gap-2 mb-4 text-left group"
        >
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Financial Insights</h3>
          <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">{monthName}</span>
          <span className={`ml-auto text-slate-500 text-xs transition-transform ${showInsights ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showInsights && (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Total Balance</p>
                <p className={`text-lg font-bold ${insights.totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(insights.totalBalance)}
                </p>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Income</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(insights.income)}</p>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Expenses</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(insights.expenses)}</p>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Savings Rate</p>
                <p className={`text-lg font-bold ${insights.savingsRate >= 20 ? 'text-emerald-400' : insights.savingsRate >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {insights.savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Savings Rate Bar */}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Savings Rate Target: 20%</span>
                <span className={`text-sm font-medium ${insights.savingsRate >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {insights.savingsRate >= 20 ? '🎉 On Track!' : '📈 Room for Improvement'}
                </span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    insights.savingsRate >= 20 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                    insights.savingsRate >= 0 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                    'bg-gradient-to-r from-red-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(insights.savingsRate, 0), 100)}%` }}
                />
              </div>
            </div>

            {/* Expense Change + Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">vs Last Month</p>
                <div className={`flex items-center gap-2 ${
                  insights.expenseChange > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {insights.expenseChange > 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  <span className="text-lg font-bold">{Math.abs(insights.expenseChange).toFixed(1)}%</span>
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Wallet size={14} />
                  <span className="text-xs">Avg Daily Spending</span>
                </div>
                <p className="text-lg font-bold text-white">{formatCurrency(insights.avgDailySpending)}</p>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Target size={14} />
                  <span className="text-xs">Transactions</span>
                </div>
                <p className="text-lg font-bold text-white">{insights.transactionCount}</p>
              </div>
            </div>

            {/* Largest Expense */}
            {insights.largestExpense && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400 font-medium">Largest Expense</span>
                </div>
                <p className="text-white text-sm">
                  <span className="font-semibold">{formatCurrency(insights.largestExpense.amount, insights.largestExpense.currency)}</span>
                  <span className="text-slate-400"> — {insights.largestExpense.description} ({insights.largestExpense.category})</span>
                </p>
              </div>
            )}

            {/* Account Health */}
            {insights.accountHealth.some(a => a.health !== 'good') && (
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h4 className="text-sm text-slate-400 mb-3">Account Health</h4>
                <div className="space-y-2">
                  {insights.accountHealth.map(acc => (
                    <div key={acc.name} className="flex items-center justify-between">
                      <span className="text-white text-sm">{acc.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">{formatCurrency(acc.balance, acc.currency)}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          acc.health === 'good' ? 'bg-emerald-400' :
                          acc.health === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart Tips */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-indigo-400 font-medium">Smart Tips</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {insights.savingsRate < 20 && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Try to save at least 20% of your income for financial security.</span>
                  </li>
                )}
                {insights.topCategories[0] && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Your highest spending is on {insights.topCategories[0][0]}. Consider if there's room to optimize.</span>
                  </li>
                )}
                {insights.expenseChange > 10 && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Your spending increased significantly this month. Review your recent transactions.</span>
                  </li>
                )}
                {insights.avgDailySpending > 100 && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Your daily spending is above €100. Setting a daily budget might help.</span>
                  </li>
                )}
                {insights.savingsRate >= 20 && insights.expenseChange <= 0 && (
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Great job! You're saving well and spending less than last month. Keep it up!</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyBudget;
