import React, { useEffect, useState } from 'react';
import { Account, User } from '../types';
import { Settings, Plus, Trash2, RefreshCw, Save, Image as ImageIcon, User as UserIcon } from 'lucide-react';
import { createAccount, updateAccountBalance, deleteAccount, updateUserProfile } from '../services/api';
import { useToast } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';
import SecuritySettings from './SecuritySettings';

interface Props {
  user: User;
  accounts: Account[];
  onUpdate: () => void;
  onUserChange: (user: User) => void;
}

const Profile: React.FC<Props> = ({ user, accounts, onUpdate, onUserChange }) => {
  // Profile personalization state
  const [fullName, setFullName] = useState(user.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setFullName(user.fullName || '');
    setAvatarUrl(user.avatarUrl || '');
  }, [user.fullName, user.avatarUrl]);

  // New Account State
  const [newAccName, setNewAccName] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState<'EUR' | 'BGN' | 'USD'>('EUR');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<string>('');
  
  // Confirm Dialog
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateUserProfile({
        fullName: fullName.trim() || null,
        avatarUrl: avatarUrl.trim() || null
      });
      onUserChange(updated);
      showToast('Profile updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) {
      showToast('Please enter an account name', 'warning');
      return;
    }
    
    try {
      await createAccount(newAccName, newAccCurrency);
      setNewAccName('');
      onUpdate();
      showToast(`Account "${newAccName}" created successfully`, 'success');
    } catch (error: any) {
      console.error('Failed to create account:', error);
      showToast(error.message || 'Failed to create account', 'error');
    }
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
    <div className="max-w-4xl mx-auto space-y-4 pb-24">
      {/* Profile Card */}
      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center overflow-hidden shrink-0">
             {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
             ) : (
              <span className="text-2xl font-semibold text-slate-300">{(fullName || user.username).charAt(0).toUpperCase()}</span>
             )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-white truncate">{fullName || user.username}</h2>
            <p className="text-sm text-slate-400">Settings & Accounts</p>
          </div>
        </div>
      </div>

      {/* Personalization */}
      <form onSubmit={handleSaveProfile} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50 space-y-4">
        <h3 className="text-base font-medium text-white flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-teal-500" />
          Personal Info
        </h3>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5 text-sm text-slate-400">
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="h-12 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-white text-base"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-400">
            Avatar URL
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 h-12 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-white text-base"
              />
              {avatarUrl && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700/50 flex items-center justify-center shrink-0">
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </label>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="h-12 px-6 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 font-medium"
          >
            <Save size={16} />
            {savingProfile ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>

      {/* Accounts */}
      <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50">
        <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-500" />
            Your Accounts
        </h3>

        {/* Account List */}
        <div className="space-y-3 mb-5">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/30">
              <div className="flex items-center justify-between gap-3 mb-3">
                 <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-slate-600/50 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                      {acc.currency}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-white truncate">{acc.name}</h4>
                      <p className="text-xs text-slate-500">{acc.type}</p>
                    </div>
                 </div>
                 <div className="flex gap-2 shrink-0">
                      <button 
                          onClick={() => startEdit(acc)}
                          className="p-2 text-slate-400 hover:text-white bg-slate-600/50 rounded-lg"
                          title="Edit Balance"
                      >
                          <RefreshCw size={16} />
                      </button>
                      <button 
                          onClick={() => handleDelete(acc.id)}
                          className="p-2 text-slate-400 hover:text-red-400 bg-slate-600/50 rounded-lg"
                      >
                          <Trash2 size={16} />
                      </button>
                  </div>
              </div>

              {editingId === acc.id ? (
                  <div className="flex items-center gap-2">
                      <input 
                          type="number" 
                          step="0.01"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="flex-1 h-12 bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 text-white"
                          placeholder="New balance"
                      />
                      <button onClick={() => saveBalance(acc.id)} className="h-12 px-4 bg-teal-600 rounded-lg text-white hover:bg-teal-700 font-medium">
                          Save
                      </button>
                  </div>
              ) : (
                  <div className="bg-slate-800/50 p-3 rounded-lg">
                      <p className="text-xs text-slate-400 mb-0.5">Current Balance</p>
                      <p className="font-semibold text-white text-lg">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                      </p>
                  </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Account */}
        <form onSubmit={handleCreateAccount} className="bg-slate-700/20 p-4 rounded-lg border border-dashed border-slate-600/50">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Add Account</h4>
            <div className="space-y-3">
                <input 
                    type="text" 
                    placeholder="Account name" 
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full h-12 bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 text-white"
                />
                <div className="flex gap-3">
                  <select 
                      value={newAccCurrency}
                      onChange={(e) => setNewAccCurrency(e.target.value as any)}
                      className="flex-1 h-12 bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 text-white"
                  >
                      <option value="EUR">EUR</option>
                      <option value="BGN">BGN</option>
                      <option value="USD">USD</option>
                  </select>
                  <button type="submit" className="h-12 px-6 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg flex items-center gap-2 font-medium">
                      <Plus size={18} />
                      Add
                  </button>
                </div>
            </div>
        </form>
      </div>

      {/* Security Settings */}
      <SecuritySettings userId={user.id} />

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