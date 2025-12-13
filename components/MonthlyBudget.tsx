import React, { useState, useMemo } from 'react';
import { Transaction, EXCHANGE_RATES } from '../types';
import { Calendar, TrendingDown, AlertCircle, CheckCircle, Edit2, Save, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
  transactions: Transaction[];
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

const MonthlyBudget: React.FC<Props> = ({ transactions }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
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
    
    const monthTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getFullYear() === year && 
             txDate.getMonth() + 1 === month &&
             t.type === 'expense' &&
             t.category !== 'Transfer Out';
    });

    // Calculate spending per category in EUR
    const categorySpending: Record<string, number> = {};
    monthTransactions.forEach(t => {
      const rate = t.currency === 'BGN' ? (1 / EXCHANGE_RATES.BGN) : 
                   t.currency === 'USD' ? (1 / EXCHANGE_RATES.USD) : 1;
      const amountEUR = t.amount * rate;
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
  }, [selectedMonth, transactions, budgets]);

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
              <ResponsiveContainer width="100%" height={300} minWidth={250} minHeight={300}>
                <PieChart>
                  <Pie
                    data={monthlyData.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {monthlyData.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
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
          <div className="mt-4 space-y-1">
            {monthlyData.pieData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="text-white font-mono">€{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyBudget;
