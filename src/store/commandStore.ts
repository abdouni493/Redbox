import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';
import { getCurrentUsername } from './authStore';
import { getActiveSessionId, paymentStamp } from './cashSessionStore';
import { useSalesStore } from './salesStore';
import type { OrderServiceInfo } from '@/types';

export interface CommandLine {
  // Fiche technique id (pre-order from a recipe) — empty for comptoir items
  ficheTechnicId: string;
  // Comptoir item id when the line was picked from the POS catalog
  comptoirItemId?: string;
  // Stock product id when the line is a stock product sold directly on POS
  stockProductId?: string;
  image?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sellByUnit?: boolean;
  sellUnit?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  description?: string;
  sessionId?: string;
  receivedBy?: string;
  at?: string;
}

export type CommandStatus = 'pending' | 'finalised';
// Kitchen progress of a pending command
export type KitchenStatus = 'new' | 'preparing' | 'ready';

export interface Command extends OrderServiceInfo {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  createdAt: string; // ISO date-time
  receiveDate: string; // YYYY-MM-DD
  receiveHour: string; // HH
  receiveMinute: string; // MM
  items: CommandLine[];
  totalAmount: number;
  paidAmount: number;
  restAmount: number;
  status: CommandStatus;
  payments: Payment[];
  createdBy?: string;
  // Where it was created ('pos' | 'commands' | 'clients')
  source?: string;
  note?: string;
  kitchenStatus?: KitchenStatus;
  kitchenPrinted?: boolean;
  cashSessionId?: string;
  finalisedAt?: string;
  finalisedBy?: string;
  finalisedSessionId?: string;
  saleId?: string;
  deliveredAt?: string;
}

export type NewCommandData = Omit<Command, 'id' | 'reference' | 'status' | 'payments' | 'restAmount' | 'createdAt' | 'createdBy'> & { paidAmount: number };

interface CommandState {
  commands: Command[];
  // Automatically print a kitchen ticket for every new command
  autoPrintKitchen: boolean;
  setAutoPrintKitchen: (v: boolean) => void;
  addCommand: (data: NewCommandData) => Command;
  updateCommand: (id: string, data: Partial<Command>) => void;
  deleteCommand: (id: string) => void;
  payDebt: (id: string, amount: number, description: string) => void;
  /**
   * Complete the command: records the final payment (if any), converts it into
   * a sale (which deducts the comptoir stock) and marks it finalised.
   */
  finaliseCommand: (id: string, opts?: { payAmount?: number; clientId?: string | null }) => Command | undefined;
  setKitchenStatus: (id: string, status: KitchenStatus) => void;
  markKitchenPrinted: (id: string) => void;
  markDelivered: (id: string) => void;
  nextReference: () => string;
}


export const useCommandStore = create<CommandState>()(
  persist(
    (set, get) => ({
      commands: [],
      autoPrintKitchen: false,
      setAutoPrintKitchen: (v) => set({ autoPrintKitchen: v }),
      nextReference: () => {
        // Highest existing number + 1 (robust to deletions)
        const max = get().commands.reduce((m, c) => {
          const n = parseInt(c.reference.replace(/\D/g, ''), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        return `CMD-${String(max + 1).padStart(3, '0')}`;
      },
      addCommand: (data) => {
        const restAmount = Math.max(0, data.totalAmount - data.paidAmount);
        const dateStr = new Date().toISOString().slice(0, 10);
        const cmd: Command = {
          kitchenStatus: 'new',
          ...data,
          id: uid('cmd'),
          reference: get().nextReference(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          restAmount,
          payments: data.paidAmount > 0 ? [{ id: uid('c-pay'), date: dateStr, amount: data.paidAmount, description: 'Versement initial', ...paymentStamp() }] : [],
          createdBy: getCurrentUsername(),
          cashSessionId: getActiveSessionId(),
        };
        set({ commands: [cmd, ...get().commands] });
        return cmd;
      },
      updateCommand: (id, data) =>
        set({
          commands: get().commands.map((c) => {
            if (c.id !== id) return c;
            const updated = { ...c, ...data };
            if (data.totalAmount !== undefined || data.paidAmount !== undefined) {
              updated.restAmount = Math.max(0, updated.totalAmount - updated.paidAmount);
            }
            return updated;
          }),
        }),
      deleteCommand: (id) => set({ commands: get().commands.filter((c) => c.id !== id) }),
      payDebt: (id, amount, description) =>
        set({
          commands: get().commands.map((c) => {
            if (c.id !== id) return c;
            const newPaid = c.paidAmount + amount;
            const rest = Math.max(0, c.totalAmount - newPaid);
            const payment: Payment = { id: uid('c-pay'), date: new Date().toISOString().slice(0, 10), amount, description, ...paymentStamp() };
            return {
              ...c,
              paidAmount: newPaid,
              restAmount: rest,
              payments: [...c.payments, payment],
            };
          }),
        }),
      finaliseCommand: (id, opts = {}) => {
        const cmd = get().commands.find((c) => c.id === id);
        if (!cmd || cmd.status === 'finalised') return undefined;
        const payAmount = Math.max(0, Number(opts.payAmount) || 0);
        if (payAmount > 0) get().payDebt(id, payAmount, `Règlement à la finalisation ${cmd.reference}`);
        const current = get().commands.find((c) => c.id === id)!;
        const clientId = opts.clientId !== undefined ? opts.clientId : current.clientId || null;

        // Convert into a sale: deducts the comptoir stock (by product name) and
        // makes the command visible in sales / client debts / caisse reports.
        const lineSum = current.items.reduce((s, l) => s + l.totalPrice, 0);
        const sale = useSalesStore.getState().addSale({
          clientId,
          date: new Date().toISOString(),
          products: current.items.map((l) => ({
            productId: l.stockProductId || l.comptoirItemId || l.ficheTechnicId,
            source: l.stockProductId ? 'stock' : 'comptoir',
            productName: l.productName,
            quantity: l.quantity,
            sellingPrice: l.unitPrice,
            sellByUnit: l.sellByUnit,
            unit: l.sellUnit,
          })),
          reduction: Math.max(0, lineSum - current.totalAmount),
          paidAmount: current.paidAmount,
          fromCommandId: current.id,
          orderType: current.orderType,
          tableNumber: current.tableNumber,
          deliveryAddress: current.deliveryAddress,
          deliveryPhone: current.deliveryPhone,
          delivererId: current.delivererId,
          delivererName: current.delivererName,
        });

        set({
          commands: get().commands.map((c) =>
            c.id === id
              ? {
                  ...c,
                  clientId: clientId || c.clientId,
                  status: 'finalised',
                  finalisedAt: new Date().toISOString(),
                  finalisedBy: getCurrentUsername(),
                  finalisedSessionId: getActiveSessionId(),
                  saleId: sale.id,
                }
              : c
          ),
        });
        return get().commands.find((c) => c.id === id);
      },
      setKitchenStatus: (id, status) =>
        set({ commands: get().commands.map((c) => (c.id === id ? { ...c, kitchenStatus: status } : c)) }),
      markKitchenPrinted: (id) =>
        set({ commands: get().commands.map((c) => (c.id === id ? { ...c, kitchenPrinted: true } : c)) }),
      markDelivered: (id) =>
        set({ commands: get().commands.map((c) => (c.id === id ? { ...c, deliveredAt: new Date().toISOString() } : c)) }),
    }),
    {
      name: 'boulengerie-commands',
      // Only the local kitchen auto-print preference stays in this browser;
      // commands themselves live in Supabase.
      partialize: (s) => ({ autoPrintKitchen: s.autoPrintKitchen }),
    }
  )
);
