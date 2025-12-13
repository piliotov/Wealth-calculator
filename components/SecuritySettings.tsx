import React, { useState, useEffect } from 'react';
import { Shield, Key, Lock, Check, X, AlertTriangle } from 'lucide-react';
import { generateTOTPSecret, generateQRCode, verifyTOTP, is2FAEnabled, enable2FA, disable2FA } from '../services/twoFactor';
import { generateSalt, getStoredSalt, storeSalt } from '../services/encryption';
import { useToast } from './ToastContainer';

// Helper to get auth token
const getAuthToken = () => localStorage.getItem('auth_token');

interface Props {
  userId: string;
}

const SecuritySettings: React.FC<Props> = ({ userId }) => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupStep, setSetupStep] = useState<'qr' | 'verify'>('qr');
  const { showToast } = useToast();

  useEffect(() => {
    setTwoFactorEnabled(is2FAEnabled());
    setEncryptionEnabled(!!getStoredSalt());
  }, []);

  const handleEnable2FA = async () => {
    try {
      const { secret, uri } = generateTOTPSecret(`user_${userId}`);
      setTotpSecret(secret);
      
      const qrUrl = await generateQRCode(uri);
      setQrCodeUrl(qrUrl);
      
      setShowSetup2FA(true);
      setSetupStep('qr');
    } catch (error: any) {
      showToast(error.message || 'Failed to setup 2FA', 'error');
    }
  };

  const handleVerify2FA = async () => {
    if (!verifyTOTP(verificationCode, totpSecret)) {
      showToast('Invalid code. Please try again.', 'error');
      return;
    }

    try {
      // Store encrypted secret locally
      enable2FA(totpSecret); // In production, encrypt this
      
      // Enable on server
      const response = await fetch('/api/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ totpSecret })
      });

      if (!response.ok) throw new Error('Failed to enable 2FA');

      setTwoFactorEnabled(true);
      setShowSetup2FA(false);
      setVerificationCode('');
      showToast('Two-factor authentication enabled!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to enable 2FA', 'error');
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) return;

    try {
      const response = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) throw new Error('Failed to disable 2FA');

      disable2FA();
      setTwoFactorEnabled(false);
      showToast('Two-factor authentication disabled', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to disable 2FA', 'error');
    }
  };

  const handleEnableEncryption = async () => {
    try {
      const salt = generateSalt();
      
      // Store salt on server
      const response = await fetch('/api/encryption/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ salt })
      });

      if (!response.ok) throw new Error('Failed to setup encryption');

      storeSalt(salt);
      setEncryptionEnabled(true);
      showToast('End-to-end encryption enabled! Your data is now encrypted on your device.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to enable encryption', 'error');
    }
  };

  return (
    <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50 space-y-4">
      <h3 className="text-base font-medium text-white flex items-center gap-2">
        <Shield className="w-4 h-4 text-teal-500" />
        Security & Privacy
      </h3>

      {/* End-to-End Encryption */}
      <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-500" />
            <div>
              <h4 className="font-medium text-white">End-to-End Encryption</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Encrypt your data on your device before sending to server
              </p>
            </div>
          </div>
          {encryptionEnabled && (
            <span className="flex items-center gap-1 text-xs text-teal-400 bg-teal-500/20 px-2 py-1 rounded-md">
              <Check className="w-3 h-3" />
              Active
            </span>
          )}
        </div>
        
        {!encryptionEnabled ? (
          <div className="mt-3">
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">
                Your financial data is currently stored unencrypted on the server. Enable E2E encryption to protect your privacy.
              </p>
            </div>
            <button
              onClick={handleEnableEncryption}
              className="w-full h-10 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg font-medium"
            >
              Enable Encryption
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2">
            ✓ All your transactions and accounts are encrypted with your password
          </p>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-500" />
            <div>
              <h4 className="font-medium text-white">Two-Factor Authentication</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Add an extra layer of security with TOTP (Google Authenticator)
              </p>
            </div>
          </div>
          {twoFactorEnabled && (
            <span className="flex items-center gap-1 text-xs text-teal-400 bg-teal-500/20 px-2 py-1 rounded-md">
              <Check className="w-3 h-3" />
              Active
            </span>
          )}
        </div>

        {!twoFactorEnabled ? (
          <button
            onClick={handleEnable2FA}
            className="mt-3 w-full h-10 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg font-medium"
          >
            Enable 2FA
          </button>
        ) : (
          <button
            onClick={handleDisable2FA}
            className="mt-3 w-full h-10 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium"
          >
            Disable 2FA
          </button>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {showSetup2FA && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Setup Two-Factor Authentication</h3>
              <button onClick={() => setShowSetup2FA(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {setupStep === 'qr' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                
                <div className="bg-white p-4 rounded-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-full" />
                </div>

                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Or enter this code manually:</p>
                  <code className="text-sm text-teal-400 font-mono">{totpSecret}</code>
                </div>

                <button
                  onClick={() => setSetupStep('verify')}
                  className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
                >
                  Continue
                </button>
              </div>
            )}

            {setupStep === 'verify' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Enter the 6-digit code from your authenticator app to verify:
                </p>

                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-14 bg-slate-800/50 border border-slate-700 rounded-lg px-4 text-white text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setSetupStep('qr')}
                    className="flex-1 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerify2FA}
                    disabled={verificationCode.length !== 6}
                    className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySettings;
