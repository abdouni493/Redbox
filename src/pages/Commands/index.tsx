import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, Plus, Eye, Pencil, Trash2, CheckCircle2, Printer, ChefHat, Settings2, Clock,
  MapPin, Phone, Bike, UtensilsCrossed, ShoppingBag, AlertTriangle, Coins, CakeSlice, Flame, PackageCheck, Truck, Calendar, StickyNote, User,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import { useCommandStore, type Command, type KitchenStatus } from '@/store/commandStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useClientStore, PASSAGER_CLIENT_ID } from '@/store/clientStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDate, formatDateTime, matchesDateFilter, todayISO, type DateFilter } from '@/lib/utils';
import { orderTypeLabel, printCommandReceipt, printKitchenTicket } from '@/lib/orderPrint';
import { isKitchenPrinterDevice, setKitchenPrinterDevice } from '@/components/layout/KitchenAutoPrint';
import type { OrderType } from '@/types';

type StatusFilter = 'pending' | 'finalised' | 'all';

const KITCHEN_LABEL: Record<KitchenStatus, string> = { new: 'Nouvelle', preparing: 'En préparation', ready: 'Prête' };
const KITCHEN_VARIANT: Record<KitchenStatus, 'info' | 'warning' | 'success'> = { new: 'info', preparing: 'warning', ready: 'success' };

function TypeIcon({ type, size = 14 }: { type?: OrderType; size?: number }) {
  if (type === 'delivery') return <Bike size={size} />;
  if (type === 'table') return <UtensilsCrossed size={size} />;
  return <ShoppingBag size={size} />;
}

