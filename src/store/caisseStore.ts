import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const DEMO_CAISSE_TRANSACTIONS: CaisseTransaction[] = [
  { id: 'cx-1', type: 'deposit', amount: 15000, date: '2026-07-15', description: 'Fond de caisse initial du matin', createdAt: '2026-07-15T07:00:00Z', createdBy: 'yacine' },
  { id: 'cx-2', type: 'withdrawal', amount: 1200, date: '2026-07-15', description: 'Achat lait d\'appoint au supermarché', createdAt: '2026-07-15T10:15:00Z', createdBy: 'yacine' },
  { id: 'cx-3', type: 'deposit', amount: 5000, date: '2026-07-15', description: 'Encaissement acompte commande CMD-001', createdAt: '2026-07-15T14:30:00Z', createdBy: 'yacine' },
  { id: 'cx-4', type: 'deposit', amount: 3000, date: '2026-07-15', description: 'Fond de caisse complémentaire', createdAt: '2026-07-15T11:00:00Z', createdBy: 'admin' },
  { id: 'cx-5', type: 'withdrawal', amount: 450, date: '2026-07-15', description: 'Café et eau pour l\'équipe', createdAt: '2026-07-15T15:00:00Z', createdBy: 'yacine' }
];

export const useCaisseStore = create<CaisseState>()(
  persist(
    (set, get) => ({
      transactions: DEMO_CAISSE_TRANSACTIONS,

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
    }),
    {
      name: 'boulengerie-caisse',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CaisseState>;
        return {
          ...current,
          ...p,
          transactions: p.transactions && p.transactions.length ? p.transactions : DEMO_CAISSE_TRANSACTIONS,
        };
      },
    }
  )
);
