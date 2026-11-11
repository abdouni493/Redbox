import type { CashSession, Sale, CaisseTransaction } from '@/types';
import type { Command } from '@/store/commandStore';

export interface SessionStores {
  sales: Sale[];
  commands: Command[];
  transactions: CaisseTransaction[];
}

export interface SessionPaymentRow {
  id: string;
  kind: 'sale' | 'saleDebt' | 'command';
  reference: string;
  amount: number;
  at: string;
  description?: string;
}

export interface SessionCalc {
  start: number;
  end: number;
  // Sales created by the worker during the session (excluding command conversions)
  sales: Sale[];
  // Commands created by the worker during the session
  commandsCreated: Command[];
  // Commands finalised during the session
  commandsFinalised: Command[];
  // Every cash entry received in the session
  payments: SessionPaymentRow[];
  deposits: CaisseTransaction[];
  withdrawals: CaisseTransaction[];
  salesTotal: number;       // value of direct sales
  salesCash: number;        // cash received on direct sales at creation
  saleDebtCash: number;     // old sale debts collected
  commandsTotal: number;    // value of commands created
  commandsCash: number;     // advances + final payments on commands
  depositsTotal: number;
  withdrawalsTotal: number;
  cashIn: number;           // all money received
  theoretical: number;      // opening + cashIn + deposits - withdrawals
  difference?: number;      // declared - theoretical (closed sessions)
}

/**
 * Compute what a cash session should contain. Records are attached to the
 * session by their `sessionId` stamp; legacy records without a stamp fall back
 * to "created by the same user inside the session time window".
 */
export function computeSessionCalc(session: CashSession, stores: SessionStores): SessionCalc {
  const start = new Date(session.openedAt).getTime();
  const end = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };
  const belongs = (tag: string | undefined, by: string | undefined, iso: string | undefined) =>
    tag ? tag === session.id : by === session.username && inWindow(iso);

  const sales = stores.sales.filter((s) => !s.fromCommandId && belongs(s.cashSessionId, s.createdBy, s.date));
  const commandsCreated = stores.commands.filter((c) => belongs(c.cashSessionId, c.createdBy, c.createdAt));
  const commandsFinalised = stores.commands.filter((c) => c.finalisedSessionId === session.id || (!c.finalisedSessionId && c.finalisedBy === session.username && inWindow(c.finalisedAt)));

  const payments: SessionPaymentRow[] = [];
  // Sale payments (initial payment + later debt payments)
  stores.sales.forEach((s) => {
    if (s.fromCommandId) return;
    s.payments.forEach((p, idx) => {
      const isInitial = idx === 0;
      const stamped = p.sessionId === session.id;
      // Legacy: initial payment of an un-stamped sale created in this session
      const legacy = !p.sessionId && isInitial && !s.cashSessionId && s.createdBy === session.username && inWindow(s.date);
      if (stamped || legacy) {
        payments.push({
          id: p.id || `${s.id}-${idx}`,
          kind: isInitial && (stamped ? s.cashSessionId === session.id : true) ? 'sale' : 'saleDebt',
          reference: s.reference,
          amount: p.amount,
          at: p.at || s.date,
          description: p.description,
        });
      }
    });
  });
  // Command payments (advance at creation, versements, payment at finalisation)
  stores.commands.forEach((c) => {
    c.payments.forEach((p) => {
      if (p.sessionId === session.id || (!p.sessionId && p.receivedBy === session.username && inWindow(p.at))) {
        payments.push({ id: p.id, kind: 'command', reference: c.reference, amount: p.amount, at: p.at || p.date, description: p.description });
      }
    });
  });
  payments.sort((a, b) => a.at.localeCompare(b.at));

  const tx = stores.transactions.filter((t) => t.sessionId === session.id);
  const deposits = tx.filter((t) => t.type === 'deposit');
  const withdrawals = tx.filter((t) => t.type === 'withdrawal');

  const sum = (arr: { amount: number }[]) => arr.reduce((s, x) => s + x.amount, 0);
  const salesCash = sum(payments.filter((p) => p.kind === 'sale'));
  const saleDebtCash = sum(payments.filter((p) => p.kind === 'saleDebt'));
  const commandsCash = sum(payments.filter((p) => p.kind === 'command'));
  const depositsTotal = sum(deposits);
  const withdrawalsTotal = sum(withdrawals);
  const cashIn = salesCash + saleDebtCash + commandsCash;
  const theoretical = session.openingAmount + cashIn + depositsTotal - withdrawalsTotal;

  return {
    start, end, sales, commandsCreated, commandsFinalised, payments, deposits, withdrawals,
    salesTotal: sales.reduce((s, x) => s + x.finalAmount, 0),
    salesCash, saleDebtCash,
    commandsTotal: commandsCreated.reduce((s, x) => s + x.totalAmount, 0),
    commandsCash, depositsTotal, withdrawalsTotal, cashIn, theoretical,
    difference: session.status === 'closed' && session.closingAmount !== undefined ? session.closingAmount - theoretical : undefined,
  };
}

export function sessionDuration(session: CashSession): string {
  const end = session.closedAt ? new Date(session.closedAt).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(session.openedAt).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}
