import { create } from 'zustand';
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
    image?: string | null;
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

export const useProductionStore = create<ProductionState>()(
    (set, get) => ({
      productions: [],
      categories: [],

      addProduction: ({ name, image, description, date, hour, categoryId, categoryName, usedProducts, outputQuantity, unitPrice, sellByUnit, sellUnit }) => {
        const totalValue = outputQuantity * unitPrice;
        const totalCost = usedProducts.reduce((s, u) => s + (u.lineCost ?? 0), 0);
        const createdBy = getCurrentUsername();
        const production: Production = {
          id: uid('prod-batch'),
          name,
          image: image ?? null,
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
          image: prod.image ?? null,
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
    })
);
