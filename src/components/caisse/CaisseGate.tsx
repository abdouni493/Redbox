import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Wallet, Coins, LogOut, Lock, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { useCashSessionStore, useActiveSession } from '@/store/cashSessionStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';

/** Workers on the "cashier" post must open the caisse before working. */
export function requiresCaisse(post?: string) {
  return post === 'cashier';
}

/**
 * Blocking alert displayed in the middle of every interface while a cashier
 * has no open caisse. The worker declares the starting float and can then
 * work normally. It re-appears as soon as the caisse is closed.
 */
export function CaisseGate() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const active = useActiveSession();
  const sessions = useCashSessionStore((s) => s.sessions);
  const openSession = useCashSessionStore((s) => s.openSession);
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');

  if (!user || user.role === 'admin' || !requiresCaisse(user.post) || active) return null;

  const username = user.username || user.name;
  const last = sessions.find((s) => s.username === username && s.status === 'closed');

  const submit = () => {
    if (amount === '' || Number(amount) < 0) { toast.error('Saisissez le montant présent dans la caisse'); return; }
    openSession({ openingAmount: Number(amount), openingNote: note.trim() || undefined });
    toast.success('Caisse ouverte — bon service !');
    setAmount(''); setNote('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A120B]/55 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-cream rounded-3xl shadow-hover border border-gold/25 overflow-hidden"
      >
        <div className="bg-gradient-button text-white px-6 py-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center"><Lock size={24} /></div>
          <div>
            <h2 className="font-display text-xl font-bold">Ouverture de la caisse</h2>
            <p className="text-sm text-white/85">Bonjour {user.name}, ouvrez votre caisse pour commencer.</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            Comptez l’argent présent dans le tiroir et saisissez le <b>fond de caisse</b>. Toutes vos ventes et commandes seront rattachées à cette caisse jusqu’à sa fermeture.
          </p>
          {last && (
            <div className="rounded-xl bg-vanilla/60 border border-gold/15 p-3 text-xs text-text-secondary space-y-0.5">
              <p className="flex items-center gap-1 font-semibold text-text-primary"><Clock size={12} /> Dernière fermeture : {last.closedAt ? formatDateTime(last.closedAt) : '—'}</p>
              <p>Montant compté à la fermeture : <b>{formatCurrency(last.closingAmount || 0)}</b></p>
              <button className="text-gold-dark font-semibold underline" onClick={() => setAmount(last.closingAmount || 0)}>Reprendre ce montant</button>
            </div>
          )}
          <Input
            label="Montant en caisse à l’ouverture (DA) *"
            type="number"
            min={0}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            icon={<Coins size={16} />}
          />
          <Input label="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : billets de 1000 × 5, pièces…" />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Déconnexion</Button>
            <Button variant="gold" className="flex-1" onClick={submit}><Wallet size={16} /> Ouvrir la caisse</Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
