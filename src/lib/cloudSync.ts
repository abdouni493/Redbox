import type { StoreApi, UseBoundStore } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useStockStore } from '@/store/stockStore';
import { useSupplierStore } from '@/store/supplierStore';
import { usePurchaseStore } from '@/store/purchaseStore';
import { useClientStore } from '@/store/clientStore';
import { useSalesStore } from '@/store/salesStore';
import { useProductionStore } from '@/store/productionStore';
import { useFicheTechnicStore } from '@/store/ficheTechnicStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useWorkerStore } from '@/store/workerStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useCaisseStore } from '@/store/caisseStore';
import { useCashSessionStore } from '@/store/cashSessionStore';
import { useCaisseReportStore } from '@/store/caisseReportStore';
import { useCommandStore } from '@/store/commandStore';
import { useSettingsStore, EMPTY_SETTINGS } from '@/store/settingsStore';
import { toast } from '@/components/ui/Toast';
import { useSyncStore } from '@/store/syncStore';

// ============================================================
// Supabase <-> Zustand synchronisation
// ------------------------------------------------------------
// The stores keep their synchronous API (the whole UI relies on it). This
// module:
//   • loads every table into its store after login (hydrate),
//   • watches each store collection and pushes the rows that changed
//     (upsert) or disappeared (delete) to Supabase,
//   • listens to Supabase Realtime so other devices (cashier, kitchen,
//     admin) see new orders / stock changes instantly.
// Column names in the database are the snake_case version of the
// TypeScript field names (e.g. `currentQuantity` -> `current_quantity`).
// ============================================================

type AnyStore = UseBoundStore<StoreApi<any>>;

interface TableDef {
  table: string;
  store: AnyStore;
  key: string;              // collection key inside the store
  columns: string[];        // camelCase fields persisted as columns
  order: 'asc' | 'desc';    // how the store orders its list (new items first = desc)
  // Quantity columns changed by several devices at once (sales, production,
  // purchases…). Changes to them are sent as atomic increments (+/- delta)
  // so two cashiers selling the same item never overwrite each other.
  counters?: string[];
}

