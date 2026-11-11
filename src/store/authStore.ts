import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, CreateAccountData, Lang, WorkerPermissions } from '@/types';
import { supabase } from '@/lib/supabase';
import { loadSettings, startCloudSync, stopCloudSync } from '@/lib/cloudSync';
import { useWorkerStore } from './workerStore';

type Result = { ok: boolean; error?: string };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** true once the initial session check + data loading is finished */
  ready: boolean;
  /** Whether an admin account exists (null = unknown / Supabase unreachable) */
  adminExists: boolean | null;
  /** Message shown on the login page when Supabase is unreachable / not installed */
  backendError: string | null;
  language: Lang;
  init: () => Promise<void>;
  refreshAdminExists: () => Promise<boolean | null>;
  login: (credentials: { identifier: string; password: string }) => Promise<Result>;
  logout: () => Promise<void>;
  setLanguage: (lang: Lang) => void;
  createAdminAccount: (data: CreateAccountData) => Promise<Result>;
  updateMyAccount: (data: { name?: string; username?: string; email?: string; password?: string; oldPassword?: string }) => Promise<Result>;
}

interface ProfileRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'worker';
  worker_id: string | null;
}

/** Translate the most common Supabase errors to French. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e || '');
  if (/invalid login credentials/i.test(msg)) return 'Identifiants incorrects';
  if (/admin_already_exists/i.test(msg)) return 'Un compte administrateur existe déjà';
  if (/email_taken|users_email|duplicate key.*email/i.test(msg)) return 'Cet email est déjà utilisé';
  if (/username_taken|username/i.test(msg) && /taken|duplicate|unique/i.test(msg)) return "Ce nom d'utilisateur est déjà utilisé";
  if (/wrong_password/i.test(msg)) return 'Ancien mot de passe incorrect';
  if (/not_admin|permission denied/i.test(msg)) return 'Action réservée à un administrateur';
  if (/failed to fetch|network/i.test(msg)) return 'Serveur Supabase injoignable — vérifiez la connexion Internet';
  return msg || 'Erreur inconnue';
}

let workerUnsub: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

/** Build the app user from the profile (+ the worker record for permissions). */
function buildUser(p: ProfileRow): User {
  if (p.role === 'admin') {
    return { id: p.id, name: p.name, username: p.username, email: p.email, role: 'admin', permissions: 'all' };
  }
  const worker = useWorkerStore.getState().workers.find((w) => w.id === p.worker_id || w.authUserId === p.id);
  return {
    id: p.id,
    name: worker?.fullName || p.name,
    username: p.username,
    email: p.email,
    role: 'worker',
    permissions: (worker?.permissions || {}) as WorkerPermissions,
    workerId: worker?.id || p.worker_id || undefined,
    post: worker?.post,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      /** After a successful sign-in: read the profile, load all data, start sync. */
      const openSession = async (authUserId: string): Promise<Result> => {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, name, username, email, role, worker_id')
          .eq('id', authUserId)
          .maybeSingle();
        if (error || !profile) {
          await supabase.auth.signOut();
          return { ok: false, error: error ? friendlyError(error) : "Profil introuvable pour ce compte" };
        }
        await startCloudSync();
        const p = profile as ProfileRow;
        // A worker whose login was disabled by the admin cannot enter.
        if (p.role === 'worker') {
          const w = useWorkerStore.getState().workers.find((x) => x.id === p.worker_id || x.authUserId === p.id);
          if (w && !w.hasAccount) {
            await stopCloudSync();
            await supabase.auth.signOut();
            return { ok: false, error: 'Compte désactivé' };
          }
        }
        set({ user: buildUser(p), isAuthenticated: true, adminExists: true });
        // Keep the worker's permissions / post live when the admin edits them.
        workerUnsub?.();
        workerUnsub = useWorkerStore.subscribe((s, prev) => {
          if (s.workers === prev.workers) return;
          const u = get().user;
          if (!u || u.role !== 'worker') return;
          const w = s.workers.find((x) => x.id === u.workerId || x.authUserId === u.id);
          if (w) set({ user: { ...u, name: w.fullName, permissions: w.permissions, post: w.post } });
        });
        return { ok: true };
      };

      return {
        user: null,
        isAuthenticated: false,
        ready: false,
        adminExists: null,
        backendError: null,
        language: 'fr',

        refreshAdminExists: async () => {
          try {
            const { data, error } = await supabase.rpc('admin_exists');
            if (error) {
              const missing = /PGRST202|PGRST205|schema cache/i.test(`${error.code} ${error.message}`);
              set({
                adminExists: null,
                backendError: missing
                  ? "Base de données non installée : exécutez le fichier supabase/schema.sql dans l'éditeur SQL de Supabase."
                  : friendlyError(error),
              });
              return null;
            }
            set({ adminExists: Boolean(data), backendError: null });
            return Boolean(data);
          } catch (e) {
            set({ adminExists: null, backendError: friendlyError(e) });
            return null;
          }
        },

        init: () => (initPromise ??= (async () => {
          try {
            await Promise.all([loadSettings(), get().refreshAdminExists()]);
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              const res = await openSession(data.session.user.id);
              if (!res.ok) set({ user: null, isAuthenticated: false });
            } else {
              set({ user: null, isAuthenticated: false });
            }
          } catch (e) {
            console.error('[auth] init failed', e);
            set({ user: null, isAuthenticated: false });
          } finally {
            set({ ready: true });
          }
        })()),

        login: async ({ identifier, password }) => {
          try {
            let email = identifier.trim();
            // Username login: resolve the email of that username first.
            if (!email.includes('@')) {
              const { data, error } = await supabase.rpc('resolve_login_email', { p_identifier: email });
              if (error) return { ok: false, error: friendlyError(error) };
              if (!data) return { ok: false, error: 'Identifiants incorrects' };
              email = data as string;
            }
            const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
            if (error || !data.user) return { ok: false, error: friendlyError(error) };
            return await openSession(data.user.id);
          } catch (e) {
            return { ok: false, error: friendlyError(e) };
          }
        },

        logout: async () => {
          workerUnsub?.();
          workerUnsub = null;
          await stopCloudSync();
          await supabase.auth.signOut();
          set({ user: null, isAuthenticated: false });
          loadSettings();
        },

        setLanguage: (lang) => {
          set({ language: lang });
          document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
          document.documentElement.setAttribute('lang', lang);
        },

        createAdminAccount: async (data) => {
          const { error } = await supabase.rpc('create_admin_account', {
            p_name: data.name.trim(),
            p_username: data.username.trim(),
            p_email: data.email.trim().toLowerCase(),
            p_password: data.password,
          });
          if (error) {
            await get().refreshAdminExists();
            return { ok: false, error: friendlyError(error) };
          }
          set({ adminExists: true });
          return { ok: true };
        },

        updateMyAccount: async ({ name, username, email, password, oldPassword }) => {
          const current = get().user;
          if (!current) return { ok: false, error: 'Non connecté' };
          const { error } = await supabase.rpc('update_my_account', {
            p_name: name ?? current.name,
            p_username: username ?? current.username,
            p_email: (email ?? current.email).trim().toLowerCase(),
            p_password: password || null,
            p_old_password: oldPassword || null,
          });
          if (error) return { ok: false, error: friendlyError(error) };
          set({
            user: {
              ...current,
              name: name ?? current.name,
              username: username ?? current.username,
              email: (email ?? current.email).trim().toLowerCase(),
            },
          });
          return { ok: true };
        },
      };
    },
    {
      name: 'boulengerie-auth',
      // Only the UI language is kept locally — the session itself is handled by Supabase Auth.
      partialize: (s) => ({ language: s.language }),
    }
  )
);

// Username of the currently logged-in user — stamped on every create operation.
export function getCurrentUsername(): string {
  const u = useAuthStore.getState().user;
  return u?.username || u?.name || '—';
}
