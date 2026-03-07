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
  warmupId: string | null;
}

interface AccountsState {
  accounts: TelegramAccount[];
  addAccount: (account: Omit<TelegramAccount, 'id' | 'status' | 'addedCount' | 'lastUsed' | 'warmupId'>) => void;
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
          accounts: [...state.accounts, { ...account, id, status: 'active', addedCount: 0, lastUsed: null, warmupId: null }],
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
