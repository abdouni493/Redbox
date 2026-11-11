import { create } from 'zustand';
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

export const usePurchaseStore = create<PurchaseState>()(
    (set, get) => ({
      purchases: [],

      nextReference: () => {
        // Highest existing number + 1 (robust to deletions)
        const max = get().purchases.reduce((m, x) => {
          const n = parseInt(String(x.reference || '').replace(/\D/g, ''), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        return `FAC-${String(max + 1).padStart(3, '0')}`;
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
    })
);
