import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface KeyState {
  accessKey: string | null;
  isKeyValid: boolean;
  setAccessKey: (key: string) => void;
  clearKey: () => void;
}

export const useKeyStore = create<KeyState>()(
  persist(
    (set) => ({
      accessKey: null,
      isKeyValid: false,
      setAccessKey: (key) => set({ accessKey: key, isKeyValid: true }),
      clearKey: () => set({ accessKey: null, isKeyValid: false }),
    }),
    { name: 'access-key-storage' }
  )
);