export default function CommandsPage() {
  const { language } = useLanguage();
  const { can, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const post = isAdmin ? undefined : user?.post;
  const isKitchen = post === 'kitchen';
  const isDeliverer = post === 'deliverer';

  const { commands, deleteCommand, finaliseCommand, payDebt, setKitchenStatus, markDelivered, autoPrintKitchen, setAutoPrintKitchen, markKitchenPrinted } = useCommandStore();
  const comptoirItems = useComptoirStore((s) => s.items);
  const clients = useClientStore((s) => s.clients);
  const settings = useSettingsStore((s) => s.settings);

  // Role-based capabilities (kitchen & deliverer profiles are read-only)
  const canCreate = !isKitchen && !isDeliverer && (can('commands', 'create') || can('pos', 'create'));
  const canEdit = !isKitchen && !isDeliverer && can('commands', 'edit');
  const canDelete = !isKitchen && !isDeliverer && can('commands', 'delete');
  const canFinalise = !isKitchen && !isDeliverer && (can('commands', 'pay') || can('commands', 'edit'));
  const canManageOptions = !isDeliverer && (isAdmin || isKitchen || can('commands', 'edit'));

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<OrderType | ''>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const [viewCmd, setViewCmd] = useState<Command | null>(null);
  const [finaliseCmd, setFinaliseCmd] = useState<Command | null>(null);
  const [payNow, setPayNow] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deviceIsKitchen, setDeviceIsKitchen] = useState(isKitchenPrinterDevice());
  const [doneCmd, setDoneCmd] = useState<Command | null>(null);

  // Deliverers only see the deliveries assigned to them
  const scoped = useMemo(() => {
    if (isDeliverer) return commands.filter((c) => c.orderType === 'delivery' && c.delivererId && c.delivererId === user?.workerId);
    return commands;
  }, [commands, isDeliverer, user?.workerId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scoped
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => !typeFilter || (c.orderType || 'takeaway') === typeFilter)
      .filter((c) => matchesDateFilter(c.createdAt, dateFilter, from, to))
      .filter((c) => !q || c.reference.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) || (c.clientPhone || '').includes(q) || (c.deliveryAddress || '').toLowerCase().includes(q) || (c.tableNumber || '').includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [scoped, status, typeFilter, dateFilter, from, to, search]);

  const stats = useMemo(() => {
    const pending = scoped.filter((c) => c.status === 'pending');
    const today = new Date().toDateString();
    return {
      pending: pending.length,
      preparing: pending.filter((c) => c.kitchenStatus === 'preparing').length,
      ready: pending.filter((c) => c.kitchenStatus === 'ready').length,
      finalisedToday: scoped.filter((c) => c.finalisedAt && new Date(c.finalisedAt).toDateString() === today).length,
      toCollect: pending.reduce((s, c) => s + c.restAmount, 0),
      deliveries: pending.filter((c) => c.orderType === 'delivery').length,
    };
  }, [scoped]);

  const comptoirStock = (name: string) => comptoirItems.filter((i) => i.productName.toLowerCase() === name.toLowerCase()).reduce((s, i) => s + i.quantity, 0);

  const openFinalise = (c: Command) => { setFinaliseCmd(c); setPayNow(c.restAmount); };

  const confirmFinalise = () => {
    if (!finaliseCmd) return;
    const pay = Math.max(0, Math.min(payNow, finaliseCmd.restAmount));
    const remaining = finaliseCmd.restAmount - pay;
    if (remaining > 0 && (!finaliseCmd.clientId || finaliseCmd.clientId === PASSAGER_CLIENT_ID)) {
      toast.error('Reste à payer : la commande doit être liée à un client (pas un client passager). Modifiez la commande pour choisir un client.');
      return;
    }
    const done = finaliseCommand(finaliseCmd.id, { payAmount: pay });
    setFinaliseCmd(null);
    if (done) {
      toast.success(remaining > 0 ? `Commande finalisée — reste ${formatCurrency(remaining)} en dette` : 'Commande finalisée et payée');
      setDoneCmd(done);
    }
  };

  const printKitchen = (c: Command) => { printKitchenTicket(c, settings); markKitchenPrinted(c.id); };

  const nextKitchen = (c: Command): KitchenStatus | null => {
    const s = c.kitchenStatus || 'new';
    if (s === 'new') return 'preparing';
    if (s === 'preparing') return 'ready';
    return null;
  };

  return (
    <div>
      <PageHeader
        title={isDeliverer ? 'Mes livraisons' : isKitchen ? 'Commandes — Cuisine' : 'Commandes'}
        icon={isKitchen ? <ChefHat size={24} /> : isDeliverer ? <Truck size={24} /> : <ClipboardList size={24} />}
        subtitle={`${stats.pending} en attente · ${filtered.length} affichées`}
        actions={
          <>
            {canManageOptions && (
              <Button variant="secondary" onClick={() => setOptionsOpen(true)}>
                <Settings2 size={16} /> Options
                {autoPrintKitchen && <span className="h-2 w-2 rounded-full bg-pistachio" />}
              </Button>
            )}
            {canCreate && <Button variant="gold" onClick={() => navigate('/pos?mode=command')}><Plus size={18} /> Nouvelle commande</Button>}
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile index={0} label="En attente" value={String(stats.pending)} icon={<Clock size={18} />} tone="text-caramel" />
        {isDeliverer ? (
          <StatTile index={1} label="Livraisons à faire" value={String(stats.deliveries)} icon={<Bike size={18} />} tone="text-gold-dark" />
        ) : (
          <StatTile index={1} label="En préparation / prêtes" value={`${stats.preparing} / ${stats.ready}`} icon={<Flame size={18} />} tone="text-gold-dark" />
        )}
        <StatTile index={2} label="Finalisées aujourd'hui" value={String(stats.finalisedToday)} icon={<CheckCircle2 size={18} />} tone="text-pistachio" />
        {!isKitchen && <StatTile index={3} label="Reste à encaisser" value={formatCurrency(stats.toCollect)} icon={<Coins size={18} />} tone="text-rose-deep" />}
      </div>

      {/* Filters */}
      <Card index={1} className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Réf, client, téléphone, adresse, table…" /></div>
          <div className="flex gap-1 p-1 rounded-xl bg-vanilla/60 border border-gold/15">
            {([['pending', 'En attente'], ['finalised', 'Finalisées'], ['all', 'Toutes']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status === k ? 'bg-gradient-button text-white' : 'text-text-secondary'}`}>{l}</button>
            ))}
          </div>
          {!isDeliverer && (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as OrderType | '')} className="h-10 rounded-xl border border-gold/25 bg-white/70 px-3 text-sm">
              <option value="">Tous les types</option>
              <option value="table">Sur place</option>
              <option value="takeaway">À emporter</option>
              <option value="delivery">Livraison</option>
            </select>
          )}
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className="h-10 rounded-xl border border-gold/25 bg-white/70 px-3 text-sm">
            <option value="all">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">Ce mois</option>
            <option value="custom">Période</option>
          </select>
          {dateFilter === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[150px]" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[150px]" />
            </div>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState message={isDeliverer ? 'Aucune livraison assignée' : 'Aucune commande'} icon={<ClipboardList size={34} />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const finalised = c.status === 'finalised';
            const ks = c.kitchenStatus || 'new';
            const next = nextKitchen(c);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
                className={`flex flex-col rounded-2xl bg-gradient-card border shadow-card p-4 ${c.orderType === 'delivery' ? 'border-lavender/30' : 'border-gold/15'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-muted">{c.reference}</p>
                    <h3 className="font-display font-semibold text-text-primary truncate">{c.clientName}</h3>
                    {(c.clientPhone || c.deliveryPhone) && <p className="text-xs text-text-muted flex items-center gap-1"><Phone size={10} /> {c.deliveryPhone || c.clientPhone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={finalised ? 'success' : 'warning'}>{finalised ? 'Finalisée' : 'En attente'}</Badge>
                    {!finalised && <Badge variant={KITCHEN_VARIANT[ks]}><ChefHat size={10} /> {KITCHEN_LABEL[ks]}</Badge>}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-gold-dark bg-gold/10 rounded-lg px-2.5 py-1.5 mb-2">
                  <TypeIcon type={c.orderType} /> {orderTypeLabel({ ...c, orderType: c.orderType || 'takeaway' })}
                  {c.orderType === 'delivery' && c.delivererName && <span className="ml-auto flex items-center gap-1 text-text-secondary"><Bike size={11} /> {c.delivererName}</span>}
                </div>
                {c.orderType === 'delivery' && c.deliveryAddress && (
                  <div className="flex items-start gap-1.5 text-xs bg-lavender/10 text-text-primary rounded-lg px-2.5 py-1.5 mb-2">
                    <MapPin size={12} className="mt-0.5 shrink-0 text-lavender" /> <span className="font-medium">{c.deliveryAddress}</span>
                  </div>
                )}

                <div className="text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {formatDateTime(c.createdAt, language)}</span>
                  <span className="flex items-center gap-1 text-rose-deep font-semibold"><Clock size={11} /> Pour {formatDate(c.receiveDate, language)} {c.receiveHour}h{c.receiveMinute}</span>
                </div>

                <div className="flex-1 space-y-1 mb-3 max-h-36 overflow-y-auto pr-1">
                  {c.items.map((l, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="h-7 w-7 rounded-md bg-gradient-rose text-white flex items-center justify-center overflow-hidden shrink-0">
                        {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <CakeSlice size={11} />}
                      </div>
                      <span className="flex-1 truncate text-text-primary"><b>{l.quantity}{l.sellByUnit && l.sellUnit ? ` ${l.sellUnit}` : '×'}</b> {l.productName}</span>
                      {!isKitchen && <span className="tabular text-text-muted">{formatCurrency(l.totalPrice)}</span>}
                    </div>
                  ))}
                </div>
                {c.note && <p className="text-xs bg-caramel/10 text-caramel rounded-lg px-2 py-1 mb-2 flex items-center gap-1"><StickyNote size={11} /> {c.note}</p>}

                {!isKitchen && (
                  <div className="border-t border-gold/10 pt-2 text-xs space-y-0.5 mb-3">
                    <div className="flex justify-between"><span className="text-text-muted">Total</span><span className="tabular font-semibold">{formatCurrency(c.totalAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">Payé</span><span className="tabular text-pistachio">{formatCurrency(c.paidAmount)}</span></div>
                    <div className="flex justify-between font-bold"><span>Reste</span><span className={`tabular ${c.restAmount > 0 ? 'text-rose-deep' : 'text-pistachio'}`}>{formatCurrency(c.restAmount)}</span></div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  <Button size="sm" variant="secondary" onClick={() => setViewCmd(c)} title="Voir"><Eye size={14} /></Button>
                  {!isKitchen && <Button size="sm" variant="secondary" onClick={() => printCommandReceipt(c, settings)} title="Imprimer le bon"><Printer size={14} /></Button>}
                  {!isDeliverer && <Button size="sm" variant="secondary" onClick={() => printKitchen(c)} title="Ticket cuisine"><ChefHat size={14} />{isKitchen && ' Imprimer'}</Button>}
                  {!finalised && canEdit && <Button size="sm" variant="ghost" onClick={() => navigate(`/pos?edit=${c.id}`)} title="Modifier"><Pencil size={14} /></Button>}
                  {canDelete && <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)} title="Supprimer"><Trash2 size={14} className="text-rose-deep" /></Button>}
                  {!finalised && (isKitchen || canEdit) && next && (
                    <Button size="sm" variant="outline" onClick={() => { setKitchenStatus(c.id, next); toast.success(next === 'ready' ? 'Commande prête' : 'En préparation'); }}>
                      {next === 'ready' ? <PackageCheck size={14} /> : <Flame size={14} />} {next === 'ready' ? 'Prête' : 'Préparer'}
                    </Button>
                  )}
                  {isDeliverer && !c.deliveredAt && (
                    <Button size="sm" variant="mint" className="flex-1" onClick={() => { markDelivered(c.id); toast.success('Livraison confirmée'); }}><Truck size={14} /> Livrée</Button>
                  )}
                  {c.deliveredAt && <Badge variant="success">Livrée {formatDateTime(c.deliveredAt, language).slice(-5)}</Badge>}
                  {!finalised && canFinalise && <Button size="sm" variant="mint" className="flex-1" onClick={() => openFinalise(c)}><CheckCircle2 size={14} /> Finaliser</Button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===== View details ===== */}
      <Modal open={!!viewCmd} onClose={() => setViewCmd(null)} title={viewCmd ? `Commande ${viewCmd.reference}` : ''} size="lg">
        {viewCmd && (() => {
          const c = commands.find((x) => x.id === viewCmd.id) || viewCmd;
          const lineSum = c.items.reduce((s, l) => s + l.totalPrice, 0);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Info label="Statut" value={c.status === 'finalised' ? 'Finalisée' : 'En attente'} />
                <Info label="Cuisine" value={KITCHEN_LABEL[c.kitchenStatus || 'new']} />
                <Info label="Service" value={orderTypeLabel({ ...c, orderType: c.orderType || 'takeaway' })} />
                <Info label="Créée par" value={c.createdBy || '—'} />
                <Info label="Client" value={c.clientName} />
                <Info label="Téléphone" value={c.deliveryPhone || c.clientPhone || '—'} />
                <Info label="Créée le" value={formatDateTime(c.createdAt, language)} />
                <Info label="Prévue pour" value={`${formatDate(c.receiveDate, language)} ${c.receiveHour}h${c.receiveMinute}`} />
                {c.orderType === 'delivery' && <Info label="Livreur" value={c.delivererName || '—'} />}
                {c.deliveredAt && <Info label="Livrée le" value={formatDateTime(c.deliveredAt, language)} />}
                {c.finalisedAt && <Info label="Finalisée le" value={`${formatDateTime(c.finalisedAt, language)}${c.finalisedBy ? ` · ${c.finalisedBy}` : ''}`} />}
                {c.source && <Info label="Origine" value={c.source === 'pos' ? 'Point de vente' : c.source} />}
              </div>
              {c.orderType === 'delivery' && (
                <div className="rounded-xl bg-lavender/10 border border-lavender/20 p-3 text-sm flex items-start gap-2"><MapPin size={16} className="text-lavender mt-0.5" /> <span><b>Adresse :</b> {c.deliveryAddress || '—'}</span></div>
              )}
              {c.note && <div className="rounded-xl bg-caramel/10 p-3 text-sm"><b>Note :</b> {c.note}</div>}

              <div className="rounded-xl border border-gold/15 overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-vanilla/60 text-text-secondary text-xs">
                    <tr><th className="text-left px-3 py-2">Produit</th><th className="text-right px-3 py-2">Qté</th>{!isKitchen && <><th className="text-right px-3 py-2">P.U.</th><th className="text-right px-3 py-2">Total</th></>}</tr>
                  </thead>
                  <tbody>
                    {c.items.map((l, i) => (
                      <tr key={i} className="border-t border-gold/10">
                        <td className="px-3 py-2"><div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-gradient-rose text-white flex items-center justify-center overflow-hidden shrink-0">{l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <CakeSlice size={14} />}</div>
                          {l.productName}</div></td>
                        <td className="px-3 py-2 text-right tabular">{l.quantity}{l.sellByUnit && l.sellUnit ? ` ${l.sellUnit}` : ''}</td>
                        {!isKitchen && <><td className="px-3 py-2 text-right tabular">{formatCurrency(l.unitPrice)}</td><td className="px-3 py-2 text-right tabular font-semibold">{formatCurrency(l.totalPrice)}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isKitchen && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-vanilla/40 p-3 text-sm space-y-1">
                    {lineSum !== c.totalAmount && <div className="flex justify-between"><span className="text-text-muted">Sous-total</span><span className="tabular">{formatCurrency(lineSum)}</span></div>}
                    {lineSum > c.totalAmount && <div className="flex justify-between"><span className="text-text-muted">Réduction</span><span className="tabular">- {formatCurrency(lineSum - c.totalAmount)}</span></div>}
                    <div className="flex justify-between font-bold"><span>Total</span><span className="tabular">{formatCurrency(c.totalAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">Payé</span><span className="tabular text-pistachio">{formatCurrency(c.paidAmount)}</span></div>
                    <div className="flex justify-between font-bold"><span>Reste</span><span className={`tabular ${c.restAmount > 0 ? 'text-rose-deep' : 'text-pistachio'}`}>{formatCurrency(c.restAmount)}</span></div>
                  </div>
                  <div className="rounded-xl bg-vanilla/40 p-3 text-sm">
                    <p className="font-semibold mb-1.5">Historique des paiements</p>
                    {c.payments.length === 0 ? <p className="text-text-muted text-xs">Aucun paiement</p> : (
                      <div className="space-y-1">
                        {c.payments.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs">
                            <span className="text-text-muted">{p.at ? formatDateTime(p.at, language) : formatDate(p.date, language)}{p.receivedBy ? ` · ${p.receivedBy}` : ''}</span>
                            <span className="tabular font-semibold text-pistachio">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {!isDeliverer && <Button variant="secondary" onClick={() => printKitchen(c)}><ChefHat size={16} /> Ticket cuisine</Button>}
                {!isKitchen && <Button variant="secondary" onClick={() => printCommandReceipt(c, settings)}><Printer size={16} /> Bon client</Button>}
                {c.status === 'pending' && canEdit && <Button variant="outline" onClick={() => navigate(`/pos?edit=${c.id}`)}><Pencil size={16} /> Modifier</Button>}
                {c.status === 'pending' && canFinalise && <Button variant="mint" onClick={() => { setViewCmd(null); openFinalise(c); }}><CheckCircle2 size={16} /> Finaliser</Button>}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ===== Finalise with payment verification ===== */}
      <Modal open={!!finaliseCmd} onClose={() => setFinaliseCmd(null)} title={finaliseCmd ? `Finaliser ${finaliseCmd.reference}` : ''} size="md">
        {finaliseCmd && (() => {
          const c = finaliseCmd;
          const pay = Math.max(0, Math.min(payNow, c.restAmount));
          const remaining = c.restAmount - pay;
          const missing = c.items.filter((l) => comptoirStock(l.productName) < l.quantity);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Info label="Total" value={formatCurrency(c.totalAmount)} />
                <Info label="Déjà payé" value={formatCurrency(c.paidAmount)} />
                <Info label="Reste" value={formatCurrency(c.restAmount)} />
              </div>

              {c.restAmount > 0 ? (
                <div className="rounded-xl border border-gold/15 bg-white p-3 space-y-3">
                  <p className="text-sm font-semibold">Vérification du paiement</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPayNow(c.restAmount)} className={`py-2 rounded-xl text-sm font-semibold border ${pay === c.restAmount ? 'bg-pistachio/15 border-pistachio text-pistachio' : 'border-gold/20 text-text-secondary'}`}>✓ Payée entièrement</button>
                    <button onClick={() => setPayNow(0)} className={`py-2 rounded-xl text-sm font-semibold border ${pay < c.restAmount ? 'bg-rose-deep/10 border-rose-deep text-rose-deep' : 'border-gold/20 text-text-secondary'}`}>Reste à payer</button>
                  </div>
                  <Input label="Montant encaissé maintenant (DA)" type="number" min={0} max={c.restAmount} value={payNow} onChange={(e) => setPayNow(Number(e.target.value))} icon={<Coins size={16} />} />
                  {remaining > 0 ? (
                    <div className="rounded-lg bg-rose-deep/10 text-rose-deep text-sm px-3 py-2 flex items-center gap-2"><AlertTriangle size={15} /> {formatCurrency(remaining)} restera en dette pour {c.clientName}</div>
                  ) : (
                    <div className="rounded-lg bg-pistachio/15 text-pistachio text-sm px-3 py-2 flex items-center gap-2"><CheckCircle2 size={15} /> Commande soldée</div>
                  )}
                  {remaining > 0 && (!c.clientId || c.clientId === PASSAGER_CLIENT_ID) && (
                    <p className="text-xs text-rose-deep">Un client passager ne peut pas garder de dette : modifiez la commande pour choisir un client.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-pistachio/15 text-pistachio text-sm px-3 py-2 flex items-center gap-2"><CheckCircle2 size={15} /> Déjà entièrement payée</div>
              )}

              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Stock comptoir</p>
                <div className="rounded-xl border border-gold/15 overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-vanilla/60 text-text-secondary"><tr><th className="text-left px-3 py-1.5">Produit</th><th className="text-right px-3 py-1.5">Commandé</th><th className="text-right px-3 py-1.5">Comptoir</th></tr></thead>
                    <tbody>
                      {c.items.map((l, i) => {
                        const st = comptoirStock(l.productName);
                        return (
                          <tr key={i} className="border-t border-gold/10">
                            <td className="px-3 py-1.5">{l.productName}</td>
                            <td className="px-3 py-1.5 text-right tabular">{l.quantity}</td>
                            <td className={`px-3 py-1.5 text-right tabular font-semibold ${st >= l.quantity ? 'text-pistachio' : 'text-rose-deep'}`}>{st}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {missing.length > 0 && <p className="text-xs text-caramel mt-1.5 flex items-center gap-1"><AlertTriangle size={12} /> Stock comptoir insuffisant pour {missing.length} produit(s) — il sera ramené à 0.</p>}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setFinaliseCmd(null)}>Annuler</Button>
                {c.restAmount > 0 && pay > 0 && pay < c.restAmount && (
                  <Button variant="outline" onClick={() => { payDebt(c.id, pay, `Versement ${c.reference}`); toast.success('Versement enregistré'); setFinaliseCmd(null); }}>Encaisser sans finaliser</Button>
                )}
                <Button variant="mint" onClick={confirmFinalise}><CheckCircle2 size={16} /> Finaliser{pay > 0 ? ` (${formatCurrency(pay)})` : ''}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* After finalising: print the invoice */}
      <Modal open={!!doneCmd} onClose={() => setDoneCmd(null)} size="sm">
        {doneCmd && (
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-pistachio/15 flex items-center justify-center mb-4"><CheckCircle2 size={30} className="text-pistachio" /></div>
            <h3 className="font-display text-lg font-semibold mb-1">Commande finalisée ✅</h3>
            <p className="text-sm text-text-secondary mb-5">{doneCmd.reference} · {formatCurrency(doneCmd.totalAmount)}</p>
            <div className="flex gap-2 w-full">
              <Button variant="secondary" className="flex-1" onClick={() => setDoneCmd(null)}>Fermer</Button>
              <Button variant="gold" className="flex-1" onClick={() => { printCommandReceipt(doneCmd, settings); setDoneCmd(null); }}><Printer size={16} /> Facture</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Options */}
      <Modal open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Options des commandes" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-gold/15 bg-white p-3 space-y-2">
            <Switch checked={autoPrintKitchen} onChange={(v) => { setAutoPrintKitchen(v); toast.success(v ? 'Impression automatique cuisine activée' : 'Impression automatique désactivée'); }} label="Impression automatique des nouvelles commandes en cuisine" />
            <p className="text-xs text-text-muted">Chaque nouvelle commande (ou commande modifiée) imprime automatiquement un ticket cuisine sur le poste cuisine.</p>
          </div>
          {!isKitchen && (
            <div className="rounded-xl border border-gold/15 bg-white p-3 space-y-2">
              <Switch checked={deviceIsKitchen} onChange={(v) => { setKitchenPrinterDevice(v); setDeviceIsKitchen(v); }} label="Cet appareil est le poste d’impression cuisine" />
              <p className="text-xs text-text-muted">Les profils « Cuisine » impriment automatiquement. Activez cette option pour qu’un autre appareil (connecté) imprime aussi les tickets.</p>
            </div>
          )}
          {isKitchen && <p className="text-xs text-text-muted flex items-center gap-1"><User size={12} /> Ce profil cuisine imprime automatiquement les tickets lorsque l’option est activée.</p>}
          <div className="flex justify-end"><Button variant="gold" onClick={() => setOptionsOpen(false)}>OK</Button></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteCommand(deleteId); toast.success('Commande supprimée'); } }} />
    </div>
  );
}

function StatTile({ index, label, value, icon, tone }: { index: number; label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card index={index} className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl bg-vanilla flex items-center justify-center ${tone}`}>{icon}</div>
      <div className="min-w-0"><p className="text-xs text-text-muted">{label}</p><p className={`text-lg font-bold tabular ${tone}`}>{value}</p></div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="bg-vanilla/40 rounded-lg px-3 py-2 min-w-0"><p className="text-[11px] text-text-muted">{label}</p><p className="text-sm font-medium text-text-primary truncate">{value}</p></div>;
}