// Built lazily so that circular imports between the stores and this module
// can never hit an uninitialised store.
let _tables: TableDef[] | null = null;
const tables = (): TableDef[] => (_tables ??= [
  { table: 'units', store: useStockStore, key: 'units', order: 'asc', columns: ['id', 'name'] },
  { table: 'marques', store: useStockStore, key: 'marques', order: 'asc', columns: ['id', 'name'] },
  { table: 'stock_categories', store: useStockStore, key: 'categories', order: 'asc', columns: ['id', 'name'] },
  {
    table: 'products', store: useStockStore, key: 'products', order: 'desc',
    counters: ['currentQuantity', 'principalQuantity'],
    columns: ['id', 'name', 'description', 'image', 'barcode', 'marqueId', 'categoryId', 'principalQuantity',
      'currentQuantity', 'minAlertQuantity', 'purchasePrice', 'unitEnabled', 'unit', 'expirationEnabled',
      'expirationDate', 'sellOnPos', 'sellingPrice', 'createdAt', 'createdBy'],
  },
  { table: 'suppliers', store: useSupplierStore, key: 'suppliers', order: 'asc', columns: ['id', 'name', 'phone', 'address'] },
  {
    table: 'purchases', store: usePurchaseStore, key: 'purchases', order: 'desc',
    columns: ['id', 'reference', 'supplierId', 'date', 'products', 'totalAmount', 'paidAmount', 'restAmount', 'payments', 'createdBy'],
  },
  { table: 'clients', store: useClientStore, key: 'clients', order: 'asc', columns: ['id', 'name', 'phone'] },
  {
    table: 'sales', store: useSalesStore, key: 'sales', order: 'desc',
    columns: ['id', 'reference', 'clientId', 'date', 'products', 'totalAmount', 'reduction', 'finalAmount', 'paidAmount',
      'restAmount', 'status', 'payments', 'createdBy', 'cashSessionId', 'fromCommandId', 'orderType', 'tableNumber',
      'deliveryAddress', 'deliveryPhone', 'delivererId', 'delivererName'],
  },
  { table: 'production_categories', store: useProductionStore, key: 'categories', order: 'asc', columns: ['id', 'name'] },
  {
    table: 'productions', store: useProductionStore, key: 'productions', order: 'desc',
    counters: ['sentToComptoir'],
    columns: ['id', 'name', 'description', 'image', 'date', 'hour', 'categoryId', 'categoryName', 'usedProducts', 'totalCost',
      'outputQuantity', 'unitPrice', 'totalValue', 'sellByUnit', 'sellUnit', 'createdBy', 'sentToComptoir'],
  },
  { table: 'fiche_categories', store: useFicheTechnicStore, key: 'categories', order: 'asc', columns: ['id', 'name'] },
  {
    table: 'fiche_technics', store: useFicheTechnicStore, key: 'ficheTechnics', order: 'desc',
    columns: ['id', 'name', 'image', 'categoryId', 'categoryName', 'description', 'usedProducts', 'sellByUnit', 'sellUnit',
      'usableInProduction', 'productUnit', 'outputQuantity', 'unitPrice', 'totalCost', 'costPerUnit', 'totalValue',
      'gainsPerUnit', 'totalGains', 'createdAt'],
  },
  {
    table: 'comptoir_items', store: useComptoirStore, key: 'items', order: 'desc',
    counters: ['quantity'],
    columns: ['id', 'productionId', 'productName', 'image', 'description', 'quantity', 'unitPrice', 'date', 'categoryId',
      'categoryName', 'sellByUnit', 'unit', 'createdBy'],
  },
  {
    table: 'destructions', store: useComptoirStore, key: 'destructions', order: 'desc',
    columns: ['id', 'comptoirId', 'productName', 'quantity', 'value', 'reason', 'date', 'unit', 'createdBy'],
  },
  { table: 'worker_roles', store: useWorkerStore, key: 'roles', order: 'asc', columns: ['id', 'name'] },
  {
    table: 'workers', store: useWorkerStore, key: 'workers', order: 'asc',
    // NB: `password` is deliberately NOT a column — passwords live only in Supabase Auth.
    columns: ['id', 'fullName', 'birthday', 'idCardNumber', 'phone', 'roleId', 'post', 'paymentEnabled', 'paymentType',
      'paymentAmount', 'hasAccount', 'email', 'username', 'authUserId', 'startDate', 'permissions', 'acomptes',
      'absences', 'payments'],
  },
  {
    table: 'expenses', store: useExpenseStore, key: 'expenses', order: 'desc',
    columns: ['id', 'name', 'description', 'amount', 'date', 'createdBy'],
  },
  {
    table: 'caisse_transactions', store: useCaisseStore, key: 'transactions', order: 'desc',
    columns: ['id', 'type', 'amount', 'date', 'description', 'createdAt', 'createdBy', 'sessionId'],
  },
  {
    table: 'cash_sessions', store: useCashSessionStore, key: 'sessions', order: 'desc',
    columns: ['id', 'username', 'workerId', 'workerName', 'openedAt', 'openingAmount', 'openingNote', 'status', 'closedAt',
      'closingAmount', 'closingNote', 'expectedAmount', 'difference', 'closedBy'],
  },
  {
    table: 'caisse_reports', store: useCaisseReportStore, key: 'reports', order: 'desc',
    columns: ['id', 'reportType', 'date', 'endDate', 'hour', 'description', 'declaredAmount', 'createdAt', 'createdBy'],
  },
  {
    table: 'commands', store: useCommandStore, key: 'commands', order: 'desc',
    columns: ['id', 'reference', 'clientId', 'clientName', 'clientPhone', 'createdAt', 'receiveDate', 'receiveHour',
      'receiveMinute', 'items', 'totalAmount', 'paidAmount', 'restAmount', 'status', 'payments', 'createdBy', 'source',
      'note', 'kitchenStatus', 'kitchenPrinted', 'cashSessionId', 'finalisedAt', 'finalisedBy', 'finalisedSessionId',
      'saleId', 'deliveredAt', 'orderType', 'tableNumber', 'deliveryAddress', 'deliveryPhone', 'delivererId',
      'delivererName'],
  },
]);

