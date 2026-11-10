import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, FileText, Printer, Wallet, ShoppingCart, Banknote, Package,
  Receipt, AlertTriangle, Flame, HardHat, Truck, Users, CakeSlice, Store,
  ArrowDownLeft, ArrowUpRight, Scale, ChevronRight, Coins, Trophy, TrendingDown,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/hooks/useLanguage';
import { useSalesStore } from '@/store/salesStore';
import { usePurchaseStore } from '@/store/purchaseStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useProductionStore } from '@/store/productionStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useStockStore } from '@/store/stockStore';
import { useClientStore } from '@/store/clientStore';
import { useSupplierStore } from '@/store/supplierStore';
import { useWorkerStore } from '@/store/workerStore';
import { useCaisseStore } from '@/store/caisseStore';
import { useCaisseReportStore } from '@/store/caisseReportStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDate, isWithinRange } from '@/lib/utils';
import { printHTML } from '@/lib/print';
import { computeReportCalc } from '@/pages/Caisse/CaisseReports';

type Row = { title: string; sub?: string; value: number; danger?: boolean };

const ACCENTS: Record<string, string> = {
  gold: 'from-[#FFA76B] to-[#E24E0E]',
  rose: 'from-[#FF7A7A] to-[#C1121F]',
  pistachio: 'from-[#6EE7A8] to-[#16A34A]',
  caramel: 'from-[#FCD34D] to-[#F59E0B]',
  lavender: 'from-[#2DD4BF] to-[#0C7E7D]',
};
const ACCENT_TEXT: Record<string, string> = {
  gold: 'text-gold-dark', rose: 'text-rose-deep', pistachio: 'text-pistachio', caramel: 'text-caramel', lavender: 'text-lavender-deep',
};

