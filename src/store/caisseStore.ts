import { create } from 'zustand';
import type { CaisseTransaction, CaisseTransactionType } from '@/types';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';
import { getActiveSessionId } from './cashSessionStore';

interface CaisseState {
  transactions: CaisseTransaction[];
  addTransaction: (data: {
    type: CaisseTransactionType;
    amount: number;
    date: string;
    description: string;
  }) => CaisseTransaction;
  updateTransaction: (id: string, data: Partial<CaisseTransaction>) => void;
  deleteTransaction: (id: string) => void;
}

export const useCaisseStore = create<CaisseState>()(
    (set, get) => ({
      transactions: [],

      addTransaction: ({ type, amount, date, description }) => {
        const tx: CaisseTransaction = {
          id: uid('cx'),
          type,
          amount,
          date,
          description,
          createdAt: new Date().toISOString(),
          createdBy: getCurrentUsername(),
          sessionId: getActiveSessionId(),
        };
        set({ transactions: [tx, ...get().transactions] });
        return tx;
      },

      updateTransaction: (id, data) =>
        set({ transactions: get().transactions.map((t) => (t.id === id ? { ...t, ...data } : t)) }),

      deleteTransaction: (id) =>
        set({ transactions: get().transactions.filter((t) => t.id !== id) }),
    })
);
