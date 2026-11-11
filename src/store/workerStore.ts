import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Worker, Role, Acompte, Absence, WorkerPaymentRecord, WorkerPermissions, WorkerPost } from '@/types';
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

// Default interfaces granted to each work post
export const POST_DEFAULT_PERMISSIONS: Record<Exclude<WorkerPost, 'general'>, WorkerPermissions> = {
  kitchen: {
    commands: { view: true },
  },
  cashier: {
    dashboard: { view: true },
    pos: { view: true, create: true },
    commands: { view: true, create: true, edit: true, pay: true },
    clients: { view: true, create: true },
    sales: { view: true },
  },
  deliverer: {
    commands: { view: true },
  },
};

export const POST_LABELS: Record<WorkerPost, string> = {
  general: 'Général (permissions manuelles)',
  kitchen: 'Cuisine',
  cashier: 'Caissier',
  deliverer: 'Livreur',
};

export function permissionsForPost(post: WorkerPost | undefined, current: WorkerPermissions = {}): WorkerPermissions {
  if (!post || post === 'general') return current;
  // Kitchen / deliverer profiles get exactly their interfaces; cashier keeps extras
  if (post === 'kitchen' || post === 'deliverer') return JSON.parse(JSON.stringify(POST_DEFAULT_PERMISSIONS[post]));
  const merged: WorkerPermissions = JSON.parse(JSON.stringify(current));
  Object.entries(POST_DEFAULT_PERMISSIONS[post]).forEach(([m, set]) => { merged[m] = { ...merged[m], ...set }; });
  return merged;
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
    post: 'cashier',
    paymentEnabled: true,
    paymentType: 'daily',
    paymentAmount: 1800,
    hasAccount: true,
    email: 'yacine@larosedor.com',
    username: 'yacine',
    password: 'password',
    startDate: '2025-06-15',
    permissions: {
      dashboard: { view: true },
      pos: { view: true, create: true },
      commands: { view: true, create: true, edit: true, pay: true },
      comptoir: { view: true, create: true },
      clients: { view: true, create: true },
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
          permissions: permissionsForPost(data.post),
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
