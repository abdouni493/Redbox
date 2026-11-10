import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, ArrowLeft, Pencil, Trash2, Eye, Calendar, Clock, Coins,
  Receipt, ShoppingCart, Banknote, HardHat, Flame, TrendingUp, AlertTriangle,
  CheckCircle2, Wallet, Scale, CakeSlice, Store, Package, Tag, ArrowDownLeft,
  ArrowUpRight, ArrowRightLeft, User, Filter, CalendarRange,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import { useCaisseReportStore } from '@/store/caisseReportStore';
import { useCaisseStore } from '@/store/caisseStore';
import { useSalesStore } from '@/store/salesStore';
import { usePurchaseStore } from '@/store/purchaseStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useProductionStore } from '@/store/productionStore';
import { useStockStore } from '@/store/stockStore';
import { useWorkerStore } from '@/store/workerStore';
import { useClientStore } from '@/store/clientStore';
import { useSupplierStore } from '@/store/supplierStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDate, todayISO, nowTime, matchesDateFilter, type DateFilter } from '@/lib/utils';
import { cardVariants } from '@/lib/animations';
import type { CaisseReport, CaisseReportType } from '@/types';

// Normalize any date string to YYYY-MM-DD
const dayOf = (d: string) => (d || '').slice(0, 10);

// Resolve the [start, end] day window covered by a report (single day or period).
function reportRange(report: CaisseReport) {
  const a = dayOf(report.date);
  const b = report.reportType === 'period' && report.endDate ? dayOf(report.endDate) : a;
  const startDay = a <= b ? a : b;
  const endDay = a <= b ? b : a;
  const inRange = (d: string) => {
    const x = dayOf(d);
    return x >= startDay && x <= endDay;
  };
  const upToEnd = new Date(endDay + 'T23:59:59').getTime();
  return { startDay, endDay, inRange, upToEnd };
}

const isPeriod = (r: CaisseReport) => r.reportType === 'period' && !!r.endDate && dayOf(r.endDate) !== dayOf(r.date);

// ============================================================
// Core calculation (also consumed by the global Reports page)
// ============================================================
type CalcStores = {
  sales: ReturnType<typeof useSalesStore.getState>['sales'];
  purchases: ReturnType<typeof usePurchaseStore.getState>['purchases'];
  expenses: ReturnType<typeof useExpenseStore.getState>['expenses'];
  destructions: ReturnType<typeof useComptoirStore.getState>['destructions'];
  workers: ReturnType<typeof useWorkerStore.getState>['workers'];
  transactions: ReturnType<typeof useCaisseStore.getState>['transactions'];
  productions?: ReturnType<typeof useProductionStore.getState>['productions'];
};

export interface ReportCalc {
  daySales: CalcStores['sales'];
  dayPurchases: CalcStores['purchases'];
  dayExpenses: CalcStores['expenses'];
  dayDestructions: CalcStores['destructions'];
  dayProductions: NonNullable<CalcStores['productions']>;
  dayWorkerPayments: { id: string; date: string; amount: number; worker: string; kind: string; description: string }[];
  dayDeposits: CalcStores['transactions'];
  dayWithdrawals: CalcStores['transactions'];
  salesGross: number;
  salesPaid: number;
  purchasesTotal: number;
  purchasesPaid: number;
  expensesTotal: number;
  workerTotal: number;
  destroyedValue: number;
  productionCost: number;
  productionRevenue: number;
  productionGains: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  gains: number;
  theoretical: number;
  decalage: number;
}

export function computeReportCalc(report: CaisseReport, stores: CalcStores): ReportCalc {
  const { sales, purchases, expenses, destructions, workers, transactions, productions = [] } = stores;
  const { inRange, upToEnd } = reportRange(report);
  const upTo = (d: string) => new Date(d).getTime() <= upToEnd;

  const daySales = sales.filter((s) => inRange(s.date));
  const dayPurchases = purchases.filter((p) => inRange(p.date));
  const dayExpenses = expenses.filter((e) => inRange(e.date));
  const dayDestructions = destructions.filter((d) => inRange(d.date));
  const dayProductions = productions.filter((p) => inRange(p.date));
  const dayTx = transactions.filter((t) => inRange(t.date));
  const dayDeposits = dayTx.filter((t) => t.type === 'deposit');
  const dayWithdrawals = dayTx.filter((t) => t.type === 'withdrawal');

  const dayWorkerPayments = workers.flatMap((w) => [
    ...w.payments.filter((p) => inRange(p.date)).map((p) => ({ id: p.id, date: p.date, amount: p.amount, worker: w.fullName, kind: 'payment', description: p.description || '' })),
    ...w.acomptes.filter((p) => inRange(p.date)).map((p) => ({ id: p.id, date: p.date, amount: p.amount, worker: w.fullName, kind: 'acompte', description: p.description || '' })),
  ]);

  const salesGross = daySales.reduce((s, x) => s + x.finalAmount, 0);
  const salesPaid = daySales.reduce((s, x) => s + x.paidAmount, 0);
  const purchasesTotal = dayPurchases.reduce((s, x) => s + x.totalAmount, 0);
  const purchasesPaid = dayPurchases.reduce((s, x) => s + x.paidAmount, 0);
  const expensesTotal = dayExpenses.reduce((s, x) => s + x.amount, 0);
  const workerTotal = dayWorkerPayments.reduce((s, x) => s + x.amount, 0);
  const destroyedValue = dayDestructions.reduce((s, x) => s + x.value, 0);
  const depositsTotal = dayDeposits.reduce((s, x) => s + x.amount, 0);
  const withdrawalsTotal = dayWithdrawals.reduce((s, x) => s + x.amount, 0);

  const productionCost = dayProductions.reduce((s, p) => s + (p.totalCost ?? 0), 0);
  const productionRevenue = dayProductions.reduce((s, p) => s + p.totalValue, 0);
  const productionGains = productionRevenue - productionCost;

  // Net economic gains over the period
  const gains = salesGross - purchasesTotal - workerTotal - expensesTotal - destroyedValue;

  // Theoretical cash in the drawer at the end of the period (cumulative cash flow)
  const cumDeposits = transactions.filter((t) => t.type === 'deposit' && upTo(t.date)).reduce((s, x) => s + x.amount, 0);
  const cumWithdrawals = transactions.filter((t) => t.type === 'withdrawal' && upTo(t.date)).reduce((s, x) => s + x.amount, 0);
  const cumSalesPaid = sales.filter((s) => upTo(s.date)).reduce((s, x) => s + x.paidAmount, 0);
  const cumPurchPaid = purchases.filter((p) => upTo(p.date)).reduce((s, x) => s + x.paidAmount, 0);
  const cumExp = expenses.filter((e) => upTo(e.date)).reduce((s, x) => s + x.amount, 0);
  const cumWorker = workers.reduce(
    (s, w) =>
      s +
      w.payments.filter((p) => upTo(p.date)).reduce((a, p) => a + p.amount, 0) +
      w.acomptes.filter((p) => upTo(p.date)).reduce((a, p) => a + p.amount, 0),
    0
  );
  const theoretical = cumDeposits + cumSalesPaid - cumWithdrawals - cumPurchPaid - cumExp - cumWorker;
  const decalage = report.declaredAmount - theoretical;

  return {
    daySales, dayPurchases, dayExpenses, dayDestructions, dayProductions, dayWorkerPayments, dayDeposits, dayWithdrawals,
    salesGross, salesPaid, purchasesTotal, purchasesPaid, expensesTotal, workerTotal, destroyedValue,
    productionCost, productionRevenue, productionGains,
    depositsTotal, withdrawalsTotal, gains, theoretical, decalage,
  };
}

