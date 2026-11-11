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

// ------------------------------------------------------------
// Write queue — one serial chain per table keeps operations ordered.
// ------------------------------------------------------------
let suspended = 0;
const chains = new Map<string, Promise<void>>();
let lastErrorToast = 0;

export const syncStatus = { pending: 0 };

function reportError(table: string, e: unknown) {
  console.error(`[sync] ${table}`, e);
  const now = Date.now();
  if (now - lastErrorToast > 5000) {
    lastErrorToast = now;
    const msg = (e as { message?: string })?.message || String(e);
    toast.error(`Synchronisation Supabase échouée (${table}) : ${msg}`);
  }
}

function enqueue(table: string, job: () => PromiseLike<{ error: unknown }>) {
  syncStatus.pending++;
  const prev = chains.get(table) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      const { error } = await job();
      if (error) reportError(table, error);
    })
    .catch((e) => reportError(table, e))
    .finally(() => { syncStatus.pending--; });
  chains.set(table, next);
}

/** Run `fn` without pushing the resulting store changes back to Supabase. */
function silently(fn: () => void) {
  suspended++;
  try { fn(); } finally { suspended--; }
}

function diffAndPush(def: TableDef, next: any[], prev: any[]) {
  if (next === prev) return;
  const prevById = new Map<string, any>((prev || []).map((x) => [x.id, x]));
  const nextIds = new Set<string>();
  const upserts: Record<string, unknown>[] = [];
  (next || []).forEach((item) => {
    nextIds.add(item.id);
    if (prevById.get(item.id) !== item) upserts.push(toRow(item, def.columns));
  });
  const deletes = (prev || []).filter((x) => !nextIds.has(x.id)).map((x) => x.id as string);
  if (upserts.length) {
    for (let i = 0; i < upserts.length; i += 500) {
      const chunk = upserts.slice(i, i + 500);
      enqueue(def.table, () => supabase.from(def.table).upsert(chunk, { onConflict: 'id' }));
    }
  }
  if (deletes.length) enqueue(def.table, () => supabase.from(def.table).delete().in('id', deletes));
}

// ------------------------------------------------------------
// Subscriptions (store -> Supabase)
// ------------------------------------------------------------
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
      enqueue('app_settings', () => supabase.from('app_settings').upsert(row, { onConflict: 'id' }));
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

/** Store profile — readable without being logged in (login page branding). */
export async function loadSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  if (error) { console.error('[sync] app_settings', error); return; }
  silently(() => {
    useSettingsStore.setState({
      settings: { ...EMPTY_SETTINGS, ...(data ? fromRow(data, SETTINGS_COLUMNS) : {}) } as typeof EMPTY_SETTINGS,
    });
  });
}

/** Load every table into the stores. */
export async function hydrateAll() {
  const results = await Promise.all(tables().map((def) => fetchAll(def.table, def.order)));
  silently(() => {
    // Group per store so each store is updated once.
    const patches = new Map<AnyStore, Record<string, unknown>>();
    tables().forEach((def, i) => {
      const patch = patches.get(def.store) ?? {};
      patch[def.key] = results[i].map((r) => fromRow(r, def.columns));
      patches.set(def.store, patch);
    });
    patches.forEach((patch, store) => store.setState(patch));
  });
  await loadSettings();
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

function applyRemote(def: TableDef, eventType: string, newRow: any, oldRow: any) {
  const list: any[] = def.store.getState()[def.key] || [];
  if (eventType === 'DELETE') {
    const id = oldRow?.id;
    if (!id || !list.some((x) => x.id === id)) return;
    silently(() => def.store.setState({ [def.key]: list.filter((x) => x.id !== id) }));
    return;
  }
  if (!newRow?.id) return;
  const item = fromRow(newRow, def.columns);
  const idx = list.findIndex((x) => x.id === item.id);
  let next: any[];
  if (idx >= 0) {
    // Ignore the echo of our own write (same content).
    const current = toRow(list[idx], def.columns);
    if (JSON.stringify(current) === JSON.stringify(toRow(item, def.columns))) return;
    next = list.slice();
    next[idx] = { ...list[idx], ...item };
  } else {
    next = def.order === 'desc' ? [item, ...list] : [...list, item];
  }
  silently(() => def.store.setState({ [def.key]: next }));
}

function startRealtime() {
  stopRealtime();
  const ch = supabase.channel('app-db-changes');
  tables().forEach((def) => {
    ch.on('postgres_changes', { event: '*', schema: 'public', table: def.table }, (payload) => {
      applyRemote(def, payload.eventType, payload.new, payload.old);
    });
  });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
    const row = payload.new as Record<string, unknown> | undefined;
    if (!row || row.id !== 1) return;
    silently(() => useSettingsStore.setState({ settings: { ...EMPTY_SETTINGS, ...fromRow(row, SETTINGS_COLUMNS) } as typeof EMPTY_SETTINGS }));
  });
  ch.subscribe();
  channel = ch;
}

function stopRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
}

// ------------------------------------------------------------
// Public lifecycle
// ------------------------------------------------------------
export async function startCloudSync() {
  stopWatching();
  await hydrateAll();
  startWatching();
  startRealtime();
}

export async function stopCloudSync() {
  stopRealtime();
  stopWatching();
  // Let pending writes finish before the session token disappears.
  await Promise.allSettled([...chains.values()]);
  clearAll();
}

/** Wait until every queued write reached Supabase. */
export async function flushSync() {
  await Promise.allSettled([...chains.values()]);
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
