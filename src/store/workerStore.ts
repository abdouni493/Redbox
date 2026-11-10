import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Worker, Role, Acompte, Absence, WorkerPaymentRecord, WorkerPermissions } from '@/types';
import { uid } from '@/lib/utils';

interface WorkerState {
  workers: Worker[];
  roles: Role[];
  addWorker: (data: Omit<Worker, 'id' | 'acomptes' | 'absences' | 'payments' | 'permissions'>) => Worker;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;
  addRole: (name: string) => Role;
  setPermissions: (id: string, permissions: WorkerPermissions) => void;
  addAcompte: (id: string, data: Omit<Acompte, 'id'>) => void;
  addAbsence: (id: string, data: Omit<Absence, 'id'>) => void;
  addPayment: (id: string, data: Omit<WorkerPaymentRecord, 'id'>) => void;
}

export const DEMO_ROLES: Role[] = [
  { id: 'role-boulanger', name: 'Boulanger' },
  { id: 'role-tourier', name: 'Viennoisier / Tourier' },
  { id: 'role-caissier', name: 'Vendeur / Caissier' },
];

export const DEMO_WORKERS: Worker[] = [
  {
    id: 'wrk-rachid',
    fullName: 'Rachid Amrani',
    birthday: '1988-05-12',
    idCardNumber: '109847365254',
    phone: '0662 33 44 55',
    roleId: 'role-boulanger',
    paymentEnabled: true,
    paymentType: 'monthly',
    paymentAmount: 48000,
    hasAccount: true,
    email: 'rachid@larosedor.com',
    username: 'rachid',
    password: 'password',
    startDate: '2025-01-10',
    permissions: {
      production: { view: true, create: true },
      stock: { view: true },
    },
    acomptes: [
      { id: 'ac-1', date: '2026-07-05', amount: 5000, description: 'Avance Tabaski' }
    ],
    absences: [
      { id: 'abs-1', date: '2026-07-02', description: 'Maladie', cost: 1500 }
    ],
    payments: [
      { id: 'wp-1', date: '2026-06-30', period: 'Juin 2026', amount: 41500, description: 'Salaire Juin (déduit acompte/absence)' }
    ],
  },
  {
    id: 'wrk-leila',
    fullName: 'Leila Kaci',
    birthday: '1992-09-24',
    idCardNumber: '112233445566',
    phone: '0554 99 88 77',
    roleId: 'role-tourier',
    paymentEnabled: true,
    paymentType: 'monthly',
    paymentAmount: 52000,
    hasAccount: false,
    email: 'leila@larosedor.com',
    username: 'leila',
    startDate: '2025-03-01',
    permissions: {},
    acomptes: [],
    absences: [],
    payments: [],
  },
  {
    id: 'wrk-yacine',
    fullName: 'Yacine Meziane',
    birthday: '1995-11-02',
    idCardNumber: '115599884433',
    phone: '0771 55 66 77',
    roleId: 'role-caissier',
    paymentEnabled: true,
    paymentType: 'daily',
    paymentAmount: 1800,
    hasAccount: true,
    email: 'yacine@larosedor.com',
    username: 'yacine',
    password: 'password',
    startDate: '2025-06-15',
    permissions: {
      pos: { view: true, create: true },
      comptoir: { view: true, create: true },
      sales: { view: true },
    },
    acomptes: [],
    absences: [],
    payments: [],
  },
  {
    id: 'wrk-sofiane',
    fullName: 'Sofiane Touati',
    birthday: '1994-04-18',
    idCardNumber: '118877665544',
    phone: '0655 44 33 22',
    roleId: 'role-boulanger',
    paymentEnabled: true,
    paymentType: 'daily',
    paymentAmount: 2200,
    hasAccount: false,
    email: 'sofiane@larosedor.com',
    username: 'sofiane',
    startDate: '2026-01-05',
    permissions: {},
    acomptes: [],
    absences: [],
    payments: [],
  }
];

export const useWorkerStore = create<WorkerState>()(
  persist(
    (set, get) => ({
      workers: DEMO_WORKERS,
      roles: DEMO_ROLES,

      addWorker: (data) => {
        const w: Worker = {
          ...data,
          id: uid('wrk'),
          permissions: {},
          acomptes: [],
          absences: [],
          payments: [],
        };
        set({ workers: [...get().workers, w] });
        return w;
      },

      updateWorker: (id, data) =>
        set({ workers: get().workers.map((w) => (w.id === id ? { ...w, ...data } : w)) }),

      deleteWorker: (id) => set({ workers: get().workers.filter((w) => w.id !== id) }),

      addRole: (name) => {
        const r: Role = { id: uid('role'), name };
        set({ roles: [...get().roles, r] });
        return r;
      },

      setPermissions: (id, permissions) =>
        set({ workers: get().workers.map((w) => (w.id === id ? { ...w, permissions } : w)) }),

      addAcompte: (id, data) =>
        set({
          workers: get().workers.map((w) =>
            w.id === id ? { ...w, acomptes: [{ ...data, id: uid('ac') }, ...w.acomptes] } : w
          ),
        }),

      addAbsence: (id, data) =>
        set({
          workers: get().workers.map((w) =>
            w.id === id ? { ...w, absences: [{ ...data, id: uid('abs') }, ...w.absences] } : w
          ),
        }),

      addPayment: (id, data) =>
        set({
          workers: get().workers.map((w) =>
            w.id === id ? { ...w, payments: [{ ...data, id: uid('wp') }, ...w.payments] } : w
          ),
        }),
    }),
    {
      name: 'boulengerie-workers',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkerState>;
        return {
          ...current,
          ...p,
          workers: p.workers && p.workers.length ? p.workers : DEMO_WORKERS,
          roles: p.roles && p.roles.length ? p.roles : DEMO_ROLES,
        };
      },
    }
  )
);