// ============================================================
// Category breakdowns (detail view only)
// ============================================================
type DetailStores = CalcStores & {
  productions: NonNullable<CalcStores['productions']>;
  products: ReturnType<typeof useStockStore.getState>['products'];
  productCategories: ReturnType<typeof useStockStore.getState>['categories'];
  comptoirItems: ReturnType<typeof useComptoirStore.getState>['items'];
  suppliers: ReturnType<typeof useSupplierStore.getState>['suppliers'];
};

interface PurchaseLineDetail { reference: string; supplier: string; date: string; quantity: number; unit?: string; unitPrice: number; lineTotal: number; }
interface PurchaseProductGroup { productName: string; unit?: string; totalQty: number; totalCost: number; lines: PurchaseLineDetail[]; }
interface PurchaseCategoryGroup { category?: string; totalCost: number; lineCount: number; products: PurchaseProductGroup[]; }

interface ProductionCategoryGroup { category?: string; productions: NonNullable<CalcStores['productions']>; totalCost: number; totalRevenue: number; totalGains: number; }

interface SaleProductGroup { productName: string; unit?: string; sellByUnit?: boolean; quantity: number; revenue: number; }
interface SaleCategoryGroup { category?: string; products: SaleProductGroup[]; totalQty: number; totalRevenue: number; }

interface RestProductGroup { productName: string; unit?: string; quantity: number; value: number; }
interface RestCategoryGroup { category?: string; products: RestProductGroup[]; totalQty: number; totalValue: number; }

export interface ReportBreakdown {
  purchases: PurchaseCategoryGroup[];
  production: ProductionCategoryGroup[];
  sales: SaleCategoryGroup[];
  rest: RestCategoryGroup[];
}