const SETTINGS_COLUMNS = ['logo', 'name', 'description', 'email', 'phone', 'address', 'socialMedia', 'nif', 'nis',
  'article', 'rc', 'imageOptimize', 'imageMaxSize', 'imageQuality'];

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function toRow(item: Record<string, unknown>, columns: string[]) {
  const row: Record<string, unknown> = {};
  columns.forEach((c) => {
    const v = item[c];
    row[snake(c)] = v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? null : v;
  });
  return row;
}

function fromRow(row: Record<string, unknown>, columns: string[]) {
  const item: Record<string, unknown> = {};
  columns.forEach((c) => {
    const v = row[snake(c)];
    // null -> undefined so optional fields behave exactly like before
    if (v !== null && v !== undefined) item[c] = v;
    else if (c === 'image' || c === 'expirationDate' || c === 'logo') item[c] = null;
  });
  return item;
}

// ============================================================
// Outbox — every change is written to a persistent queue first
// ------------------------------------------------------------
// • The queue is saved in localStorage, so a change made while the network
//   is down (or just before closing the tab) is never lost: it is replayed
//   on the next start/login.
// • Operations are sent one by one, in order. Network / server errors are
//   retried forever with back-off; a change refused by the database (bad
//   data, permission…) is retried 3 times, then kept aside in a "failed"
//   list (never silently dropped) and an error is shown.
// ============================================================
type Shape = 'full' | 'partial';
type Op =
  | { kind: 'upsert'; table: string; shape: Shape; rows: Record<string, unknown>[]; attempts?: number }
  | { kind: 'delete'; table: string; ids: string[]; attempts?: number }
  | { kind: 'delta'; table: string; id: string; deltas: Record<string, number>; attempts?: number };

const OUTBOX_KEY = 'altech-outbox-v1';
const FAILED_KEY = 'altech-outbox-failed-v1';
const MAX_ATTEMPTS = 3;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

let outbox: Op[] = readJSON<Op[]>(OUTBOX_KEY, []);
let failedOps: Op[] = readJSON<Op[]>(FAILED_KEY, []);
let enabled = false;          // true while a user session is open
let processing = false;
let retryTimer: number | undefined;
let backoff = 1000;
let counterRpcMissing = false;
let flushWaiters: (() => void)[] = [];

function persistOutbox() {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); }
  catch (e) { console.warn('[sync] outbox not persisted (storage full?)', e); }
  useSyncStore.setState({ pending: outbox.length, failed: failedOps.length });
}

function persistFailed() {
  try { localStorage.setItem(FAILED_KEY, JSON.stringify(failedOps.slice(-200))); } catch { /* ignore */ }
}

function opIds(op: Op): string[] {
  if (op.kind === 'upsert') return op.rows.map((r) => String(r.id));
  if (op.kind === 'delete') return op.ids;
  return [op.id];
}

/** Does this row still have changes waiting to be written? */
function hasPending(table: string, id: string) {
  return outbox.some((op) => op.table === table && opIds(op).includes(id));
}

function enqueue(op: Op) {
  // Merge with the previous queued operation when possible (fewer requests).
  // outbox[0] may be in flight, so never merge into it while processing.
  const last = outbox.length > (processing ? 1 : 0) ? outbox[outbox.length - 1] : undefined;
  if (last && op.kind === 'upsert' && last.kind === 'upsert' && last.table === op.table && last.shape === op.shape && last.rows.length < 500) {
    const byId = new Map(last.rows.map((r) => [String(r.id), r]));
    op.rows.forEach((r) => byId.set(String(r.id), r));
    last.rows = [...byId.values()];
  } else if (last && op.kind === 'delta' && last.kind === 'delta' && last.table === op.table && last.id === op.id) {
    Object.entries(op.deltas).forEach(([k, v]) => { last.deltas[k] = round((last.deltas[k] || 0) + v); });
  } else {
    outbox.push(op);
  }
  persistOutbox();
  kick();
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function isTransient(err: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!err) return true;
  const code = err.code || '';
  const msg = err.message || '';
  if (!code) return true;                                   // fetch failed / no response
  if (/^PGRST30/.test(code)) return true;                   // JWT expired / invalid → refreshed automatically
  if (['40001', '40P01', '57014', '53300', '08006', '08001'].includes(code)) return true;
  return /fetch|network|timeout|jwt|load failed|502|503|504/i.test(msg);
}

