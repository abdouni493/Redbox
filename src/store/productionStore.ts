import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Production, UsedProduct, Category } from '@/types';
import { uid } from '@/lib/utils';
import { useStockStore } from './stockStore';
import { useComptoirStore } from './comptoirStore';
import { getCurrentUsername } from './authStore';

interface ProductionState {
  productions: Production[];
  categories: Category[];
  addProduction: (data: {
    name: string;
    description: string;
    date: string;
    hour: string;
    categoryId?: string;
    categoryName?: string;
    usedProducts: UsedProduct[];
    outputQuantity: number;
    unitPrice: number;
    sellByUnit?: boolean;
    sellUnit?: string;
  }) => Production;
  updateProduction: (id: string, data: Partial<Production>) => void;
  deleteProduction: (id: string) => void;
  transferToComptoir: (id: string, qty: number) => void;
  addCategory: (name: string) => Category;
  deleteCategory: (id: string) => void;
}

export const DEMO_PROD_CATEGORIES: Category[] = [
  { id: 'pcat-viennoiserie', name: 'Viennoiserie' },
  { id: 'pcat-pain', name: 'Pain' },
  { id: 'pcat-specialites', name: 'Brioches & Gâteaux' },
];

export const DEMO_PRODUCTIONS: Production[] = [
  {
    id: 'prod-batch-1',
    name: 'Croissant au Beurre',
    description: 'Lot du matin - 120 pièces',
    date: '2026-07-15',
    hour: '05:30',
    categoryId: 'pcat-viennoiserie',
    categoryName: 'Viennoiserie',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 15, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 975 },
      { productId: 'prod-beurre', productName: 'Beurre Doux 82% MG', quantityUsed: 8, unit: 'kg', unitCost: 850, sourceType: 'stock', lineCost: 6800 },
      { productId: 'prod-sucre', productName: 'Sucre Semoule Cristal', quantityUsed: 2, unit: 'kg', unitCost: 95, sourceType: 'stock', lineCost: 190 },
      { productId: 'prod-levure', productName: 'Levure Boulangère Sèche', quantityUsed: 0.3, unit: 'kg', unitCost: 420, sourceType: 'stock', lineCost: 126 }
    ],
    totalCost: 8091,
    outputQuantity: 120,
    unitPrice: 120,
    totalValue: 14400,
    sellByUnit: false,
    createdBy: 'admin',
    sentToComptoir: 120,
  },
  {
    id: 'prod-batch-2',
    name: 'Baguette Tradition',
    description: 'Lot classique levain',
    date: '2026-07-15',
    hour: '06:00',
    categoryId: 'pcat-pain',
    categoryName: 'Pain',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 25, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 1625 },
      { productId: 'prod-levure', productName: 'Levure Boulangère Sèche', quantityUsed: 0.5, unit: 'kg', unitCost: 420, sourceType: 'stock', lineCost: 210 }
    ],
    totalCost: 1835,
    outputQuantity: 200,
    unitPrice: 20,
    totalValue: 4000,
    sellByUnit: false,
    createdBy: 'admin',
    sentToComptoir: 180,
  },
  {
    id: 'prod-batch-3',
    name: 'Mille-feuille Vanille',
    description: 'Mille-feuilles classiques crème vanille',
    date: '2026-07-15',
    hour: '07:30',
    categoryId: 'pcat-specialites',
    categoryName: 'Brioches & Gâteaux',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 4, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 260 },
      { productId: 'prod-beurre', productName: 'Beurre Doux 82% MG', quantityUsed: 3, unit: 'kg', unitCost: 850, sourceType: 'stock', lineCost: 2550 },
      { productId: 'prod-sucre', productName: 'Sucre Semoule Cristal', quantityUsed: 2, unit: 'kg', unitCost: 95, sourceType: 'stock', lineCost: 190 }
    ],
    totalCost: 3000,
    outputQuantity: 40,
    unitPrice: 180,
    totalValue: 7200,
    sellByUnit: false,
    createdBy: 'admin',
    sentToComptoir: 30,
  },
  {
    id: 'prod-batch-4',
    name: 'Pain de Campagne',
    description: 'Pain rustique au levain naturel',
    date: '2026-07-15',
    hour: '06:30',
    categoryId: 'pcat-pain',
    categoryName: 'Pain',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 30, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 1950 },
      { productId: 'prod-sel', productName: 'Sel Iodé Fin', quantityUsed: 0.6, unit: 'kg', unitCost: 40, sourceType: 'stock', lineCost: 24 }
    ],
    totalCost: 1974,
    outputQuantity: 80,
    unitPrice: 45,
    totalValue: 3600,
    sellByUnit: false,
    createdBy: 'admin',
    sentToComptoir: 80,
  },
  {
    id: 'prod-batch-5',
    name: 'Pain au Chocolat',
    description: 'Viennoiserie pur beurre au chocolat noir',
    date: '2026-07-15',
    hour: '05:45',
    categoryId: 'pcat-viennoiserie',
    categoryName: 'Viennoiserie',
    usedProducts: [
      { productId: 'prod-farine', productName: 'Farine de Blé T55', quantityUsed: 18, unit: 'kg', unitCost: 65, sourceType: 'stock', lineCost: 1170 },
      { productId: 'prod-beurre', productName: 'Beurre Doux 82% MG', quantityUsed: 9, unit: 'kg', unitCost: 850, sourceType: 'stock', lineCost: 7650 },
      { productId: 'prod-chocolat', productName: 'Pépites de Chocolat Noir 50%', quantityUsed: 3, unit: 'kg', unitCost: 1200, sourceType: 'stock', lineCost: 3600 }
    ],
    totalCost: 12420,
    outputQuantity: 150,
    unitPrice: 130,
    totalValue: 19500,
    sellByUnit: false,
    createdBy: 'admin',
    sentToComptoir: 150,
  }
];

