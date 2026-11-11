import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Eye, Wallet, Lock, Unlock, Calendar, Clock, CheckCircle2, AlertTriangle, Receipt, ClipboardList,
  Coins, Printer, Trash2, ArrowDownLeft, ArrowUpRight, Bike, UtensilsCrossed, ShoppingBag,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from '@/components/ui/Toast';
import { CloseCaisseModal } from '@/components/caisse/CloseCaisseModal';
import { useSessionStores } from '@/components/caisse/useSessionCalc';
import { printSessionReport } from '@/components/caisse/sessionPrint';
import { useCashSessionStore } from '@/store/cashSessionStore';
import { useWorkerStore, POST_LABELS } from '@/store/workerStore';
import { useClientStore } from '@/store/clientStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/hooks/useLanguage';
import { computeSessionCalc, sessionDuration, type SessionCalc } from '@/lib/cashSession';
import { orderTypeLabel } from '@/lib/orderPrint';
import { formatCurrency, formatDate, formatDateTime, matchesDateFilter, todayISO, type DateFilter } from '@/lib/utils';
import type { CashSession, OrderType } from '@/types';

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const time = (iso?: string) => (iso ? formatDateTime(iso).slice(-5) : '—');

function DiffBadge({ diff }: { diff?: number }) {
  if (diff === undefined) return <Badge variant="warning"><Unlock size={10} /> Ouverte</Badge>;
  if (Math.abs(diff) < 0.01) return <Badge variant="success"><CheckCircle2 size={10} /> Équilibrée</Badge>;
  return <Badge variant={diff > 0 ? 'warning' : 'danger'}>{diff > 0 ? 'Excédent' : 'Manque'} {formatCurrency(Math.abs(diff))}</Badge>;
}