async function runOp(op: Op): Promise<{ error: any; data?: any }> {
  if (op.kind === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.rows, { onConflict: 'id' });
    return { error };
  }
  if (op.kind === 'delete') {
    const { error } = await supabase.from(op.table).delete().in('id', op.ids);
    return { error };
  }
  // Atomic increment (see apply_counter_deltas in supabase/schema.sql)
  const deltas: Record<string, number> = {};
  Object.entries(op.deltas).forEach(([k, v]) => { if (v) deltas[snake(k)] = v; });
  if (!Object.keys(deltas).length) return { error: null };
  if (!counterRpcMissing) {
    const { data, error } = await supabase.rpc('apply_counter_deltas', { p_table: op.table, p_id: op.id, p_deltas: deltas });
    if (!error) return { error: null, data };
    if (!/PGRST202|apply_counter_deltas/.test(`${error.code} ${error.message}`)) return { error };
    counterRpcMissing = true;
    console.warn('[sync] apply_counter_deltas missing — run supabase/schema.sql again. Falling back to absolute values.');
  }
  // Fallback (older database): write the absolute local values.
  const def = tables().find((d) => d.table === op.table);
  const item = def ? (def.store.getState()[def.key] || []).find((x: any) => x.id === op.id) : undefined;
  if (!item) return { error: null };
  const patch: Record<string, unknown> = {};
  Object.keys(op.deltas).forEach((k) => { patch[snake(k)] = item[k] ?? 0; });
  const { error } = await supabase.from(op.table).update(patch).eq('id', op.id);
  return { error };
}

/** After an atomic increment: align the local counters on the server values. */
function afterDelta(op: Extract<Op, { kind: 'delta' }>, serverRow: any) {
  if (!serverRow || hasPending(op.table, op.id)) return;
  const def = tables().find((d) => d.table === op.table);
  if (!def?.counters) return;
  const list: any[] = def.store.getState()[def.key] || [];
  const idx = list.findIndex((x) => x.id === op.id);
  if (idx < 0) return;
  const patch: Record<string, unknown> = {};
  let changed = false;
  def.counters.forEach((c) => {
    const v = serverRow[snake(c)];
    if (v !== undefined && v !== null && Number(v) !== Number(list[idx][c])) { patch[c] = Number(v); changed = true; }
  });
  if (!changed) return;
  const next = list.slice();
  next[idx] = { ...list[idx], ...patch };
  silently(() => def.store.setState({ [def.key]: next }));
}

let lastErrorToast = 0;
function notifyError(text: string) {
  useSyncStore.setState({ lastError: text });
  const now = Date.now();
  if (now - lastErrorToast > 5000) {
    lastErrorToast = now;
    toast.error(text);
  }
}

function scheduleRetry(ms: number) {
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => { retryTimer = undefined; kick(); }, ms);
}

function resolveFlushWaiters() {
  if (outbox.length) return;
  const w = flushWaiters;
  flushWaiters = [];
  w.forEach((fn) => fn());
}

async function processOutbox() {
  if (processing || !enabled) return;
  processing = true;
  useSyncStore.setState({ saving: true });
  try {
    while (outbox.length && enabled) {
      const op = outbox[0];
      let res: { error: any; data?: any };
      try {
        res = await runOp(op);
      } catch (e) {
        res = { error: { message: (e as Error)?.message || String(e) } };
      }
      if (!res.error) {
        outbox.shift();
        persistOutbox();
        backoff = 1000;
        useSyncStore.setState({ lastError: null });
        if (op.kind === 'delta') afterDelta(op, res.data);
        continue;
      }
      console.error(`[sync] ${op.kind} ${op.table}`, res.error);
      if (isTransient(res.error)) {
        // Network / server problem: keep the operation and retry later.
        useSyncStore.setState({ lastError: 'Connexion à Supabase interrompue — nouvel essai automatique…' });
        scheduleRetry(backoff);
        backoff = Math.min(backoff * 2, 30000);
        break;
      }
      op.attempts = (op.attempts || 0) + 1;
      if (op.attempts < MAX_ATTEMPTS) {
        persistOutbox();
        scheduleRetry(1500 * op.attempts);
        break;
      }
      // Refused by the database: keep it aside (never silently lost).
      outbox.shift();
      failedOps.push(op);
      persistFailed();
      persistOutbox();
      notifyError(`Enregistrement refusé par la base (${op.table}) : ${res.error.message || res.error.code}`);
    }
  } finally {
    processing = false;
    useSyncStore.setState({ saving: false, pending: outbox.length });
    resolveFlushWaiters();
  }
}

