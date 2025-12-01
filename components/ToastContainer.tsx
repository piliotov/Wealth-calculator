import React, { useState, useCallback } from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastMessage extends Omit<ToastProps, 'onClose'> {
  id: number;
}

interface ToastContextType {
  showToast: (message: string, type: ToastProps['type']) => void;
}

export const ToastContext = React.createContext<ToastContextType>({
  showToast: () => {}
});

export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastProps['type']) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastContainer');
  }
  return context;
};
