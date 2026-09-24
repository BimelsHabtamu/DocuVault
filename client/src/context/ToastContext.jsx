import { createContext, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = useTranslation(['translation', 'layout']);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon" aria-hidden="true">{toast.type === 'error' ? '\u2715' : '\u2713'}</span>
            {t(toast.message)}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