function kick() {
  if (!enabled || processing || retryTimer !== undefined) return;
  void processOutbox();
}

/** Run `fn` without pushing the resulting store changes back to Supabase. */
let suspended = 0;
function silently(fn: () => void) {
  suspended++;
  try { fn(); } finally { suspended--; }
}

/** Wait until every queued change has reached Supabase (or `timeoutMs`). */
export function flushSync(timeoutMs = 15000): Promise<boolean> {
  if (!outbox.length) return Promise.resolve(true);
  kick();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(outbox.length === 0), timeoutMs);
    flushWaiters.push(() => { window.clearTimeout(timer); resolve(true); });
  });
}

/** Operations refused by the database (kept for diagnosis / retry). */
export function getFailedOps() { return failedOps; }
export function retryFailedOps() {
  if (!failedOps.length) return 0;
  const n = failedOps.length;
  failedOps.forEach((op) => { op.attempts = 0; outbox.push(op); });
  failedOps = [];
  persistFailed();
  persistOutbox();
  kick();
  return n;
}

// ------------------------------------------------------------
// Store -> outbox
// ------------------------------------------------------------
function diffAndPush(def: TableDef, next: any[], prev: any[]) {
  if (next === prev) return;
  const prevById = new Map<string, any>((prev || []).map((x) => [x.id, x]));
  const nextIds = new Set<string>();
  const counters = def.counters ?? [];
  const otherCols = def.columns.filter((c) => !counters.includes(c));
  const full: Record<string, unknown>[] = [];
  const partial: Record<string, unknown>[] = [];
  const deltas: { id: string; deltas: Record<string, number> }[] = [];

  (next || []).forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    nextIds.add(item.id);
    const before = prevById.get(item.id);
    if (before === item) return;
    if (!before || !counters.length) {
      full.push(toRow(item, def.columns));
      return;
    }
    // Existing row of a table with counters: other fields as a normal
    // update, quantities as atomic increments.
    const a = toRow(item, otherCols);
    const b = toRow(before, otherCols);
    if (JSON.stringify(a) !== JSON.stringify(b)) partial.push(a);
    const d: Record<string, number> = {};
    counters.forEach((c) => {
      const delta = round((Number(item[c]) || 0) - (Number(before[c]) || 0));
      if (delta) d[c] = delta;
    });
    if (Object.keys(d).length) deltas.push({ id: item.id, deltas: d });
  });
  const deletes = (prev || []).filter((x) => x && !nextIds.has(x.id)).map((x) => String(x.id));

  for (let i = 0; i < full.length; i += 500) enqueue({ kind: 'upsert', table: def.table, shape: 'full', rows: full.slice(i, i + 500) });
  for (let i = 0; i < partial.length; i += 500) enqueue({ kind: 'upsert', table: def.table, shape: 'partial', rows: partial.slice(i, i + 500) });
  deltas.forEach((d) => enqueue({ kind: 'delta', table: def.table, id: d.id, deltas: d.deltas }));
  if (deletes.length) enqueue({ kind: 'delete', table: def.table, ids: deletes });
}

let unsubscribers: (() => void)[] = [];

function startWatching() {
  stopWatching();
  tables().forEach((def) => {
    unsubscribers.push(
      def.store.subscribe((state: any, prevState: any) => {
        if (suspended) return;
        diffAndPush(def, state[def.key], prevState[def.key]);
      })
    );
  });
  unsubscribers.push(
    useSettingsStore.subscribe((state, prevState) => {
      if (suspended || state.settings === prevState.settings) return;
      const row = { id: 1, ...toRow(state.settings as unknown as Record<string, unknown>, SETTINGS_COLUMNS) };
      enqueue({ kind: 'upsert', table: 'app_settings', shape: 'full', rows: [row] });
    })
  );
}

