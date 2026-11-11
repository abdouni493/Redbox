import { create } from 'zustand';
import type { Supplier } from '@/types';
import { uid } from '@/lib/utils';

interface SupplierState {
  suppliers: Supplier[];
  addSupplier: (data: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
}

export const useSupplierStore = create<SupplierState>()(
    (set, get) => ({
      suppliers: [],
      addSupplier: (data) => {
        const s: Supplier = { ...data, id: uid('sup') };
        set({ suppliers: [...get().suppliers, s] });
        return s;
      },
      updateSupplier: (id, data) =>
        set({ suppliers: get().suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)) }),
      deleteSupplier: (id) => set({ suppliers: get().suppliers.filter((s) => s.id !== id) }),
    })
);
