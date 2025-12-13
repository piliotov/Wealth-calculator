import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/api';
import { User } from '../types';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { verifyTOTP } from '../services/twoFactor';

interface Props {
  onLogin: (user: User) => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isRegister) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError('Include at least one uppercase letter');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError('Include at least one number');
        return;
      }
    }
    
    setLoading(true);

    try {
      const result = isRegister 
        ? await registerUser(username, password)
        : await loginUser(username, password);
      
      // Check if user has 2FA enabled
      const token = localStorage.getItem('auth_token');
      const statusResponse = await fetch('/api/2fa/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.enabled && !isRegister) {
          // User has 2FA enabled, prompt for code
          setPendingUser(result.user);
          setNeeds2FA(true);
          setLoading(false);
          return;
        }
      }
      
      onLogin(result.user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: totpCode })
      });

      if (!response.ok) {
        throw new Error('Invalid 2FA code');
      }

      if (pendingUser) {
        onLogin(pendingUser);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid 2FA code');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  if (needs2FA) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 mb-4">
                <Shield className="w-7 h-7 text-teal-500" />
              </div>
              <h1 className="text-2xl font-semibold text-white">Two-Factor Authentication</h1>
              <p className="mt-1 text-slate-400 text-sm">Enter the code from your authenticator app</p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
              <form onSubmit={handleVerify2FA} className="space-y-5">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    placeholder="000000"
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNeeds2FA(false);
                    setPendingUser(null);
                    setTotpCode('');
                    setError('');
                    localStorage.removeItem('auth_token');
                  }}
                  className="w-full text-slate-400 hover:text-white text-sm py-2"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top section */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h1 className="text-2xl font-semibold text-white">ProsperPilot</h1>
            <p className="mt-1 text-slate-400 text-sm">Manage your money, simply</p>
          </div>

          {/* Form */}
          <div className="bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your username"
                  autoComplete="username webauthn"
                  autoCapitalize="off"
                  autoCorrect="off"
                  name="username"
                  id="username"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    name="password"
                    id="password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {isRegister && (
                  <p className="mt-2 text-xs text-slate-500">
                    Min 8 chars, one uppercase, one number
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Please wait...' : (isRegister ? 'Create account' : 'Sign in')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-sm text-slate-400 hover:text-white"
              >
                {isRegister ? 'Already have an account? Sign in' : "New here? Create an account"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <p className="text-xs text-slate-600">Your data stays on your device</p>
      </div>
    </div>
  );
};

export default Auth;