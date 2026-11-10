import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoreSettings } from '@/types';

interface SettingsState {
  settings: StoreSettings;
  updateSettings: (data: Partial<StoreSettings>) => void;
}

const defaultSettings: StoreSettings = {
  logo: null,
  name: 'Altech Food',
  description: 'Fast Food - Commande & Vente',
  email: 'contact@altechfood.com',
  phone: '0555 12 34 56',
  address: '12 Rue des Jardins, Alger',
  socialMedia: '@altechfood',
  nif: '001234567890123',
  nis: '1920384756',
  article: '16253445',
  rc: '16/00-1234567B',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      updateSettings: (data) => set({ settings: { ...get().settings, ...data } }),
    }),
    { name: 'boulengerie-settings' }
  )
);
