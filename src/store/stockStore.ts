import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, Marque, Category, Unit } from '@/types';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';

// Default measurement units offered out of the box (g / kg / litre / metre).
const DEFAULT_UNITS: Unit[] = [
  { id: 'unit-g', name: 'g' },
  { id: 'unit-kg', name: 'kg' },
  { id: 'unit-l', name: 'litre' },
  { id: 'unit-m', name: 'm' },
];

export const DEMO_MARQUES: Marque[] = [
  { id: 'mq-soummam', name: 'Moulins Soummam' },
  { id: 'mq-saf', name: 'Saf-Instant' },
  { id: 'mq-cevital', name: 'Cevital' },
  { id: 'mq-barry', name: 'Barry Callebaut' },
  { id: 'mq-candia', name: 'Candia' },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-mat', name: 'Matières Premières' },
  { id: 'cat-pat', name: 'Spécialités Boulengerie' },
  { id: 'cat-emb', name: 'Emballages' },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-farine',
    name: 'Farine de Blé T55',
    description: 'Farine blanche pour pains et viennoiseries',
    barcode: '5449000111678',
    marqueId: 'mq-soummam',
    categoryId: 'cat-mat',
    principalQuantity: 500,
    currentQuantity: 320,
    minAlertQuantity: 100,
    purchasePrice: 65,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: true,
    expirationDate: '2026-12-31',
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-beurre',
    name: 'Beurre Doux 82% MG',
    description: 'Beurre professionnel pour feuilletage et viennoiseries',
    barcode: '3250390001234',
    marqueId: 'mq-candia',
    categoryId: 'cat-mat',
    principalQuantity: 120,
    currentQuantity: 85,
    minAlertQuantity: 20,
    purchasePrice: 850,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: true,
    expirationDate: '2026-09-15',
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-levure',
    name: 'Levure Boulangère Sèche',
    description: 'Levure sèche instantanée',
    barcode: '3104330002345',
    marqueId: 'mq-saf',
    categoryId: 'cat-mat',
    principalQuantity: 25,
    currentQuantity: 18,
    minAlertQuantity: 5,
    purchasePrice: 420,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: true,
    expirationDate: '2026-10-22',
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-chocolat',
    name: 'Pépites de Chocolat Noir 50%',
    description: 'Chocolat noir de laboratoire pour pains et cookies',
    barcode: '3073990003456',
    marqueId: 'mq-barry',
    categoryId: 'cat-pat',
    principalQuantity: 50,
    currentQuantity: 8,
    minAlertQuantity: 15,
    purchasePrice: 1200,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: true,
    expirationDate: '2026-11-18',
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-sucre',
    name: 'Sucre Semoule Cristal',
    description: 'Sucre blanc pour pâte et glaçage',
    barcode: '6131415004567',
    marqueId: 'mq-cevital',
    categoryId: 'cat-mat',
    principalQuantity: 300,
    currentQuantity: 245,
    minAlertQuantity: 50,
    purchasePrice: 95,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: false,
    expirationDate: null,
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-sel',
    name: 'Sel Iodé Fin',
    description: 'Sel de table pour la pâte',
    barcode: '6131415004599',
    marqueId: 'mq-cevital',
    categoryId: 'cat-mat',
    principalQuantity: 100,
    currentQuantity: 80,
    minAlertQuantity: 10,
    purchasePrice: 40,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: false,
    expirationDate: null,
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-amandes',
    name: 'Amandes Effilées',
    description: 'Pour décors de croissants et brioches',
    barcode: '3073990003999',
    marqueId: 'mq-barry',
    categoryId: 'cat-pat',
    principalQuantity: 20,
    currentQuantity: 15,
    minAlertQuantity: 5,
    purchasePrice: 1800,
    unitEnabled: true,
    unit: 'kg',
    expirationEnabled: true,
    expirationDate: '2026-12-15',
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-boite',
    name: 'Boîte en Carton Moyen',
    description: 'Emballage cartonné pour brioches et gâteaux',
    barcode: '0000000005678',
    marqueId: '',
    categoryId: 'cat-emb',
    principalQuantity: 1000,
    currentQuantity: 600,
    minAlertQuantity: 150,
    purchasePrice: 22,
    unitEnabled: false,
    unit: 'pcs',
    expirationEnabled: false,
    expirationDate: null,
    createdAt: '2026-07-01',
    createdBy: 'admin',
  },
  {
    id: 'prod-sachet',
    name: 'Sachet Kraft Baguette',
    description: 'Emballage individuel baguette',
    barcode: '0000000005699',
    marqueId: '',
    categoryId: 'cat-emb',
    principalQuantity: 5000,
    currentQuantity: 4200,
    minAlertQuantity: 500,
    purchasePrice: 3,
    unitEnabled: false,
    unit: 'pcs',
    expirationEnabled: false,
    expirationDate: null,
    createdAt: '2026-07-01',
    createdBy: 'admin',
  }
];

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
  persist(
    (set, get) => ({
      products: DEMO_PRODUCTS,
      marques: DEMO_MARQUES,
      categories: DEMO_CATEGORIES,
      units: DEFAULT_UNITS,

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
    }),
    {
      name: 'boulengerie-stock',
      // Make sure the default units appear for stores created before units existed.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StockState>;
        return {
          ...current,
          ...p,
          products: p.products && p.products.length ? p.products : DEMO_PRODUCTS,
          marques: p.marques && p.marques.length ? p.marques : DEMO_MARQUES,
          categories: p.categories && p.categories.length ? p.categories : DEMO_CATEGORIES,
          units: p.units && p.units.length ? p.units : DEFAULT_UNITS,
        };
      },
    }
  )
);
