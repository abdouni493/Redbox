import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Sale, SaleLine, Payment } from '@/types';
import { uid } from '@/lib/utils';
import { useComptoirStore } from './comptoirStore';
import { getCurrentUsername } from './authStore';

interface SalesState {
  sales: Sale[];
  addSale: (data: {
    clientId: string | null;
    date: string;
    products: SaleLine[];
    reduction: number;
    paidAmount: number;
  }) => Sale;
  updateSale: (id: string, data: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  payDebt: (id: string, amount: number, description: string) => void;
  nextReference: () => string;
}

export const DEMO_SALES: Sale[] = [
  {
    id: 'sale-1',
    reference: 'VTE-001',
    clientId: 'cli-karim',
    date: '2026-07-14',
    products: [
      { productId: 'comp-1', productName: 'Croissant au Beurre', quantity: 20, sellingPrice: 120 },
      { productId: 'comp-2', productName: 'Baguette Tradition', quantity: 30, sellingPrice: 20 }
    ],
    totalAmount: 3000,
    reduction: 0,
    finalAmount: 3000,
    paidAmount: 2000,
    restAmount: 1000,
    status: 'debt',
    payments: [{ id: 's-pay-1', date: '2026-07-14', amount: 2000 }],
    createdBy: 'yacine',
  },
  {
    id: 'sale-2',
    reference: 'VTE-002',
    clientId: null,
    date: '2026-07-15',
    products: [
      { productId: 'comp-1', productName: 'Croissant au Beurre', quantity: 10, sellingPrice: 120 },
      { productId: 'comp-3', productName: 'Mille-feuille Vanille', quantity: 15, sellingPrice: 180 }
    ],
    totalAmount: 3900,
    reduction: 100,
    finalAmount: 3800,
    paidAmount: 3800,
    restAmount: 0,
    status: 'paid',
    payments: [{ id: 's-pay-2', date: '2026-07-15', amount: 3800 }],
    createdBy: 'yacine',
  },
  {
    id: 'sale-3',
    reference: 'VTE-003',
    clientId: 'cli-amel',
    date: '2026-07-15',
    products: [
      { productId: 'comp-4', productName: 'Pain au Chocolat', quantity: 2, sellingPrice: 130 },
      { productId: 'comp-5', productName: 'Brioche Tressée', quantity: 1, sellingPrice: 350 }
    ],
    totalAmount: 610,
    reduction: 0,
    finalAmount: 610,
    paidAmount: 610,
    restAmount: 0,
    status: 'paid',
    payments: [{ id: 's-pay-3', date: '2026-07-15', amount: 610 }],
    createdBy: 'yacine',
  },
  {
    id: 'sale-4',
    reference: 'VTE-004',
    clientId: null,
    date: '2026-07-15',
    products: [
      { productId: 'comp-2', productName: 'Baguette Tradition', quantity: 10, sellingPrice: 20 }
    ],
    totalAmount: 200,
    reduction: 0,
    finalAmount: 200,
    paidAmount: 200,
    restAmount: 0,
    status: 'paid',
    payments: [{ id: 's-pay-4', date: '2026-07-15', amount: 200 }],
    createdBy: 'admin',
  }
];

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      sales: DEMO_SALES,

      nextReference: () => {
        const n = get().sales.length + 1;
        return `VTE-${String(n).padStart(3, '0')}`;
      },

      addSale: ({ clientId, date, products, reduction, paidAmount }) => {
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
          payments: paidAmount > 0 ? [{ id: uid('s-pay'), date, amount: paidAmount }] : [],
          createdBy: getCurrentUsername(),
        };
        // Reduce comptoir stock by product name
        const comptoir = useComptoirStore.getState();
        products.forEach((line) => comptoir.reduceByName(line.productName || '', line.quantity));
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
            const payment: Payment = { id: uid('s-pay'), date: new Date().toISOString().slice(0, 10), amount, description };
            return {
              ...s,
              paidAmount: newPaid,
              restAmount: rest,
              status: rest > 0 ? 'debt' : 'paid',
              payments: [...s.payments, payment],
            };
          }),
        }),
    }),
    {
      name: 'boulengerie-sales',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SalesState>;
        return {
          ...current,
          ...p,
          sales: p.sales && p.sales.length ? p.sales : DEMO_SALES,
        };
      },
    }
  )
);