export default function ReportsPage() {
  const { t, language } = useLanguage();
  const sales = useSalesStore((s) => s.sales);
  const purchases = usePurchaseStore((s) => s.purchases);
  const expenses = useExpenseStore((s) => s.expenses);
  const productions = useProductionStore((s) => s.productions);
  const destructions = useComptoirStore((s) => s.destructions);
  const comptoirItems = useComptoirStore((s) => s.items);
  const products = useStockStore((s) => s.products);
  const marques = useStockStore((s) => s.marques);
  const categories = useStockStore((s) => s.categories);
  const clients = useClientStore((s) => s.clients);
  const suppliers = useSupplierStore((s) => s.suppliers);
  const workers = useWorkerStore((s) => s.workers);
  const transactions = useCaisseStore((s) => s.transactions);
  const caisseReports = useCaisseReportStore((s) => s.reports);
  const settings = useSettingsStore((s) => s.settings);

  const [from, setFrom] = useState('2026-06-01');
  const [to, setTo] = useState('2026-06-30');
  const [generated, setGenerated] = useState(false);
  const [drill, setDrill] = useState<{ title: string; rows: Row[] } | null>(null);

  // Accordion toggle states
  const [expandedProdId, setExpandedProdId] = useState<string | null>(null);
  const [expandedCatName, setExpandedCatName] = useState<string | null>(null);

  const report = useMemo(() => {
    if (!generated) return null;
    const inRange = (d: string) => isWithinRange(d, from, to);
    const rSales = sales.filter((s) => inRange(s.date));
    const rPurchases = purchases.filter((p) => inRange(p.date));
    const rExpenses = expenses.filter((e) => inRange(e.date));
    const rProductions = productions.filter((p) => inRange(p.date));
    const rDestructions = destructions.filter((d) => inRange(d.date));
    const rTx = transactions.filter((x) => inRange(x.date));
    const rReports = caisseReports.filter((r) => inRange(r.date));

    const totalSales = rSales.reduce((s, x) => s + x.finalAmount, 0);
    const totalPurchases = rPurchases.reduce((s, x) => s + x.totalAmount, 0);
    const totalExpenses = rExpenses.reduce((s, x) => s + x.amount, 0);

    const workerPayments = workers.reduce((s, w) => s + w.payments.filter((p) => inRange(p.date)).reduce((a, p) => a + p.amount, 0), 0);
    const workerAcomptes = workers.reduce((s, w) => s + w.acomptes.filter((a) => inRange(a.date)).reduce((x, a) => x + a.amount, 0), 0);
    const destroyedValue = rDestructions.reduce((s, d) => s + d.value, 0);
    const netProfit = totalSales - totalPurchases - totalExpenses - workerPayments - destroyedValue;

    const clientDebts = rSales.filter((s) => s.restAmount > 0);
    const supplierDebts = rPurchases.filter((p) => p.restAmount > 0);
    const totalClientDebt = clientDebts.reduce((s, x) => s + x.restAmount, 0);
    const totalSupplierDebt = supplierDebts.reduce((s, x) => s + x.restAmount, 0);

    const stockValue = products.reduce((s, p) => s + p.currentQuantity * p.purchasePrice, 0);
    const lowStock = products.filter((p) => p.currentQuantity <= p.minAlertQuantity);
    const comptoirValue = comptoirItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    const deposits = rTx.filter((x) => x.type === 'deposit');
    const withdrawals = rTx.filter((x) => x.type === 'withdrawal');
    const depositsTotal = deposits.reduce((s, x) => s + x.amount, 0);
    const withdrawalsTotal = withdrawals.reduce((s, x) => s + x.amount, 0);

    // Caisse report decalages
    const reportCalcs = rReports.map((r) => ({ report: r, calc: computeReportCalc(r, { sales, purchases, expenses, destructions, workers, transactions }) }));
    const totalDecalage = reportCalcs.reduce((s, x) => s + x.calc.decalage, 0);

    // Comptoir analysis (best / worst sellers within range)
    const salesMap = new Map<string, { name: string; units: number; revenue: number; unit?: string; sellByUnit?: boolean }>();
    rSales.forEach((s) => s.products.forEach((l) => {
      const key = l.productName || '—';
      const e = salesMap.get(key) || { name: key, units: 0, revenue: 0, unit: l.unit, sellByUnit: l.sellByUnit };
      e.units += l.quantity; e.revenue += l.quantity * l.sellingPrice;
      if (l.sellByUnit) { e.sellByUnit = true; e.unit = l.unit; }
      salesMap.set(key, e);
    }));
    const soldRanked = [...salesMap.values()].sort((a, b) => b.units - a.units);
    const productSalesRevenue = soldRanked.reduce((s, p) => s + p.revenue, 0);

    // Comptoir rest right now (per product) + total value
    const restItems = comptoirItems
      .filter((i) => i.quantity > 0)
      .map((i) => ({ name: i.productName, quantity: i.quantity, value: i.quantity * i.unitPrice, unit: i.sellByUnit ? i.unit : undefined }))
      .sort((a, b) => b.value - a.value);

    // ---- Group purchases by category ----
    const purchasesCatMap = new Map<string, { categoryName: string; totalAmount: number; products: { [name: string]: { name: string; quantity: number; unit?: string; totalCost: number } } }>();
    rPurchases.forEach(pur => {
      pur.products.forEach(line => {
        const prod = products.find(p => p.id === line.productId);
        const catName = prod ? (categories.find(c => c.id === prod.categoryId)?.name || 'Sans Catégorie') : 'Sans Catégorie';
        
        if (!purchasesCatMap.has(catName)) {
          purchasesCatMap.set(catName, { categoryName: catName, totalAmount: 0, products: {} });
        }
        const catGroup = purchasesCatMap.get(catName)!;
        const lineTotal = line.quantity * line.purchasePrice;
        catGroup.totalAmount += lineTotal;

        const pName = line.productName || '—';
        if (!catGroup.products[pName]) {
          catGroup.products[pName] = { name: pName, quantity: 0, unit: line.unit, totalCost: 0 };
        }
        const pGroup = catGroup.products[pName];
        pGroup.quantity += line.quantity;
        pGroup.totalCost += lineTotal;
      });
    });
    const purchasesByCategory = [...purchasesCatMap.values()].map(cat => ({
      ...cat,
      productsList: Object.values(cat.products).sort((a, b) => b.totalCost - a.totalCost)
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      rSales, rPurchases, rExpenses, rProductions, rDestructions, rTx,
      totalSales, totalPurchases, totalExpenses, workerPayments, workerAcomptes,
      destroyedValue, netProfit, clientDebts, supplierDebts, totalClientDebt, totalSupplierDebt,
      stockValue, lowStock, comptoirValue, deposits, withdrawals, depositsTotal, withdrawalsTotal,
      reportCalcs, totalDecalage, soldRanked, productSalesRevenue, restItems,
      purchasesByCategory
    };
  }, [generated, from, to, sales, purchases, expenses, productions, destructions, comptoirItems, products, categories, clients, suppliers, workers, transactions, caisseReports]);

  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name || '—' : t('walkIn'));
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || '—';
  const marqueName = (id: string) => marques.find((m) => m.id === id)?.name || '—';
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || '—';

  const handlePrint = () => {
    if (!report) return;

    let purchasesCatHTML = '';
    if (report.purchasesByCategory.length > 0) {
      purchasesCatHTML = `
        <h3 style="margin-top: 20px; font-family: sans-serif; color: #444;">Achats par Catégorie</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f2f2f2; border-bottom: 2px solid #ddd;">
              <th style="text-align: left; padding: 8px;">Catégorie / Produit</th>
              <th style="text-align: right; padding: 8px;">Quantité</th>
              <th style="text-align: right; padding: 8px;">P.U Moyen</th>
              <th style="text-align: right; padding: 8px;">Montant Total</th>
            </tr>
          </thead>
          <tbody>
            ${report.purchasesByCategory.map(cat => `
              <tr style="background-color: #eaeaea; font-weight: bold; border-bottom: 1px solid #ccc;">
                <td colspan="3" style="padding: 8px;">Catégorie: ${cat.categoryName}</td>
                <td style="text-align: right; padding: 8px;">${formatCurrency(cat.totalAmount)}</td>
              </tr>
              ${cat.productsList.map(p => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 6px 6px 6px 24px; color: #555;">${p.name}</td>
                  <td style="text-align: right; padding: 6px; color: #555;">${p.quantity}${p.unit ? ` ${p.unit}` : ''}</td>
                  <td style="text-align: right; padding: 6px; color: #555;">${formatCurrency(p.quantity > 0 ? p.totalCost / p.quantity : 0)}</td>
                  <td style="text-align: right; padding: 6px; font-weight: bold; color: #444;">${formatCurrency(p.totalCost)}</td>
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let productionsHTML = '';
    if (report.rProductions.length > 0) {
      productionsHTML = `
        <h3 style="margin-top: 20px; font-family: sans-serif; color: #444;">Ingrédients Consommés par Production</h3>
        ${report.rProductions.map(p => {
          const cost = p.usedProducts.reduce((sum, u) => sum + (u.lineCost ?? (u.quantityUsed * (u.unitCost ?? 0))), 0);
          return `
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 15px; background-color: #fcfcfc;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 6px; font-size: 13px;">
                <span>Production: ${p.name}</span>
                <span>Rendement: ${p.outputQuantity} unités</span>
              </div>
              <div style="font-size: 11px; color: #666; margin-bottom: 6px;">
                Date: ${formatDate(p.date, language)} · Coût total des ingrédients: <strong style="color: #c93b3b;">${formatCurrency(cost)}</strong>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="background-color: #f5f5f5; color: #666;">
                    <th style="text-align: left; padding: 4px;">Ingrédient</th>
                    <th style="text-align: right; padding: 4px;">Quantité</th>
                    <th style="text-align: right; padding: 4px;">P.U Achat</th>
                    <th style="text-align: right; padding: 4px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${p.usedProducts.map(u => `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 4px; color: #444;">${u.productName}</td>
                      <td style="text-align: right; padding: 4px; color: #444;">${u.quantityUsed}${u.unit ? ` ${u.unit}` : ''}</td>
                      <td style="text-align: right; padding: 4px; color: #444;">${formatCurrency(u.unitCost ?? 0)}</td>
                      <td style="text-align: right; padding: 4px; font-weight: bold; color: #c93b3b;">${formatCurrency(u.lineCost ?? (u.quantityUsed * (u.unitCost ?? 0)))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
      `;
    }

    const body = `
      <div class="title-bar"><div class="title">RAPPORT</div><div class="title-meta"><strong>${formatDate(from)} → ${formatDate(to)}</strong></div></div>
      <br/>
      <table><thead><tr><th>Indicateur</th><th>Montant</th></tr></thead><tbody>
        <tr><td>Total ventes</td><td>${formatCurrency(report.totalSales)}</td></tr>
        <tr><td>Total achats</td><td>${formatCurrency(report.totalPurchases)}</td></tr>
        <tr><td>Total dépenses</td><td>${formatCurrency(report.totalExpenses)}</td></tr>
        <tr><td>Paiements employés</td><td>${formatCurrency(report.workerPayments)}</td></tr>
        <tr><td>Valeur détruite</td><td>${formatCurrency(report.destroyedValue)}</td></tr>
        <tr><td><strong>Bénéfice net</strong></td><td><strong>${formatCurrency(report.netProfit)}</strong></td></tr>
        <tr><td>Valeur stock actuel</td><td>${formatCurrency(report.stockValue)}</td></tr>
        <tr><td>Dettes clients</td><td>${formatCurrency(report.totalClientDebt)}</td></tr>
        <tr><td>Dettes fournisseurs</td><td>${formatCurrency(report.totalSupplierDebt)}</td></tr>
        <tr><td>Dépôts caisse</td><td>${formatCurrency(report.depositsTotal)}</td></tr>
        <tr><td>Retraits caisse</td><td>${formatCurrency(report.withdrawalsTotal)}</td></tr>
        <tr><td>Décalage rapports caisse</td><td>${formatCurrency(report.totalDecalage)}</td></tr>
      </tbody></table>
      ${purchasesCatHTML}
      ${productionsHTML}
    `;
    printHTML(`Rapport ${from} - ${to}`, body, '', settings);
  };

  return (
    <div>
      <PageHeader title={t('reports')} icon={<TrendingUp size={24} />}
        actions={report && <Button variant="gold" onClick={handlePrint}><Printer size={18} /> {t('exportPDF')}</Button>} />

      <Card index={0} className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Input label={t('from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[180px]" />
          <Input label={t('to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[180px]" />
          <Button variant="gold" onClick={() => setGenerated(true)}><FileText size={18} /> {t('generateReport')}</Button>
        </div>
      </Card>

      {!report ? (
        <Card index={1} className="text-center py-12 text-text-muted">Sélectionnez une période et générez le rapport</Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Financial overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <OverviewTile icon={<Wallet size={20} />} label={t('totalSales')} value={report.totalSales} accent="pistachio" />
            <OverviewTile icon={<ShoppingCart size={20} />} label={t('totalPurchasesAmount')} value={report.totalPurchases} accent="caramel" />
            <OverviewTile icon={<Banknote size={20} />} label={t('totalExpenses')} value={report.totalExpenses} accent="rose" />
            <OverviewTile icon={<TrendingUp size={20} />} label={t('netProfit')} value={report.netProfit} accent={report.netProfit >= 0 ? 'pistachio' : 'rose'} />
          </div>

          {/* ===== Sales & client debts ===== */}
          <SectionTitle icon={<Receipt size={18} />} title={t('salesReport')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<Receipt size={20} />} accent="pistachio" label={t('sales')} value={report.totalSales} count={report.rSales.length}
              onClick={() => setDrill({ title: t('sales'), rows: report.rSales.map((s) => ({ title: `${s.reference} — ${clientName(s.clientId)}`, sub: `${s.products.length} article(s) · ${formatDate(s.date, language)}`, value: s.finalAmount })) })} />
            <DrillCard icon={<AlertTriangle size={20} />} accent="rose" label={t('clientDebts')} value={report.totalClientDebt} count={report.clientDebts.length}
              onClick={() => setDrill({ title: t('clientDebts'), rows: report.clientDebts.map((s) => ({ title: `${clientName(s.clientId)} (${s.reference})`, sub: formatDate(s.date, language), value: s.restAmount, danger: true })) })} />
            <DrillCard icon={<Coins size={20} />} accent="caramel" label={t('totalPaid')} value={report.rSales.reduce((a, s) => a + s.paidAmount, 0)} count={report.rSales.length}
              onClick={() => setDrill({ title: t('totalPaid'), rows: report.rSales.map((s) => ({ title: `${s.reference} — ${clientName(s.clientId)}`, sub: formatDate(s.date, language), value: s.paidAmount })) })} />
            <DrillCard icon={<Users size={20} />} accent="lavender" label={t('clients')} value={clients.length} count={clients.length} isCount
              onClick={() => setDrill({ title: t('clients'), rows: clients.map((c) => ({ title: c.name, sub: c.phone, value: report.rSales.filter((s) => s.clientId === c.id).reduce((a, s) => a + s.finalAmount, 0) })) })} />
          </div>

          {/* ===== Purchases & supplier debts ===== */}
          <SectionTitle icon={<ShoppingCart size={18} />} title={t('purchaseReport')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<ShoppingCart size={20} />} accent="caramel" label={t('purchase')} value={report.totalPurchases} count={report.rPurchases.length}
              onClick={() => setDrill({ title: t('purchase'), rows: report.rPurchases.map((p) => ({ title: `${p.reference} — ${supplierName(p.supplierId)}`, sub: `${p.products.length} article(s) · ${formatDate(p.date, language)}`, value: p.totalAmount })) })} />
            <DrillCard icon={<AlertTriangle size={20} />} accent="rose" label={t('supplierDebts')} value={report.totalSupplierDebt} count={report.supplierDebts.length}
              onClick={() => setDrill({ title: t('supplierDebts'), rows: report.supplierDebts.map((p) => ({ title: `${supplierName(p.supplierId)} (${p.reference})`, sub: formatDate(p.date, language), value: p.restAmount, danger: true })) })} />
            <DrillCard icon={<Coins size={20} />} accent="pistachio" label={t('totalPaid')} value={report.rPurchases.reduce((a, p) => a + p.paidAmount, 0)} count={report.rPurchases.length}
              onClick={() => setDrill({ title: t('totalPaid'), rows: report.rPurchases.map((p) => ({ title: `${p.reference} — ${supplierName(p.supplierId)}`, sub: formatDate(p.date, language), value: p.paidAmount })) })} />
            <DrillCard icon={<Truck size={20} />} accent="lavender" label={t('suppliers')} value={suppliers.length} count={suppliers.length} isCount
              onClick={() => setDrill({ title: t('suppliers'), rows: suppliers.map((s) => ({ title: s.name, sub: s.phone, value: report.rPurchases.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.totalAmount, 0) })) })} />
          </div>

          {/* ===== Stock & alerts ===== */}
          <SectionTitle icon={<Package size={18} />} title={t('stockReport')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<Package size={20} />} accent="gold" label={t('stockValue')} value={report.stockValue} count={products.length}
              onClick={() => setDrill({ title: t('stock'), rows: products.map((p) => ({ title: p.name, sub: `${marqueName(p.marqueId)} · ${categoryName(p.categoryId)} · Stock: ${p.currentQuantity}`, value: p.currentQuantity * p.purchasePrice })) })} />
            <DrillCard icon={<AlertTriangle size={20} />} accent="rose" label={t('stockAlertsCount')} value={report.lowStock.length} isCount count={report.lowStock.length}
              onClick={() => setDrill({ title: t('stockAlertsCount'), rows: report.lowStock.map((p) => ({ title: p.name, sub: `Stock: ${p.currentQuantity} / Min: ${p.minAlertQuantity}`, value: p.currentQuantity, danger: true })) })} />
            <DrillCard icon={<Store size={20} />} accent="pistachio" label={t('comptoirValue')} value={report.comptoirValue} count={comptoirItems.length}
              onClick={() => setDrill({ title: t('comptoir'), rows: comptoirItems.map((i) => ({ title: i.productName, sub: `${i.quantity} × ${formatCurrency(i.unitPrice)}`, value: i.quantity * i.unitPrice })) })} />
            <DrillCard icon={<CakeSlice size={20} />} accent="caramel" label={t('production')} value={report.rProductions.reduce((a, p) => a + p.totalValue, 0)} count={report.rProductions.length}
              onClick={() => setDrill({ title: t('production'), rows: report.rProductions.map((p) => ({ title: p.name, sub: `${p.outputQuantity} unités · ${formatDate(p.date, language)}`, value: p.totalValue })) })} />
          </div>

          {/* ===== Detailed Ingrédients par Production + Achats par Catégorie ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Ingredients per Production Accordion */}
            <Card index={0} className="border border-gold/15">
              <h3 className="font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
                <CakeSlice size={18} className="text-gold-dark" /> Détails des Ingrédients par Production
              </h3>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {report.rProductions.map((p) => {
                  const isOpen = expandedProdId === p.id;
                  const prodCost = p.usedProducts.reduce((sum, u) => sum + (u.lineCost ?? (u.quantityUsed * (u.unitCost ?? 0))), 0);
                  return (
                    <div key={p.id} className="border border-gold/10 rounded-xl overflow-hidden bg-vanilla/10">
                      <button
                        onClick={() => setExpandedProdId(isOpen ? null : p.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gold/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-sm text-text-primary truncate">{p.name}</p>
                          <p className="text-xs text-text-muted">{formatDate(p.date, language)} · {p.outputQuantity} unités</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-rose-deep">{formatCurrency(prodCost)}</span>
                          {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-gold/10 bg-white/70"
                          >
                            <div className="p-3">
                              <table className="w-full text-xs">
                                <thead className="bg-vanilla/60 text-text-secondary">
                                  <tr>
                                    <th className="text-left px-2 py-1.5 font-medium">{t('ingredient')}</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Quantité</th>
                                    <th className="text-right px-2 py-1.5 font-medium">P.U Achat</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.usedProducts.map((u, ui) => (
                                    <tr key={ui} className="border-t border-gold/5">
                                      <td className="px-2 py-1.5 font-medium text-text-primary">{u.productName}</td>
                                      <td className="px-2 py-1.5 text-right tabular">{u.quantityUsed}{u.unit ? ` ${u.unit}` : ''}</td>
                                      <td className="px-2 py-1.5 text-right tabular">{formatCurrency(u.unitCost ?? 0)}</td>
                                      <td className="px-2 py-1.5 text-right tabular text-rose-deep font-semibold">{formatCurrency(u.lineCost ?? (u.quantityUsed * (u.unitCost ?? 0)))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {report.rProductions.length === 0 && <EmptyState message={t('noData')} />}
              </div>
            </Card>

            {/* Purchases by Category Accordion */}
            <Card index={1} className="border border-gold/15">
              <h3 className="font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
                <ShoppingCart size={18} className="text-gold-dark" /> Achats groupés par Catégorie
              </h3>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {report.purchasesByCategory.map((cat) => {
                  const isOpen = expandedCatName === cat.categoryName;
                  return (
                    <div key={cat.categoryName} className="border border-gold/10 rounded-xl overflow-hidden bg-vanilla/10">
                      <button
                        onClick={() => setExpandedCatName(isOpen ? null : cat.categoryName)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gold/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-sm text-text-primary truncate">{cat.categoryName}</p>
                          <p className="text-xs text-text-muted">{cat.productsList.length} articles achetés</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-gold-dark">{formatCurrency(cat.totalAmount)}</span>
                          {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-gold/10 bg-white/70"
                          >
                            <div className="p-3">
                              <table className="w-full text-xs">
                                <thead className="bg-vanilla/60 text-text-secondary">
                                  <tr>
                                    <th className="text-left px-2 py-1.5 font-medium">Produit</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Quantité</th>
                                    <th className="text-right px-2 py-1.5 font-medium">P.U Moyen</th>
                                    <th className="text-right px-2 py-1.5 font-medium">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cat.productsList.map((p, pi) => {
                                    const avgPrice = p.quantity > 0 ? p.totalCost / p.quantity : 0;
                                    return (
                                      <tr key={pi} className="border-t border-gold/5">
                                        <td className="px-2 py-1.5 font-medium text-text-primary">{p.name}</td>
                                        <td className="px-2 py-1.5 text-right tabular">{p.quantity}{p.unit ? ` ${p.unit}` : ''}</td>
                                        <td className="px-2 py-1.5 text-right tabular">{formatCurrency(avgPrice)}</td>
                                        <td className="px-2 py-1.5 text-right tabular text-gold-dark font-semibold">{formatCurrency(p.totalCost)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {report.purchasesByCategory.length === 0 && <EmptyState message={t('noData')} />}
              </div>
            </Card>
          </div>

          {/* ===== Comptoir & destructions ===== */}
          <SectionTitle icon={<Flame size={18} />} title={t('comptoirReport')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<Flame size={20} />} accent="rose" label={t('destruction')} value={report.destroyedValue} count={report.rDestructions.length}
              onClick={() => setDrill({ title: t('destructionHistory'), rows: report.rDestructions.map((d) => ({ title: d.productName, sub: `${d.quantity} unités · ${d.reason} · ${formatDate(d.date, language)}`, value: d.value, danger: true })) })} />
            <DrillCard icon={<Trophy size={20} />} accent="pistachio" label={t('bestSellers')} value={report.soldRanked[0]?.revenue || 0} count={Math.min(5, report.soldRanked.length)}
              onClick={() => setDrill({ title: t('bestSellers'), rows: report.soldRanked.slice(0, 5).map((p) => ({ title: p.name, sub: `${p.units} ${t('unitsSold')}`, value: p.revenue })) })} />
            <DrillCard icon={<TrendingDown size={20} />} accent="caramel" label={t('worstSellers')} value={0} count={Math.min(5, report.soldRanked.length)} hideValue
              onClick={() => setDrill({ title: t('worstSellers'), rows: report.soldRanked.slice().reverse().slice(0, 5).map((p) => ({ title: p.name, sub: `${p.units} ${t('unitsSold')}`, value: p.revenue })) })} />
            <DrillCard icon={<CakeSlice size={20} />} accent="lavender" label={t('productionProducts')} value={report.rProductions.reduce((a, p) => a + p.outputQuantity, 0)} isCount count={report.rProductions.length}
              onClick={() => setDrill({ title: t('productionProducts'), rows: report.rProductions.map((p) => ({ title: p.name, sub: `${p.usedProducts.length} ingrédient(s) · ${formatDate(p.date, language)}`, value: p.outputQuantity })) })} />
          </div>

          {/* ===== Per-product sales & comptoir rest ===== */}
          <SectionTitle icon={<Receipt size={18} />} title={t('productSales')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<Receipt size={20} />} accent="pistachio" label={t('productSales')} value={report.productSalesRevenue} count={report.soldRanked.length}
              onClick={() => setDrill({ title: t('productSales'), rows: report.soldRanked.map((p) => ({ title: p.name, sub: `${p.units}${p.sellByUnit && p.unit ? ' ' + p.unit : ''} ${t('unitsSold')}`, value: p.revenue })) })} />
            <DrillCard icon={<Coins size={20} />} accent="caramel" label={t('soldQty')} value={report.soldRanked.reduce((a, p) => a + p.units, 0)} isCount count={report.soldRanked.length}
              onClick={() => setDrill({ title: t('soldQty'), rows: report.soldRanked.map((p) => ({ title: p.name, sub: `${formatCurrency(p.revenue)}`, value: p.units })) })} />
            <DrillCard icon={<Store size={20} />} accent="gold" label={t('restAtComptoir')} value={report.comptoirValue} count={report.restItems.length}
              onClick={() => setDrill({ title: t('restAtComptoir'), rows: report.restItems.map((p) => ({ title: p.name, sub: `${p.quantity}${p.unit ? ' ' + p.unit : ' unités'}`, value: p.value })) })} />
            <DrillCard icon={<Package size={20} />} accent="lavender" label={t('restValue')} value={report.comptoirValue} count={report.restItems.length}
              onClick={() => setDrill({ title: t('restValue'), rows: report.restItems.map((p) => ({ title: p.name, sub: `${p.quantity}${p.unit ? ' ' + p.unit : ' unités'}`, value: p.value })) })} />
          </div>

          {/* ===== Expenses & workers ===== */}
          <SectionTitle icon={<Banknote size={18} />} title={`${t('expensesReport')} & ${t('workers')}`} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<Banknote size={20} />} accent="rose" label={t('expenses')} value={report.totalExpenses} count={report.rExpenses.length}
              onClick={() => setDrill({ title: t('expenses'), rows: report.rExpenses.map((e) => ({ title: e.name, sub: `${e.description} · ${formatDate(e.date, language)}`, value: e.amount })) })} />
            <DrillCard icon={<HardHat size={20} />} accent="lavender" label={t('workerSalaries')} value={report.workerPayments} count={workers.length}
              onClick={() => setDrill({ title: t('workerSalaries'), rows: workers.flatMap((w) => w.payments.filter((p) => isWithinRange(p.date, from, to)).map((p) => ({ title: w.fullName, sub: `${p.period || ''} · ${formatDate(p.date, language)}`, value: p.amount }))) })} />
            <DrillCard icon={<Coins size={20} />} accent="caramel" label={t('acomptes')} value={report.workerAcomptes} count={workers.length}
              onClick={() => setDrill({ title: t('acomptes'), rows: workers.flatMap((w) => w.acomptes.filter((a) => isWithinRange(a.date, from, to)).map((a) => ({ title: w.fullName, sub: `${a.description || ''} · ${formatDate(a.date, language)}`, value: a.amount }))) })} />
            <DrillCard icon={<Users size={20} />} accent="pistachio" label={t('activeWorkers')} value={workers.length} isCount count={workers.length}
              onClick={() => setDrill({ title: t('workers'), rows: workers.map((w) => ({ title: w.fullName, sub: w.phone, value: w.paymentAmount })) })} />
          </div>

          {/* ===== Caisse operations & decalages ===== */}
          <SectionTitle icon={<Wallet size={18} />} title={t('caisseReport')} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard icon={<ArrowDownLeft size={20} />} accent="pistachio" label={t('totalDeposits')} value={report.depositsTotal} count={report.deposits.length}
              onClick={() => setDrill({ title: t('totalDeposits'), rows: report.deposits.map((d) => ({ title: d.description || t('deposit'), sub: formatDate(d.date, language), value: d.amount })) })} />
            <DrillCard icon={<ArrowUpRight size={20} />} accent="rose" label={t('totalWithdrawals')} value={report.withdrawalsTotal} count={report.withdrawals.length}
              onClick={() => setDrill({ title: t('totalWithdrawals'), rows: report.withdrawals.map((d) => ({ title: d.description || t('withdrawal'), sub: formatDate(d.date, language), value: d.amount, danger: true })) })} />
            <DrillCard icon={<Scale size={20} />} accent={Math.abs(report.totalDecalage) < 0.01 ? 'pistachio' : 'rose'} label={t('reportsDecalage')} value={report.totalDecalage} count={report.reportCalcs.length} signed
              onClick={() => setDrill({ title: t('reportsDecalage'), rows: report.reportCalcs.map(({ report: r, calc }) => ({ title: `${formatDate(r.date, language)} — ${r.hour}`, sub: `${t('declaredAmount')}: ${formatCurrency(r.declaredAmount)} · ${t('theoreticalBalance')}: ${formatCurrency(calc.theoretical)}`, value: calc.decalage, danger: Math.abs(calc.decalage) >= 0.01 })) })} />
            <DrillCard icon={<FileText size={20} />} accent="lavender" label={t('caisseReports')} value={report.reportCalcs.length} isCount count={report.reportCalcs.length}
              onClick={() => setDrill({ title: t('caisseReports'), rows: report.reportCalcs.map(({ report: r }) => ({ title: `${formatDate(r.date, language)} — ${r.hour}`, sub: r.description, value: r.declaredAmount })) })} />
          </div>
        </motion.div>
      )}

      {/* Drill-down modal */}
      <Modal open={!!drill} onClose={() => setDrill(null)} title={drill?.title} size="md">
        {drill && <DrillList rows={drill.rows} emptyLabel={t('noData')} />}
      </Modal>
    </div>
  );
}

function OverviewTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card index={0}>
      <div className={`${ACCENT_TEXT[accent]} mb-2`}>{icon}</div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-bold tabular ${ACCENT_TEXT[accent]}`}>{formatCurrency(value)}</p>
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="font-display font-semibold text-text-primary flex items-center gap-2 pt-2">
      <span className="text-gold-dark">{icon}</span> {title}
    </h3>
  );
}

function DrillCard({ icon, label, value, accent, count, onClick, isCount, signed, hideValue }: {
  icon: React.ReactNode; label: string; value: number; accent: string; count: number;
  onClick: () => void; isCount?: boolean; signed?: boolean; hideValue?: boolean;
}) {
  const sign = signed && value > 0 ? '+ ' : signed && value < 0 ? '− ' : '';
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      className="relative overflow-hidden rounded-2xl bg-gradient-card border border-gold/15 shadow-card p-5 text-left">
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-10 ${ACCENTS[accent]}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm ${ACCENTS[accent]}`}>{icon}</div>
        <ChevronRight size={18} className="text-text-muted" />
      </div>
      <p className="text-sm text-text-muted mb-1">{label}</p>
      {!hideValue && (
        <p className={`text-xl font-bold tabular ${ACCENT_TEXT[accent]}`}>
          {isCount ? Math.round(value) : `${sign}${formatCurrency(Math.abs(value))}`}
        </p>
      )}
      <p className="text-xs text-text-muted mt-1">{count} {count > 1 ? 'éléments' : 'élément'} · 👆</p>
    </motion.button>
  );
}

function DrillList({ rows, emptyLabel }: { rows: Row[]; emptyLabel: string }) {
  if (rows.length === 0) return <EmptyState message={emptyLabel} />;
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-vanilla/40 border border-gold/10">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
              {r.sub && <p className="text-xs text-text-muted truncate">{r.sub}</p>}
            </div>
            <p className={`text-sm font-bold tabular shrink-0 ${r.danger ? 'text-rose-deep' : 'text-gold-dark'}`}>{formatCurrency(r.value)}</p>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex justify-between border-t border-gold/15 pt-3 px-1 font-bold sticky bottom-0 bg-cream">
        <span className="text-text-primary">Total</span>
        <span className="tabular text-gold-dark">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
