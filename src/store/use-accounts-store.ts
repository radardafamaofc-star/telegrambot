import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TelegramAccount {
  id: string;
  phoneNumber: string;
  sessionString: string;
  label: string;
  status: 'active' | 'banned' | 'flood' | 'offline';
  addedCount: number;
  lastUsed: string | null;
}

interface AccountsState {
  accounts: TelegramAccount[];
  addAccount: (account: Omit<TelegramAccount, 'id' | 'status' | 'addedCount' | 'lastUsed'>) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, updates: Partial<TelegramAccount>) => void;
  getActiveAccounts: () => TelegramAccount[];
}

export const useAccountsStore = create<AccountsState>()(
  persist(
    (set, get) => ({
      accounts: [],
      addAccount: (account) => {
        const id = crypto.randomUUID();
        set((state) => ({
          accounts: [...state.accounts, { ...account, id, status: 'active', addedCount: 0, lastUsed: null }],
        }));
      },
      removeAccount: (id) => {
        set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
      },
      updateAccount: (id, updates) => {
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        }));
      },
      getActiveAccounts: () => get().accounts.filter((a) => a.status === 'active'),
    }),
    { name: 'tg-accounts-storage' }
  )
);
