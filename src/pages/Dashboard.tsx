import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, Package, ShoppingCart, CakeSlice, AlertTriangle, CreditCard,
  TrendingUp, Users, Truck, Banknote, Clock, HardHat, Receipt, Percent,
  ShoppingBag, LayoutGrid, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/hooks/useLanguage';
import { useStockStore } from '@/store/stockStore';
import { useSalesStore } from '@/store/salesStore';
import { usePurchaseStore } from '@/store/purchaseStore';
import { useProductionStore } from '@/store/productionStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useClientStore } from '@/store/clientStore';
import { useWorkerStore } from '@/store/workerStore';
import { useCommandStore } from '@/store/commandStore';
import { formatCurrency, formatDate, daysUntil, getMonthLabel } from '@/lib/utils';

const CHART_COLORS = ['#FF6B2C', '#0EA5A4', '#16A34A', '#FFC43D', '#EF4444', '#F59E0B'];

type RangeKey = 'today' | 'week' | 'month' | 'year' | 'all';

const DAY = 24 * 60 * 60 * 1000;

function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return cur > 0 ? 100 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('month');

  const products = useStockStore((s) => s.products);
  const categories = useStockStore((s) => s.categories);
  const sales = useSalesStore((s) => s.sales);
  const purchases = usePurchaseStore((s) => s.purchases);
  const productions = useProductionStore((s) => s.productions);
  const expenses = useExpenseStore((s) => s.expenses);
  const clients = useClientStore((s) => s.clients);
  const workers = useWorkerStore((s) => s.workers);
  const commands = useCommandStore((s) => s.commands);

  const rangeTabs: { key: RangeKey; label: string }[] = [
    { key: 'today', label: t('today') },
    { key: 'week', label: t('week') },
    { key: 'month', label: t('month') },
    { key: 'year', label: t('year') },
    { key: 'all', label: t('all') },
  ];

  // Period + previous-period window (rolling) for trend deltas.
  const windows = useMemo(() => {
    const now = Date.now();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const spans: Record<RangeKey, number> = { today: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY, all: 0 };
    if (range === 'all') return { from: 0, to: now, prevFrom: 0, prevTo: 0 };
    const span = spans[range];
    const from = range === 'today' ? start.getTime() : now - span;
    return { from, to: now, prevFrom: from - span, prevTo: from };
  }, [range]);

  const inRange = (d: string, from: number, to: number) => {
    const ts = new Date(d).getTime();
    return ts >= from && ts <= to;
  };

  const kpis = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const compute = (from: number, to: number) => {
      const ps = sales.filter((s) => inRange(s.date, from, to));
      const revenue = sum(ps.map((s) => s.finalAmount));
      const collected = sum(ps.map((s) => s.paidAmount));
      const outstanding = sum(ps.map((s) => s.restAmount));
      const orders = ps.length;
      const purch = sum(purchases.filter((p) => inRange(p.date, from, to)).map((p) => p.totalAmount));
      const exp = sum(expenses.filter((e) => inRange(e.date, from, to)).map((e) => e.amount));
      const profit = revenue - purch - exp;
      const avgTicket = orders ? revenue / orders : 0;
      const margin = revenue ? ((revenue - purch) / revenue) * 100 : 0;
      return { revenue, collected, outstanding, orders, purch, exp, profit, avgTicket, margin };
    };
    const cur = compute(windows.from, windows.to);
    const prev = range === 'all' ? null : compute(windows.prevFrom, windows.prevTo);
    return { cur, prev };
  }, [sales, purchases, expenses, windows, range]);

  const globals = useMemo(() => {
    const totalStock = products.reduce((sum, p) => sum + p.currentQuantity, 0);
    const lowStock = products.filter((p) => p.currentQuantity <= p.minAlertQuantity);
    const clientDebts = sales.reduce((sum, s) => sum + s.restAmount, 0);
    const supplierDebts = purchases.reduce((sum, p) => sum + p.restAmount, 0);
    const today = new Date().toDateString();
    const todayProductions = productions.filter((p) => new Date(p.date).toDateString() === today).length;
    return { totalStock, lowStock, clientDebts, supplierDebts, todayProductions, totalClients: clients.length };
  }, [products, sales, purchases, productions, clients]);

  // Upcoming commands due within the next 48 hours or overdue by 2 hours
  const upcomingCommands = useMemo(() => {
    return commands
      .filter((c) => c.status === 'pending')
      .map((c) => {
        const [y, m, d] = c.receiveDate.split('-').map(Number);
        const deliveryDate = new Date(y, m - 1, d, Number(c.receiveHour || 0), Number(c.receiveMinute || 0));
        const diffHrs = (deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60);
        return { ...c, diffHrs, deliveryDate };
      })
      .filter((c) => c.diffHrs >= -2 && c.diffHrs <= 48)
      .sort((a, b) => a.diffHrs - b.diffHrs);
  }, [commands]);

  const salesEvolution = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => map.set(s.date, (map.get(s.date) || 0) + s.finalAmount));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date: formatDate(date, language).slice(0, 5), amount }));
  }, [sales, language]);

  const monthlyComparison = useMemo(() => {
    const months = new Map<string, { sales: number; purchases: number; expenses: number }>();
    const ensure = (k: string) => {
      if (!months.has(k)) months.set(k, { sales: 0, purchases: 0, expenses: 0 });
      return months.get(k)!;
    };
    sales.forEach((s) => (ensure(getMonthLabel(s.date)).sales += s.finalAmount));
    purchases.forEach((p) => (ensure(getMonthLabel(p.date)).purchases += p.totalAmount));
    expenses.forEach((e) => (ensure(getMonthLabel(e.date)).expenses += e.amount));
    return Array.from(months.entries()).map(([month, v]) => ({ month, ...v }));
  }, [sales, purchases, expenses]);

  const categoryDist = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) =>
      s.products.forEach((line) => {
        const prod = products.find((p) => p.id === line.productId);
        const cat = categories.find((c) => c.id === prod?.categoryId);
        map.set(cat?.name || 'Autre', (map.get(cat?.name || 'Autre') || 0) + line.quantity);
      })
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [sales, products, categories]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) =>
      s.products.forEach((line) => {
        map.set(line.productName || line.productId, (map.get(line.productName || line.productId) || 0) + line.quantity);
      })
    );
    const arr = Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const max = arr[0]?.qty || 1;
    return arr.map((p) => ({ ...p, pct: (p.qty / max) * 100 }));
  }, [sales]);

  const recentSales = useMemo(() => [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [sales]);
  const expirations = useMemo(
    () => products.filter((p) => { const d = daysUntil(p.expirationDate); return d !== null && d >= 0 && d <= 7; }).slice(0, 5),
    [products]
  );

  const { cur, prev } = kpis;
  const collectRate = cur.revenue ? (cur.collected / cur.revenue) * 100 : 0;

  const statItems = [
    { label: t('periodRevenue'), value: cur.revenue, icon: <Wallet size={22} />, format: 'currency' as const, accent: 'gold' as const, delta: prev ? pctDelta(cur.revenue, prev.revenue) : null, hint: t('vsPrevious') },
    { label: t('netProfit'), value: cur.profit, icon: <TrendingUp size={22} />, format: 'currency' as const, accent: (cur.profit >= 0 ? 'pistachio' : 'rose') as 'pistachio' | 'rose', delta: prev ? pctDelta(cur.profit, prev.profit) : null, hint: t('vsPrevious') },
    { label: t('totalOrders'), value: cur.orders, icon: <Receipt size={22} />, format: 'number' as const, accent: 'lavender' as const, delta: prev ? pctDelta(cur.orders, prev.orders) : null, hint: t('vsPrevious') },
    { label: t('avgTicket'), value: cur.avgTicket, icon: <ShoppingBag size={22} />, format: 'currency' as const, accent: 'caramel' as const, delta: prev ? pctDelta(cur.avgTicket, prev.avgTicket) : null, hint: t('vsPrevious') },
    { label: t('grossMargin'), value: cur.margin, icon: <Percent size={22} />, format: 'number' as const, accent: 'pistachio' as const, suffix: '%' },
    { label: t('monthPurchases'), value: cur.purch, icon: <ShoppingCart size={22} />, format: 'currency' as const, accent: 'caramel' as const, delta: prev ? pctDelta(cur.purch, prev.purch) : null, hint: t('vsPrevious') },
    { label: t('productsInStock'), value: globals.totalStock, icon: <Package size={22} />, format: 'number' as const, accent: 'pistachio' as const },
    { label: t('stockAlerts'), value: globals.lowStock.length, icon: <AlertTriangle size={22} />, format: 'number' as const, accent: 'rose' as const },
  ];

  const quickActions = [
    { label: t('pos'), icon: <CreditCard size={18} />, to: '/pos', accent: 'gold' },
    { label: t('stock'), icon: <Package size={18} />, to: '/stock', accent: 'pistachio' },
    { label: t('purchase'), icon: <ShoppingCart size={18} />, to: '/purchase', accent: 'caramel' },
    { label: t('clients'), icon: <Users size={18} />, to: '/clients', accent: 'lavender' },
  ];

  return (
    <div>
      <PageHeader title={t('dashboard')} subtitle={formatDate(new Date(), language)} icon={<TrendingUp size={24} />} />

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-muted mr-1 flex items-center gap-1.5">
          <LayoutGrid size={15} /> {t('overview')} :
        </span>
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-white border border-black/[0.06] shadow-sm">
          {rangeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRange(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold font-display transition-all ${
                range === tab.key ? 'bg-gradient-button text-white shadow-gold' : 'text-text-secondary hover:bg-vanilla'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Command Alerts */}
      {upcomingCommands.length > 0 && (
        <div className="mb-6 space-y-2.5">
          {upcomingCommands.map((cmd) => {
            const isOverdue = cmd.diffHrs < 0;
            const dueText = isOverdue
              ? `En retard de ${Math.abs(Math.round(cmd.diffHrs))}h`
              : cmd.diffHrs < 1
              ? `Dans moins d'une heure (${cmd.receiveHour}h${cmd.receiveMinute})`
              : `Dans ${Math.round(cmd.diffHrs)}h (${formatDate(cmd.receiveDate, language)} à ${cmd.receiveHour}h${cmd.receiveMinute})`;
            return (
              <motion.div
                key={cmd.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-wrap items-center justify-between p-4 rounded-2xl border shadow-sm gap-4 ${
                  isOverdue ? 'bg-rose-deep/10 border-rose-deep/20 text-rose-deep' : 'bg-gold/10 border-gold/25 text-gold-dark'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br shrink-0 ${
                    isOverdue ? 'from-[#FF7A7A] to-[#C1121F]' : 'from-[#FFA76B] to-[#E24E0E]'
                  }`}>
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Livraison de commande : {cmd.clientName} ({cmd.reference})</p>
                    <p className="text-xs opacity-90">{dueText} · {cmd.items.length} articles · Reste à payer: {formatCurrency(cmd.restAmount)}</p>
                  </div>
                </div>
                <Button size="sm" variant={isOverdue ? 'rose' : 'gold'} onClick={() => navigate('/clients/commands')}>Gérer</Button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Row 1: KPI stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statItems.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>

      {/* Row 2: Business health + payment breakdown + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card index={0} accent="gold" className="lg:col-span-2">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('paymentBreakdown')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MiniKpi label={t('collected')} value={cur.collected} color="text-pistachio" />
            <MiniKpi label={t('outstanding')} value={cur.outstanding} color="text-rose-deep" />
            <MiniKpi label={t('cashOut')} value={cur.purch + cur.exp} color="text-caramel" />
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>{t('collected')}</span>
              <span className="tabular font-semibold text-text-secondary">{collectRate.toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full bg-vanilla overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(collectRate, 100)}%` }} transition={{ duration: 0.8 }}
                className="h-full bg-gradient-mint rounded-full" />
            </div>
          </div>
        </Card>

        <Card index={1} accent="lavender">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('quickActions')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className="group flex flex-col items-start gap-2 p-3 rounded-xl border border-black/[0.06] bg-white hover:border-gold/30 hover:shadow-sm transition-all"
              >
                <span className={`h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm ${
                  a.accent === 'gold' ? 'from-[#FFA76B] to-[#E24E0E]' :
                  a.accent === 'pistachio' ? 'from-[#6EE7A8] to-[#16A34A]' :
                  a.accent === 'caramel' ? 'from-[#FCD34D] to-[#F59E0B]' : 'from-[#2DD4BF] to-[#0C7E7D]'
                }`}>{a.icon}</span>
                <span className="text-sm font-semibold text-text-primary flex items-center gap-1">
                  {a.label}
                  <ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card index={0} className="lg:col-span-2">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('salesEvolution')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={salesEvolution}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B2C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF6B2C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD9C280" />
              <XAxis dataKey="date" stroke="#9A8574" fontSize={11} />
              <YAxis stroke="#9A8574" fontSize={11} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #FFD9C2' }} />
              <Area type="monotone" dataKey="amount" stroke="#FF6B2C" strokeWidth={3} fill="url(#salesGrad)" dot={{ fill: '#E24E0E', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card index={1}>
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('salesVsPurchases')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD9C280" />
              <XAxis dataKey="month" stroke="#9A8574" fontSize={11} />
              <YAxis stroke="#9A8574" fontSize={11} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #FFD9C2' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" name={t('sales')} fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name={t('purchase')} fill="#FF6B2C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name={t('expenses')} fill="#0EA5A4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card index={2}>
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('categoryDistribution')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={85} paddingAngle={2} label={(e) => e.name}>
                {categoryDist.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #FFD9C2' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 4: Top products / recent sales / stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card index={0} accent="gold">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('topProducts')}</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary truncate">{i + 1}. {p.name}</span>
                  <span className="tabular text-text-muted">{p.qty}</span>
                </div>
                <div className="h-2 rounded-full bg-vanilla overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} transition={{ delay: i * 0.1, duration: 0.6 }}
                    className="h-full bg-gradient-button rounded-full" />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-text-muted">—</p>}
          </div>
        </Card>

        <Card index={1} accent="lavender">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('recentSales')}</h3>
          <div className="space-y-2.5">
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">{s.reference}</p>
                  <p className="text-xs text-text-muted">{clients.find((c) => c.id === s.clientId)?.name || t('walkIn')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular text-text-primary">{formatCurrency(s.finalAmount)}</p>
                  <Badge variant={s.status === 'paid' ? 'success' : 'danger'}>{s.status === 'paid' ? t('paid') : t('rest')}</Badge>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && <p className="text-sm text-text-muted">—</p>}
          </div>
        </Card>

        <Card index={2} accent="rose">
          <h3 className="font-display font-semibold text-rose-deep mb-4 flex items-center gap-2">
            <AlertTriangle size={18} /> {t('stockAlerts')}
          </h3>
          <div className="space-y-2.5">
            {globals.lowStock.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm bg-rose/5 rounded-lg px-3 py-2">
                <span className="text-text-secondary truncate">{p.name}</span>
                <Badge variant="danger">{p.currentQuantity} / {p.minAlertQuantity}</Badge>
              </div>
            ))}
            {globals.lowStock.length === 0 && <p className="text-sm text-text-muted">Aucune alerte ✅</p>}
          </div>
        </Card>
      </div>

      {/* Row 5: Finances + expirations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card index={0} accent="caramel">
          <h3 className="font-display font-semibold text-text-primary mb-4">{t('businessHealth')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FinanceTile icon={<Truck size={18} />} label={t('supplierDebts')} value={globals.supplierDebts} color="text-caramel" />
            <FinanceTile icon={<Users size={18} />} label={t('clientDebts')} value={globals.clientDebts} color="text-rose-deep" />
            <FinanceTile icon={<Banknote size={18} />} label={t('totalExpenses')} value={cur.exp} color="text-lavender-deep" />
            <FinanceTile icon={<CakeSlice size={18} />} label={t('todayProductions')} value={globals.todayProductions} color="text-pistachio" isCount />
          </div>
        </Card>

        <Card index={1} accent="pistachio">
          <h3 className="font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock size={18} /> {t('nextExpirations')}
          </h3>
          <div className="space-y-2.5">
            {expirations.map((p) => {
              const d = daysUntil(p.expirationDate);
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary truncate">{p.name}</span>
                  <Badge variant={d !== null && d <= 2 ? 'danger' : 'warning'}>{d === 0 ? "Aujourd'hui" : `${d} j`}</Badge>
                </div>
              );
            })}
            {expirations.length === 0 && <p className="text-sm text-text-muted">Aucune expiration proche</p>}
          </div>
        </Card>
      </div>

      {/* Row 6: Workers */}
      <Card index={0} accent="gold">
        <h3 className="font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <HardHat size={18} /> {t('activeWorkers')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FinanceTile icon={<HardHat size={18} />} label={t('activeWorkers')} value={workers.length} color="text-gold-dark" isCount />
          <FinanceTile icon={<Banknote size={18} />} label="Paiements ce mois"
            value={workers.filter((w) => w.paymentEnabled && w.paymentType === 'monthly').reduce((s, w) => s + w.paymentAmount, 0)} color="text-pistachio" />
          <FinanceTile icon={<Clock size={18} />} label={t('absences')}
            value={workers.reduce((s, w) => s + w.absences.length, 0)} color="text-rose-deep" isCount />
          <FinanceTile icon={<Wallet size={18} />} label={t('acomptes')}
            value={workers.reduce((s, w) => s + w.acomptes.reduce((a, ac) => a + ac.amount, 0), 0)} color="text-caramel" />
        </div>
      </Card>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white border border-black/[0.06] p-4">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold tabular ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function FinanceTile({ icon, label, value, color, isCount }: { icon: React.ReactNode; label: string; value: number; color: string; isCount?: boolean }) {
  return (
    <div className="bg-vanilla/50 rounded-xl p-3.5 border border-black/[0.05]">
      <div className={`flex items-center gap-2 mb-1.5 ${color}`}>{icon}</div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular ${color}`}>{isCount ? value : formatCurrency(value)}</p>
    </div>
  );
}
