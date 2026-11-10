import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Purchase, PurchaseLine, Payment } from '@/types';
import { uid } from '@/lib/utils';
import { useStockStore } from './stockStore';
import { getCurrentUsername } from './authStore';

interface PurchaseState {
  purchases: Purchase[];
  addPurchase: (data: {
    supplierId: string;
    date: string;
    products: PurchaseLine[];
    paidAmount: number;
  }) => Purchase;
  updatePurchase: (id: string, data: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  payDebt: (id: string, amount: number, description: string) => void;
  nextReference: () => string;
}

export const DEMO_PURCHASES: Purchase[] = [
  {
    id: 'pur-1',
    reference: 'FAC-001',
    supplierId: 'sup-soummam',
    date: '2026-07-02',
    products: [
      { productId: 'prod-farine', quantity: 200, purchasePrice: 65, unitEnabled: true, unit: 'kg', expirationDate: '2026-12-31' }
    ],
    totalAmount: 13000,
    paidAmount: 10000,
    restAmount: 3000,
    payments: [{ id: 'pay-1', date: '2026-07-02', amount: 10000, description: 'Paiement initial chèque' }],
    createdBy: 'admin',
  },
  {
    id: 'pur-2',
    reference: 'FAC-002',
    supplierId: 'sup-cevital',
    date: '2026-07-05',
    products: [
      { productId: 'prod-sucre', quantity: 150, purchasePrice: 95, unitEnabled: true, unit: 'kg', expirationDate: null }
    ],
    totalAmount: 14250,
    paidAmount: 14250,
    restAmount: 0,
    payments: [{ id: 'pay-2', date: '2026-07-05', amount: 14250, description: 'Paiement Espèces' }],
    createdBy: 'admin',
  },
  {
    id: 'pur-3',
    reference: 'FAC-003',
    supplierId: 'sup-distri',
    date: '2026-07-10',
    products: [
      { productId: 'prod-chocolat', quantity: 20, purchasePrice: 1200, unitEnabled: true, unit: 'kg', expirationDate: '2026-11-18' },
      { productId: 'prod-amandes', quantity: 10, purchasePrice: 1800, unitEnabled: true, unit: 'kg', expirationDate: '2026-12-15' }
    ],
    totalAmount: 42000,
    paidAmount: 20000,
    restAmount: 22000,
    payments: [{ id: 'pay-3', date: '2026-07-10', amount: 20000, description: 'Acompte par virement' }],
    createdBy: 'admin',
  }
];

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      purchases: DEMO_PURCHASES,

      nextReference: () => {
        const n = get().purchases.length + 1;
        return `FAC-${String(n).padStart(3, '0')}`;
      },

      addPurchase: ({ supplierId, date, products, paidAmount }) => {
        const totalAmount = products.reduce((s, p) => s + p.quantity * p.purchasePrice, 0);
        const restAmount = Math.max(0, totalAmount - paidAmount);
        const purchase: Purchase = {
          id: uid('pur'),
          reference: get().nextReference(),
          supplierId,
          date,
          products,
          totalAmount,
          paidAmount,
          restAmount,
          payments: paidAmount > 0 ? [{ id: uid('pay'), date, amount: paidAmount, description: 'Paiement initial' }] : [],
          createdBy: getCurrentUsername(),
        };
        // Update stock for each product
        const stock = useStockStore.getState();
        products.forEach((line) => {
          stock.applyPurchaseToStock(
            line.productId,
            line.quantity,
            line.minAlertQuantity || 0,
            line.purchasePrice,
            line.expirationDate,
            { unitEnabled: line.unitEnabled, unit: line.unit }
          );
        });
        set({ purchases: [purchase, ...get().purchases] });
        return purchase;
      },

      updatePurchase: (id, data) =>
        set({ purchases: get().purchases.map((p) => (p.id === id ? { ...p, ...data } : p)) }),

      deletePurchase: (id) => set({ purchases: get().purchases.filter((p) => p.id !== id) }),

      payDebt: (id, amount, description) =>
        set({
          purchases: get().purchases.map((p) => {
            if (p.id !== id) return p;
            const newPaid = p.paidAmount + amount;
            const payment: Payment = { id: uid('pay'), date: new Date().toISOString().slice(0, 10), amount, description };
            return {
              ...p,
              paidAmount: newPaid,
              restAmount: Math.max(0, p.totalAmount - newPaid),
              payments: [...p.payments, payment],
            };
          }),
        }),
    }),
    {
      name: 'boulengerie-purchases',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PurchaseState>;
        return {
          ...current,
          ...p,
          purchases: p.purchases && p.purchases.length ? p.purchases : DEMO_PURCHASES,
        };
      },
    }
  )
);
