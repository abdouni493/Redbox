import { create } from 'zustand';
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

export const useClientStore = create<ClientState>()(
    (set, get) => ({
      clients: [],
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
    })
);
