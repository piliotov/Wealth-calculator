import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, TrendingUp, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from './ToastContainer';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../services/api';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: 'EUR' | 'BGN' | 'USD';
  deadline?: string;
  category: string;
  color: string;
  createdAt: string;
}

interface Props {
  userId: string;
}

const GOAL_CATEGORIES = [
  { name: 'Emergency Fund', icon: '🛡️', color: 'from-red-500 to-orange-500' },
  { name: 'Vacation', icon: '✈️', color: 'from-cyan-500 to-blue-500' },
  { name: 'New Car', icon: '🚗', color: 'from-purple-500 to-pink-500' },
  { name: 'House Down Payment', icon: '🏠', color: 'from-green-500 to-emerald-500' },
  { name: 'Education', icon: '📚', color: 'from-yellow-500 to-orange-500' },
  { name: 'Investment', icon: '📈', color: 'from-indigo-500 to-violet-500' },
  { name: 'Gadgets', icon: '💻', color: 'from-slate-500 to-slate-600' },
  { name: 'Other', icon: '🎯', color: 'from-pink-500 to-rose-500' },
];

const GoalsTracker: React.FC<Props> = ({ userId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    currency: 'EUR' as const,
    deadline: '',
    category: 'Emergency Fund',
  });
  const { showToast } = useToast();

  // Load goals from server, with localStorage fallback for migration
  useEffect(() => {
    const loadGoals = async () => {
      setLoading(true);
      try {
        const serverGoals = await getGoals();
        
        // If server has no goals, check localStorage for migration
        if (serverGoals.length === 0) {
          const saved = localStorage.getItem(`goals_${userId}`);
          if (saved) {
            const localGoals: Goal[] = JSON.parse(saved);
            // Migrate local goals to server
            for (const goal of localGoals) {
              const category = GOAL_CATEGORIES.find(c => c.name === goal.category) || GOAL_CATEGORIES[0];
              try {
                await createGoal({
                  name: goal.name,
                  targetAmount: goal.targetAmount,
                  currentAmount: goal.currentAmount,
                  currency: goal.currency,
                  deadline: goal.deadline || null,
                  category: goal.category,
                  color: category.color,
                });
              } catch (err) {
                console.warn('Failed to migrate goal:', goal.name, err);
              }
            }
            // Re-fetch from server after migration
            const migrated = await getGoals();
            setGoals(migrated as Goal[]);
            // Clear localStorage after successful migration
            localStorage.removeItem(`goals_${userId}`);
            if (localGoals.length > 0) {
              showToast('Goals synced to cloud ☁️', 'success');
            }
          } else {
            setGoals([]);
          }
        } else {
          setGoals(serverGoals as Goal[]);
          // Clean up any stale localStorage
          localStorage.removeItem(`goals_${userId}`);
        }
      } catch (err) {
        console.error('Failed to load goals:', err);
        // Fallback to localStorage if server fails
        const saved = localStorage.getItem(`goals_${userId}`);
        if (saved) setGoals(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };
    loadGoals();
  }, [userId]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.targetAmount) return;

    const category = GOAL_CATEGORIES.find(c => c.name === newGoal.category) || GOAL_CATEGORIES[0];
    
    try {
      const created = await createGoal({
        name: newGoal.name,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: parseFloat(newGoal.currentAmount) || 0,
        currency: newGoal.currency,
        deadline: newGoal.deadline || null,
        category: newGoal.category,
        color: category.color,
      });
      
      setGoals(prev => [created as Goal, ...prev]);
      setNewGoal({ name: '', targetAmount: '', currentAmount: '', currency: 'EUR', deadline: '', category: 'Emergency Fund' });
      setShowForm(false);
      showToast('Goal created! 🎯', 'success');
    } catch (err) {
      showToast('Failed to create goal', 'error');
    }
  };

  const handleUpdateProgress = async (goalId: string, newAmount: number) => {
    try {
      await updateGoal(goalId, { currentAmount: Math.max(0, newAmount) });
      setGoals(prev => prev.map(g => 
        g.id === goalId ? { ...g, currentAmount: Math.max(0, newAmount) } : g
      ));
    } catch (err) {
      showToast('Failed to update goal', 'error');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      setGoals(prev => prev.filter(g => g.id !== goalId));
      showToast('Goal deleted', 'success');
    } catch (err) {
      showToast('Failed to delete goal', 'error');
    }
  };

  const formatCurrency = (amount: number, currency: string) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-indigo-400" />
          Savings Goals
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          New Goal
        </button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <form onSubmit={handleAddGoal} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Goal Name</label>
              <input
                type="text"
                required
                value={newGoal.name}
                onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                placeholder="e.g., Summer Vacation"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={newGoal.category}
                onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                {GOAL_CATEGORIES.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Amount</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={newGoal.targetAmount}
                onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                placeholder="5000"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Already Saved</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newGoal.currentAmount}
                onChange={(e) => setNewGoal({ ...newGoal, currentAmount: e.target.value })}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select
                value={newGoal.currency}
                onChange={(e) => setNewGoal({ ...newGoal, currency: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="EUR">EUR</option>
                <option value="BGN">BGN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Target Date (Optional)</label>
            <input
              type="date"
              value={newGoal.deadline}
              onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              Create Goal
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 mx-auto mb-4 animate-spin" />
          <p className="text-slate-400">Loading goals...</p>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No savings goals yet</p>
          <p className="text-sm text-slate-500">Create your first goal to start tracking!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const category = GOAL_CATEGORIES.find(c => c.name === goal.category) || GOAL_CATEGORIES[0];
            const isComplete = goal.currentAmount >= goal.targetAmount;
            
            return (
              <div key={goal.id} className={`bg-slate-900/50 p-4 rounded-lg border ${isComplete ? 'border-emerald-500/50' : 'border-slate-700'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${goal.color} flex items-center justify-center text-lg`}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {goal.name}
                        {isComplete && <span className="text-emerald-400">✓</span>}
                      </h3>
                      <p className="text-xs text-slate-400">{goal.category}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">
                      {formatCurrency(goal.currentAmount, goal.currency)} of {formatCurrency(goal.targetAmount, goal.currency)}
                    </span>
                    <span className={`font-medium ${isComplete ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${isComplete ? 'from-emerald-500 to-green-500' : goal.color} transition-all duration-500`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  {goal.deadline && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar size={12} />
                      {getDaysRemaining(goal.deadline)}
                    </div>
                  )}
                  
                  {!isComplete && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => handleUpdateProgress(goal.id, goal.currentAmount + 50)}
                        className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                      >
                        +50
                      </button>
                      <button
                        onClick={() => handleUpdateProgress(goal.id, goal.currentAmount + 100)}
                        className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                      >
                        +100
                      </button>
                      <button
                        onClick={() => {
                          const amount = prompt('Enter amount to add:');
                          if (amount) handleUpdateProgress(goal.id, goal.currentAmount + parseFloat(amount));
                        }}
                        className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                      >
                        <TrendingUp size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GoalsTracker;