function buildBreakdown(report: CaisseReport, calc: ReportCalc, stores: DetailStores): ReportBreakdown {
  const { products, productCategories, comptoirItems, productions, suppliers } = stores;

  const catOfProduct = (productId: string): string | undefined => {
    const p = products.find((x) => x.id === productId);
    if (!p) return undefined;
    return productCategories.find((c) => c.id === p.categoryId)?.name;
  };
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || '—';

  // ---------- Purchases by category → product → invoice lines ----------
  const purchMap = new Map<string, Map<string, PurchaseProductGroup>>();
  calc.dayPurchases.forEach((pur) => {
    pur.products.forEach((line) => {
      const cat = catOfProduct(line.productId) || '';
      if (!purchMap.has(cat)) purchMap.set(cat, new Map());
      const prodMap = purchMap.get(cat)!;
      const name = line.productName || '—';
      const lineTotal = line.quantity * line.purchasePrice;
      const g = prodMap.get(name) || { productName: name, unit: line.unit, totalQty: 0, totalCost: 0, lines: [] };
      g.totalQty += line.quantity;
      g.totalCost += lineTotal;
      if (line.unit) g.unit = line.unit;
      g.lines.push({ reference: pur.reference, supplier: supplierName(pur.supplierId), date: pur.date, quantity: line.quantity, unit: line.unit, unitPrice: line.purchasePrice, lineTotal });
      prodMap.set(name, g);
    });
  });
  const purchases: PurchaseCategoryGroup[] = [...purchMap.entries()].map(([cat, prodMap]) => {
    const productList = [...prodMap.values()].sort((a, b) => b.totalCost - a.totalCost);
    return {
      category: cat || undefined,
      products: productList,
      totalCost: productList.reduce((s, p) => s + p.totalCost, 0),
      lineCount: productList.reduce((s, p) => s + p.lines.length, 0),
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  // ---------- Production by category ----------
  const prodCatMap = new Map<string, ProductionCategoryGroup>();
  calc.dayProductions.forEach((p) => {
    const cat = p.categoryName || '';
    const g = prodCatMap.get(cat) || { category: cat || undefined, productions: [], totalCost: 0, totalRevenue: 0, totalGains: 0 };
    const cost = p.totalCost ?? p.usedProducts.reduce((s, u) => s + (u.lineCost ?? 0), 0);
    g.productions.push(p);
    g.totalCost += cost;
    g.totalRevenue += p.totalValue;
    g.totalGains += p.totalValue - cost;
    prodCatMap.set(cat, g);
  });
  const production = [...prodCatMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---------- Sales by category (map sold product name → category) ----------
  const nameToCat = new Map<string, string>();
  productions.forEach((p) => { if (p.name && p.categoryName) nameToCat.set(p.name, p.categoryName); });
  comptoirItems.forEach((i) => { if (i.productName && i.categoryName) nameToCat.set(i.productName, i.categoryName); });

  const salesMap = new Map<string, Map<string, SaleProductGroup>>();
  calc.daySales.forEach((sale) => {
    sale.products.forEach((line) => {
      const name = line.productName || '—';
      const cat = nameToCat.get(name) || '';
      if (!salesMap.has(cat)) salesMap.set(cat, new Map());
      const prodMap = salesMap.get(cat)!;
      const g = prodMap.get(name) || { productName: name, unit: line.unit, sellByUnit: line.sellByUnit, quantity: 0, revenue: 0 };
      g.quantity += line.quantity;
      g.revenue += line.quantity * line.sellingPrice;
      if (line.sellByUnit) { g.sellByUnit = true; g.unit = line.unit; }
      prodMap.set(name, g);
    });
  });
  const sales: SaleCategoryGroup[] = [...salesMap.entries()].map(([cat, prodMap]) => {
    const productList = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      category: cat || undefined,
      products: productList,
      totalQty: productList.reduce((s, p) => s + p.quantity, 0),
      totalRevenue: productList.reduce((s, p) => s + p.revenue, 0),
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ---------- What is still sitting on the comptoir right now, by category ----------
  const restMap = new Map<string, RestProductGroup[]>();
  comptoirItems.filter((i) => i.quantity > 0).forEach((i) => {
    const cat = i.categoryName || '';
    if (!restMap.has(cat)) restMap.set(cat, []);
    restMap.get(cat)!.push({ productName: i.productName, unit: i.sellByUnit ? i.unit : undefined, quantity: i.quantity, value: i.quantity * i.unitPrice });
  });
  const rest: RestCategoryGroup[] = [...restMap.entries()].map(([cat, list]) => ({
    category: cat || undefined,
    products: list.sort((a, b) => b.value - a.value),
    totalQty: list.reduce((s, p) => s + p.quantity, 0),
    totalValue: list.reduce((s, p) => s + p.value, 0),
  })).sort((a, b) => b.totalValue - a.totalValue);

  return { purchases, production, sales, rest };
}

// ============================================================
// Live clock (shown in the "single day" creation mode)
// ============================================================
function LiveClock() {
  const { t, language } = useLanguage();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gradient-button text-white px-4 py-3 shadow-gold">
      <Clock size={20} />
      <div>
        <p className="text-[11px] text-white/80 leading-none">{t('currentDateTime')}</p>
        <p className="text-lg font-bold tabular leading-tight mt-0.5">{formatDate(now, language)} — {hh}:{mm}<span className="text-white/70 text-sm">:{ss}</span></p>
      </div>
    </div>
  );
}

// ============================================================
// Reports list page
// ============================================================
export default function CaisseReportsPage() {
  const { t, language } = useLanguage();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const { reports, addReport, updateReport, deleteReport } = useCaisseReportStore();
  const sales = useSalesStore((s) => s.sales);
  const purchases = usePurchaseStore((s) => s.purchases);
  const expenses = useExpenseStore((s) => s.expenses);
  const destructions = useComptoirStore((s) => s.destructions);
  const comptoirItems = useComptoirStore((s) => s.items);
  const productions = useProductionStore((s) => s.productions);
  const products = useStockStore((s) => s.products);
  const productCategories = useStockStore((s) => s.categories);
  const workers = useWorkerStore((s) => s.workers);
  const transactions = useCaisseStore((s) => s.transactions);
  const suppliers = useSupplierStore((s) => s.suppliers);

  const stores: DetailStores = { sales, purchases, expenses, destructions, workers, transactions, productions, products, productCategories, comptoirItems, suppliers };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CaisseReport | null>(null);
  const [form, setForm] = useState({
    reportType: 'day' as CaisseReportType,
    date: todayISO(),
    endDate: todayISO(),
    hour: nowTime(),
    description: '',
    declaredAmount: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaisseReport | null>(null);

  // List filter
  const [filter, setFilter] = useState<DateFilter>('all');
  const [filterFrom, setFilterFrom] = useState('2026-06-01');
  const [filterTo, setFilterTo] = useState(todayISO());

  const sorted = useMemo(() => {
    return reports
      .filter((r) => matchesDateFilter(r.date, filter, filterFrom, filterTo))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }, [reports, filter, filterFrom, filterTo]);

  const openCreate = () => {
    setEditing(null);
    setForm({ reportType: 'day', date: todayISO(), endDate: todayISO(), hour: nowTime(), description: '', declaredAmount: 0 });
    setFormOpen(true);
  };
  const openEdit = (r: CaisseReport) => {
    setEditing(r);
    setForm({
      reportType: r.reportType || 'day',
      date: r.date,
      endDate: r.endDate || r.date,
      hour: r.hour,
      description: r.description,
      declaredAmount: r.declaredAmount,
    });
    setFormOpen(true);
  };

  const submit = () => {
    if (form.declaredAmount < 0) { toast.error('Montant invalide'); return; }
    if (form.reportType === 'period' && form.endDate < form.date) { toast.error('La date de fin doit être après la date de début'); return; }
    const payload = {
      reportType: form.reportType,
      date: form.date,
      endDate: form.reportType === 'period' ? form.endDate : undefined,
      hour: form.hour,
      description: form.description,
      declaredAmount: Number(form.declaredAmount),
    };
    if (editing) {
      updateReport(editing.id, payload);
      toast.success('Rapport modifié');
    } else {
      addReport(payload);
      toast.success('Rapport de caisse créé');
    }
    setFormOpen(false);
  };

  if (detail) {
    return <ReportDetail report={detail} stores={stores} onBack={() => setDetail(null)} />;
  }

  const filterOptions: { value: DateFilter; label: string }[] = [
    { value: 'all', label: t('all') },
    { value: 'today', label: t('today') },
    { value: 'week', label: t('week') },
    { value: 'month', label: t('month') },
    { value: 'custom', label: t('period') },
  ];

  return (
    <div>
      <PageHeader
        title={t('caisseReports')}
        icon={<FileText size={24} />}
        subtitle={`${reports.length} ${t('caisseReports').toLowerCase()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/caisse')}><ArrowLeft size={18} /> {t('backToCaisse')}</Button>
            {can('caisse', 'create') && <Button variant="gold" onClick={openCreate}><Plus size={18} /> {t('newCaisseReport')}</Button>}
          </div>
        }
      />

      {/* Filter bar */}
      <Card index={0} className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary"><Filter size={16} className="text-gold-dark" /> {t('filterReports')}</span>
          <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-vanilla/60 border border-gold/15">
            {filterOptions.map((opt) => {
              const active = filter === opt.value;
              return (
                <button key={opt.value} onClick={() => setFilter(opt.value)} className="relative px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors">
                  {active && <motion.span layoutId="reports-filter-pill" className="absolute inset-0 rounded-xl bg-gradient-button shadow-gold" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className={`relative z-10 ${active ? 'text-white' : 'text-text-secondary'}`}>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {filter === 'custom' && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="flex items-end gap-2 overflow-hidden">
                <Input label={t('from')} type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="max-w-[160px]" />
                <Input label={t('to')} type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="max-w-[160px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <EmptyState message={t('noReports')} icon={<FileText size={30} />} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((r, i) => {
            const calc = computeReportCalc(r, stores);
            const balanced = Math.abs(calc.decalage) < 0.01;
            const period = isPeriod(r);
            return (
              <motion.div key={r.id} custom={i} variants={cardVariants} initial="hidden" animate="visible" whileHover="hover"
                className="rounded-2xl bg-gradient-card border border-gold/15 shadow-card p-5 flex flex-col">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-button flex items-center justify-center text-white shadow-gold shrink-0">
                      {period ? <CalendarRange size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-text-primary flex items-center gap-1 text-sm">
                        <Calendar size={12} />
                        {period ? `${formatDate(r.date, language)} → ${formatDate(r.endDate!, language)}` : formatDate(r.date, language)}
                      </p>
                      <p className="text-xs text-text-muted flex items-center gap-1"><Clock size={11} /> {r.hour}{r.createdBy ? ` · ${r.createdBy}` : ''}</p>
                    </div>
                  </div>
                  <Badge variant={period ? 'warning' : 'info'}>{period ? t('periodReport') : t('singleDayReport')}</Badge>
                </div>
                {r.description && <p className="text-sm text-text-secondary mb-3 line-clamp-2">{r.description}</p>}

                <div className="bg-vanilla/40 rounded-xl p-3 space-y-1.5 text-sm mb-3">
                  <div className="flex justify-between"><span className="text-text-muted">{t('declaredAmount')}</span><span className="tabular font-semibold text-gold-dark">{formatCurrency(r.declaredAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">{t('realAmount')}</span><span className="tabular font-medium">{formatCurrency(calc.theoretical)}</span></div>
                  {r.createdBy && <div className="flex justify-between"><span className="text-text-muted flex items-center gap-1"><User size={11} /> {t('createdBy')}</span><span className="font-medium">{r.createdBy}</span></div>}
                </div>

                {balanced ? (
                  <div className="flex items-center gap-2 rounded-xl bg-pistachio/15 text-pistachio px-3 py-2 text-sm font-medium mb-3">
                    <CheckCircle2 size={16} /> {t('noDecalage')}
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium mb-3 ${calc.decalage > 0 ? 'bg-caramel/15 text-gold-dark' : 'bg-rose-deep/15 text-rose-deep'}`}>
                    <AlertTriangle size={16} /> {calc.decalage > 0 ? t('surplus') : t('deficit')}: {formatCurrency(Math.abs(calc.decalage))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setDetail(r)}><Eye size={14} /> {t('viewDetails')}</Button>
                  {can('caisse', 'edit') && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil size={14} /></Button>}
                  {can('caisse', 'delete') && <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 size={14} className="text-rose-deep" /></Button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('edit') : t('newCaisseReport')} size="sm">
        <div className="space-y-4">
          {/* Report type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-vanilla/60 border border-gold/15">
            <button
              onClick={() => setForm({ ...form, reportType: 'day', date: editing ? form.date : todayISO(), hour: editing ? form.hour : nowTime() })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${form.reportType === 'day' ? 'bg-gradient-button text-white shadow-gold' : 'text-text-secondary'}`}
            >
              <Calendar size={16} /> {t('singleDayReport')}
            </button>
            <button
              onClick={() => setForm({ ...form, reportType: 'period' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${form.reportType === 'period' ? 'bg-gradient-button text-white shadow-gold' : 'text-text-secondary'}`}
            >
              <CalendarRange size={16} /> {t('periodReport')}
            </button>
          </div>

          {form.reportType === 'day' ? (
            <>
              {!editing && <LiveClock />}
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} icon={<Calendar size={16} />} />
                <Input label={t('hour')} type="time" value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })} icon={<Clock size={16} />} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('from')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} icon={<Calendar size={16} />} />
              <Input label={t('endDate')} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} icon={<CalendarRange size={16} />} />
            </div>
          )}

          <Textarea label={`${t('description')} (${language === 'ar' ? 'اختياري' : 'optionnel'})`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Clôture de journée" />
          <Input label={`${t('cashCounted')} (DA) *`} type="number" min={0} value={form.declaredAmount || ''} onChange={(e) => setForm({ ...form, declaredAmount: Number(e.target.value) })} icon={<Coins size={16} />} />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>{t('cancel')}</Button>
            <Button variant="gold" onClick={submit}>{editing ? t('save') : t('create')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteReport(deleteId); toast.success('Rapport supprimé'); } }} />
    </div>
  );
}

// ============================================================
// Full report detail view (everything inline)
// ============================================================
function ReportDetail({ report, stores, onBack }: { report: CaisseReport; stores: DetailStores; onBack: () => void }) {
  const { t, language } = useLanguage();
  const clients = useClientStore((s) => s.clients);
  const calc = useMemo(() => computeReportCalc(report, stores), [report, stores]);
  const breakdown = useMemo(() => buildBreakdown(report, calc, stores), [report, calc, stores]);
  const [movementsOpen, setMovementsOpen] = useState(false);

  const balanced = Math.abs(calc.decalage) < 0.01;
  const period = isPeriod(report);
  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name || '—' : t('walkIn'));
  const catLabel = (c?: string) => c || t('uncategorized');

  const rangeLabel = period
    ? `${formatDate(report.date, language)} → ${formatDate(report.endDate!, language)}`
    : `${formatDate(report.date, language)} — ${report.hour}`;

  return (
    <div>
      <PageHeader
        title={t('reportDetails')}
        icon={<FileText size={24} />}
        subtitle={rangeLabel}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMovementsOpen(true)}><ArrowRightLeft size={18} /> {t('cashMovements')}</Button>
            <Button variant="secondary" onClick={onBack}><ArrowLeft size={18} /> {t('backToReports')}</Button>
          </div>
        }
      />

      {/* Header: date / period + description + author */}
      <Card index={0} className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={period ? 'warning' : 'info'}>{period ? t('periodReport') : t('singleDayReport')}</Badge>
              <span className="flex items-center gap-1 text-sm font-medium text-text-primary">
                {period ? <CalendarRange size={14} className="text-gold-dark" /> : <Calendar size={14} className="text-gold-dark" />} {rangeLabel}
              </span>
            </div>
            {report.description
              ? <p className="text-sm text-text-secondary mt-1">{report.description}</p>
              : <p className="text-sm text-text-muted italic mt-1">—</p>}
          </div>
          {report.createdBy && (
            <span className="flex items-center gap-1.5 text-sm text-text-muted"><User size={14} /> {t('createdBy')}: <span className="font-medium text-text-secondary">{report.createdBy}</span></span>
          )}
        </div>
      </Card>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <CalcCard index={0} icon={<Receipt size={20} />} accent="pistachio" label={t('daySales')} value={calc.salesGross} count={calc.daySales.length} />
        <CalcCard index={1} icon={<ShoppingCart size={20} />} accent="caramel" label={t('dayPurchases')} value={calc.purchasesTotal} count={calc.dayPurchases.length} />
        <CalcCard index={2} icon={<CakeSlice size={20} />} accent="gold" label={t('productionValue')} value={calc.productionRevenue} count={calc.dayProductions.length} />
        <CalcCard index={3} icon={<Banknote size={20} />} accent="rose" label={t('dayExpenses')} value={calc.expensesTotal} count={calc.dayExpenses.length} />
        <CalcCard index={4} icon={<HardHat size={20} />} accent="lavender" label={t('dayWorkerPayments')} value={calc.workerTotal} count={calc.dayWorkerPayments.length} />
        <CalcCard index={5} icon={<Flame size={20} />} accent="rose" label={t('dayDestructions')} value={calc.destroyedValue} count={calc.dayDestructions.length} />
      </div>

      {/* ===== Purchases by category ===== */}
      <SectionHeader icon={<ShoppingCart size={18} />} title={t('purchasesByCategory')} total={calc.purchasesTotal} />
      {breakdown.purchases.length === 0 ? (
        <Card index={0} className="mb-6"><EmptyState message={t('noData')} icon={<ShoppingCart size={28} />} /></Card>
      ) : (
        <div className="space-y-4 mb-6">
          {breakdown.purchases.map((cat, ci) => (
            <Card key={cat.category || 'uncat'} index={ci}>
              <CategoryBar icon={<Tag size={16} />} name={catLabel(cat.category)} sub={`${cat.products.length} ${t('productName').toLowerCase()} · ${cat.lineCount} ${t('purchase').toLowerCase()}`} value={cat.totalCost} accent="caramel" />
              <div className="space-y-3 mt-3">
                {cat.products.map((p) => (
                  <div key={p.productName} className="rounded-xl border border-gold/15 overflow-hidden">
                    <div className="flex items-center justify-between bg-vanilla/50 px-3 py-2">
                      <span className="text-sm font-semibold text-text-primary">{p.productName}{p.unit ? <span className="text-xs text-gold-dark ml-1">· {p.unit}</span> : null}</span>
                      <span className="text-xs text-text-muted">{t('total')}: <span className="tabular font-semibold text-gold-dark">{formatCurrency(p.totalCost)}</span> · {p.totalQty}{p.unit ? ` ${p.unit}` : ''}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-text-muted text-xs"><tr>
                        <th className="text-left px-3 py-1.5 font-medium">{t('reference')}</th>
                        <th className="text-left px-3 py-1.5 font-medium">{t('supplier')}</th>
                        <th className="text-left px-3 py-1.5 font-medium">{t('date')}</th>
                        <th className="text-right px-3 py-1.5 font-medium">{t('quantity')}</th>
                        <th className="text-right px-3 py-1.5 font-medium">{t('purchasePrice')}</th>
                        <th className="text-right px-3 py-1.5 font-medium">{t('lineTotal')}</th>
                      </tr></thead>
                      <tbody>
                        {p.lines.map((l, li) => (
                          <tr key={li} className="border-t border-gold/10">
                            <td className="px-3 py-1.5 font-medium text-text-primary">{l.reference}</td>
                            <td className="px-3 py-1.5 text-text-secondary">{l.supplier}</td>
                            <td className="px-3 py-1.5 text-text-muted">{formatDate(l.date, language)}</td>
                            <td className="px-3 py-1.5 text-right tabular">{l.quantity}{l.unit ? ` ${l.unit}` : ''}</td>
                            <td className="px-3 py-1.5 text-right tabular">{formatCurrency(l.unitPrice)}</td>
                            <td className="px-3 py-1.5 text-right tabular text-caramel font-semibold">{formatCurrency(l.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== Production by category ===== */}
      <SectionHeader icon={<CakeSlice size={18} />} title={t('productionByCategory')} total={calc.productionRevenue} />
      {breakdown.production.length === 0 ? (
        <Card index={0} className="mb-6"><EmptyState message={t('noData')} icon={<CakeSlice size={28} />} /></Card>
      ) : (
        <div className="space-y-4 mb-6">
          {breakdown.production.map((cat, ci) => (
            <Card key={cat.category || 'uncat'} index={ci}>
              <CategoryBar icon={<Tag size={16} />} name={catLabel(cat.category)} sub={`${cat.productions.length} production(s)`} value={cat.totalRevenue} accent="gold"
                extra={<span className={`text-xs font-semibold ${cat.totalGains >= 0 ? 'text-pistachio' : 'text-rose-deep'}`}>{t('totalGains')}: {formatCurrency(cat.totalGains)}</span>} />
              <div className="space-y-3 mt-3">
                {cat.productions.map((p) => {
                  const cost = p.totalCost ?? p.usedProducts.reduce((s, u) => s + (u.lineCost ?? 0), 0);
                  const gains = p.totalValue - cost;
                  const su = p.sellByUnit && p.sellUnit ? ` ${p.sellUnit}` : '';
                  return (
                    <div key={p.id} className="rounded-xl border border-gold/15 overflow-hidden">
                      <div className="flex items-center justify-between bg-vanilla/50 px-3 py-2">
                        <span className="text-sm font-semibold text-text-primary">{p.name}</span>
                        <span className="text-xs text-text-muted">{formatDate(p.date, language)} — {p.hour}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-text-muted text-xs"><tr>
                          <th className="text-left px-3 py-1.5 font-medium">{t('ingredient')}</th>
                          <th className="text-right px-3 py-1.5 font-medium">{t('quantity')}</th>
                          <th className="text-right px-3 py-1.5 font-medium">{t('unitCost')}</th>
                          <th className="text-right px-3 py-1.5 font-medium">{t('lineCost')}</th>
                        </tr></thead>
                        <tbody>
                          {p.usedProducts.map((u, ui) => (
                            <tr key={ui} className="border-t border-gold/10">
                              <td className="px-3 py-1.5 text-text-primary">{u.productName}</td>
                              <td className="px-3 py-1.5 text-right tabular">{u.quantityUsed}{u.unit ? ` ${u.unit}` : ''}</td>
                              <td className="px-3 py-1.5 text-right tabular">{formatCurrency(u.unitCost ?? 0)}</td>
                              <td className="px-3 py-1.5 text-right tabular text-rose-deep">{formatCurrency(u.lineCost ?? (u.quantityUsed * (u.unitCost ?? 0)))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-vanilla/30 border-t border-gold/10">
                        <MiniTile label={`${t('qtyReceived')}${su ? ` (${p.sellUnit})` : ''}`} value={`${p.outputQuantity}${su}`} />
                        <MiniTile label={t('productionCost')} value={formatCurrency(cost)} tone="rose" />
                        <MiniTile label={t('expectedRevenue')} value={formatCurrency(p.totalValue)} tone="gold" />
                        <MiniTile label={t('totalGains')} value={formatCurrency(gains)} tone={gains >= 0 ? 'mint' : 'rose'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== Sales by category ===== */}
      <SectionHeader icon={<Receipt size={18} />} title={t('salesByCategory')} total={calc.salesGross} />
      {breakdown.sales.length === 0 ? (
        <Card index={0} className="mb-6"><EmptyState message={t('noData')} icon={<Receipt size={28} />} /></Card>
      ) : (
        <div className="space-y-4 mb-6">
          {breakdown.sales.map((cat, ci) => (
            <Card key={cat.category || 'uncat'} index={ci}>
              <CategoryBar icon={<Tag size={16} />} name={catLabel(cat.category)} sub={`${cat.totalQty} ${t('unitsSold')}`} value={cat.totalRevenue} accent="pistachio" />
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-vanilla/60 text-text-secondary"><tr>
                    <th className="text-left px-3 py-2">{t('name')}</th>
                    <th className="text-right px-3 py-2">{t('soldQty')}</th>
                    <th className="text-right px-3 py-2">{t('revenue')}</th>
                  </tr></thead>
                  <tbody>
                    {cat.products.map((p) => (
                      <tr key={p.productName} className="border-t border-gold/10">
                        <td className="px-3 py-2 font-medium text-text-primary">{p.productName}</td>
                        <td className="px-3 py-2 text-right tabular">{p.quantity}{p.sellByUnit && p.unit ? ` ${p.unit}` : ''}</td>
                        <td className="px-3 py-2 text-right tabular text-pistachio font-semibold">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gold/15 bg-vanilla/40 font-bold">
                      <td className="px-3 py-2">{t('categoryTotal')}</td>
                      <td className="px-3 py-2 text-right tabular">{cat.totalQty}</td>
                      <td className="px-3 py-2 text-right tabular text-pistachio">{formatCurrency(cat.totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== Rest at comptoir by category (current) ===== */}
      <SectionHeader icon={<Store size={18} />} title={t('restByCategory')} total={breakdown.rest.reduce((s, c) => s + c.totalValue, 0)} />
      {breakdown.rest.length === 0 ? (
        <Card index={0} className="mb-6"><EmptyState message={t('noData')} icon={<Store size={28} />} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {breakdown.rest.map((cat, ci) => (
            <Card key={cat.category || 'uncat'} index={ci}>
              <CategoryBar icon={<Package size={16} />} name={catLabel(cat.category)} sub={`${cat.totalQty} ${t('available').toLowerCase()}`} value={cat.totalValue} accent="caramel" />
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-vanilla/60 text-text-secondary"><tr>
                    <th className="text-left px-3 py-2">{t('name')}</th>
                    <th className="text-right px-3 py-2">{t('available')}</th>
                    <th className="text-right px-3 py-2">{t('restValue')}</th>
                  </tr></thead>
                  <tbody>
                    {cat.products.map((p, pi) => (
                      <tr key={p.productName + pi} className="border-t border-gold/10">
                        <td className="px-3 py-2 font-medium text-text-primary">{p.productName}</td>
                        <td className="px-3 py-2 text-right tabular">{p.quantity}{p.unit ? ` ${p.unit}` : ''}</td>
                        <td className="px-3 py-2 text-right tabular text-gold-dark font-semibold">{formatCurrency(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== Destructions (only if any) ===== */}
      {calc.dayDestructions.length > 0 && (
        <>
          <SectionHeader icon={<Flame size={18} />} title={t('dayDestructions')} total={calc.destroyedValue} />
          <Card index={0} className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-vanilla/60 text-text-secondary"><tr>
                  <th className="text-left px-3 py-2">{t('name')}</th>
                  <th className="text-left px-3 py-2">{t('reason')}</th>
                  <th className="text-left px-3 py-2">{t('date')}</th>
                  <th className="text-right px-3 py-2">{t('quantity')}</th>
                  <th className="text-right px-3 py-2">{t('moneyWasted')}</th>
                </tr></thead>
                <tbody>
                  {calc.dayDestructions.map((d) => (
                    <tr key={d.id} className="border-t border-gold/10">
                      <td className="px-3 py-2 font-medium text-text-primary">{d.productName}</td>
                      <td className="px-3 py-2 text-text-secondary">{d.reason}</td>
                      <td className="px-3 py-2 text-text-muted">{formatDate(d.date, language)}</td>
                      <td className="px-3 py-2 text-right tabular">{d.quantity}{d.unit ? ` ${d.unit}` : ''}</td>
                      <td className="px-3 py-2 text-right tabular text-rose-deep font-semibold">{formatCurrency(d.value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gold/15 bg-vanilla/40 font-bold">
                    <td className="px-3 py-2" colSpan={4}>{t('total')}</td>
                    <td className="px-3 py-2 text-right tabular text-rose-deep">{formatCurrency(calc.destroyedValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ===== Summary + reconciliation ===== */}
      <SectionHeader icon={<Scale size={18} />} title={t('reportSummary')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Economic gains breakdown */}
        <Card index={0}>
          <h3 className="font-display font-semibold text-text-primary mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-gold-dark" /> {t('dayGains')}</h3>
          <div className="space-y-2 text-sm">
            <Line label={t('grossSales')} value={calc.salesGross} positive />
            <Line label={`− ${t('dayPurchases')}`} value={calc.purchasesTotal} />
            <Line label={`− ${t('dayWorkerPayments')}`} value={calc.workerTotal} />
            <Line label={`− ${t('dayExpenses')}`} value={calc.expensesTotal} />
            <Line label={`− ${t('moneyWasted')} (${t('destruction')})`} value={calc.destroyedValue} />
            <div className="border-t border-gold/15 pt-2 flex justify-between font-bold">
              <span className="text-text-primary">{t('dayGains')}</span>
              <span className={`tabular ${calc.gains >= 0 ? 'text-pistachio' : 'text-rose-deep'}`}>{formatCurrency(calc.gains)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-muted pt-1">
              <span>{t('productionByCategory')} — {t('totalGains')}</span>
              <span className={`tabular ${calc.productionGains >= 0 ? 'text-pistachio' : 'text-rose-deep'}`}>{formatCurrency(calc.productionGains)}</span>
            </div>
          </div>
        </Card>

        {/* Reconciliation: declared vs theoretical */}
        <Card index={1}>
          <h3 className="font-display font-semibold text-text-primary mb-4 flex items-center gap-2"><Wallet size={18} className="text-gold-dark" /> {t('decalage')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ReconTile label={t('declaredAmount')} value={report.declaredAmount} accent="gold" />
            <ReconTile label={t('shouldBeInCaisse')} value={calc.theoretical} accent="lavender" />
            <ReconTile label={t('decalage')} value={calc.decalage} accent={balanced ? 'pistachio' : calc.decalage > 0 ? 'caramel' : 'rose'} signed />
          </div>
          <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${balanced ? 'bg-pistachio/15 text-pistachio' : calc.decalage > 0 ? 'bg-caramel/15 text-gold-dark' : 'bg-rose-deep/15 text-rose-deep'}`}>
            {balanced ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {balanced ? t('noDecalage') : `${calc.decalage > 0 ? t('surplus') : t('deficit')}: ${formatCurrency(Math.abs(calc.decalage))}`}
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <Line label={t('totalDeposits')} value={calc.depositsTotal} positive />
            <Line label={t('totalWithdrawals')} value={calc.withdrawalsTotal} />
          </div>
        </Card>
      </div>

      {/* Cash movements modal */}
      <Modal open={movementsOpen} onClose={() => setMovementsOpen(false)} title={t('cashMovements')} size="md">
        <div className="space-y-5">
          <MovementBlock title={t('totalDeposits')} icon={<ArrowDownLeft size={16} />} tone="mint" rows={calc.dayDeposits} total={calc.depositsTotal} emptyLabel={t('noMovements')} language={language} />
          <MovementBlock title={t('totalWithdrawals')} icon={<ArrowUpRight size={16} />} tone="rose" rows={calc.dayWithdrawals} total={calc.withdrawalsTotal} emptyLabel={t('noMovements')} language={language} />
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Presentational helpers
// ============================================================
const ACCENTS: Record<string, string> = {
  gold: 'from-[#FF9CC0] to-[#F0568A]',
  rose: 'from-[#FFB0CB] to-[#F2547D]',
  pistachio: 'from-[#A6E9CE] to-[#3FB591]',
  caramel: 'from-[#FFD08A] to-[#F2944A]',
  lavender: 'from-[#CDB0F5] to-[#9B7ED8]',
};
const ACCENT_TEXT: Record<string, string> = {
  gold: 'text-gold-dark', rose: 'text-rose-deep', pistachio: 'text-pistachio', caramel: 'text-gold-dark', lavender: 'text-[#7B5BB8]',
};

function SectionHeader({ icon, title, total }: { icon: React.ReactNode; title: string; total?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display font-semibold text-text-primary flex items-center gap-2">
        <span className="text-gold-dark">{icon}</span> {title}
      </h3>
      {total !== undefined && <span className="text-sm font-bold tabular text-gold-dark">{formatCurrency(total)}</span>}
    </div>
  );
}

function CategoryBar({ icon, name, sub, value, accent, extra }: { icon: React.ReactNode; name: string; sub?: string; value: number; accent: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-vanilla/40 border border-gold/10 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 ${ACCENTS[accent]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
          {sub && <p className="text-xs text-text-muted truncate">{sub}</p>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base font-bold tabular ${ACCENT_TEXT[accent]}`}>{formatCurrency(value)}</p>
        {extra}
      </div>
    </div>
  );
}

function CalcCard({ index, icon, label, value, accent, count, signed }: {
  index: number; icon: React.ReactNode; label: string; value: number; accent: string; count?: number; signed?: boolean;
}) {
  const sign = signed && value > 0 ? '+ ' : signed && value < 0 ? '− ' : '';
  return (
    <motion.div
      custom={index} variants={cardVariants} initial="hidden" animate="visible"
      className="relative overflow-hidden rounded-2xl bg-gradient-card border border-gold/15 shadow-card p-5"
    >
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-10 ${ACCENTS[accent]}`} />
      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm mb-3 ${ACCENTS[accent]}`}>{icon}</div>
      <p className="text-sm text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular ${ACCENT_TEXT[accent]}`}>{sign}{formatCurrency(Math.abs(value))}</p>
      {count !== undefined && <p className="text-xs text-text-muted mt-1">{count} {count > 1 ? 'opérations' : 'opération'}</p>}
    </motion.div>
  );
}

function MiniTile({ label, value, tone }: { label: string; value: string; tone?: 'rose' | 'gold' | 'mint' }) {
  const cls = tone === 'rose' ? 'text-rose-deep' : tone === 'gold' ? 'text-gold-dark' : tone === 'mint' ? 'text-pistachio' : 'text-text-primary';
  return (
    <div className="bg-white/70 rounded-lg p-2 text-center border border-gold/10">
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className={`text-sm font-bold tabular ${cls}`}>{value}</p>
    </div>
  );
}

function Line({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={`tabular ${positive ? 'text-pistachio' : 'text-text-primary'}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function ReconTile({ label, value, accent, signed }: { label: string; value: number; accent: string; signed?: boolean }) {
  const sign = signed && value > 0 ? '+ ' : signed && value < 0 ? '− ' : '';
  return (
    <div className="rounded-xl bg-vanilla/50 border border-gold/15 p-4">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold tabular ${ACCENT_TEXT[accent]}`}>{sign}{formatCurrency(Math.abs(value))}</p>
    </div>
  );
}

function MovementBlock({ title, icon, tone, rows, total, emptyLabel, language }: {
  title: string; icon: React.ReactNode; tone: 'mint' | 'rose';
  rows: { id: string; date: string; amount: number; description: string; createdBy?: string }[];
  total: number; emptyLabel: string; language: 'fr' | 'ar';
}) {
  const grad = tone === 'mint' ? 'from-[#A6E9CE] to-[#3FB591]' : 'from-[#FFB0CB] to-[#F2547D]';
  const text = tone === 'mint' ? 'text-pistachio' : 'text-rose-deep';
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className={`h-7 w-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white ${grad}`}>{icon}</span> {title}
        </span>
        <span className={`text-sm font-bold tabular ${text}`}>{formatCurrency(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-3">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-vanilla/40 border border-gold/10">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{m.description || title}</p>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Calendar size={11} /> {formatDate(m.date, language)}{m.createdBy ? ` · ${m.createdBy}` : ''}
                </p>
              </div>
              <span className={`text-sm font-bold tabular shrink-0 ${text}`}>{tone === 'mint' ? '+' : '−'} {formatCurrency(m.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
