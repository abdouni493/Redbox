import { useMemo } from 'react';
import { UtensilsCrossed, ShoppingBag, Bike, MapPin, Phone, Hash } from 'lucide-react';
import { useWorkerStore } from '@/store/workerStore';
import type { OrderServiceInfo, OrderType } from '@/types';

interface Props {
  value: OrderServiceInfo;
  onChange: (v: OrderServiceInfo) => void;
  compact?: boolean;
}

const OPTIONS: { key: OrderType; label: string; icon: typeof Bike }[] = [
  { key: 'table', label: 'Sur place', icon: UtensilsCrossed },
  { key: 'takeaway', label: 'À emporter', icon: ShoppingBag },
  { key: 'delivery', label: 'Livraison', icon: Bike },
];

/** Selector for how the order is served: on a table, takeaway or delivery. */
export function OrderServicePicker({ value, onChange }: Props) {
  const workers = useWorkerStore((s) => s.workers);
  const deliverers = useMemo(() => {
    const dedicated = workers.filter((w) => w.post === 'deliverer');
    return dedicated.length ? dedicated : workers;
  }, [workers]);
  const hasDedicated = workers.some((w) => w.post === 'deliverer');

  const set = (patch: Partial<OrderServiceInfo>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-vanilla/60 border border-gold/15">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = value.orderType === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => set({ orderType: o.key })}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                active ? 'bg-gradient-button text-white shadow-gold' : 'text-text-secondary hover:bg-gold/10'
              }`}
            >
              <Icon size={15} />
              {o.label}
            </button>
          );
        })}
      </div>

      {value.orderType === 'table' && (
        <div className="relative">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={value.tableNumber || ''}
            onChange={(e) => set({ tableNumber: e.target.value })}
            placeholder="N° de table"
            className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>
      )}

      {value.orderType === 'delivery' && (
        <div className="space-y-2 rounded-xl border border-gold/15 bg-vanilla/30 p-2">
          <select
            value={value.delivererId || ''}
            onChange={(e) => {
              const w = workers.find((x) => x.id === e.target.value);
              set({ delivererId: w?.id, delivererName: w?.fullName });
            }}
            className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            <option value="">— Livreur —</option>
            {deliverers.map((w) => (
              <option key={w.id} value={w.id}>{w.fullName}</option>
            ))}
          </select>
          {!hasDedicated && (
            <p className="text-[10px] text-text-muted">Astuce : créez un employé avec le poste « Livreur » pour qu’il voie ses livraisons.</p>
          )}
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <textarea
              value={value.deliveryAddress || ''}
              onChange={(e) => set({ deliveryAddress: e.target.value })}
              placeholder="Adresse de livraison *"
              rows={2}
              className="w-full rounded-xl border border-gold/25 bg-white/70 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
            />
          </div>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={value.deliveryPhone || ''}
              onChange={(e) => set({ deliveryPhone: e.target.value })}
              placeholder="Téléphone de contact"
              className="w-full h-9 rounded-xl border border-gold/25 bg-white/70 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Keep only the fields relevant to the selected order type. */
export function cleanService(v: OrderServiceInfo): OrderServiceInfo {
  const type = v.orderType || 'takeaway';
  return {
    orderType: type,
    tableNumber: type === 'table' ? v.tableNumber?.trim() || undefined : undefined,
    deliveryAddress: type === 'delivery' ? v.deliveryAddress?.trim() || undefined : undefined,
    deliveryPhone: type === 'delivery' ? v.deliveryPhone?.trim() || undefined : undefined,
    delivererId: type === 'delivery' ? v.delivererId || undefined : undefined,
    delivererName: type === 'delivery' ? v.delivererName || undefined : undefined,
  };
}
