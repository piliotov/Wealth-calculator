import React, { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import FloatingAIChat from './components/AIChat';
import SalaryCalculator from './components/SalaryCalculator';
import Profile from './components/Profile';
import { getCurrentUser, logoutUser, getTransactions, addTransaction, getAccounts } from './services/localDb';
import { User, Transaction, Account, AppView } from './types';
import { LayoutDashboard, LogOut, Receipt, Calculator, User as UserIcon } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadData(currentUser.id);
    }
  }, []);

  const loadData = async (userId: string) => {
    const tx = await getTransactions(userId);
    const acc = await getAccounts(userId);
    setTransactions(tx);
    setAccounts(acc);
  };

  useEffect(() => {
    if (user) {
      loadData(user.id);
    }
  }, [user, refreshKey]);

  const handleLogin = (u: User) => {
    setUser(u);
    loadData(u.id);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  const handleAddTransaction = async (data: any) => {
    if (!user) return;
    await addTransaction(user.id, data);
    setRefreshKey(prev => prev + 1);
  };

  // Nav Button Component
  const NavBtn = ({ target, icon: Icon, label }: { target: AppView, icon: any, label: string }) => (
    <button
      onClick={() => setView(target)}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
        view === target ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} />
        {label}
      </div>
    </button>
  );

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-slate-100 font-sans">
      {/* Navbar */}
      <nav className="border-b border-slate-700 bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView(AppView.DASHBOARD)}>
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Receipt className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">WealthTracker AI</span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex gap-1 bg-slate-800 p-1 rounded-lg">
                <NavBtn target={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
                <NavBtn target={AppView.CALCULATOR} icon={Calculator} label="Salary" />
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView(AppView.PROFILE)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${view === AppView.PROFILE ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <UserIcon size={18} />
                  <span className="hidden sm:block">{user.username}</span>
                </button>
                <div className="h-6 w-px bg-slate-700"></div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* VIEW: DASHBOARD */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 ${view === AppView.DASHBOARD ? 'block' : 'hidden'}`}>
          <div className="lg:col-span-4 space-y-6">
               <TransactionForm accounts={accounts} onAdd={handleAddTransaction} />
          </div>
          <div className="lg:col-span-8">
            <Dashboard 
                transactions={transactions} 
                accounts={accounts} 
                onUpdate={() => setRefreshKey(prev => prev + 1)}
            />
          </div>
        </div>

        {/* VIEW: CALCULATOR */}
        <div className={view === AppView.CALCULATOR ? 'block' : 'hidden'}>
            <SalaryCalculator accounts={accounts} onAddIncome={handleAddTransaction} />
        </div>

        {/* VIEW: PROFILE */}
        <div className={view === AppView.PROFILE ? 'block' : 'hidden'}>
            <Profile user={user} accounts={accounts} onUpdate={() => setRefreshKey(k => k + 1)} />
        </div>

        {/* FLOATING AI CHAT (Always rendered, fixed position) */}
        <FloatingAIChat user={user} accounts={accounts} />

      </main>
    </div>
  );
};

export default App;