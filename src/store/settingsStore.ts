import { create } from 'zustand';
import type { StoreSettings } from '@/types';

interface SettingsState {
  settings: StoreSettings;
  updateSettings: (data: Partial<StoreSettings>) => void;
}

// Empty store profile — the real values are loaded from the Supabase
// `app_settings` table and edited from Paramètres → Infos magasin.
export const EMPTY_SETTINGS: StoreSettings = {
  logo: null,
  name: '',
  description: '',
  email: '',
  phone: '',
  address: '',
  socialMedia: '',
  nif: '',
  nis: '',
  article: '',
  rc: '',
  imageOptimize: true,
  imageMaxSize: 800,
  imageQuality: 0.72,
};

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: EMPTY_SETTINGS,
  updateSettings: (data) => set({ settings: { ...get().settings, ...data } }),
}));
