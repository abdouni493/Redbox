import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, Plus, Minus, X, Search, ShoppingBag, UserPlus, CakeSlice, Printer, CheckCircle2,
  ClipboardList, Receipt, ChefHat, CalendarClock, Pencil, ArrowLeft, StickyNote,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { ClientForm } from '@/components/shared/ClientForm';
import { VirtualKeyboard } from '@/components/shared/VirtualKeyboard';
import { OrderServicePicker, cleanService } from '@/components/shared/OrderServicePicker';
import { useComptoirStore } from '@/store/comptoirStore';
import { useClientStore } from '@/store/clientStore';
import { useSalesStore } from '@/store/salesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCommandStore, type Command, type CommandLine } from '@/store/commandStore';
import { useFicheTechnicStore } from '@/store/ficheTechnicStore';
import { useStockStore } from '@/store/stockStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, todayISO } from '@/lib/utils';
import { printInvoice } from '@/lib/print';
import { printCommandReceipt, printKitchenTicket } from '@/lib/orderPrint';
import { toast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderServiceInfo, Sale } from '@/types';

type Mode = 'sale' | 'command';
type Source = 'comptoir' | 'recipes';

interface CartLine {
  key: string;
  comptoirItemId?: string;
  stockProductId?: string;
  ficheTechnicId?: string;
  productName: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  available: number; // Infinity for recipe (made on demand)
  sellByUnit?: boolean;
  unit?: string;
}

interface CatalogItem {
  key: string;
  comptoirItemId?: string;
  stockProductId?: string;
  ficheTechnicId?: string;
  productName: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  categoryName?: string;
  sellByUnit?: boolean;
  unit?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function POS() {
  const { t } = useLanguage();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editId = params.get('edit');

  const items = useComptoirStore((s) => s.items);
  const fiches = useFicheTechnicStore((s) => s.ficheTechnics);
  const stockProducts = useStockStore((s) => s.products);
  const stockCategories = useStockStore((s) => s.categories);
  const { clients, addClient, getOrCreatePassager } = useClientStore();
  const addSale = useSalesStore((s) => s.addSale);
  const { commands, addCommand, updateCommand, payDebt } = useCommandStore();
  const settings = useSettingsStore((s) => s.settings);

  const editing = useMemo(() => (editId ? commands.find((c) => c.id === editId) : undefined), [editId, commands]);

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'command' || editId ? 'command' : 'sale');
  const [source, setSource] = useState<Source>('comptoir');
  const [printPrompt, setPrintPrompt] = useState<{ sale?: Sale; command?: Command; edited?: boolean } | null>(null);

  const [search, setSearch] = useState('');
  const [keyboardEnabled, setKeyboardEnabled] = useState(() => localStorage.getItem('pos_keyboard_enabled') === 'true');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [reductionEnabled, setReductionEnabled] = useState(false);
  const [reduction, setReduction] = useState<number>(0);
  const [paid, setPaid] = useState<number>(0);
  // Until the cashier edits "Client paie", it auto-follows the order total (sale mode).
  const [paidEdited, setPaidEdited] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [service, setService] = useState<OrderServiceInfo>({ orderType: 'takeaway' });
  // Command-only fields
  const now = new Date();
  const [receiveDate, setReceiveDate] = useState(todayISO());
  const [receiveTime, setReceiveTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const [note, setNote] = useState('');
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);

