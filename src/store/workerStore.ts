import { create } from 'zustand';
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
  general: 'Général',
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

export const useWorkerStore = create<WorkerState>()(
    (set, get) => ({
      workers: [],
      roles: [],

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
    })
);
