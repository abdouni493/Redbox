import { create } from 'zustand';
import type { CashSession } from '@/types';
import { uid } from '@/lib/utils';
import { useAuthStore, getCurrentUsername } from './authStore';

interface CashSessionState {
  sessions: CashSession[];
  openSession: (data: { openingAmount: number; openingNote?: string }) => CashSession | null;
  closeSession: (id: string, data: { closingAmount: number; closingNote?: string; expectedAmount: number }) => void;
  deleteSession: (id: string) => void;
}

export const useCashSessionStore = create<CashSessionState>()(
    (set, get) => ({
      sessions: [],

      openSession: ({ openingAmount, openingNote }) => {
        const user = useAuthStore.getState().user;
        if (!user) return null;
        const username = user.username || user.name;
        // A user can only have one open caisse at a time.
        const existing = get().sessions.find((s) => s.username === username && s.status === 'open');
        if (existing) return existing;
        const session: CashSession = {
          id: uid('cs'),
          username,
          workerId: user.workerId,
          workerName: user.name,
          openedAt: new Date().toISOString(),
          openingAmount,
          openingNote,
          status: 'open',
        };
        set({ sessions: [session, ...get().sessions] });
        return session;
      },

      closeSession: (id, { closingAmount, closingNote, expectedAmount }) =>
        set({
          sessions: get().sessions.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: 'closed',
                  closedAt: new Date().toISOString(),
                  closingAmount,
                  closingNote,
                  expectedAmount,
                  difference: closingAmount - expectedAmount,
                  closedBy: getCurrentUsername(),
                }
              : s
          ),
        }),

      deleteSession: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
    })
);

/** Open caisse session of the currently logged-in user, if any. */
export function getActiveSession(): CashSession | undefined {
  const user = useAuthStore.getState().user;
  if (!user) return undefined;
  const username = user.username || user.name;
  return useCashSessionStore.getState().sessions.find((s) => s.username === username && s.status === 'open');
}

export function getActiveSessionId(): string | undefined {
  return getActiveSession()?.id;
}

/** React hook: open session of the current user. */
export function useActiveSession(): CashSession | undefined {
  const user = useAuthStore((s) => s.user);
  const sessions = useCashSessionStore((s) => s.sessions);
  if (!user) return undefined;
  const username = user.username || user.name;
  return sessions.find((s) => s.username === username && s.status === 'open');
}

/** Payment stamp: who received the money, in which caisse, and when. */
export function paymentStamp() {
  return { sessionId: getActiveSessionId(), receivedBy: getCurrentUsername(), at: new Date().toISOString() };
}
