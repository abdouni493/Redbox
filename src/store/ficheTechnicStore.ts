import { create } from 'zustand';
import type { Category, UsedProduct } from '@/types';
import { uid } from '@/lib/utils';

export interface FicheTechnic {
  id: string;
  name: string;
  // Optional product image, stored as a base64 data URL.
  image?: string | null;
  categoryId: string;
  categoryName: string;
  description?: string;
  usedProducts: UsedProduct[];
  sellByUnit: boolean;
  sellUnit?: string;
  // When enabled, the produced item can be reused as an ingredient inside
  // another fiche technique (e.g. a cream used to make a cake). `productUnit`
  // is the measurement unit (g / kg / litre / …) used when it is consumed
  // in another production.
  usableInProduction?: boolean;
  productUnit?: string;
  outputQuantity: number;
  unitPrice: number;
  totalCost: number;
  costPerUnit: number;
  totalValue: number;
  gainsPerUnit: number;
  totalGains: number;
  createdAt: string;
}

interface FicheTechnicState {
  ficheTechnics: FicheTechnic[];
  categories: Category[];
  addFicheTechnic: (data: Omit<FicheTechnic, 'id' | 'createdAt'>) => FicheTechnic;
  updateFicheTechnic: (id: string, data: Partial<FicheTechnic>) => void;
  deleteFicheTechnic: (id: string) => void;
  addCategory: (name: string) => Category;
  deleteCategory: (id: string) => void;
}

export const useFicheTechnicStore = create<FicheTechnicState>()(
    (set, get) => ({
      ficheTechnics: [],
      categories: [],

      addFicheTechnic: (data) => {
        const ft: FicheTechnic = {
          ...data,
          id: uid('ft'),
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ ficheTechnics: [ft, ...get().ficheTechnics] });
        return ft;
      },

      updateFicheTechnic: (id, data) => {
        set({
          ficheTechnics: get().ficheTechnics.map((ft) =>
            ft.id === id ? { ...ft, ...data } : ft
          ),
        });
      },

      deleteFicheTechnic: (id) => {
        set({
          ficheTechnics: get().ficheTechnics.filter((ft) => ft.id !== id),
        });
      },

      addCategory: (name) => {
        const existing = get().categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        const c: Category = { id: uid('ftcat'), name };
        set({ categories: [...get().categories, c] });
        return c;
      },

      deleteCategory: (id) => {
        set({ categories: get().categories.filter((c) => c.id !== id) });
      },
    })
);
