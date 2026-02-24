import { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Alert.css';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: AlertType;
  message: string;
}

interface ConfirmState {
  show: boolean;
  message: string;
  resolve: ((value: boolean) => void) | null;
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (message: string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({ show: false, message: '', resolve: null });
  const idRef = useRef(0);

  const showAlert = useCallback((message: string, type: AlertType = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirm({ show: true, message, resolve });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    confirm.resolve?.(result);
    setConfirm({ show: false, message: '', resolve: null });
  };

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'i',
    warning: '!',
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* 토스트 알림 */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">{iconMap[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 확인 모달 */}
      {confirm.show && (
        <div className="confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">?</div>
            <p className="confirm-message">{confirm.message}</p>
            <div className="confirm-buttons">
              <button className="confirm-btn confirm-cancel" onClick={() => handleConfirm(false)}>
                취소
              </button>
              <button className="confirm-btn confirm-ok" onClick={() => handleConfirm(true)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
