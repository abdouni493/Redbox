import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';
import { useComptoirStore } from './comptoirStore';
import { getCurrentUsername } from './authStore';

export interface CommandLine {
  ficheTechnicId: string;
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
}

export type CommandStatus = 'pending' | 'finalised';

export interface Command {
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
}

interface CommandState {
  commands: Command[];
  addCommand: (data: Omit<Command, 'id' | 'reference' | 'status' | 'payments' | 'restAmount' | 'createdAt' | 'createdBy'> & { paidAmount: number }) => Command;
  updateCommand: (id: string, data: Partial<Command>) => void;
  deleteCommand: (id: string) => void;
  payDebt: (id: string, amount: number, description: string) => void;
  finaliseCommand: (id: string) => void;
  nextReference: () => string;
}

export const DEMO_COMMANDS: Command[] = [
  {
    id: 'cmd-1',
    reference: 'CMD-001',
    clientId: 'cli-amel',
    clientName: 'Amel Oulhadj',
    clientPhone: '0770 98 76 54',
    createdAt: '2026-07-14T14:30:00Z',
    receiveDate: '2026-07-18',
    receiveHour: '16',
    receiveMinute: '30',
    items: [
      { ficheTechnicId: 'ft-mille', productName: 'Gâteau d\'Anniversaire Chocolat (10 pers)', quantity: 1, unitPrice: 3500, totalPrice: 3500 }
    ],
    totalAmount: 3500,
    paidAmount: 1500,
    restAmount: 2000,
    status: 'pending',
    payments: [{ id: 'c-pay-1', date: '2026-07-14', amount: 1500, description: 'Versement initial' }],
    createdBy: 'admin'
  },
  {
    id: 'cmd-2',
    reference: 'CMD-002',
    clientId: 'cli-lynda',
    clientName: 'Lynda Bouzidi',
    clientPhone: '0550 11 22 33',
    createdAt: '2026-07-15T09:00:00Z',
    receiveDate: '2026-07-19',
    receiveHour: '10',
    receiveMinute: '00',
    items: [
      { ficheTechnicId: 'ft-croissant', productName: 'Croissant au Beurre', quantity: 50, unitPrice: 120, totalPrice: 6000 }
    ],
    totalAmount: 6000,
    paidAmount: 3000,
    restAmount: 3000,
    status: 'pending',
    payments: [{ id: 'c-pay-2', date: '2026-07-15', amount: 3000, description: 'Acompte espèces' }],
    createdBy: 'yacine'
  }
];

export const useCommandStore = create<CommandState>()(
  persist(
    (set, get) => ({
      commands: DEMO_COMMANDS,
      nextReference: () => {
        const n = get().commands.length + 1;
        return `CMD-${String(n).padStart(3, '0')}`;
      },
      addCommand: (data) => {
        const restAmount = Math.max(0, data.totalAmount - data.paidAmount);
        const dateStr = new Date().toISOString().slice(0, 10);
        const cmd: Command = {
          ...data,
          id: uid('cmd'),
          reference: get().nextReference(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          restAmount,
          payments: data.paidAmount > 0 ? [{ id: uid('c-pay'), date: dateStr, amount: data.paidAmount, description: 'Versement initial' }] : [],
          createdBy: getCurrentUsername(),
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
            const payment: Payment = { id: uid('c-pay'), date: new Date().toISOString().slice(0, 10), amount, description };
            return {
              ...c,
              paidAmount: newPaid,
              restAmount: rest,
              payments: [...c.payments, payment],
            };
          }),
        }),
      finaliseCommand: (id) => {
        const cmd = get().commands.find((c) => c.id === id);
        if (!cmd) return;
        
        // Deduct from comptoir stock by matching product name
        const comptoir = useComptoirStore.getState();
        cmd.items.forEach((item) => {
          comptoir.reduceByName(item.productName, item.quantity);
        });

        set({
          commands: get().commands.map((c) =>
            c.id === id ? { ...c, status: 'finalised' } : c
          ),
        });
      },
    }),
    {
      name: 'boulengerie-commands',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CommandState>;
        return {
          ...current,
          ...p,
          commands: p.commands && p.commands.length ? p.commands : DEMO_COMMANDS,
        };
      },
    }
  )
);
