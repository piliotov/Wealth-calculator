import React, { useMemo } from 'react';
import { PieChart, TrendingUp, TrendingDown, Wallet, AlertTriangle, Sparkles, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Account, Transaction } from '../types';

interface Props {
  accounts: Account[];
  transactions: Transaction[];
}

const FinancialInsights: React.FC<Props> = ({ accounts, transactions }) => {
  const insights = useMemo(() => {
    // Total balances
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    // Get last 30 days of transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTx = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
    
    // Calculate income and expenses
    const income = recentTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = recentTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Savings rate
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    // Category breakdown
    const categoryBreakdown = recentTx
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
    
    // Top spending categories
    const topCategories = Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5) as [string, number][];
    
    // Average daily spending
    const avgDailySpending = expenses / 30;
    
    // Projected monthly expenses
    const projectedMonthly = avgDailySpending * 30;
    
    // Month over month comparison (simplified)
    const prevMonthStart = new Date();
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    prevMonthStart.setDate(1);
    
    const prevMonthEnd = new Date();
    prevMonthEnd.setDate(0);
    
    const prevMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });
    
    const prevMonthExpenses = prevMonthTx
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenseChange = prevMonthExpenses > 0 
      ? ((expenses - prevMonthExpenses) / prevMonthExpenses) * 100 
      : 0;
    
    // Find largest expense
    const largestExpense = recentTx
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)[0];
    
    // Account health scores
    const accountHealth = accounts.map(acc => ({
      name: acc.name,
      balance: acc.balance,
      health: acc.balance > 1000 ? 'good' : acc.balance > 0 ? 'warning' : 'critical'
    }));
    
    return {
      totalBalance,
      income,
      expenses,
      savingsRate,
      topCategories,
      avgDailySpending,
      projectedMonthly,
      expenseChange,
      largestExpense,
      accountHealth,
      transactionCount: recentTx.length,
    };
  }, [accounts, transactions]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(amount);

  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
      'Food & Dining': '🍔',
      'Transportation': '🚗',
      'Shopping': '🛍️',
      'Entertainment': '🎬',
      'Bills & Utilities': '📱',
      'Healthcare': '🏥',
      'Travel': '✈️',
      'Education': '📚',
      'Personal': '👤',
      'Groceries': '🛒',
      'Rent': '🏠',
      'Salary': '💼',
      'Freelance': '💻',
      'Investment': '📈',
      'Transfer': '🔄',
      'Other': '📌',
    };
    return emojis[category] || '📌';
  };

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-700">
      <div className="flex items-center gap-2 mb-6">
        <PieChart className="w-6 h-6 text-amber-400" />
        <h2 className="text-xl font-bold text-white">Financial Insights</h2>
        <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">Last 30 Days</span>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Not enough data for insights</p>
          <p className="text-sm text-slate-500">Add some transactions to see your financial analysis</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Total Balance</p>
              <p className={`text-lg font-bold ${insights.totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(insights.totalBalance)}
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Income</p>
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(insights.income)}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Expenses</p>
              <p className="text-lg font-bold text-red-400">{formatCurrency(insights.expenses)}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Savings Rate</p>
              <p className={`text-lg font-bold ${insights.savingsRate >= 20 ? 'text-emerald-400' : insights.savingsRate >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {insights.savingsRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Savings Rate Indicator */}
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

          {/* Expense Change */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">vs Last Month</p>
                <p className="text-lg font-semibold text-white">Spending Change</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                insights.expenseChange > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {insights.expenseChange > 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                <span className="text-lg font-bold">{Math.abs(insights.expenseChange).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Top Spending Categories */}
          {insights.topCategories.length > 0 && (
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm text-slate-400 mb-3">Top Spending Categories</h3>
              <div className="space-y-3">
                {insights.topCategories.map(([category, amount], idx) => {
                  const percentage = (amount / insights.expenses) * 100;
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white flex items-center gap-2">
                          <span>{getCategoryEmoji(category)}</span>
                          {category}
                        </span>
                        <span className="text-slate-400">
                          {formatCurrency(amount)} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            idx === 0 ? 'bg-gradient-to-r from-violet-500 to-purple-500' :
                            idx === 1 ? 'bg-gradient-to-r from-indigo-500 to-blue-500' :
                            idx === 2 ? 'bg-gradient-to-r from-cyan-500 to-teal-500' :
                            idx === 3 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                            'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Wallet size={16} />
                <span className="text-xs">Avg Daily Spending</span>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(insights.avgDailySpending)}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Target size={16} />
                <span className="text-xs">Transactions</span>
              </div>
              <p className="text-xl font-bold text-white">{insights.transactionCount}</p>
            </div>
          </div>

          {/* Largest Expense Alert */}
          {insights.largestExpense && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Largest Expense</span>
              </div>
              <p className="text-white">
                <span className="font-semibold">{formatCurrency(insights.largestExpense.amount)}</span>
                <span className="text-slate-400"> on {insights.largestExpense.description} ({insights.largestExpense.category})</span>
              </p>
            </div>
          )}

          {/* Account Health */}
          {insights.accountHealth.some(acc => acc.health !== 'good') && (
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-sm text-slate-400 mb-3">Account Health</h3>
              <div className="space-y-2">
                {insights.accountHealth.map(acc => (
                  <div key={acc.name} className="flex items-center justify-between">
                    <span className="text-white">{acc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{formatCurrency(acc.balance)}</span>
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
              <Sparkles className="w-5 h-5 text-indigo-400" />
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
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialInsights;
