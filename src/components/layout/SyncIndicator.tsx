import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { useSyncStore } from '@/store/syncStore';
import { retryFailedOps } from '@/lib/cloudSync';
import { toast } from '@/components/ui/Toast';

/** Header badge: shows whether every change has reached the Supabase database. */
export function SyncIndicator() {
  const { pending, online, saving, lastError, failed } = useSyncStore();

  let icon = <Cloud size={16} />;
  let label = 'Enregistré';
  let cls = 'bg-pistachio/10 border-pistachio/30 text-pistachio';
  let title = 'Toutes les données sont enregistrées dans Supabase';

  if (!online) {
    icon = <CloudOff size={16} />;
    label = pending ? `Hors ligne · ${pending}` : 'Hors ligne';
    cls = 'bg-rose-deep/10 border-rose-deep/30 text-rose-deep';
    title = "Pas de connexion Internet — les modifications sont gardées et seront envoyées automatiquement au retour de la connexion";
  } else if (pending > 0) {
    icon = saving ? <Loader2 size={16} className="animate-spin" /> : <CloudOff size={16} />;
    label = `Envoi… ${pending}`;
    cls = 'bg-caramel/10 border-caramel/30 text-caramel';
    title = lastError || `${pending} modification(s) en cours d'enregistrement`;
  } else if (failed > 0) {
    icon = <AlertTriangle size={16} />;
    label = `${failed} refusée(s)`;
    cls = 'bg-rose-deep/10 border-rose-deep/30 text-rose-deep';
    title = (lastError || 'Des modifications ont été refusées par la base') + ' — cliquer pour réessayer';
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        if (failed > 0 && pending === 0) {
          const n = retryFailedOps();
          toast.info(`${n} modification(s) renvoyée(s)`);
        }
      }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${cls}`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
