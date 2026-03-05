import { createContext, useContext } from 'react';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (message: string) => Promise<boolean>;
}

export const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
