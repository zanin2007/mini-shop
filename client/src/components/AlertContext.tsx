/**
 * 전역 알림 시스템 (Context API)
 * - showAlert: 토스트 알림 (success/error/info/warning), 3초 후 자동 사라짐, 우측 상단
 * - showConfirm: 확인/취소 모달, Promise<boolean> 반환
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { AlertContext } from './useAlert';
import type { AlertType } from './useAlert';
import './Alert.css';

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

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({ show: false, message: '', resolve: null });
  const idRef = useRef(0);

  const timerMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // unmount 시 남은 토스트 타이머 정리
  useEffect(() => {
    const map = timerMap.current;
    return () => {
      map.forEach(timer => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const showAlert = useCallback((message: string, type: AlertType = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timerMap.current.delete(id);
    }, 3000);
    timerMap.current.set(id, timer);
  }, []);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirm({ show: true, message, resolve });
    });
  }, []);

  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  confirmResolveRef.current = confirm.resolve;

  const handleConfirm = useCallback((result: boolean) => {
    confirmResolveRef.current?.(result);
    setConfirm({ show: false, message: '', resolve: null });
  }, []);

  // ESC 키로 확인 모달 닫기
  useEffect(() => {
    if (!confirm.show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirm.show, handleConfirm]);

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
              onClick={() => {
                const timer = timerMap.current.get(toast.id);
                if (timer) { clearTimeout(timer); timerMap.current.delete(toast.id); }
                setToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
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
