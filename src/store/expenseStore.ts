import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Expense } from '@/types';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';

interface ExpenseState {
  expenses: Expense[];
  addExpense: (data: Omit<Expense, 'id'>) => Expense;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
}

export const DEMO_EXPENSES: Expense[] = [
  { id: 'exp-1', name: 'Loyer Laboratoire', description: 'Loyer mensuel du local de production', amount: 35000, date: '2026-07-01', createdBy: 'admin' },
  { id: 'exp-2', name: 'Facture Sonelgaz', description: 'Électricité triphasé pour fours', amount: 18200, date: '2026-07-05', createdBy: 'admin' },
  { id: 'exp-3', name: 'Achat Boîtes Carton', description: 'Emballages pour gâteaux', amount: 8800, date: '2026-07-10', createdBy: 'admin' },
  { id: 'exp-4', name: 'Maintenance Pétrin', description: 'Réparation courroie pétrin mécanique', amount: 4500, date: '2026-07-12', createdBy: 'admin' }
];

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
      expenses: DEMO_EXPENSES,
      addExpense: (data) => {
        const e: Expense = { ...data, id: uid('exp'), createdBy: data.createdBy || getCurrentUsername() };
        set({ expenses: [e, ...get().expenses] });
        return e;
      },
      updateExpense: (id, data) =>
        set({ expenses: get().expenses.map((e) => (e.id === id ? { ...e, ...data } : e)) }),
      deleteExpense: (id) => set({ expenses: get().expenses.filter((e) => e.id !== id) }),
    }),
    {
      name: 'boulengerie-expenses',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ExpenseState>;
        return {
          ...current,
          ...p,
          expenses: p.expenses && p.expenses.length ? p.expenses : DEMO_EXPENSES,
        };
      },
    }
  )
);
