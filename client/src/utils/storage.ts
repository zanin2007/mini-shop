import type { User } from '../types';

export const getStoredUser = (): User | null => {
  try {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};