function stopWatching() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

// ------------------------------------------------------------
// Loading (Supabase -> store)
// ------------------------------------------------------------
async function fetchAll(table: string, order: 'asc' | 'desc') {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('inserted_at', { ascending: order === 'asc' })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * Server rows are the truth, except for rows that still have local changes
 * waiting in the outbox: those keep their local version (they will reach
 * the server in a moment), and rows created locally but not sent yet are
 * kept too.
 */
function mergeServer(def: TableDef, rows: Record<string, unknown>[]) {
  const local: any[] = def.store.getState()[def.key] || [];
  const localById = new Map<string, any>(local.map((x) => [String(x.id), x]));
  const serverIds = new Set<string>();
  const result: any[] = [];
  rows.forEach((r) => {
    const id = String(r.id);
    serverIds.add(id);
    if (hasPending(def.table, id)) {
      const l = localById.get(id);
      if (l) result.push(l);           // pending update → local version; missing → pending delete
    } else {
      result.push(fromRow(r, def.columns));
    }
  });
  const unsent: any[] = [];
  local.forEach((l) => { if (!serverIds.has(String(l.id)) && hasPending(def.table, String(l.id))) unsent.push(l); });
  // Rows waiting in a persisted outbox from a previous session
  outbox.forEach((op) => {
    if (op.kind !== 'upsert' || op.shape !== 'full' || op.table !== def.table) return;
    op.rows.forEach((r) => {
      const id = String(r.id);
      if (!serverIds.has(id) && !localById.has(id) && !unsent.some((u) => String(u.id) === id)) unsent.push(fromRow(r, def.columns));
    });
  });
  return def.order === 'desc' ? [...unsent, ...result] : [...result, ...unsent];
}

/** Store profile — readable without being logged in (login page branding). */
export async function loadSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  if (error) { console.error('[sync] app_settings', error); return; }
  if (hasPending('app_settings', '1')) return;
  silently(() => {
    useSettingsStore.setState({
      settings: { ...EMPTY_SETTINGS, ...(data ? fromRow(data, SETTINGS_COLUMNS) : {}) } as typeof EMPTY_SETTINGS,
    });
  });
}

/** Load every table into the stores. */
export async function hydrateAll() {
  const defs = tables();
  const results = await Promise.all(defs.map((def) => fetchAll(def.table, def.order)));
  silently(() => {
    // Group per store so each store is updated once.
    const patches = new Map<AnyStore, Record<string, unknown>>();
    defs.forEach((def, i) => {
      const patch = patches.get(def.store) ?? {};
      patch[def.key] = mergeServer(def, results[i]);
      patches.set(def.store, patch);
    });
    patches.forEach((patch, store) => store.setState(patch));
  });
  await loadSettings();
}

let resyncing = false;
/** Re-read everything from Supabase (after a disconnection). */
export async function resync() {
  if (!enabled || resyncing) return;
  resyncing = true;
  try {
    await hydrateAll();
  } catch (e) {
    console.error('[sync] resync failed', e);
  } finally {
    resyncing = false;
  }
}

/** Empty every store (logout). */
export function clearAll() {
  silently(() => {
    const patches = new Map<AnyStore, Record<string, unknown>>();
    tables().forEach((def) => {
      const patch = patches.get(def.store) ?? {};
      patch[def.key] = [];
      patches.set(def.store, patch);
    });
    patches.forEach((patch, store) => store.setState(patch));
  });
}

// ------------------------------------------------------------
// Realtime (other devices -> this device)
// ------------------------------------------------------------
let channel: RealtimeChannel | null = null;
let wasSubscribed = false;

