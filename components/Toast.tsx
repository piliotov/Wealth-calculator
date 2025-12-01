import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const styles = {
    success: 'bg-emerald-500/90 text-white border-emerald-400',
    error: 'bg-red-500/90 text-white border-red-400',
    warning: 'bg-amber-500/90 text-white border-amber-400',
    info: 'bg-blue-500/90 text-white border-blue-400'
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border ${styles[type]} backdrop-blur-sm animate-slide-in`}>
      {icons[type]}
      <p className="flex-1 font-medium text-sm">{message}</p>
      <button 
        onClick={onClose}
        className="hover:bg-white/20 rounded-full p-1 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
