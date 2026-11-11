import { useMemo } from 'react';
import { useSalesStore } from '@/store/salesStore';
import { useCommandStore } from '@/store/commandStore';
import { useCaisseStore } from '@/store/caisseStore';
import { computeSessionCalc, type SessionCalc } from '@/lib/cashSession';
import type { CashSession } from '@/types';

export function useSessionStores() {
  const sales = useSalesStore((s) => s.sales);
  const commands = useCommandStore((s) => s.commands);
  const transactions = useCaisseStore((s) => s.transactions);
  return useMemo(() => ({ sales, commands, transactions }), [sales, commands, transactions]);
}

export function useSessionCalc(session?: CashSession | null): SessionCalc | null {
  const stores = useSessionStores();
  return useMemo(() => (session ? computeSessionCalc(session, stores) : null), [session, stores]);
}
