import { useState } from 'react';
import { Lock, Coins, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { useCashSessionStore } from '@/store/cashSessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sessionDuration } from '@/lib/cashSession';
import { printSessionReport } from './sessionPrint';
import { useSessionCalc } from './useSessionCalc';
import type { CashSession } from '@/types';

interface Props {
  session: CashSession | null | undefined;
  open: boolean;
  onClose: () => void;
  /** Admin closing someone else's caisse */
  forced?: boolean;
}

/** Close a caisse: counted cash vs theoretical amount, with the gap. */
export function CloseCaisseModal({ session, open, onClose, forced }: Props) {
  const calc = useSessionCalc(session);
  const closeSession = useCashSessionStore((s) => s.closeSession);
  const settings = useSettingsStore((s) => s.settings);
  const [counted, setCounted] = useState<number | ''>('');
  const [note, setNote] = useState('');

  if (!session || !calc) return null;
  const diff = counted === '' ? null : Number(counted) - calc.theoretical;

  const submit = () => {
    if (counted === '' || Number(counted) < 0) { toast.error('Saisissez le montant compté dans la caisse'); return; }
    closeSession(session.id, {
      closingAmount: Number(counted),
      closingNote: [forced ? 'Fermée par l’administrateur' : '', note.trim()].filter(Boolean).join(' — ') || undefined,
      expectedAmount: calc.theoretical,
    });
    toast.success('Caisse fermée');
    const closed = useCashSessionStore.getState().sessions.find((s) => s.id === session.id);
    if (closed) printSessionReport(closed, calc, settings);
    setCounted(''); setNote('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Fermeture de caisse — ${session.workerName}`} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Tile label="Ouverte le" value={formatDateTime(session.openedAt)} />
          <Tile label="Durée" value={sessionDuration(session)} />
          <Tile label="Ventes" value={String(calc.sales.length)} />
          <Tile label="Commandes" value={String(calc.commandsCreated.length)} />
        </div>

        <div className="rounded-xl border border-gold/15 bg-white p-3 text-sm space-y-1.5">
          <Row label="Fond de caisse (ouverture)" value={session.openingAmount} />
          <Row label="+ Encaissements ventes" value={calc.salesCash} />
          {calc.saleDebtCash > 0 && <Row label="+ Règlements de dettes" value={calc.saleDebtCash} />}
          <Row label="+ Encaissements commandes" value={calc.commandsCash} />
          {calc.depositsTotal > 0 && <Row label="+ Dépôts" value={calc.depositsTotal} />}
          {calc.withdrawalsTotal > 0 && <Row label="− Retraits" value={-calc.withdrawalsTotal} />}
          <div className="flex justify-between font-bold text-base border-t border-dashed border-gold/20 pt-1.5">
            <span>Théorique (doit être en caisse)</span><span className="tabular text-gold-dark">{formatCurrency(calc.theoretical)}</span>
          </div>
        </div>

        <Input label="Argent compté dans la caisse (DA) *" type="number" min={0} autoFocus value={counted}
          onChange={(e) => setCounted(e.target.value === '' ? '' : Number(e.target.value))} icon={<Coins size={16} />} />

        {diff !== null && (
          Math.abs(diff) < 0.01 ? (
            <div className="rounded-xl bg-pistachio/15 text-pistachio px-3 py-2 text-sm font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> Caisse équilibrée</div>
          ) : (
            <div className={`rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 ${diff > 0 ? 'bg-caramel/15 text-caramel' : 'bg-rose-deep/10 text-rose-deep'}`}>
              <AlertTriangle size={16} /> {diff > 0 ? 'Excédent' : 'Manque'} : {formatCurrency(Math.abs(diff))}
            </div>
          )
        )}
        <Input label="Note de fermeture (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : écart expliqué par…" />

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="secondary" onClick={() => printSessionReport(session, calc, settings)}><Printer size={16} /> Imprimer l’état</Button>
          <Button variant="rose" onClick={submit}><Lock size={16} /> Fermer la caisse</Button>
        </div>
      </div>
    </Modal>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-vanilla/50 px-2.5 py-1.5"><p className="text-text-muted">{label}</p><p className="font-semibold text-text-primary text-sm truncate">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-text-muted">{label}</span><span className="tabular font-medium">{formatCurrency(value)}</span></div>;
}
