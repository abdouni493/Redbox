import { create } from 'zustand';

// Live state of the Supabase synchronisation, shown in the header.
interface SyncState {
  pending: number;        // operations waiting to be written to Supabase
  online: boolean;        // browser network status
  saving: boolean;        // a write is in flight
  lastError: string | null;
  failed: number;         // operations rejected by the database (kept for recovery)
}

export const useSyncStore = create<SyncState>()(() => ({
  pending: 0,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  saving: false,
  lastError: null,
  failed: 0,
}));