export const useProductionStore = create<ProductionState>()(
  persist(
    (set, get) => ({
      productions: DEMO_PRODUCTIONS,
      categories: DEMO_PROD_CATEGORIES,

      addProduction: ({ name, description, date, hour, categoryId, categoryName, usedProducts, outputQuantity, unitPrice, sellByUnit, sellUnit }) => {
        const totalValue = outputQuantity * unitPrice;
        const totalCost = usedProducts.reduce((s, u) => s + (u.lineCost ?? 0), 0);
        const createdBy = getCurrentUsername();
        const production: Production = {
          id: uid('prod-batch'),
          name,
          description,
          date,
          hour,
          categoryId,
          categoryName,
          usedProducts,
          totalCost,
          outputQuantity,
          unitPrice,
          totalValue,
          sellByUnit,
          sellUnit,
          createdBy,
          sentToComptoir: 0,
        };
        // Consume ingredient stock. Semi-finished (fiche) ingredients are not
        // tracked in raw stock, so they are skipped.
        const stock = useStockStore.getState();
        usedProducts
          .filter((u) => u.sourceType !== 'fiche')
          .forEach((u) => stock.consumeStock(u.productId, u.quantityUsed));
        
        set({ productions: [production, ...get().productions] });
        return production;
      },

      updateProduction: (id, data) =>
        set({
          productions: get().productions.map((p) => {
            if (p.id !== id) return p;
            const usedProducts = data.usedProducts ?? p.usedProducts;
            return {
              ...p,
              ...data,
              totalCost: usedProducts.reduce((s, u) => s + (u.lineCost ?? 0), 0),
              totalValue:
                (data.outputQuantity ?? p.outputQuantity) * (data.unitPrice ?? p.unitPrice),
            };
          }),
        }),

      deleteProduction: (id) =>
        set({ productions: get().productions.filter((p) => p.id !== id) }),

      transferToComptoir: (id, qty) => {
        const prod = get().productions.find((p) => p.id === id);
        if (!prod) return;
        const currentSent = prod.sentToComptoir ?? 0;
        const newSent = currentSent + qty;
        if (newSent > prod.outputQuantity) {
          throw new Error('Quantity exceeds production quantity');
        }
        set({
          productions: get().productions.map((p) =>
            p.id === id ? { ...p, sentToComptoir: newSent } : p
          ),
        });
        useComptoirStore.getState().addComptoirItem({
          productionId: prod.id,
          productName: prod.name,
          description: prod.description,
          quantity: qty,
          unitPrice: prod.unitPrice,
          date: new Date().toISOString().slice(0, 10),
          categoryId: prod.categoryId,
          categoryName: prod.categoryName,
          sellByUnit: prod.sellByUnit,
          unit: prod.sellByUnit ? prod.sellUnit : undefined,
          createdBy: getCurrentUsername(),
        });
      },

      addCategory: (name) => {
        const existing = get().categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        const c: Category = { id: uid('pcat'), name };
        set({ categories: [...get().categories, c] });
        return c;
      },

      deleteCategory: (id) => set({ categories: get().categories.filter((c) => c.id !== id) }),
    }),
    {
      name: 'boulengerie-productions',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProductionState>;
        return {
          ...current,
          ...p,
          productions: p.productions && p.productions.length ? p.productions : DEMO_PRODUCTIONS,
          categories: p.categories && p.categories.length ? p.categories : DEMO_PROD_CATEGORIES,
        };
      },
    }
  )
);
