import type { CashSession, StoreSettings } from '@/types';
import type { SessionCalc } from '@/lib/cashSession';
import { printDocument } from '@/lib/orderPrint';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { sessionDuration } from '@/lib/cashSession';

/** Thermal-style "Z" ticket summarising a cash session. */
export function printSessionReport(session: CashSession, calc: SessionCalc, store: StoreSettings) {
  const row = (l: string, v: number, bold = false) =>
    `<div style="display:flex;justify-content:space-between;padding:2px 0;${bold ? 'font-weight:800;font-size:14px' : ''}"><span>${l}</span><span>${formatCurrency(v)}</span></div>`;
  const diff = session.closingAmount !== undefined ? session.closingAmount - calc.theoretical : undefined;
  const html = `<html><head><title>Caisse ${session.workerName}</title><style>
    *{box-sizing:border-box;margin:0;padding:0} @page{margin:4mm}
    body{font-family:'Segoe UI',Arial,sans-serif;width:76mm;margin:0 auto;font-size:12px;color:#111}
    .c{text-align:center}.sep{border-top:1px dashed #333;margin:6px 0}.m{color:#555;font-size:11px}
  </style></head><body>
    <div class="c"><b style="font-size:15px">${store.name}</b><div class="m">ÉTAT DE CAISSE</div></div>
    <div class="sep"></div>
    <div>Caissier : <b>${session.workerName}</b></div>
    <div class="m">Ouverture : ${formatDateTime(session.openedAt)}</div>
    <div class="m">Fermeture : ${session.closedAt ? formatDateTime(session.closedAt) : 'en cours'} · ${sessionDuration(session)}</div>
    <div class="sep"></div>
    ${row('Fond de caisse', session.openingAmount)}
    ${row(`Ventes (${calc.sales.length})`, calc.salesCash)}
    ${calc.saleDebtCash ? row('Règlements dettes', calc.saleDebtCash) : ''}
    ${row(`Commandes (${calc.commandsCreated.length})`, calc.commandsCash)}
    ${calc.depositsTotal ? row('Dépôts', calc.depositsTotal) : ''}
    ${calc.withdrawalsTotal ? row('Retraits', -calc.withdrawalsTotal) : ''}
    <div class="sep"></div>
    ${row('THÉORIQUE', calc.theoretical, true)}
    ${session.closingAmount !== undefined ? row('Compté', session.closingAmount, true) : ''}
    ${diff !== undefined ? row(diff >= 0 ? 'Excédent' : 'Manque', Math.abs(diff), true) : ''}
    <div class="sep"></div>
    <div class="m">Valeur des ventes : ${formatCurrency(calc.salesTotal)}</div>
    <div class="m">Valeur des commandes : ${formatCurrency(calc.commandsTotal)}</div>
    ${session.closingNote ? `<div class="m">Note : ${session.closingNote}</div>` : ''}
    <div class="sep"></div>
    <div style="display:flex;justify-content:space-between;margin-top:22px" class="m"><span>Signature caissier</span><span>Signature gérant</span></div>
  </body></html>`;
  printDocument(html);
}
