import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Supplier } from '@/types';
import { uid } from '@/lib/utils';

interface SupplierState {
  suppliers: Supplier[];
  addSupplier: (data: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
}

export const DEMO_SUPPLIERS: Supplier[] = [
  { id: 'sup-soummam', name: 'Moulins Soummam Spa', phone: '034 12 34 56', address: 'Zone Industrielle, Bejaia' },
  { id: 'sup-cevital', name: 'Cevital Agro', phone: '021 45 67 89', address: 'Port d\'Alger, Alger' },
  { id: 'sup-distri', name: 'Distri-Est Fournitures', phone: '031 88 99 00', address: 'Constantine' },
  { id: 'sup-emballage', name: 'Emballages du Centre', phone: '025 33 44 55', address: 'Blida' },
  { id: 'sup-oran', name: 'Oran Levures Distri', phone: '041 55 66 77', address: 'Zone Industrielle, Oran' },
];

export const useSupplierStore = create<SupplierState>()(
  persist(
    (set, get) => ({
      suppliers: DEMO_SUPPLIERS,
      addSupplier: (data) => {
        const s: Supplier = { ...data, id: uid('sup') };
        set({ suppliers: [...get().suppliers, s] });
        return s;
      },
      updateSupplier: (id, data) =>
        set({ suppliers: get().suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)) }),
      deleteSupplier: (id) => set({ suppliers: get().suppliers.filter((s) => s.id !== id) }),
    }),
    {
      name: 'boulengerie-suppliers',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SupplierState>;
        return {
          ...current,
          ...p,
          suppliers: p.suppliers && p.suppliers.length ? p.suppliers : DEMO_SUPPLIERS,
        };
      },
    }
  )
);