function applyRemote(def: TableDef, eventType: string, newRow: any, oldRow: any) {
  const id = String((eventType === 'DELETE' ? oldRow?.id : newRow?.id) ?? '');
  if (!id) return;
  // Never let a remote event overwrite a row that still has local changes.
  if (hasPending(def.table, id)) return;
  const list: any[] = def.store.getState()[def.key] || [];
  if (eventType === 'DELETE') {
    if (!list.some((x) => String(x.id) === id)) return;
    silently(() => def.store.setState({ [def.key]: list.filter((x) => String(x.id) !== id) }));
    return;
  }
  const item = fromRow(newRow, def.columns);
  const idx = list.findIndex((x) => String(x.id) === id);
  let next: any[];
  if (idx >= 0) {
    if (JSON.stringify(toRow(list[idx], def.columns)) === JSON.stringify(toRow(item, def.columns))) return;
    next = list.slice();
    next[idx] = item;
  } else {
    next = def.order === 'desc' ? [item, ...list] : [...list, item];
  }
  silently(() => def.store.setState({ [def.key]: next }));
}

function startRealtime() {
  stopRealtime();
  wasSubscribed = false;
  const ch = supabase.channel('app-db-changes');
  tables().forEach((def) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: def.table }, (payload) => {
      applyRemote(def, payload.eventType, payload.new, payload.old);
    });
  });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
    const row = payload.new as Record<string, unknown> | undefined;
    if (!row || row.id !== 1 || hasPending('app_settings', '1')) return;
    silently(() => useSettingsStore.setState({ settings: { ...EMPTY_SETTINGS, ...fromRow(row, SETTINGS_COLUMNS) } as typeof EMPTY_SETTINGS }));
  });
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Reconnected after an interruption: catch up with what we missed.
      if (wasSubscribed) void resync();
      wasSubscribed = true;
    }
  });
  channel = ch;
}

function stopRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
}

// ------------------------------------------------------------
// Browser events: network back, tab visible again, closing the tab
// ------------------------------------------------------------
let hiddenAt = 0;
let browserHooks = false;
function installBrowserHooks() {
  if (browserHooks || typeof window === 'undefined') return;
  browserHooks = true;
  window.addEventListener('online', () => {
    useSyncStore.setState({ online: true });
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
    backoff = 1000;
    kick();
    void resync();
  });
  window.addEventListener('offline', () => useSyncStore.setState({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 60000) void resync();
    kick();
  });
  window.addEventListener('beforeunload', (e) => {
    if (!outbox.length) return;
    // Changes are kept in the outbox anyway, but warn the user.
    e.preventDefault();
    e.returnValue = '';
  });
}

// ------------------------------------------------------------
// Public lifecycle
// ------------------------------------------------------------
export async function startCloudSync() {
  installBrowserHooks();
  stopWatching();
  enabled = true;
  kick();                 // replay changes left from a previous session
  await hydrateAll();
  startWatching();
  startRealtime();
}

/** Stop syncing (logout). Returns the number of changes not sent yet. */
export async function stopCloudSync(): Promise<number> {
  stopRealtime();
  stopWatching();
  await flushSync(10000);
  enabled = false;
  window.clearTimeout(retryTimer);
  retryTimer = undefined;
  clearAll();
  return outbox.length;
}

// ------------------------------------------------------------
// Backup / restore / reset (Paramètres → Base de données)
// Changes go through the stores, so the watcher pushes them to Supabase.
// ------------------------------------------------------------
export function exportData() {
  const out: Record<string, unknown> = { version: 2, exportedAt: new Date().toISOString() };
  tables().forEach((def) => { out[def.table] = def.store.getState()[def.key]; });
  out.app_settings = useSettingsStore.getState().settings;
  return out;
}

export function importData(data: Record<string, unknown>) {
  let count = 0;
  tables().forEach((def) => {
    const rows = data[def.table];
    if (Array.isArray(rows)) {
      def.store.setState({ [def.key]: rows });
      count++;
    }
  });
  if (data.app_settings && typeof data.app_settings === 'object') {
    useSettingsStore.getState().updateSettings(data.app_settings as Record<string, unknown>);
  }
  return count;
}

/** Wipe business data. Workers (linked to login accounts), roles and units are kept. */
export function resetBusinessData() {
  const keep = new Set(['workers', 'worker_roles', 'units']);
  tables().forEach((def) => {
    if (!keep.has(def.table)) def.store.setState({ [def.key]: [] });
  });
}
