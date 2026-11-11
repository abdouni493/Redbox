import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Lock, AlertTriangle, Clock, CreditCard, ClipboardList, Receipt, Coins, PackageCheck, BellRing,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CloseCaisseModal } from '@/components/caisse/CloseCaisseModal';
import { useSessionCalc } from '@/components/caisse/useSessionCalc';
import { useActiveSession } from '@/store/cashSessionStore';
import { useAuthStore } from '@/store/authStore';
import { useCommandStore } from '@/store/commandStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sessionDuration } from '@/lib/cashSession';

/** Dashboard of a cashier profile: own caisse, closing alerts and service KPIs. */
export default function CashierDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const session = useActiveSession();
  const calc = useSessionCalc(session);
  const commands = useCommandStore((s) => s.commands);
  const [closeOpen, setCloseOpen] = useState(false);

  const pending = useMemo(() => commands.filter((c) => c.status === 'pending'), [commands]);
  const ready = pending.filter((c) => c.kitchenStatus === 'ready');

  const openedHours = session ? (Date.now() - new Date(session.openedAt).getTime()) / 3600000 : 0;
  const openedPreviousDay = session ? new Date(session.openedAt).toDateString() !== new Date().toDateString() : false;
  const hour = new Date().getHours();

  return (
    <div>
      <PageHeader title={`Bonjour ${user?.name?.split(' ')[0] || ''}`} subtitle="Tableau de bord caissier" icon={<LayoutDashboard size={24} />}
        actions={session && <Button variant="rose" onClick={() => setCloseOpen(true)}><Lock size={16} /> Fermer la caisse</Button>} />

      {/* Closing alerts — always visible while the caisse is open */}
      {session && (
        <div className="space-y-2 mb-5">
          {openedPreviousDay ? (
            <Alert tone="danger" icon={<AlertTriangle size={18} />} title="Caisse ouverte depuis un jour précédent"
              text={`Ouverte le ${formatDateTime(session.openedAt)}. Fermez-la et ouvrez une nouvelle caisse pour la journée.`}
              action={<Button size="sm" variant="rose" onClick={() => setCloseOpen(true)}>Fermer maintenant</Button>} />
          ) : openedHours >= 8 ? (
            <Alert tone="warning" icon={<Clock size={18} />} title={`Caisse ouverte depuis ${sessionDuration(session)}`}
              text="Service long : pensez à compter et fermer la caisse en fin de service."
              action={<Button size="sm" variant="gold" onClick={() => setCloseOpen(true)}>Fermer la caisse</Button>} />
          ) : null}
          <Alert tone={hour >= 20 ? 'warning' : 'info'} icon={<BellRing size={18} />} title="Rappel de fermeture"
            text={`N’oubliez pas de fermer votre caisse en fin de service (comptage + écart). ${pending.length ? `${pending.length} commande(s) encore en attente.` : ''}`}
            action={<Button size="sm" variant="secondary" onClick={() => setCloseOpen(true)}><Lock size={14} /> Fermer</Button>} />
        </div>
      )}

      {session && calc && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <Card index={0} accent="gold" className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-button text-white flex items-center justify-center shadow-gold"><Wallet size={20} /></div>
              <div>
                <p className="font-display font-semibold">Ma caisse</p>
                <p className="text-xs text-text-muted">Ouverte {formatDateTime(session.openedAt)} · {sessionDuration(session)}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <Line label="Fond de caisse" value={session.openingAmount} />
              <Line label="Encaissements ventes" value={calc.salesCash + calc.saleDebtCash} />
              <Line label="Encaissements commandes" value={calc.commandsCash} />
              {(calc.depositsTotal > 0 || calc.withdrawalsTotal > 0) && <Line label="Dépôts − retraits" value={calc.depositsTotal - calc.withdrawalsTotal} />}
              <div className="flex justify-between font-bold text-base border-t border-dashed border-gold/20 pt-1.5">
                <span>Théorique en caisse</span><span className="tabular text-gold-dark">{formatCurrency(calc.theoretical)}</span>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <Kpi index={1} icon={<Receipt size={18} />} label="Mes ventes" value={String(calc.sales.length)} sub={formatCurrency(calc.salesTotal)} />
            <Kpi index={2} icon={<ClipboardList size={18} />} label="Mes commandes" value={String(calc.commandsCreated.length)} sub={formatCurrency(calc.commandsTotal)} />
            <Kpi index={3} icon={<Clock size={18} />} label="Commandes en attente" value={String(pending.length)} sub={`${ready.length} prête(s)`} onClick={() => navigate('/commands')} />
            <Kpi index={4} icon={<Coins size={18} />} label="Total encaissé" value={formatCurrency(calc.cashIn)} sub={`${calc.payments.length} opération(s)`} />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <QuickAction icon={<CreditCard size={22} />} label="Nouvelle vente" onClick={() => navigate('/pos')} />
        <QuickAction icon={<ClipboardList size={22} />} label="Nouvelle commande" onClick={() => navigate('/pos?mode=command')} />
        <QuickAction icon={<PackageCheck size={22} />} label="Gérer les commandes" onClick={() => navigate('/commands')} />
      </div>

      {calc && calc.payments.length > 0 && (
        <Card index={6}>
          <p className="font-display font-semibold mb-3">Derniers encaissements de la caisse</p>
          <div className="divide-y divide-gold/10">
            {calc.payments.slice().reverse().slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.kind === 'command' ? 'bg-caramel/15 text-caramel' : 'bg-pistachio/15 text-pistachio'}`}>{p.kind === 'command' ? 'Commande' : p.kind === 'saleDebt' ? 'Dette' : 'Vente'}</span>
                  {p.reference}
                  <span className="text-xs text-text-muted">{formatDateTime(p.at).slice(-5)}</span>
                </span>
                <span className="tabular font-semibold text-pistachio">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CloseCaisseModal session={session} open={closeOpen && !!session} onClose={() => setCloseOpen(false)} />
    </div>
  );
}

function Alert({ tone, icon, title, text, action }: { tone: 'danger' | 'warning' | 'info'; icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  const cls = tone === 'danger' ? 'bg-rose-deep/10 border-rose-deep/25 text-rose-deep' : tone === 'warning' ? 'bg-caramel/10 border-caramel/30 text-caramel' : 'bg-gold/10 border-gold/25 text-gold-dark';
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0"><p className="font-semibold text-sm">{title}</p><p className="text-xs opacity-90">{text}</p></div>
      </div>
      {action}
    </motion.div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-text-muted">{label}</span><span className="tabular font-medium">{formatCurrency(value)}</span></div>;
}

function Kpi({ index, icon, label, value, sub, onClick }: { index: number; icon: React.ReactNode; label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <Card index={index} hoverable={!!onClick} onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      <div className="flex items-center gap-2 text-gold-dark mb-1">{icon}<span className="text-xs text-text-muted">{label}</span></div>
      <p className="text-xl font-bold tabular text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted tabular">{sub}</p>}
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      className="flex items-center gap-3 rounded-2xl bg-gradient-card border border-gold/15 shadow-card px-4 py-4 text-left hover:shadow-hover">
      <div className="h-11 w-11 rounded-xl bg-gradient-button text-white flex items-center justify-center shadow-gold">{icon}</div>
      <span className="font-display font-semibold text-text-primary">{label}</span>
    </motion.button>
  );
}
