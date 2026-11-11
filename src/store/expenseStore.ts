import { create } from 'zustand';
import type { Expense } from '@/types';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';

interface ExpenseState {
  expenses: Expense[];
  addExpense: (data: Omit<Expense, 'id'>) => Expense;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
}

export const useExpenseStore = create<ExpenseState>()(
    (set, get) => ({
      expenses: [],
      addExpense: (data) => {
        const e: Expense = { ...data, id: uid('exp'), createdBy: data.createdBy || getCurrentUsername() };
        set({ expenses: [e, ...get().expenses] });
        return e;
      },
      updateExpense: (id, data) =>
        set({ expenses: get().expenses.map((e) => (e.id === id ? { ...e, ...data } : e)) }),
      deleteExpense: (id) => set({ expenses: get().expenses.filter((e) => e.id !== id) }),
    })
);
