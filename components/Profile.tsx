import React, { useState } from 'react';
import { Account, User } from '../types';
import { Settings, Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import { createAccount, updateAccountBalance, deleteAccount } from '../services/api';
import { useToast } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  user: User;
  accounts: Account[];
  onUpdate: () => void;
}

const Profile: React.FC<Props> = ({ user, accounts, onUpdate }) => {
  // New Account State
  const [newAccName, setNewAccName] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState<'EUR' | 'BGN' | 'USD'>('EUR');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<string>('');
  
  // Confirm Dialog
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;
    await createAccount(newAccName, newAccCurrency);
    setNewAccName('');
    onUpdate();
    showToast(`Account "${newAccName}" created successfully`, 'success');
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAccount = async () => {
    if (confirmDelete) {
      await deleteAccount(confirmDelete);
      onUpdate();
      showToast('Account deleted successfully', 'success');
      setConfirmDelete(null);
    }
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditBalance(acc.balance.toString());
  };

  const saveBalance = async (id: string) => {
    await updateAccountBalance(id, parseFloat(editBalance));
    setEditingId(null);
    onUpdate();
    showToast('Balance updated successfully', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-surface p-6 rounded-xl border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
             <span className="text-2xl font-bold text-slate-300">{user.username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.username}</h2>
            <p className="text-slate-400">Account Settings</p>
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="bg-surface p-6 rounded-xl border border-slate-700">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Manage Accounts
        </h3>

        {/* List */}
        <div className="space-y-4 mb-8">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                    {acc.currency}
                 </div>
                 <div>
                    <h4 className="font-semibold text-white">{acc.name}</h4>
                    <p className="text-xs text-slate-500 uppercase">{acc.type}</p>
                 </div>
              </div>

              <div className="flex items-center gap-4">
                {editingId === acc.id ? (
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={editBalance}
                            onChange={(e) => setEditBalance(e.target.value)}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white w-32"
                        />
                        <button onClick={() => saveBalance(acc.id)} className="p-2 bg-emerald-600 rounded text-white hover:bg-emerald-700">
                            <Save size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="text-right mr-4">
                        <p className="text-sm text-slate-400">Balance</p>
                        <p className="font-mono text-white">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                        </p>
                    </div>
                )}
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => startEdit(acc)}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        title="Reconcile Balance"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button 
                        onClick={() => handleDelete(acc.id)}
                        className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add New */}
        <form onSubmit={handleCreateAccount} className="bg-slate-900/50 p-4 rounded-lg border border-dashed border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Add New Account</h4>
            <div className="flex flex-col md:flex-row gap-3">
                <input 
                    type="text" 
                    placeholder="Account Name (e.g. Cash USD)" 
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
                <select 
                    value={newAccCurrency}
                    onChange={(e) => setNewAccCurrency(e.target.value as any)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                    <option value="EUR">EUR</option>
                    <option value="BGN">BGN</option>
                    <option value="USD">USD</option>
                </select>
                <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <Plus size={18} />
                    Add
                </button>
            </div>
        </form>
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Account?"
        message="Are you sure you want to delete this account? Transactions will remain but will be unlinked from this account."
        confirmText="Delete Account"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setConfirmDelete(null)}
        type="danger"
      />
    </div>
  );
};

export default Profile;