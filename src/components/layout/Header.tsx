import { useState } from 'react';
import { Menu, Globe, Wallet, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveSession, useCashSessionStore } from '@/store/cashSessionStore';
import { CloseCaisseModal } from '@/components/caisse/CloseCaisseModal';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import { SyncIndicator } from './SyncIndicator';

const POST_LABELS: Record<string, string> = { kitchen: 'Cuisine', cashier: 'Caissier', deliverer: 'Livreur' };

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const { language, setLanguage } = useLanguage();
  const { canView } = usePermissions();
  const active = useActiveSession();
  const openSession = useCashSessionStore((s) => s.openSession);
  const [closeOpen, setCloseOpen] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  // Any user working on the POS can open a caisse (mandatory for cashiers)
  const canUseCaisse = canView('pos');

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-16 bg-cream/85 backdrop-blur-md border-b border-gold/15 flex items-center justify-between px-4 lg:px-6">
      <button onClick={onMenuClick} className="lg:hidden text-text-secondary hover:text-text-primary">
        <Menu size={24} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <SyncIndicator />
        {/* Cash session indicator */}
        {active ? (
          <button
            onClick={() => setCloseOpen(true)}
            title={`Caisse ouverte depuis ${formatDateTime(active.openedAt)}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pistachio/15 border border-pistachio/30 text-sm font-semibold text-pistachio hover:bg-pistachio/25 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-pistachio animate-pulse" />
            <span className="hidden sm:inline">Caisse ouverte</span>
            <Lock size={14} className="sm:ml-1" />
            <span className="hidden md:inline">Fermer</span>
          </button>
        ) : canUseCaisse && user?.post !== 'cashier' ? (
          <button
            onClick={() => setOpenForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vanilla/80 border border-gold/20 text-sm font-medium text-text-secondary hover:bg-gold/10"
          >
            <Wallet size={16} /> <span className="hidden sm:inline">Ouvrir caisse</span>
          </button>
        ) : null}

        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vanilla/80 border border-gold/20 text-sm font-medium text-text-secondary hover:bg-gold/10 hover:border-gold/40 transition-colors"
        >
          <Globe size={16} />
          {language === 'fr' ? '🇫🇷 FR' : '🇩🇿 AR'}
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-text-primary leading-tight">{user?.name}</p>
            <p className="text-[11px] text-text-muted capitalize">{user?.post && POST_LABELS[user.post] ? POST_LABELS[user.post] : user?.role}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-button flex items-center justify-center text-white text-sm font-semibold shadow-gold">
            {initials || 'U'}
          </div>
        </div>
      </div>

      <CloseCaisseModal session={active} open={closeOpen && !!active} onClose={() => setCloseOpen(false)} />
      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Ouvrir une caisse" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Les ventes et commandes que vous créez seront rattachées à cette caisse jusqu’à sa fermeture.</p>
          <Input label="Fond de caisse (DA)" type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenForm(false)}>Annuler</Button>
            <Button variant="gold" onClick={() => {
              if (amount === '' || Number(amount) < 0) { toast.error('Montant invalide'); return; }
              openSession({ openingAmount: Number(amount) });
              toast.success('Caisse ouverte');
              setAmount(''); setOpenForm(false);
            }}>Ouvrir</Button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
