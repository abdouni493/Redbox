import { create } from 'zustand';
import type { Sale, SaleLine, Payment, OrderServiceInfo } from '@/types';
import { uid } from '@/lib/utils';
import { useComptoirStore } from './comptoirStore';
import { useStockStore } from './stockStore';
import { getCurrentUsername } from './authStore';
import { getActiveSessionId, paymentStamp } from './cashSessionStore';

interface SalesState {
  sales: Sale[];
  addSale: (data: {
    clientId: string | null;
    date: string;
    products: SaleLine[];
    reduction: number;
    paidAmount: number;
    // When the sale is generated from a finalised command, the money was
    // already recorded on the command payments (not a new cash entry).
    fromCommandId?: string;
  } & OrderServiceInfo) => Sale;
  updateSale: (id: string, data: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  payDebt: (id: string, amount: number, description: string) => void;
  nextReference: () => string;
}

export const useSalesStore = create<SalesState>()(
    (set, get) => ({
      sales: [],

      nextReference: () => {
        // Highest existing number + 1 (robust to deletions)
        const max = get().sales.reduce((m, x) => {
          const n = parseInt(String(x.reference || '').replace(/\D/g, ''), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        return `VTE-${String(max + 1).padStart(3, '0')}`;
      },

      addSale: ({ clientId, date, products, reduction, paidAmount, fromCommandId, ...service }) => {
        const totalAmount = products.reduce((s, p) => s + p.quantity * p.sellingPrice, 0);
        const finalAmount = Math.max(0, totalAmount - reduction);
        const restAmount = Math.max(0, finalAmount - paidAmount);
        const sale: Sale = {
          id: uid('sale'),
          reference: get().nextReference(),
          clientId,
          date,
          products,
          totalAmount,
          reduction,
          finalAmount,
          paidAmount,
          restAmount,
          status: restAmount > 0 ? 'debt' : 'paid',
          payments: paidAmount > 0
            ? [{ id: uid('s-pay'), date, amount: paidAmount, ...(fromCommandId ? {} : paymentStamp()) }]
            : [],
          createdBy: getCurrentUsername(),
          cashSessionId: getActiveSessionId(),
          fromCommandId,
          ...service,
        };
        // Reduce the comptoir (by product name) or, for products sold directly
        // from stock ("vente directe au POS"), the stock quantity.
        const comptoir = useComptoirStore.getState();
        const stock = useStockStore.getState();
        products.forEach((line) => {
          if (line.source === 'stock') stock.consumeStock(line.productId, line.quantity);
          else comptoir.reduceByName(line.productName || '', line.quantity);
        });
        set({ sales: [sale, ...get().sales] });
        return sale;
      },

      updateSale: (id, data) =>
        set({ sales: get().sales.map((s) => (s.id === id ? { ...s, ...data } : s)) }),

      deleteSale: (id) => set({ sales: get().sales.filter((s) => s.id !== id) }),

      payDebt: (id, amount, description) =>
        set({
          sales: get().sales.map((s) => {
            if (s.id !== id) return s;
            const newPaid = s.paidAmount + amount;
            const rest = Math.max(0, s.finalAmount - newPaid);
            const payment: Payment = { id: uid('s-pay'), date: new Date().toISOString().slice(0, 10), amount, description, ...paymentStamp() };
            return {
              ...s,
              paidAmount: newPaid,
              restAmount: rest,
              status: rest > 0 ? 'debt' : 'paid',
              payments: [...s.payments, payment],
            };
          }),
        }),
    })
);
