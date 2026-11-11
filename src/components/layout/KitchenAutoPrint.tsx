import { useEffect, useRef } from 'react';
import { useCommandStore } from '@/store/commandStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { printKitchenTicket } from '@/lib/orderPrint';
import { toast } from '@/components/ui/Toast';

const DEVICE_KEY = 'kitchen_printer_device';
// Only commands created/updated recently are auto-printed (avoids printing history)
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isKitchenPrinterDevice(): boolean {
  try { return localStorage.getItem(DEVICE_KEY) === 'true'; } catch { return false; }
}
export function setKitchenPrinterDevice(v: boolean) {
  try { localStorage.setItem(DEVICE_KEY, String(v)); } catch { /* ignore */ }
}

/**
 * Background watcher mounted in the app layout:
 *  - when "auto print kitchen" is ON and this device is a kitchen station
 *    (kitchen profile, or flagged in the commands options), prints a kitchen
 *    ticket for every pending command that has not been printed yet.
 */
export function KitchenAutoPrint() {
  const user = useAuthStore((s) => s.user);
  const autoPrint = useCommandStore((s) => s.autoPrintKitchen);
  const commands = useCommandStore((s) => s.commands);
  const printing = useRef(new Set<string>());

  // Commands are kept in sync across devices by Supabase Realtime (see lib/cloudSync).

  const isStation = !!user && (user.post === 'kitchen' || isKitchenPrinterDevice());

  useEffect(() => {
    if (!autoPrint || !isStation) return;
    const now = Date.now();
    const toPrint = commands.filter(
      (c) => c.status === 'pending' && !c.kitchenPrinted && !printing.current.has(c.id) && now - new Date(c.createdAt).getTime() < MAX_AGE_MS
    );
    if (!toPrint.length) return;
    const settings = useSettingsStore.getState().settings;
    toPrint.forEach((c, i) => {
      printing.current.add(c.id);
      useCommandStore.getState().markKitchenPrinted(c.id);
      // Stagger multiple tickets so the print dialogs don't collide
      window.setTimeout(() => {
        printKitchenTicket(c, settings);
        toast.success(`Ticket cuisine imprimé : ${c.reference}`);
        printing.current.delete(c.id);
      }, i * 1500);
    });
  }, [autoPrint, isStation, commands]);

  return null;
}
