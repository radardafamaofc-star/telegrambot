import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/lib/queryClient';
import { BACKEND_URL } from '@/lib/backend-url';

interface AuthState {
  apiId: number | null;
  apiHash: string | null;
  sessionString: string | null;
  isAuthenticated: boolean;
  setAuth: (apiId: number, apiHash: string, sessionString: string) => void;
  logout: () => void;
}

async function clearBackendSession() {
  try {
    const base = BACKEND_URL?.replace(/\/+$/, '') || '';
    await fetch(`${base}/api/clear-session`, { method: 'POST' });
  } catch {}
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiId: null,
      apiHash: null,
      sessionString: null,
      isAuthenticated: false,
      setAuth: (apiId, apiHash, sessionString) => {
        clearBackendSession();
        queryClient.clear();
        set({ apiId, apiHash, sessionString, isAuthenticated: true });
      },
      logout: () => {
        clearBackendSession();
        queryClient.clear();
        set({ apiId: null, apiHash: null, sessionString: null, isAuthenticated: false });
      },
    }),
    {
      name: 'tg-auth-storage',
    }
  )
);
