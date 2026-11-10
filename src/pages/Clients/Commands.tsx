import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Search, Calendar, Clock, CreditCard, ChevronRight,
  Eye, Pencil, Trash2, CheckCircle2, AlertTriangle, Printer, UserPlus, X, Coins,
  ChevronDown, ChevronUp, User, Phone, Check, Receipt
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/ui/SearchBar';
import { toast } from '@/components/ui/Toast';
import { useCommandStore, type Command, type CommandLine } from '@/store/commandStore';
import { useClientStore } from '@/store/clientStore';
import { useFicheTechnicStore } from '@/store/ficheTechnicStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatDate, todayISO, uid } from '@/lib/utils';
import { cardVariants } from '@/lib/animations';

type DateFilter = 'today' | 'week' | 'month' | 'period' | 'all';
type StatusFilter = 'all' | 'paid' | 'debt' | 'pending' | 'finalised';

export default function CommandsPage() {
  const { t, language } = useLanguage();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const { commands, addCommand, updateCommand, deleteCommand, payDebt, finaliseCommand } = useCommandStore();
  const { clients, addClient } = useClientStore();
  const { ficheTechnics } = useFicheTechnicStore();
  const comptoirItems = useComptoirStore((s) => s.items);
  const settings = useSettingsStore((s) => s.settings);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Client selection / creation inline
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Item builder states
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<CommandLine[]>([]);
  const [receiveDate, setReceiveDate] = useState(todayISO());
  const [receiveHour, setReceiveHour] = useState('14');
  const [receiveMinute, setReceiveMinute] = useState('30');
  const [customTotal, setCustomTotal] = useState<number | null>(null);
  const [versement, setVersement] = useState(0);

  // Interaction modals
  const [finaliseCmd, setFinaliseCmd] = useState<Command | null>(null);
  const [payCmd, setPayCmd] = useState<Command | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDescription, setPayDescription] = useState('Paiement acompte commande');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Print prompt modal (matches POS design)
  const [printPromptCmd, setPrintPromptCmd] = useState<Command | null>(null);
  const [printPromptType, setPrintPromptType] = useState<'create' | 'finalise'>('create');

  // Comptoir stock helper
  const getComptoirStock = (productName: string) => {
    return comptoirItems
      .filter((i) => i.productName.toLowerCase() === productName.toLowerCase())
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Filter logic
  const filteredCommands = useMemo(() => {
    return commands.filter((c) => {
      // Search by client name
      const matchesSearch = c.clientName.toLowerCase().includes(search.toLowerCase()) || 
        (c.clientPhone && c.clientPhone.includes(search));
      
      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'paid') matchesStatus = c.restAmount <= 0;
      else if (statusFilter === 'debt') matchesStatus = c.restAmount > 0;
      else if (statusFilter === 'pending') matchesStatus = c.status === 'pending';
      else if (statusFilter === 'finalised') matchesStatus = c.status === 'finalised';

      // Date filter
      let matchesDate = true;
      const cmdTime = new Date(c.createdAt).getTime();
      const today = new Date();
      
      if (dateFilter === 'today') {
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        matchesDate = cmdTime >= start.getTime() && cmdTime <= end.getTime();
      } else if (dateFilter === 'week') {
        const start = new Date(); start.setDate(start.getDate() - 7);
        matchesDate = cmdTime >= start.getTime();
      } else if (dateFilter === 'month') {
        const start = new Date(); start.setDate(start.getDate() - 30);
        matchesDate = cmdTime >= start.getTime();
      } else if (dateFilter === 'period') {
        const start = new Date(from); start.setHours(0,0,0,0);
        const end = new Date(to + 'T23:59:59');
        matchesDate = cmdTime >= start.getTime() && cmdTime <= end.getTime();
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [commands, search, statusFilter, dateFilter, from, to]);

  // Statistics
  const stats = useMemo(() => {
    const totalPaid = filteredCommands.reduce((sum, c) => sum + c.paidAmount, 0);
    const totalRest = filteredCommands.reduce((sum, c) => sum + c.restAmount, 0);
    const totalValue = filteredCommands.reduce((sum, c) => sum + c.totalAmount, 0);
    return { totalPaid, totalRest, totalValue };
  }, [filteredCommands]);

  // Client search results
  const clientSearchResults = useMemo(() => {
    if (!clientSearch) return [];
    return clients.filter((c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch)
    );
  }, [clients, clientSearch]);

  // Fiche techniques search results
  const recipeSearchResults = useMemo(() => {
    if (!recipeSearch) return [];
    return ficheTechnics.filter((ft) =>
      ft.name.toLowerCase().includes(recipeSearch.toLowerCase())
    );
  }, [ficheTechnics, recipeSearch]);

  const handleCreateClientInline = () => {
    if (!newClientName) { toast.error('Nom requis'); return; }
    const newCli = addClient({ name: newClientName, phone: newClientPhone });
    setSelectedClient(newCli);
    setNewClientName('');
    setNewClientPhone('');
    setShowNewClientForm(false);
    toast.success('Client créé et sélectionné');
  };

  const handleAddRecipeLine = (ft: typeof ficheTechnics[0]) => {
    const exists = selectedItems.find((item) => item.ficheTechnicId === ft.id);
    if (exists) {
      toast.error('Ce produit est déjà ajouté');
      return;
    }
    const newLine: CommandLine = {
      ficheTechnicId: ft.id,
      productName: ft.name,
      quantity: 1,
      unitPrice: ft.unitPrice,
      totalPrice: ft.unitPrice,
      sellByUnit: ft.sellByUnit,
      sellUnit: ft.sellUnit,
    };
    setSelectedItems([...selectedItems, newLine]);
    setRecipeSearch('');
    toast.success('Produit ajouté');
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    setSelectedItems(
      selectedItems.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          quantity: qty,
          totalPrice: qty * item.unitPrice,
        };
      })
    );
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    setSelectedItems(
      selectedItems.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          unitPrice: price,
          totalPrice: item.quantity * price,
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, idx) => idx !== index));
  };

  const computedTotalSum = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const finalTotalAmount = customTotal !== null ? customTotal : computedTotalSum;

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setSelectedClient(null);
    setSelectedItems([]);
    setReceiveDate(todayISO());
    setReceiveHour('14');
    setReceiveMinute('30');
    setCustomTotal(null);
    setVersement(0);
    setClientSearch('');
    setRecipeSearch('');
    setShowNewClientForm(false);
    setFormOpen(true);
  };

  const handleOpenEditForm = (cmd: Command) => {
    if (cmd.status === 'finalised') {
      toast.error('Une commande finalisée ne peut pas être modifiée');
      return;
    }
    setEditingId(cmd.id);
    setSelectedClient({ id: cmd.clientId, name: cmd.clientName, phone: cmd.clientPhone });
    setSelectedItems(cmd.items);
    setReceiveDate(cmd.receiveDate);
    setReceiveHour(cmd.receiveHour);
    setReceiveMinute(cmd.receiveMinute);
    setCustomTotal(cmd.totalAmount);
    setVersement(cmd.paidAmount);
    setFormOpen(true);
  };

  const handleSaveCommand = () => {
    if (!selectedClient) { toast.error('Veuillez sélectionner un client'); return; }
    if (selectedItems.length === 0) { toast.error('Ajoutez au moins un produit'); return; }
    if (versement < 0) { toast.error('Le versement ne peut pas être négatif'); return; }

    const cmdData = {
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientPhone: selectedClient.phone,
      receiveDate,
      receiveHour,
      receiveMinute,
      items: selectedItems,
      totalAmount: finalTotalAmount,
      paidAmount: versement,
    };

    if (editingId) {
      updateCommand(editingId, cmdData);
      toast.success('Commande modifiée avec succès');
      const updatedCmd = useCommandStore.getState().commands.find((c) => c.id === editingId);
      if (updatedCmd) promptPrint(updatedCmd);
    } else {
      const newCmd = addCommand(cmdData);
      toast.success('Commande créée avec succès');
      promptPrint(newCmd);
    }
    setFormOpen(false);
  };

  const promptPrint = (cmd: Command, type: 'create' | 'finalise' = 'create') => {
    setPrintPromptCmd(cmd);
    setPrintPromptType(type);
  };

  const printCommandInvoice = (cmd: Command) => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;

    const rows = cmd.items
      .map(
        (l) => `<tr>
        <td style="padding: 10px; border-bottom: 1px solid #FBE4EF;">${l.productName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #FBE4EF; text-align: right;">${l.quantity}${l.sellByUnit && l.sellUnit ? ` ${l.sellUnit}` : ''}</td>
        <td style="padding: 10px; border-bottom: 1px solid #FBE4EF; text-align: right;">${formatCurrency(l.unitPrice)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #FBE4EF; text-align: right; font-weight: bold;">${formatCurrency(l.totalPrice)}</td>
      </tr>`
      )
      .join('');

    const logo = settings.logo
      ? `<div style="width: 78px; height: 78px; border-radius: 16px; border: 2px solid #FF7FB0; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#fff;"><img src="${settings.logo}" style="width:100%; height:100%; object-fit:cover;"/></div>`
      : `<div style="width: 78px; height: 78px; border-radius: 16px; border: 2px solid #FF7FB0; display:flex; align-items:center; justify-content:center; font-size:30px; background:#fff;">🥐</div>`;

    win.document.write(`
      <html>
        <head>
          <title>Commande ${cmd.reference}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #5A2A47; padding: 24px; background: #fff; }
            .sheet { max-width: 650px; margin: 0 auto; border: 2px solid #FFC2DD; border-radius: 18px; overflow: hidden; }
            .header { display: flex; align-items: center; gap: 18px; padding: 20px; background: linear-gradient(135deg,#FFF4FA 0%,#FFEAF3 100%); border-bottom: 3px solid #FF7FB0; }
            .store-name { font-size: 22px; font-weight: bold; color: #6E3B5C; }
            .store-meta { font-size: 11px; color: #8A4A6B; margin-top: 4px; }
            .title-bar { display:flex; justify-content:space-between; align-items:center; padding: 12px 20px; background:#FF7FB0; color:#fff; }
            .title { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
            .content { padding: 20px; }
            .party { background: #FFF7FB; border: 1px solid #FFC2DD; border-left: 4px solid #FF7FB0; border-radius: 10px; padding: 12px; margin-bottom: 18px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
            th { background: #FFF4FA; color: #6E3B5C; padding: 10px; text-align: left; font-weight:600; border-bottom: 2px solid #FFC2DD; }
            .totals { width: 280px; margin-left: auto; border: 1px solid #FFC2DD; border-radius: 10px; font-size: 13px; }
            .totals div { display: flex; justify-content: space-between; padding: 8px 12px; }
            .totals .grand { background: #FF7FB0; color: #fff; font-weight: bold; }
            .footer { margin-top: 20px; border-top: 2px dashed #FFC2DD; padding-top: 10px; text-align: center; font-size: 12px; color: #B06A8C; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              ${logo}
              <div>
                <div class="store-name">${settings.name}</div>
                <div class="store-meta">📍 ${settings.address} · 📞 ${settings.phone}</div>
              </div>
            </div>
            <div class="title-bar">
              <div class="title">BON DE COMMANDE</div>
              <div style="text-align: right; font-size: 12px;">
                <strong>${cmd.reference}</strong><br/>
                Livraison: ${formatDate(cmd.receiveDate)} à ${cmd.receiveHour}h${cmd.receiveMinute}
              </div>
            </div>
            <div class="content">
              <div class="party">
                <strong>Client: ${cmd.clientName}</strong><br/>
                ${cmd.clientPhone ? `📞 Téléphone: ${cmd.clientPhone}` : ''}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th style="text-align: right;">Qté</th>
                    <th style="text-align: right;">P.U.</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              <div class="totals">
                <div><span>Total Commande</span><span>${formatCurrency(cmd.totalAmount)}</span></div>
                <div><span>Acompte versé</span><span>${formatCurrency(cmd.paidAmount)}</span></div>
                <div class="grand"><span>Reste à payer</span><span>${formatCurrency(cmd.restAmount)}</span></div>
              </div>
              <div class="footer">
                Merci de votre confiance !
              </div>
            </div>
          </div>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleConfirmFinalise = () => {
    if (!finaliseCmd) return;
    const cmdSnapshot = finaliseCmd;
    finaliseCommand(finaliseCmd.id);
    toast.success('Commande finalisée avec succès. Comptoir mis à jour !');
    setFinaliseCmd(null);
    promptPrint(cmdSnapshot, 'finalise');
  };

  const handlePayDebt = () => {
    if (!payCmd) return;
    if (payAmount <= 0) { toast.error('Montant invalide'); return; }
    if (payAmount > payCmd.restAmount) { toast.error('Le montant dépasse la dette restante'); return; }

    payDebt(payCmd.id, payAmount, payDescription);
    toast.success('Paiement enregistré !');
    setPayCmd(null);
    setPayAmount(0);
  };

  return (
    <div>
      <PageHeader
        title="Commandes Clients"
        icon={<ShoppingCart size={24} />}
        subtitle={`${filteredCommands.length} commandes filtrées`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/clients')}><User size={18} /> Retour aux Clients</Button>
            <Button variant="gold" onClick={handleOpenCreateForm}><Plus size={18} /> Nouvelle Commande</Button>
          </div>
        }
      />

      {/* ===== Statistics Cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card index={0} className="relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#A6E9CE] to-[#3FB591] opacity-10" />
          <p className="text-sm text-text-muted mb-1">Total Commandes</p>
          <p className="text-2xl font-bold tabular text-gold-dark">{formatCurrency(stats.totalValue)}</p>
        </Card>
        <Card index={1} className="relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#FFC2DD] to-[#FF7FB0] opacity-10" />
          <p className="text-sm text-text-muted mb-1">Total Versé (Acomptes)</p>
          <p className="text-2xl font-bold tabular text-pistachio">{formatCurrency(stats.totalPaid)}</p>
        </Card>
        <Card index={2} className="relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#FFB0CB] to-[#F2547D] opacity-10" />
          <p className="text-sm text-text-muted mb-1">Total Dettes</p>
          <p className="text-2xl font-bold tabular text-rose-deep">{formatCurrency(stats.totalRest)}</p>
        </Card>
      </div>

      {/* ===== Search & Filter Controls ===== */}
      <Card index={3} className="mb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par client ou téléphone..." />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full h-11 px-4 rounded-xl border border-gold/15 bg-vanilla/30 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="finalised">Finalisées</option>
                <option value="paid">Payées</option>
                <option value="debt">Avec Dette</option>
              </select>
            </div>
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full h-11 px-4 rounded-xl border border-gold/15 bg-vanilla/30 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
                <option value="period">Par période</option>
              </select>
            </div>
          </div>

          <AnimatePresence>
            {dateFilter === 'period' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-3 overflow-hidden"
              >
                <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* ===== Commands Cards Grid ===== */}
      {filteredCommands.length === 0 ? (
        <EmptyState message="Aucune commande trouvée" icon={<ShoppingCart size={36} />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCommands.map((cmd, i) => {
            const isFinalised = cmd.status === 'finalised';
            return (
              <motion.div
                key={cmd.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col border border-gold/15 rounded-2xl bg-gradient-card shadow-card p-5 overflow-hidden relative"
              >
                {/* Header info */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div>
                    <span className="text-xs font-bold text-text-muted">{cmd.reference}</span>
                    <h3 className="font-display font-semibold text-text-primary mt-0.5 truncate max-w-[150px]">{cmd.clientName}</h3>
                    {cmd.clientPhone && (
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {cmd.clientPhone}
                      </p>
                    )}
                  </div>
                  <Badge variant={isFinalised ? 'success' : 'warning'}>
                    {isFinalised ? 'Finalisée' : 'En attente'}
                  </Badge>
                </div>

                {/* Dates info */}
                <div className="bg-vanilla/30 rounded-xl p-3 text-xs space-y-1.5 border border-gold/5 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted flex items-center gap-1"><Calendar size={11} /> Créée le :</span>
                    <span className="font-semibold">{formatDate(cmd.createdAt.slice(0, 10), language)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-deep font-semibold">
                    <span className="flex items-center gap-1"><Clock size={11} /> Livraison :</span>
                    <span>{formatDate(cmd.receiveDate, language)} à {cmd.receiveHour}h{cmd.receiveMinute}</span>
                  </div>
                </div>

                {/* Items preview list */}
                <div className="mb-4 flex-1">
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Produits</h4>
                  <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                    {cmd.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs py-1 border-b border-gold/5 last:border-b-0">
                        <span className="text-text-primary truncate max-w-[140px]">{item.productName}</span>
                        <span className="text-text-muted font-mono">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing info */}
                <div className="border-t border-gold/10 pt-3 mt-auto space-y-1 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Total Commande</span>
                    <span className="font-semibold font-mono text-text-primary">{formatCurrency(cmd.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Acompte Versé</span>
                    <span className="font-semibold font-mono text-pistachio">{formatCurrency(cmd.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-text-primary pt-1 border-t border-dashed border-gold/10">
                    <span>Dette / Reste</span>
                    <span className={`font-mono ${cmd.restAmount > 0 ? 'text-rose-deep' : 'text-pistachio'}`}>
                      {formatCurrency(cmd.restAmount)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 mt-4 pt-2 border-t border-gold/10">
                  <Button size="sm" variant="secondary" title="Imprimer" onClick={() => printCommandInvoice(cmd)}>
                    <Printer size={14} />
                  </Button>
                  {!isFinalised && can('clients', 'edit') && (
                    <Button size="sm" variant="ghost" title="Modifier" onClick={() => handleOpenEditForm(cmd)}>
                      <Pencil size={14} />
                    </Button>
                  )}
                  {cmd.restAmount > 0 && (
                    <Button
                      size="sm"
                      variant="gold"
                      title="Enregistrer règlement"
                      onClick={() => {
                        setPayCmd(cmd);
                        setPayAmount(cmd.restAmount);
                        setPayDescription(`Règlement dette pour commande ${cmd.reference}`);
                      }}
                    >
                      <Coins size={14} /> Payer
                    </Button>
                  )}
                  {!isFinalised && (
                    <Button size="sm" variant="mint" className="flex-1" onClick={() => setFinaliseCmd(cmd)}>
                      Finaliser
                    </Button>
                  )}
                  {can('clients', 'delete') && (
                    <Button size="sm" variant="ghost" title="Supprimer" onClick={() => setDeleteId(cmd.id)}>
                      <Trash2 size={14} className="text-rose-deep" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===== Create / Edit Command Modal ===== */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Modifier la commande' : 'Créer une commande'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Client Selection Row */}
          <div className="border border-gold/10 rounded-2xl p-4 bg-vanilla/10 relative">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <User size={16} /> 1. Sélectionner ou créer le client
            </h3>
            
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-gold/15">
                <div>
                  <p className="font-semibold text-sm text-text-primary">{selectedClient.name}</p>
                  {selectedClient.phone && <p className="text-xs text-text-muted">📞 {selectedClient.phone}</p>}
                </div>
                {!editingId && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                    <X size={14} /> Changer
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input
                      type="text"
                      placeholder="Rechercher par nom ou numéro..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-gold/15 bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                  </div>
                  <Button variant="secondary" onClick={() => setShowNewClientForm(!showNewClientForm)}>
                    <UserPlus size={16} />
                  </Button>
                </div>

                {/* Inline Client Creation */}
                <AnimatePresence>
                  {showNewClientForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 border border-gold/10 rounded-xl bg-white space-y-2 overflow-hidden"
                    >
                      <p className="text-xs font-semibold text-text-primary">Nouveau Client</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input placeholder="Nom du client *" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                        <Input placeholder="Téléphone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="secondary" onClick={() => setShowNewClientForm(false)}>Annuler</Button>
                        <Button size="sm" variant="gold" onClick={handleCreateClientInline}>Créer</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Search Results List */}
                {clientSearch && clientSearchResults.length > 0 && (
                  <div className="border border-gold/10 rounded-xl bg-white max-h-[160px] overflow-y-auto shadow-md">
                    {clientSearchResults.map((cli) => (
                      <button
                        key={cli.id}
                        onClick={() => { setSelectedClient(cli); setClientSearch(''); }}
                        className="w-full text-left p-3 hover:bg-gold/5 border-b border-gold/5 last:border-b-0 text-sm text-text-primary transition-colors flex items-center justify-between"
                      >
                        <span>{cli.name}</span>
                        {cli.phone && <span className="text-xs text-text-muted">📞 {cli.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch && clientSearchResults.length === 0 && (
                  <p className="text-xs text-center text-text-muted py-2">Aucun client trouvé</p>
                )}
              </div>
            )}
          </div>

          {/* Dates & Hours Row */}
          <div className="border border-gold/10 rounded-2xl p-4 bg-vanilla/10">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Calendar size={16} /> 2. Date et heure de livraison
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Date de livraison *" type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} />
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Heure (00-23)</label>
                <select
                  value={receiveHour}
                  onChange={(e) => setReceiveHour(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gold/15 bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {Array.from({ length: 24 }).map((_, h) => {
                    const val = String(h).padStart(2, '0');
                    return <option key={val} value={val}>{val}h</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Minute (00-59)</label>
                <select
                  value={receiveMinute}
                  onChange={(e) => setReceiveMinute(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gold/15 bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {['00', '15', '30', '45'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Products Select & List */}
          <div className="border border-gold/10 rounded-2xl p-4 bg-vanilla/10">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Receipt size={16} /> 3. Produits commandés (Fiche Recette)
            </h3>

            <div className="space-y-3">
              {/* Recipe search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un produit/recette..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gold/15 bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              {/* Recipe matches */}
              {recipeSearch && recipeSearchResults.length > 0 && (
                <div className="border border-gold/10 rounded-xl bg-white max-h-[160px] overflow-y-auto shadow-md">
                  {recipeSearchResults.map((ft) => (
                    <button
                      key={ft.id}
                      onClick={() => handleAddRecipeLine(ft)}
                      className="w-full text-left p-3 hover:bg-gold/5 border-b border-gold/5 last:border-b-0 text-sm text-text-primary transition-colors flex items-center justify-between"
                    >
                      <span>{ft.name}</span>
                      <span className="text-xs font-semibold text-gold-dark">{formatCurrency(ft.unitPrice)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Items Table */}
              {selectedItems.length > 0 ? (
                <div className="overflow-x-auto bg-white border border-gold/10 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-vanilla/60 text-text-secondary">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Désignation</th>
                        <th className="text-right px-3 py-2 font-medium">Quantité</th>
                        <th className="text-right px-3 py-2 font-medium">P.U de Vente</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                        <th className="text-center px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gold/5">
                          <td className="px-3 py-2 font-medium text-text-primary">{item.productName}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-right border border-gold/15 rounded-lg focus:outline-none text-xs"
                            />
                            {item.sellByUnit && item.sellUnit ? ` ${item.sellUnit}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItemPrice(idx, Number(e.target.value))}
                              className="w-20 px-1.5 py-1 text-right border border-gold/15 rounded-lg focus:outline-none text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular text-text-primary">
                            {formatCurrency(item.totalPrice)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleRemoveItem(idx)} className="p-1 rounded-lg text-rose-deep hover:bg-rose-deep/15">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-center text-text-muted py-6">Aucun produit sélectionné</p>
              )}
            </div>
          </div>

          {/* Pricing calculations */}
          <div className="border border-gold/10 rounded-2xl p-4 bg-vanilla/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Total calculé (DA)</label>
              <div className="w-full h-11 px-4 flex items-center rounded-xl border border-gold/15 bg-white text-text-primary text-sm font-semibold font-mono">
                {formatCurrency(computedTotalSum)}
              </div>
            </div>
            <Input
              label="Ajuster le total final (DA)"
              type="number"
              value={customTotal !== null ? customTotal : ''}
              placeholder={String(computedTotalSum)}
              onChange={(e) => setCustomTotal(e.target.value ? Number(e.target.value) : null)}
            />
            <Input
              label="Acompte / Versement (DA)"
              type="number"
              value={versement}
              onChange={(e) => setVersement(Number(e.target.value))}
            />
          </div>

          {/* Balance Preview */}
          <div className="flex justify-between items-center p-3.5 rounded-xl bg-gold/10 text-gold-dark font-bold text-sm">
            <span>Reste à payer (Dette enregistrée) :</span>
            <span className="font-mono text-base">{formatCurrency(Math.max(0, finalTotalAmount - versement))}</span>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button variant="gold" onClick={handleSaveCommand}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* ===== Finalise Confirmation Modal ===== */}
      <Modal
        open={!!finaliseCmd}
        onClose={() => setFinaliseCmd(null)}
        title="Finaliser la commande"
        size="md"
      >
        {finaliseCmd && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gold/10 text-gold-dark rounded-xl text-sm font-semibold">
              <AlertTriangle size={18} />
              <span>Veuillez vérifier les stocks disponibles au comptoir avant de valider.</span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">État des stocks</h4>
              <div className="border border-gold/10 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-vanilla/60 text-text-secondary">
                    <tr>
                      <th className="text-left px-3 py-2">Produit</th>
                      <th className="text-right px-3 py-2">Commandé</th>
                      <th className="text-right px-3 py-2">Stock Comptoir</th>
                      <th className="text-center px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finaliseCmd.items.map((item, idx) => {
                      const avail = getComptoirStock(item.productName);
                      const isOk = avail >= item.quantity;
                      return (
                        <tr key={idx} className="border-t border-gold/5">
                          <td className="px-3 py-2 font-medium text-text-primary">{item.productName}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-mono">{avail}</td>
                          <td className="px-3 py-2 text-center">
                            {isOk ? (
                              <span className="text-pistachio font-bold">Disponible</span>
                            ) : (
                              <span className="text-rose-deep font-bold flex items-center justify-center gap-1">
                                <AlertTriangle size={12} /> Stock Insuffisant
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-vanilla/30 p-3 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">Total Final:</span>
                <span className="font-semibold font-mono text-text-primary">{formatCurrency(finaliseCmd.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Déjà payé:</span>
                <span className="font-semibold font-mono text-pistachio">{formatCurrency(finaliseCmd.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-gold/10 pt-1.5">
                <span className="text-text-primary">Dette à enregistrer:</span>
                <span className="font-mono text-rose-deep">{formatCurrency(finaliseCmd.restAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setFinaliseCmd(null)}>Annuler</Button>
              <Button variant="mint" onClick={handleConfirmFinalise}>Valider & Soustraire du Stock</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Pay Debt Modal ===== */}
      <Modal
        open={!!payCmd}
        onClose={() => setPayCmd(null)}
        title="Enregistrer un versement (Règlement)"
        size="sm"
      >
        {payCmd && (
          <div className="space-y-4">
            <div className="bg-vanilla/30 p-3 rounded-xl text-xs space-y-1">
              <p><strong>N° Commande :</strong> {payCmd.reference}</p>
              <p><strong>Client :</strong> {payCmd.clientName}</p>
              <p><strong>Reste à payer :</strong> <strong className="text-rose-deep">{formatCurrency(payCmd.restAmount)}</strong></p>
            </div>

            <Input
              label="Montant du versement (DA) *"
              type="number"
              value={payAmount || ''}
              max={payCmd.restAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
            />

            <Input
              label="Description / Note"
              type="text"
              value={payDescription}
              onChange={(e) => setPayDescription(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setPayCmd(null)}>Annuler</Button>
              <Button variant="gold" onClick={handlePayDebt}>Valider le paiement</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteCommand(deleteId); toast.success('Commande supprimée'); } }}
      />

      {/* ===== Print Prompt Modal (POS-style design) ===== */}
      <Modal open={!!printPromptCmd} onClose={() => setPrintPromptCmd(null)} size="sm">
        <div className="flex flex-col items-center text-center py-2">
          <div className="h-14 w-14 rounded-full bg-pistachio/15 flex items-center justify-center mb-4">
            <CheckCircle2 size={30} className="text-pistachio" />
          </div>
          <h3 className="font-display text-lg font-semibold text-text-primary mb-1">
            {printPromptType === 'finalise' ? 'Commande Finalisée ✅' : 'Commande Enregistrée ✅'}
          </h3>
          <p className="text-sm text-text-secondary mb-1">{printPromptCmd?.reference}</p>
          <p className="text-sm text-text-muted mb-6">
            {printPromptType === 'finalise'
              ? 'Voulez-vous imprimer la facture de finalisation ?'
              : 'Voulez-vous imprimer le bon de commande ?'}
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => setPrintPromptCmd(null)}>Non, merci</Button>
            <Button variant="gold" className="flex-1" onClick={() => { if (printPromptCmd) { printCommandInvoice(printPromptCmd); setPrintPromptCmd(null); } }}>
              <Printer size={16} /> Imprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