  // ---- Load a command for editing (?edit=<id>) ----
  useEffect(() => {
    if (!editId) { setLoadedEditId(null); return; }
    if (!editing || loadedEditId === editId) return;
    if (editing.status === 'finalised') {
      toast.error('Une commande finalisée ne peut pas être modifiée');
      navigate('/commands');
      return;
    }
    setMode('command');
    setCart(editing.items.map((l, i) => {
      if (l.stockProductId) {
        const sp = stockProducts.find((x) => x.id === l.stockProductId);
        return {
          key: `stk-${l.stockProductId}`, stockProductId: l.stockProductId, productName: l.productName,
          image: l.image ?? sp?.image, unitPrice: l.unitPrice, quantity: l.quantity,
          available: sp ? sp.currentQuantity : Infinity, sellByUnit: l.sellByUnit, unit: l.sellUnit,
        };
      }
      const comp = l.comptoirItemId ? items.find((x) => x.id === l.comptoirItemId) : items.find((x) => x.productName === l.productName);
      return {
        key: l.comptoirItemId || l.ficheTechnicId || `line-${i}-${l.productName}`,
        comptoirItemId: l.comptoirItemId || comp?.id,
        ficheTechnicId: l.ficheTechnicId || undefined,
        productName: l.productName,
        image: l.image ?? comp?.image,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        available: comp ? comp.quantity : Infinity,
        sellByUnit: l.sellByUnit,
        unit: l.sellUnit,
      };
    }));
    const lineSum = editing.items.reduce((s, l) => s + l.totalPrice, 0);
    const red = Math.max(0, lineSum - editing.totalAmount);
    setReductionEnabled(red > 0);
    setReduction(red);
    setClientId(editing.clientId || null);
    setClientSearch(editing.clientName || '');
    setService({
      orderType: editing.orderType || 'takeaway',
      tableNumber: editing.tableNumber,
      deliveryAddress: editing.deliveryAddress,
      deliveryPhone: editing.deliveryPhone,
      delivererId: editing.delivererId,
      delivererName: editing.delivererName,
    });
    setReceiveDate(editing.receiveDate || todayISO());
    setReceiveTime(`${editing.receiveHour || '00'}:${editing.receiveMinute || '00'}`);
    setNote(editing.note || '');
    setPaid(0);
    setPaidEdited(true);
    setLoadedEditId(editId);
  }, [editId, editing, loadedEditId, items, stockProducts, navigate]);

