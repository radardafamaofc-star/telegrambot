import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  apiId: number | null;
  apiHash: string | null;
  sessionString: string | null;
  isAuthenticated: boolean;
  setAuth: (apiId: number, apiHash: string, sessionString: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiId: null,
      apiHash: null,
      sessionString: null,
      isAuthenticated: false,
      setAuth: (apiId, apiHash, sessionString) => 
        set({ apiId, apiHash, sessionString, isAuthenticated: true }),
      logout: () => 
        set({ apiId: null, apiHash: null, sessionString: null, isAuthenticated: false }),
    }),
    {
      name: 'tg-auth-storage',
    }
  )
);