/** Caisse sessions grouped by worker → day → session detail. */
export function CaisseSessions() {
  const { language } = useLanguage();
  const { can } = usePermissions();
  const sessions = useCashSessionStore((s) => s.sessions);
  const deleteSession = useCashSessionStore((s) => s.deleteSession);
  const workers = useWorkerStore((s) => s.workers);
  const settings = useSettingsStore((s) => s.settings);
  const stores = useSessionStores();

  const [workerKey, setWorkerKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<CashSession | null>(null);
  const [forceClose, setForceClose] = useState<CashSession | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DateFilter>('all');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const calcs = useMemo(() => {
    const m = new Map<string, SessionCalc>();
    sessions.forEach((s) => m.set(s.id, computeSessionCalc(s, stores)));
    return m;
  }, [sessions, stores]);

  const byWorker = useMemo(() => {
    const groups = new Map<string, CashSession[]>();
    sessions.forEach((s) => {
      if (!groups.has(s.username)) groups.set(s.username, []);
      groups.get(s.username)!.push(s);
    });
    return [...groups.entries()].map(([username, list]) => {
      const sorted = list.slice().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      const worker = workers.find((w) => w.id === sorted[0].workerId || w.username === username);
      const closed = sorted.filter((s) => s.status === 'closed');
      return {
        username,
        name: sorted[0].workerName,
        post: worker?.post,
        sessions: sorted,
        open: sorted.find((s) => s.status === 'open'),
        days: new Set(sorted.map((s) => dayKey(s.openedAt))).size,
        cashIn: sorted.reduce((s, x) => s + (calcs.get(x.id)?.cashIn || 0), 0),
        totalDiff: closed.reduce((s, x) => s + (calcs.get(x.id)?.difference || 0), 0),
        last: sorted[0],
      };
    }).sort((a, b) => b.last.openedAt.localeCompare(a.last.openedAt));
  }, [sessions, workers, calcs]);

  const current = workerKey ? byWorker.find((w) => w.username === workerKey) : undefined;

  if (sessions.length === 0) {
    return <EmptyState message="Aucune caisse ouverte pour le moment. Les caissiers ouvrent leur caisse à la connexion." icon={<Wallet size={30} />} />;
  }

  // ---------- Worker detail: days ----------
  if (current) {
    const visible = current.sessions.filter((s) => matchesDateFilter(s.openedAt, filter, from, to));
    const days = new Map<string, CashSession[]>();
    visible.forEach((s) => {
      const k = dayKey(s.openedAt);
      if (!days.has(k)) days.set(k, []);
      days.get(k)!.push(s);
    });
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setWorkerKey(null)}><ArrowLeft size={14} /> Tous les caissiers</Button>
            <div>
              <p className="font-display font-semibold text-lg">{current.name}</p>
              <p className="text-xs text-text-muted">{current.sessions.length} caisse(s) · {current.days} jour(s){current.post ? ` · ${POST_LABELS[current.post]}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value as DateFilter)} className="h-9 rounded-xl border border-gold/25 bg-white/70 px-3 text-sm">
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
              <option value="custom">Période</option>
            </select>
            {filter === 'custom' && (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-gold/25 bg-white/70 px-2 text-sm" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-gold/25 bg-white/70 px-2 text-sm" />
              </>
            )}
          </div>
        </div>

        {days.size === 0 ? <EmptyState message="Aucune caisse sur cette période" /> : (
          <div className="space-y-4">
            {[...days.entries()].map(([day, list], di) => {
              const dayCalcs = list.map((s) => calcs.get(s.id)!);
              const dayIn = dayCalcs.reduce((s, c) => s + c.cashIn, 0);
              const dayDiff = list.reduce((s, x) => s + (calcs.get(x.id)?.difference || 0), 0);
              return (
                <Card key={day} index={di}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="font-display font-semibold flex items-center gap-2"><Calendar size={16} className="text-gold-dark" /> {formatDate(day, language)}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-muted">Encaissé : <b className="text-pistachio tabular">{formatCurrency(dayIn)}</b></span>
                      <span className="text-text-muted">Écart : <b className={`tabular ${dayDiff < 0 ? 'text-rose-deep' : dayDiff > 0 ? 'text-caramel' : 'text-pistachio'}`}>{formatCurrency(dayDiff)}</b></span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-text-muted">
                        <tr className="border-b border-gold/10">
                          <th className="text-left py-2 pr-2">Ouverture</th>
                          <th className="text-right py-2 px-2">Fond</th>
                          <th className="text-left py-2 px-2">Fermeture</th>
                          <th className="text-right py-2 px-2">Théorique</th>
                          <th className="text-right py-2 px-2">Compté</th>
                          <th className="text-center py-2 px-2">Écart</th>
                          <th className="text-right py-2 pl-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((s) => {
                          const c = calcs.get(s.id)!;
                          return (
                            <tr key={s.id} className="border-b border-gold/5 last:border-0">
                              <td className="py-2 pr-2 tabular">{time(s.openedAt)}</td>
                              <td className="py-2 px-2 text-right tabular">{formatCurrency(s.openingAmount)}</td>
                              <td className="py-2 px-2 tabular">{s.closedAt ? `${dayKey(s.closedAt) !== day ? formatDate(s.closedAt, language) + ' ' : ''}${time(s.closedAt)}` : <span className="text-caramel font-semibold">En cours</span>}</td>
                              <td className="py-2 px-2 text-right tabular font-semibold text-gold-dark">{formatCurrency(c.theoretical)}</td>
                              <td className="py-2 px-2 text-right tabular">{s.closingAmount !== undefined ? formatCurrency(s.closingAmount) : '—'}</td>
                              <td className="py-2 px-2 text-center"><DiffBadge diff={c.difference} /></td>
                              <td className="py-2 pl-2">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="secondary" onClick={() => setDetail(s)}><Eye size={13} /> Voir</Button>
                                  {s.status === 'open' && can('caisse', 'edit') && <Button size="sm" variant="ghost" title="Forcer la fermeture" onClick={() => setForceClose(s)}><Lock size={13} /></Button>}
                                  {can('caisse', 'delete') && <Button size="sm" variant="ghost" title="Supprimer" onClick={() => setDeleteId(s.id)}><Trash2 size={13} className="text-rose-deep" /></Button>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {renderModals()}
      </div>
    );
  }

  // ---------- Workers overview ----------
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {byWorker.map((w, i) => (
          <motion.div key={w.username} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-gradient-card border border-gold/15 shadow-card p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-gradient-button text-white font-semibold flex items-center justify-center shadow-gold">
                {w.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold truncate">{w.name}</p>
                <p className="text-xs text-text-muted">@{w.username}{w.post ? ` · ${POST_LABELS[w.post]}` : ''}</p>
              </div>
              {w.open ? <Badge variant="success"><Unlock size={10} /> Ouverte</Badge> : <Badge variant="neutral"><Lock size={10} /> Fermée</Badge>}
            </div>
            <div className="bg-vanilla/40 rounded-xl p-3 text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span className="text-text-muted">Caisses / jours</span><span className="font-semibold">{w.sessions.length} / {w.days}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Total encaissé</span><span className="tabular font-semibold text-pistachio">{formatCurrency(w.cashIn)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Écart cumulé</span><span className={`tabular font-semibold ${w.totalDiff < 0 ? 'text-rose-deep' : w.totalDiff > 0 ? 'text-caramel' : 'text-pistachio'}`}>{formatCurrency(w.totalDiff)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Dernière ouverture</span><span className="text-xs">{formatDateTime(w.last.openedAt, language)}</span></div>
            </div>
            {w.open && (
              <div className="rounded-xl bg-pistachio/10 text-pistachio text-xs px-3 py-2 mb-3 flex items-center gap-1.5">
                <Clock size={12} /> Ouverte depuis {sessionDuration(w.open)} · théorique {formatCurrency(calcs.get(w.open.id)?.theoretical || 0)}
              </div>
            )}
            <Button variant="gold" size="sm" className="mt-auto" onClick={() => setWorkerKey(w.username)}><Eye size={14} /> Voir les journées</Button>
          </motion.div>
        ))}
      </div>
      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <>
        <SessionDetailModal session={detail} calc={detail ? calcs.get(detail.id) : undefined} onClose={() => setDetail(null)}
          onPrint={(s, c) => printSessionReport(s, c, settings)} />
        <CloseCaisseModal session={forceClose} open={!!forceClose} onClose={() => setForceClose(null)} forced />
        <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) { deleteSession(deleteId); toast.success('Caisse supprimée'); } }} />
      </>
    );
  }
}

function TypeIcon({ type }: { type?: OrderType }) {
  if (type === 'delivery') return <Bike size={12} />;
  if (type === 'table') return <UtensilsCrossed size={12} />;
  return <ShoppingBag size={12} />;
}

function SessionDetailModal({ session, calc, onClose, onPrint }: {
  session: CashSession | null; calc?: SessionCalc; onClose: () => void; onPrint: (s: CashSession, c: SessionCalc) => void;
}) {
  const { language } = useLanguage();
  const clients = useClientStore((s) => s.clients);
  const [tab, setTab] = useState<'sales' | 'commands' | 'payments' | 'moves'>('sales');
  if (!session || !calc) return null;
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name || '—';

  return (
    <Modal open={!!session} onClose={onClose} title={`Caisse de ${session.workerName}`} size="xl">
      <div className="space-y-4">
        {/* Opening / closing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-pistachio/25 bg-pistachio/5 p-3">
            <p className="text-xs font-bold text-pistachio flex items-center gap-1 mb-1"><Unlock size={12} /> OUVERTURE</p>
            <p className="text-sm">{formatDateTime(session.openedAt, language)}</p>
            <p className="text-lg font-bold tabular">{formatCurrency(session.openingAmount)}</p>
            {session.openingNote && <p className="text-xs text-text-muted">{session.openingNote}</p>}
          </div>
          <div className={`rounded-xl border p-3 ${session.status === 'open' ? 'border-caramel/30 bg-caramel/5' : 'border-rose-deep/20 bg-rose-deep/5'}`}>
            <p className={`text-xs font-bold flex items-center gap-1 mb-1 ${session.status === 'open' ? 'text-caramel' : 'text-rose-deep'}`}><Lock size={12} /> FERMETURE</p>
            {session.status === 'open' ? <p className="text-sm text-caramel font-semibold">Caisse toujours ouverte ({sessionDuration(session)})</p> : (
              <>
                <p className="text-sm">{formatDateTime(session.closedAt!, language)} · durée {sessionDuration(session)}{session.closedBy && session.closedBy !== session.username ? ` · par ${session.closedBy}` : ''}</p>
                <p className="text-lg font-bold tabular">{formatCurrency(session.closingAmount || 0)} <span className="text-xs font-normal text-text-muted">compté</span></p>
                {session.closingNote && <p className="text-xs text-text-muted">{session.closingNote}</p>}
              </>
            )}
          </div>
        </div>

        {/* Theoretical breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 rounded-xl border border-gold/15 bg-white p-3 text-sm space-y-1.5">
            <p className="font-semibold mb-1">Détail du théorique</p>
            <Row label="Fond de caisse" value={session.openingAmount} />
            <Row label={`+ Ventes directes encaissées (${calc.sales.length})`} value={calc.salesCash} />
            {calc.saleDebtCash > 0 && <Row label="+ Règlements de dettes clients" value={calc.saleDebtCash} />}
            <Row label={`+ Encaissements commandes (${calc.payments.filter((p) => p.kind === 'command').length})`} value={calc.commandsCash} />
            {calc.depositsTotal > 0 && <Row label="+ Dépôts en caisse" value={calc.depositsTotal} />}
            {calc.withdrawalsTotal > 0 && <Row label="− Retraits de caisse" value={-calc.withdrawalsTotal} />}
            <div className="flex justify-between font-bold text-base border-t border-dashed border-gold/20 pt-1.5"><span>Théorique</span><span className="tabular text-gold-dark">{formatCurrency(calc.theoretical)}</span></div>
          </div>
          <div className="rounded-xl border border-gold/15 bg-white p-3 text-sm space-y-2">
            <p className="font-semibold">Résultat</p>
            <Row label="Théorique" value={calc.theoretical} />
            <Row label="Compté" value={session.closingAmount ?? NaN} />
            <DiffBadge diff={calc.difference} />
            <div className="pt-2 border-t border-gold/10 text-xs text-text-muted space-y-0.5">
              <p>Valeur des ventes : <b className="text-text-primary">{formatCurrency(calc.salesTotal)}</b></p>
              <p>Valeur des commandes créées : <b className="text-text-primary">{formatCurrency(calc.commandsTotal)}</b></p>
              <p>Commandes finalisées : <b className="text-text-primary">{calc.commandsFinalised.length}</b></p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-vanilla/60 border border-gold/15 w-fit">
          {([
            ['sales', `Ventes (${calc.sales.length})`, Receipt],
            ['commands', `Commandes (${calc.commandsCreated.length})`, ClipboardList],
            ['payments', `Encaissements (${calc.payments.length})`, Coins],
            ['moves', `Mouvements (${calc.deposits.length + calc.withdrawals.length})`, Wallet],
          ] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-gradient-button text-white' : 'text-text-secondary'}`}><Icon size={13} /> {l}</button>
          ))}
        </div>

        <div className="rounded-xl border border-gold/15 bg-white overflow-x-auto">
          {tab === 'sales' && (
            <Table empty={calc.sales.length === 0} head={['Réf', 'Heure', 'Client', 'Service', 'Total', 'Payé', 'Reste']}>
              {calc.sales.map((s) => (
                <tr key={s.id} className="border-t border-gold/10">
                  <td className="px-3 py-2 font-semibold">{s.reference}</td>
                  <td className="px-3 py-2 tabular">{time(s.date)}</td>
                  <td className="px-3 py-2">{clientName(s.clientId)}</td>
                  <td className="px-3 py-2 text-xs"><span className="flex items-center gap-1"><TypeIcon type={s.orderType} /> {orderTypeLabel({ ...s, orderType: s.orderType || 'takeaway' })}</span></td>
                  <td className="px-3 py-2 text-right tabular">{formatCurrency(s.finalAmount)}</td>
                  <td className="px-3 py-2 text-right tabular text-pistachio">{formatCurrency(s.paidAmount)}</td>
                  <td className={`px-3 py-2 text-right tabular ${s.restAmount > 0 ? 'text-rose-deep' : ''}`}>{formatCurrency(s.restAmount)}</td>
                </tr>
              ))}
            </Table>
          )}
          {tab === 'commands' && (
            <Table empty={calc.commandsCreated.length === 0} head={['Réf', 'Heure', 'Client', 'Service', 'Statut', 'Total', 'Payé', 'Reste']}>
              {calc.commandsCreated.map((c) => (
                <tr key={c.id} className="border-t border-gold/10">
                  <td className="px-3 py-2 font-semibold">{c.reference}</td>
                  <td className="px-3 py-2 tabular">{time(c.createdAt)}</td>
                  <td className="px-3 py-2">{c.clientName}</td>
                  <td className="px-3 py-2 text-xs"><span className="flex items-center gap-1"><TypeIcon type={c.orderType} /> {orderTypeLabel({ ...c, orderType: c.orderType || 'takeaway' })}</span></td>
                  <td className="px-3 py-2"><Badge variant={c.status === 'finalised' ? 'success' : 'warning'}>{c.status === 'finalised' ? 'Finalisée' : 'En attente'}</Badge></td>
                  <td className="px-3 py-2 text-right tabular">{formatCurrency(c.totalAmount)}</td>
                  <td className="px-3 py-2 text-right tabular text-pistachio">{formatCurrency(c.paidAmount)}</td>
                  <td className={`px-3 py-2 text-right tabular ${c.restAmount > 0 ? 'text-rose-deep' : ''}`}>{formatCurrency(c.restAmount)}</td>
                </tr>
              ))}
            </Table>
          )}
          {tab === 'payments' && (
            <Table empty={calc.payments.length === 0} head={['Heure', 'Type', 'Référence', 'Description', 'Montant']}>
              {calc.payments.map((p) => (
                <tr key={p.id} className="border-t border-gold/10">
                  <td className="px-3 py-2 tabular">{time(p.at)}</td>
                  <td className="px-3 py-2"><Badge variant={p.kind === 'command' ? 'warning' : p.kind === 'saleDebt' ? 'info' : 'success'}>{p.kind === 'command' ? 'Commande' : p.kind === 'saleDebt' ? 'Dette' : 'Vente'}</Badge></td>
                  <td className="px-3 py-2 font-semibold">{p.reference}</td>
                  <td className="px-3 py-2 text-xs text-text-muted">{p.description || '—'}</td>
                  <td className="px-3 py-2 text-right tabular text-pistachio font-semibold">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </Table>
          )}
          {tab === 'moves' && (
            <Table empty={calc.deposits.length + calc.withdrawals.length === 0} head={['Heure', 'Type', 'Description', 'Montant']}>
              {[...calc.deposits, ...calc.withdrawals].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((t) => (
                <tr key={t.id} className="border-t border-gold/10">
                  <td className="px-3 py-2 tabular">{time(t.createdAt)}</td>
                  <td className="px-3 py-2">{t.type === 'deposit' ? <span className="flex items-center gap-1 text-pistachio"><ArrowDownLeft size={12} /> Dépôt</span> : <span className="flex items-center gap-1 text-rose-deep"><ArrowUpRight size={12} /> Retrait</span>}</td>
                  <td className="px-3 py-2">{t.description}</td>
                  <td className="px-3 py-2 text-right tabular font-semibold">{formatCurrency(t.amount)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onPrint(session, calc)}><Printer size={16} /> Imprimer l’état</Button>
          <Button variant="gold" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-text-muted">{label}</span><span className="tabular font-medium">{Number.isNaN(value) ? '—' : formatCurrency(value)}</span></div>;
}

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: boolean }) {
  if (empty) return <p className="text-center text-sm text-text-muted py-6">Aucune donnée</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-vanilla/60 text-xs text-text-secondary">
        <tr>{head.map((h, i) => <th key={h} className={`px-3 py-2 ${i >= head.length - 3 && /Total|Payé|Reste|Montant/.test(h) ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

