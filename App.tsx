import React, { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransferForm from './components/TransferForm';
import LendingTracker from './components/LendingTracker';
import FloatingAIChat from './components/AIChat';
import SalaryCalculator from './components/SalaryCalculator';
import Profile from './components/Profile';
import MonthlyBudget from './components/MonthlyBudget';
import GoalsTracker from './components/GoalsTracker';
import RecurringTransactions from './components/RecurringTransactions';
import FinancialInsights from './components/FinancialInsights';
import { ToastContainer } from './components/ToastContainer';
import { getCurrentUser, logoutUser, getTransactions, addTransaction, getAccounts, transferMoney, fetchUserProfile } from './services/api';
import { User, Transaction, Account, AppView } from './types';
import { LayoutDashboard, LogOut, Calculator, User as UserIcon, PiggyBank, Target, RefreshCw, PieChart, Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { view: AppView.DASHBOARD, label: 'Home', icon: LayoutDashboard },
    { view: AppView.BUDGET, label: 'Budget', icon: PiggyBank },
    { view: AppView.GOALS, label: 'Goals', icon: Target },
    { view: AppView.RECURRING, label: 'Bills', icon: RefreshCw },
    { view: AppView.INSIGHTS, label: 'Insights', icon: PieChart },
    { view: AppView.CALCULATOR, label: 'Salary', icon: Calculator },
  ];

  const switchView = (v: AppView) => {
    setView(v);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadData(currentUser.id);
      // Load profile details (name, avatar) once token is present
      fetchUserProfile().then(setUser).catch(() => handleLogout());
    }
  }, []);

  const loadData = async (userId: string) => {
    const tx = await getTransactions();
    const acc = await getAccounts();
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

  const handleUserUpdated = (u: User) => {
    setUser(u);
  };

  const handleAddTransaction = async (data: any) => {
    if (!user) return;
    await addTransaction(data);
    setRefreshKey(prev => prev + 1);
  };

  const handleTransfer = async (data: any) => {
    if (!user) return;
    await transferMoney(data);
    setRefreshKey(prev => prev + 1);
  };

  // Nav Button Component
  const NavBtn = ({ target, icon: Icon, label }: { target: AppView, icon: any, label: string }) => (
    <button
      onClick={() => switchView(target)}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        view === target ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <span className="hidden lg:inline">{label}</span>
      </div>
    </button>
  );

  if (!user) {
    return (
      <ToastContainer>
        <Auth onLogin={handleLogin} />
      </ToastContainer>
    );
  }

  return (
    <ToastContainer>
    <div className="min-h-screen bg-background text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button onClick={() => switchView(AppView.DASHBOARD)} className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span className="font-semibold text-white hidden sm:block">ProsperPilot</span>
            </button>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <NavBtn key={item.view} target={item.view} icon={item.icon} label={item.label} />
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => switchView(AppView.PROFILE)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${view === AppView.PROFILE ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <UserIcon size={18} />
                <span className="hidden sm:block max-w-[100px] truncate">{user.fullName || user.username}</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-400 rounded-lg"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900">
            <nav className="px-4 py-3 grid grid-cols-3 gap-2">
              {navItems.map(item => (
                <button
                  key={item.view}
                  onClick={() => switchView(item.view)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                    view === item.view ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-800 active:bg-slate-700'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        
        {/* VIEW: DASHBOARD */}
        <div className={`${view === AppView.DASHBOARD ? 'block' : 'hidden'}`}>
          <div className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
            <div className="lg:col-span-4 space-y-4">
              <TransactionForm accounts={accounts} onAdd={handleAddTransaction} />
              <TransferForm accounts={accounts} onTransfer={handleTransfer} />
              <LendingTracker accounts={accounts} onAddLoan={handleAddTransaction} />
            </div>
            <div className="lg:col-span-8">
              <Dashboard 
                  transactions={transactions} 
                  accounts={accounts} 
                  onUpdate={() => setRefreshKey(prev => prev + 1)}
              />
            </div>
          </div>
        </div>

        {/* VIEW: BUDGET */}
        <div className={view === AppView.BUDGET ? 'block' : 'hidden'}>
            <MonthlyBudget transactions={transactions} />
        </div>

        {/* VIEW: CALCULATOR */}
        <div className={view === AppView.CALCULATOR ? 'block' : 'hidden'}>
            <SalaryCalculator accounts={accounts} onAddIncome={handleAddTransaction} />
        </div>

        {/* VIEW: GOALS */}
        <div className={view === AppView.GOALS ? 'block' : 'hidden'}>
            <GoalsTracker userId={user.id} />
        </div>

        {/* VIEW: RECURRING */}
        <div className={view === AppView.RECURRING ? 'block' : 'hidden'}>
            <RecurringTransactions userId={user.id} />
        </div>

        {/* VIEW: INSIGHTS */}
        <div className={view === AppView.INSIGHTS ? 'block' : 'hidden'}>
            <FinancialInsights accounts={accounts} transactions={transactions} />
        </div>

        {/* VIEW: PROFILE */}
        <div className={view === AppView.PROFILE ? 'block' : 'hidden'}>
          <Profile user={user} accounts={accounts} onUpdate={() => setRefreshKey(k => k + 1)} onUserChange={handleUserUpdated} />
        </div>

        {/* FLOATING AI CHAT (Always rendered, fixed position) */}
        <FloatingAIChat user={user} accounts={accounts} />

      </main>
    </div>
  </ToastContainer>
  );
}

export default App;