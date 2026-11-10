import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Client } from '@/types';
import { uid } from '@/lib/utils';

/** Fixed id for the shared walk-in ("passager") client created on demand. */
export const PASSAGER_CLIENT_ID = 'cli-passager';

interface ClientState {
  clients: Client[];
  addClient: (data: Omit<Client, 'id'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  /** Returns the single shared walk-in client, creating it once if needed. */
  getOrCreatePassager: (name?: string) => Client;
}

export const DEMO_CLIENTS: Client[] = [
  { id: 'cli-passager', name: 'Client passager', phone: '' },
  { id: 'cli-karim', name: 'Karim Bensmail', phone: '0661 12 45 78' },
  { id: 'cli-amel', name: 'Amel Oulhadj', phone: '0770 98 76 54' },
  { id: 'cli-lynda', name: 'Lynda Bouzidi', phone: '0550 11 22 33' },
  { id: 'cli-mourad', name: 'Mourad Belkacem', phone: '0663 88 77 66' },
  { id: 'cli-fatiha', name: 'Fatiha Rahmani', phone: '0772 12 34 56' },
];

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      clients: DEMO_CLIENTS,
      addClient: (data) => {
        const c: Client = { ...data, id: uid('cli') };
        set({ clients: [...get().clients, c] });
        return c;
      },
      updateClient: (id, data) =>
        set({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...data } : c)) }),
      deleteClient: (id) => set({ clients: get().clients.filter((c) => c.id !== id) }),
      getOrCreatePassager: (name = 'Client passager') => {
        const existing = get().clients.find((c) => c.id === PASSAGER_CLIENT_ID);
        if (existing) return existing;
        const c: Client = { id: PASSAGER_CLIENT_ID, name, phone: '' };
        set({ clients: [...get().clients, c] });
        return c;
      },
    }),
    {
      name: 'boulengerie-clients',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ClientState>;
        return {
          ...current,
          ...p,
          clients: p.clients && p.clients.length ? p.clients : DEMO_CLIENTS,
        };
      },
    }
  )
);
