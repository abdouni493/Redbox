import { create } from 'zustand';
import type { Product, Marque, Category, Unit } from '@/types';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';


interface StockState {
  products: Product[];
  marques: Marque[];
  categories: Category[];
  units: Unit[];
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Product;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  // Increase stock from a purchase line
  applyPurchaseToStock: (
    productId: string,
    qty: number,
    minAlert: number,
    purchasePrice: number,
    expirationDate: string | null,
    unitInfo?: { unitEnabled?: boolean; unit?: string }
  ) => void;
  // Decrease stock when used in production
  consumeStock: (productId: string, qty: number) => void;
  addMarque: (name: string) => Marque;
  addCategory: (name: string) => Category;
  deleteMarque: (id: string) => void;
  deleteCategory: (id: string) => void;
  addUnit: (name: string) => Unit;
  deleteUnit: (id: string) => void;
}

export const useStockStore = create<StockState>()(
    (set, get) => ({
      products: [],
      marques: [],
      categories: [],
      units: [],

      addProduct: (p) => {
        const product: Product = {
          ...p,
          id: uid('prod'),
          createdAt: new Date().toISOString().slice(0, 10),
          createdBy: p.createdBy || getCurrentUsername(),
        };
        set({ products: [product, ...get().products] });
        return product;
      },

      updateProduct: (id, data) =>
        set({ products: get().products.map((p) => (p.id === id ? { ...p, ...data } : p)) }),

      deleteProduct: (id) => set({ products: get().products.filter((p) => p.id !== id) }),

      applyPurchaseToStock: (productId, qty, minAlert, purchasePrice, expirationDate, unitInfo) =>
        set({
          products: get().products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  currentQuantity: p.currentQuantity + qty,
                  principalQuantity: p.principalQuantity + qty,
                  minAlertQuantity: minAlert || p.minAlertQuantity,
                  purchasePrice: purchasePrice || p.purchasePrice,
                  expirationDate: expirationDate ?? p.expirationDate,
                  expirationEnabled: expirationDate ? true : p.expirationEnabled,
                  // Remember the detail/unit purchasing mode chosen on the line.
                  unitEnabled: unitInfo?.unitEnabled ?? p.unitEnabled,
                  unit: unitInfo?.unitEnabled ? (unitInfo.unit || p.unit) : p.unit,
                }
              : p
          ),
        }),

      consumeStock: (productId, qty) =>
        set({
          products: get().products.map((p) =>
            p.id === productId
              ? { ...p, currentQuantity: Math.max(0, p.currentQuantity - qty) }
              : p
          ),
        }),

      addMarque: (name) => {
        const m: Marque = { id: uid('mq'), name };
        set({ marques: [...get().marques, m] });
        return m;
      },

      addCategory: (name) => {
        const c: Category = { id: uid('cat'), name };
        set({ categories: [...get().categories, c] });
        return c;
      },

      deleteMarque: (id) => set({ marques: get().marques.filter((m) => m.id !== id) }),

      deleteCategory: (id) => set({ categories: get().categories.filter((c) => c.id !== id) }),

      addUnit: (name) => {
        const existing = get().units.find((u) => u.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        const u: Unit = { id: uid('unit'), name };
        set({ units: [...get().units, u] });
        return u;
      },

      deleteUnit: (id) => set({ units: get().units.filter((u) => u.id !== id) }),
    })
);