  // ---- Catalog ----
  const catalog: CatalogItem[] = useMemo(() => {
    if (mode === 'command' && source === 'recipes') {
      return fiches.map((f) => ({
        key: `ft-${f.id}`, ficheTechnicId: f.id, productName: f.name, image: f.image, unitPrice: f.unitPrice,
        quantity: Infinity, categoryName: f.categoryName, sellByUnit: f.sellByUnit, unit: f.sellUnit,
      }));
    }
    const comptoirItems: CatalogItem[] = items
      // Commands can be placed even if the product is momentarily out of stock
      .filter((i) => mode === 'command' || i.quantity > 0)
      .map((i) => ({
        key: i.id, comptoirItemId: i.id, productName: i.productName, image: i.image, unitPrice: i.unitPrice,
        quantity: i.quantity, categoryName: i.categoryName, sellByUnit: i.sellByUnit, unit: i.unit,
      }));
    // Stock products flagged "vente directe au POS" are sold straight from stock.
    const direct: CatalogItem[] = stockProducts
      .filter((p) => p.sellOnPos && (p.sellingPrice ?? 0) > 0 && (mode === 'command' || p.currentQuantity > 0))
      .map((p) => ({
        key: `stk-${p.id}`, stockProductId: p.id, productName: p.name, image: p.image, unitPrice: p.sellingPrice || 0,
        quantity: p.currentQuantity,
        categoryName: stockCategories.find((c) => c.id === p.categoryId)?.name,
        sellByUnit: !!(p.unitEnabled && p.unit), unit: p.unitEnabled ? p.unit : undefined,
      }));
    return [...comptoirItems, ...direct];
  }, [mode, source, items, fiches, stockProducts, stockCategories]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((i) => { if (i.categoryName) set.add(i.categoryName); });
    return [...set].map((name) => ({ value: name, label: name }));
  }, [catalog]);

  const available = useMemo(() => catalog.filter((i) =>
    i.productName.toLowerCase().includes(search.toLowerCase()) &&
    (!categoryFilter || i.categoryName === categoryFilter)
  ), [catalog, search, categoryFilter]);

  const clientResults = useMemo(() => clientSearch && !clientId ? clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch)).slice(0, 5) : [], [clientSearch, clients, clientId]);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [cart]);
  const finalAmount = Math.max(0, subtotal - (reductionEnabled ? reduction : 0));
  const alreadyPaid = editing ? editing.paidAmount : 0;
  // Sale: defaults to the full total. Command: defaults to 0 (acompte optional).
  const effectivePaid = paidEdited ? paid : mode === 'sale' ? finalAmount : 0;
  const change = Math.max(0, alreadyPaid + effectivePaid - finalAmount);
  const rest = Math.max(0, finalAmount - alreadyPaid - effectivePaid);
  const strictStock = mode === 'sale';

  const addToCart = (item: CatalogItem) => {
    const existing = cart.find((c) => c.key === item.key);
    if (existing) {
      if (existing.quantity + 1 > existing.available) {
        if (strictStock) { toast.warning('Stock insuffisant'); return; }
        toast.warning('Quantité supérieure au stock comptoir — à préparer');
      }
      setCart(cart.map((c) => c.key === item.key ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      if (item.quantity < 1 && strictStock) { toast.warning('Stock insuffisant'); return; }
      setCart([...cart, {
        key: item.key, comptoirItemId: item.comptoirItemId, stockProductId: item.stockProductId, ficheTechnicId: item.ficheTechnicId, productName: item.productName,
        image: item.image, unitPrice: item.unitPrice, quantity: 1, available: item.quantity, sellByUnit: item.sellByUnit, unit: item.unit,
      }]);
    }
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.key !== key) return c;
      const q = c.quantity + delta;
      if (q > c.available && strictStock) { toast.warning('Stock insuffisant'); return c; }
      return { ...c, quantity: Math.max(1, q) };
    }));
  };

  // Free-form quantity entry — used for products sold by unit (g / kg / …).
  const setQty = (key: string, value: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.key !== key) return c;
      if (value > c.available && strictStock) { toast.warning('Stock insuffisant'); return { ...c, quantity: c.available }; }
      return { ...c, quantity: value < 0 ? 0 : value };
    }));
  };

  const reset = () => {
    setCart([]); setReduction(0); setReductionEnabled(false); setPaid(0); setPaidEdited(false);
    setClientId(null); setClientSearch(''); setService({ orderType: 'takeaway' }); setNote('');
    const d = new Date();
    setReceiveDate(todayISO()); setReceiveTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const exitEdit = () => {
    reset();
    setLoadedEditId(null);
    params.delete('edit');
    setParams(params, { replace: true });
  };

  const validateService = (): boolean => {
    if (service.orderType === 'delivery' && !service.deliveryAddress?.trim()) {
      toast.error('Adresse de livraison requise');
      return false;
    }
    return true;
  };

  const createSale = () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    if (!validateService()) return;
    if (rest > 0 && !clientId) { toast.error('Sélectionnez un client pour une vente à crédit'); return; }
    // No client selected → assign to the shared walk-in (passager) client, created on demand.
    const saleClientId = clientId ?? getOrCreatePassager(t('walkInClient')).id;
    const sale = addSale({
      clientId: saleClientId,
      date: new Date().toISOString(),
      products: cart.map((c) => ({ productId: c.stockProductId || c.comptoirItemId || c.key, source: c.stockProductId ? 'stock' as const : 'comptoir' as const, productName: c.productName, quantity: c.quantity, sellingPrice: c.unitPrice, sellByUnit: c.sellByUnit, unit: c.unit })),
      reduction: reductionEnabled ? Number(reduction) : 0,
      // Never record more than the amount due (the change is handed back).
      paidAmount: Math.min(Number(effectivePaid), finalAmount),
      ...cleanService(service),
    });
    toast.success(rest > 0 ? 'Vente créée (dette)' : 'Vente créée et payée');
    setPrintPrompt({ sale });
    reset();
  };

  const buildLines = (): CommandLine[] =>
    cart.map((c) => ({
      ficheTechnicId: c.ficheTechnicId || '',
      comptoirItemId: c.comptoirItemId,
      stockProductId: c.stockProductId,
      image: c.image,
      productName: c.productName,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      totalPrice: c.quantity * c.unitPrice,
      sellByUnit: c.sellByUnit,
      sellUnit: c.unit,
    }));

  const saveCommand = () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    if (!validateService()) return;
    if (effectivePaid < 0) { toast.error('Montant invalide'); return; }
    const client = clientId ? clients.find((c) => c.id === clientId) : null;
    const passager = client ? null : getOrCreatePassager(t('walkInClient'));
    const [hh, mm] = receiveTime.split(':');
    const payNow = Math.min(Number(effectivePaid), Math.max(0, finalAmount - alreadyPaid));
    const svc = cleanService(service);
    const data = {
      clientId: client?.id || passager!.id,
      clientName: client?.name || passager!.name,
      clientPhone: client?.phone || svc.deliveryPhone || undefined,
      receiveDate,
      receiveHour: hh || '00',
      receiveMinute: mm || '00',
      items: buildLines(),
      totalAmount: finalAmount,
      note: note.trim() || undefined,
      ...svc,
    };

    if (editing) {
      // kitchenPrinted reset → the kitchen gets the updated ticket again
      updateCommand(editing.id, { ...data, paidAmount: editing.paidAmount, kitchenPrinted: false });
      if (payNow > 0) payDebt(editing.id, payNow, `Versement ${editing.reference}`);
      const updated = useCommandStore.getState().commands.find((c) => c.id === editing.id)!;
      toast.success('Commande modifiée');
      setPrintPrompt({ command: updated, edited: true });
      exitEdit();
      return;
    }

    const cmd = addCommand({ ...data, paidAmount: payNow, source: 'pos' });
    toast.success('Commande créée — en attente');
    setPrintPrompt({ command: cmd });
    reset();
  };

  const handlePrintSale = (sale: Sale) => {
    const cl = clients.find((c) => c.id === sale.clientId);
    printInvoice({
      type: 'sale', reference: sale.reference, date: sale.date,
      partyName: cl?.name || t('walkIn'), partyPhone: cl?.phone,
      lines: sale.products.map((l) => ({ designation: l.productName || '', quantity: l.quantity, unitPrice: l.sellingPrice })),
      total: sale.totalAmount, reduction: sale.reduction, final: sale.finalAmount, paid: sale.paidAmount, rest: sale.restAmount,
      service: sale,
    }, settings);
  };

  const isCommand = mode === 'command';

  return (
    <div>
      <PageHeader
        title={editing ? `Modifier ${editing.reference}` : t('pos')}
        icon={editing ? <Pencil size={24} /> : <CreditCard size={24} />}
        subtitle={editing ? `${editing.clientName} · commande en attente` : undefined}
        actions={
          <>
            {editing && <Button variant="secondary" onClick={() => { exitEdit(); navigate('/commands'); }}><ArrowLeft size={16} /> Retour aux commandes</Button>}
            {can('commands', 'view') && !editing && <Button variant="secondary" onClick={() => navigate('/commands')}><ClipboardList size={16} /> {t('commands')}</Button>}
            <div className="flex items-center gap-2 bg-white/80 border border-gold/15 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-text-secondary">{t('virtualKeyboard')}</span>
              <Switch checked={keyboardEnabled} onChange={(val) => {
                setKeyboardEnabled(val);
                localStorage.setItem('pos_keyboard_enabled', String(val));
                if (!val) setShowKeyboard(false);
              }} />
            </div>
          </>
        }
      />

      {/* Mode selector: direct sale vs command */}
      {!editing && (
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white/70 border border-gold/15 shadow-sm mb-4 max-w-xl">
          {([
            { key: 'sale', label: 'Vente directe', sub: 'Payée et remise immédiatement', icon: Receipt },
            { key: 'command', label: 'Commande', sub: 'En attente · cuisine / livraison', icon: ClipboardList },
          ] as const).map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button key={m.key} onClick={() => { setMode(m.key); setPaidEdited(false); setPaid(0); if (m.key === 'sale') { setSource('comptoir'); setCart((c) => c.filter((l) => !l.ficheTechnicId)); } }}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors ${active ? 'text-white' : 'text-text-secondary hover:bg-gold/10'}`}>
                {active && <motion.span layoutId="pos-mode-pill" className="absolute inset-0 rounded-xl bg-gradient-button shadow-gold" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <Icon size={20} className="relative z-10 shrink-0" />
                <span className="relative z-10">
                  <span className="block text-sm font-bold">{m.label}</span>
                  <span className={`block text-[11px] ${active ? 'text-white/85' : 'text-text-muted'}`}>{m.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Catalog */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isCommand && (
              <div className="flex gap-1 p-1 rounded-xl bg-vanilla/60 border border-gold/15">
                <button onClick={() => { setSource('comptoir'); setCategoryFilter(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${source === 'comptoir' ? 'bg-gradient-button text-white' : 'text-text-secondary'}`}>Comptoir</button>
                <button onClick={() => { setSource('recipes'); setCategoryFilter(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${source === 'recipes' ? 'bg-gradient-button text-white' : 'text-text-secondary'}`}>Sur commande (recettes)</button>
              </div>
            )}
            <div className="flex-1 min-w-[180px]">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder={`${t('search')} produit`}
                onFocus={() => { if (keyboardEnabled) setShowKeyboard(true); }}
              />
            </div>
            {categoryOptions.length > 0 && (
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder={t('allCategories')} options={categoryOptions} className="max-w-[200px]" />
            )}
          </div>
          <AnimatePresence>
            {keyboardEnabled && showKeyboard && (
              <div className="mb-4">
                <VirtualKeyboard value={search} onChange={setSearch} onClose={() => setShowKeyboard(false)} />
              </div>
            )}
          </AnimatePresence>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {available.map((item, i) => {
              const inCart = cart.find((c) => c.key === item.key);
              const out = Number.isFinite(item.quantity) && item.quantity <= 0;
              return (
                <motion.button
                  key={item.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                  whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}
                  onClick={() => addToCart(item)}
                  className={`relative bg-gradient-card border rounded-2xl overflow-hidden text-left shadow-card hover:shadow-hover transition-shadow ${inCart ? 'border-gold ring-2 ring-gold/30' : 'border-gold/15'}`}
                >
                  <div className="aspect-[4/3] w-full bg-gradient-rose flex items-center justify-center text-white overflow-hidden">
                    {item.image ? <img src={item.image} alt={item.productName} className="h-full w-full object-cover" /> : <CakeSlice size={28} />}
                  </div>
                  {inCart && <span className="absolute top-2 right-2 h-6 min-w-6 px-1.5 rounded-full bg-gradient-button text-white text-xs font-bold flex items-center justify-center shadow-gold">{inCart.quantity}</span>}
                  <div className="p-3">
                    <p className="font-medium text-text-primary text-sm truncate">{item.productName}</p>
                    <p className="text-gold-dark font-bold tabular text-sm mt-0.5">{formatCurrency(item.unitPrice)}{item.sellByUnit && item.unit ? <span className="text-xs text-text-muted font-normal">/{item.unit}</span> : null}</p>
                    <p className={`text-xs ${out ? 'text-rose-deep font-semibold' : 'text-text-muted'}`}>
                      {Number.isFinite(item.quantity) ? (out ? 'Rupture — sur commande' : `Dispo: ${item.quantity}${item.sellByUnit && item.unit ? ` ${item.unit}` : ''}`) : 'Préparé sur commande'}
                    </p>
                  </div>
                </motion.button>
              );
            })}
            {available.length === 0 && <p className="col-span-full text-center text-text-muted py-10">{t('noData')}</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-gradient-card border border-gold/15 rounded-2xl p-4 shadow-card h-fit lg:sticky lg:top-20">
          <h3 className="font-display font-semibold text-text-primary flex items-center justify-between gap-2 mb-3">
            <span className="flex items-center gap-2">{isCommand ? <ClipboardList size={18} /> : <ShoppingBag size={18} />} {isCommand ? (editing ? editing.reference : 'Nouvelle commande') : t('cart')}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${isCommand ? 'bg-caramel/15 text-caramel' : 'bg-pistachio/15 text-pistachio'}`}>{isCommand ? 'En attente' : 'Vente directe'}</span>
          </h3>

          {/* Client */}
          <div className="mb-3 relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientId(null); }} placeholder={t('client')} className="pl-9" />
                {clientResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-gold/20 shadow-hover overflow-hidden">
                    {clientResults.map((c) => <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(c.name); if (c.phone && !service.deliveryPhone) setService((s) => ({ ...s, deliveryPhone: c.phone })); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gold/10">{c.name}{c.phone ? <span className="text-xs text-text-muted"> · {c.phone}</span> : null}</button>)}
                  </div>
                )}
              </div>
              <Button size="icon" variant="secondary" onClick={() => setShowClientForm(true)}><UserPlus size={16} /></Button>
            </div>
            {clientId ? (
              <p className="text-xs text-pistachio mt-1">✓ {clients.find((c) => c.id === clientId)?.name}</p>
            ) : (
              <p className="text-xs text-text-muted mt-1">{t('walkInClient')}</p>
            )}
          </div>

          {/* Service type */}
          <div className="mb-3">
            <OrderServicePicker value={service} onChange={setService} />
          </div>

          {isCommand && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1 mb-1"><CalendarClock size={12} /> Pour le</label>
                <input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-text-secondary mb-1 block">À</label>
                <input type="time" value={receiveTime} onChange={(e) => setReceiveTime(e.target.value)} className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
              <div className="col-span-2 relative">
                <StickyNote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour la cuisine (optionnel)" className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {cart.map((l) => {
                const over = Number.isFinite(l.available) && l.quantity > l.available;
                return (
                  <motion.div key={l.key} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-2 bg-vanilla/50 rounded-xl p-2">
                    <div className="h-9 w-9 rounded-lg bg-gradient-rose text-white flex items-center justify-center overflow-hidden shrink-0">
                      {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <CakeSlice size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{l.productName}{l.sellByUnit && l.unit ? <span className="text-xs text-gold-dark"> · {l.unit}</span> : null}</p>
                      <p className="text-xs text-text-muted tabular">{formatCurrency(l.unitPrice)}{l.sellByUnit && l.unit ? `/${l.unit}` : ''} × {l.quantity}{l.sellByUnit && l.unit ? ` ${l.unit}` : ''}</p>
                      {over && <p className="text-[10px] text-caramel font-semibold">Au-delà du stock ({l.available}) — à préparer</p>}
                    </div>
                    {l.sellByUnit ? (
                      <input type="number" step="any" min={0} value={l.quantity} onChange={(e) => setQty(l.key, Number(e.target.value))}
                        className="w-20 h-7 rounded-md bg-white border border-gold/20 px-2 text-sm tabular text-center focus:outline-none focus:ring-2 focus:ring-gold/40" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(l.key, -1)} className="h-6 w-6 rounded-md bg-white border border-gold/20 flex items-center justify-center"><Minus size={12} /></button>
                        <span className="w-6 text-center text-sm tabular">{l.quantity}</span>
                        <button onClick={() => changeQty(l.key, 1)} className="h-6 w-6 rounded-md bg-white border border-gold/20 flex items-center justify-center"><Plus size={12} /></button>
                      </div>
                    )}
                    <span className="text-sm tabular font-semibold w-20 text-right">{formatCurrency(l.quantity * l.unitPrice)}</span>
                    <button onClick={() => setCart(cart.filter((c) => c.key !== l.key))} className="text-rose-deep"><X size={14} /></button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {cart.length === 0 && <p className="text-sm text-text-muted text-center py-6">Panier vide</p>}
          </div>

          {/* Totals */}
          <div className="border-t border-gold/15 pt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">{t('subtotal')}</span><span className="tabular">{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between">
              <Switch checked={reductionEnabled} onChange={setReductionEnabled} label={t('reduction')} />
              {reductionEnabled && <Input type="number" value={reduction} onChange={(e) => setReduction(Number(e.target.value))} className="max-w-[100px] h-8" />}
            </div>
            <div className="flex justify-between text-base font-bold"><span>{t('total')}</span><span className="tabular text-gold-dark">{formatCurrency(finalAmount)}</span></div>
            {editing && alreadyPaid > 0 && (
              <div className="flex justify-between"><span className="text-text-muted">Déjà versé</span><span className="tabular text-pistachio">{formatCurrency(alreadyPaid)}</span></div>
            )}
            <Input
              label={isCommand ? (editing ? 'Versement supplémentaire' : 'Acompte / versement') : t('clientPays')}
              type="number" value={effectivePaid}
              onChange={(e) => { setPaid(Number(e.target.value)); setPaidEdited(true); }}
            />
            {isCommand && (
              <div className="flex gap-1.5">
                <button onClick={() => { setPaid(0); setPaidEdited(true); }} className="flex-1 text-[11px] py-1 rounded-lg bg-vanilla border border-gold/15 hover:bg-gold/10">Rien</button>
                <button onClick={() => { setPaid(Math.max(0, finalAmount - alreadyPaid)); setPaidEdited(true); }} className="flex-1 text-[11px] py-1 rounded-lg bg-vanilla border border-gold/15 hover:bg-gold/10">Tout payer</button>
              </div>
            )}
            <div className="flex justify-between"><span className="text-text-muted">{t('change')}</span><span className="tabular text-pistachio">{formatCurrency(change)}</span></div>
            {rest > 0 && <div className="flex justify-between"><span className="text-text-muted">{t('rest')}</span><span className="tabular text-rose-deep font-bold">{formatCurrency(rest)}</span></div>}
          </div>

          <div className="mt-3 space-y-2">
            {isCommand ? (
              <Button variant="gold" className="w-full" onClick={saveCommand}>
                <ClipboardList size={16} /> {editing ? 'Enregistrer les modifications' : 'Créer la commande (en attente)'}
              </Button>
            ) : rest <= 0 ? (
              <Button variant="gold" className="w-full" onClick={createSale}>{t('createSalePaid')} 🟢</Button>
            ) : (
              <Button variant="rose" className="w-full" onClick={createSale}>{t('createSaleDebt')} 🔴</Button>
            )}
            {cart.length > 0 && <Button variant="ghost" className="w-full" onClick={editing ? () => { exitEdit(); navigate('/commands'); } : reset}>{t('cancel')}</Button>}
          </div>
        </div>
      </div>

      <Modal open={showClientForm} onClose={() => setShowClientForm(false)} title={t('newClient')} size="sm">
        <ClientForm onSubmit={(data) => { const c = addClient(data); setClientId(c.id); setClientSearch(c.name); setShowClientForm(false); toast.success('Client créé'); }} onCancel={() => setShowClientForm(false)} />
      </Modal>

      {/* Print prompt after a successful sale / command */}
      <Modal open={!!printPrompt} onClose={() => setPrintPrompt(null)} size="sm">
        {printPrompt && (
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-pistachio/15 flex items-center justify-center mb-4">
              <CheckCircle2 size={30} className="text-pistachio" />
            </div>
            <h3 className="font-display text-lg font-semibold text-text-primary mb-1">
              {printPrompt.sale ? 'Vente enregistrée ✅' : printPrompt.edited ? 'Commande modifiée ✅' : 'Commande créée — en attente ⏳'}
            </h3>
            <p className="text-sm text-text-secondary mb-1">{printPrompt.sale?.reference || printPrompt.command?.reference}</p>
            <p className="text-sm text-text-muted mb-5">Que voulez-vous imprimer ?</p>
            <div className="grid gap-2 w-full">
              {printPrompt.sale && (
                <Button variant="gold" onClick={() => { handlePrintSale(printPrompt.sale!); setPrintPrompt(null); }}>
                  <Printer size={16} /> Imprimer la facture
                </Button>
              )}
              {printPrompt.command && (
                <>
                  <Button variant="gold" onClick={() => printCommandReceipt(printPrompt.command!, settings)}>
                    <Printer size={16} /> Bon de commande (client)
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    printKitchenTicket(printPrompt.command!, settings);
                    useCommandStore.getState().markKitchenPrinted(printPrompt.command!.id);
                  }}>
                    <ChefHat size={16} /> Ticket cuisine
                  </Button>
                  {can('commands', 'view') && (
                    <Button variant="ghost" onClick={() => { setPrintPrompt(null); navigate('/commands'); }}>
                      <ClipboardList size={16} /> Voir les commandes
                    </Button>
                  )}
                </>
              )}
              <Button variant="secondary" onClick={() => setPrintPrompt(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
