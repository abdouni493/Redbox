import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const DEMO_FT_CATEGORIES: Category[] = [
  { id: 'ftcat-viennoiserie', name: 'Viennoiserie' },
  { id: 'ftcat-pain', name: 'Pain' },
  { id: 'ftcat-specialites', name: 'Brioches & Gâteaux' },
];

export const DEMO_FICHES: FicheTechnic[] = [
  {
    id: 'ft-croissant',
    name: 'Croissant au Beurre',
    categoryId: 'ftcat-viennoiserie',
    categoryName: 'Viennoiserie',
    description: 'Recette standard croissant 120g au beurre de feuilletage',
    outputQuantity: 120,
    unitPrice: 120,
    totalCost: 8091,
    costPerUnit: 67.42,
    totalValue: 14400,
    gainsPerUnit: 52.58,
    totalGains: 6309,
    sellByUnit: false,
    createdAt: '2026-07-01',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 15, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 975 },
      { productId: 'prod-beurre', productName: 'Beurre Doux 82% MG', quantityUsed: 8, unit: 'kg', unitCost: 850, sourceType: 'stock', lineCost: 6800 },
      { productId: 'prod-sucre', productName: 'Sucre Semoule Cristal', quantityUsed: 2, unit: 'kg', unitCost: 95, sourceType: 'stock', lineCost: 190 },
      { productId: 'prod-levure', productName: 'Levure Boulangère Sèche', quantityUsed: 0.3, unit: 'kg', unitCost: 420, sourceType: 'stock', lineCost: 126 }
    ],
  },
  {
    id: 'ft-baguette',
    name: 'Baguette Tradition',
    categoryId: 'ftcat-pain',
    categoryName: 'Pain',
    description: 'Baguette de tradition française levain naturel',
    outputQuantity: 200,
    unitPrice: 20,
    totalCost: 1835,
    costPerUnit: 9.17,
    totalValue: 4000,
    gainsPerUnit: 10.83,
    totalGains: 2165,
    sellByUnit: false,
    createdAt: '2026-07-01',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 25, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 1625 },
      { productId: 'prod-levure', productName: 'Levure Boulangère Sèche', quantityUsed: 0.5, unit: 'kg', unitCost: 420, sourceType: 'stock', lineCost: 210 }
    ],
  }
];

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
  persist(
    (set, get) => ({
      ficheTechnics: DEMO_FICHES,
      categories: DEMO_FT_CATEGORIES,

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
    }),
    {
      name: 'boulengerie-fiche-technics',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FicheTechnicState>;
        return {
          ...current,
          ...p,
          ficheTechnics: p.ficheTechnics && p.ficheTechnics.length ? p.ficheTechnics : DEMO_FICHES,
          categories: p.categories && p.categories.length ? p.categories : DEMO_FT_CATEGORIES,
        };
      },
    }
  )
);
