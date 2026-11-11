import type { StoreSettings, OrderServiceInfo, OrderType } from '@/types';
import type { Command } from '@/store/commandStore';
import { formatCurrency, formatDateTime, formatDate } from './utils';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  table: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

export function orderTypeLabel(info: OrderServiceInfo): string {
  if (!info.orderType) return '—';
  if (info.orderType === 'table') return info.tableNumber ? `Sur place · Table ${info.tableNumber}` : 'Sur place';
  return ORDER_TYPE_LABELS[info.orderType];
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Print an HTML document through a hidden iframe. Unlike window.open this is
 * not blocked by popup blockers, so it also works for automatic printing.
 */
export function printDocument(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 60_000);
    }
  };
  // Give images (logo / product pictures) a moment to load
  setTimeout(run, 350);
}

const ticketCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 4mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; width: 76mm; margin: 0 auto; font-size: 12px; }
  .center { text-align: center; }
  .store { font-size: 16px; font-weight: bold; }
  .muted { color: #555; font-size: 11px; }
  .sep { border-top: 1px dashed #333; margin: 6px 0; }
  .big { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  .badge { display: inline-block; border: 2px solid #111; border-radius: 6px; padding: 2px 8px; font-weight: 800; font-size: 14px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  td.r { text-align: right; white-space: nowrap; }
  .kitchen td { font-size: 16px; font-weight: 700; padding: 5px 0; border-bottom: 1px dotted #999; }
  .qty { width: 46px; font-size: 18px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .total { font-size: 15px; font-weight: 800; }
  .box { border: 1px solid #333; border-radius: 6px; padding: 5px 7px; margin-top: 6px; }
`;

function serviceBlock(c: OrderServiceInfo, large = false): string {
  if (!c.orderType) return '';
  const cls = large ? 'badge' : 'muted';
  let html = `<div class="${cls}">${esc(orderTypeLabel(c)).toUpperCase()}</div>`;
  if (c.orderType === 'delivery') {
    html += `<div class="box">${c.deliveryAddress ? `📍 ${esc(c.deliveryAddress)}<br/>` : ''}${c.deliveryPhone ? `📞 ${esc(c.deliveryPhone)}<br/>` : ''}${c.delivererName ? `🛵 Livreur : <b>${esc(c.delivererName)}</b>` : ''}</div>`;
  }
  return html;
}

/** Kitchen ticket — no prices, big quantities. */
export function buildKitchenTicket(cmd: Command, store: StoreSettings): string {
  const rows = cmd.items
    .map((l) => `<tr><td class="qty">${l.quantity}${l.sellByUnit && l.sellUnit ? ` ${esc(l.sellUnit)}` : '×'}</td><td>${esc(l.productName)}</td></tr>`)
    .join('');
  return `<html><head><title>Cuisine ${esc(cmd.reference)}</title><style>${ticketCss}</style></head><body>
    <div class="center">
      <div class="muted">${esc(store.name)} — TICKET CUISINE</div>
      <div class="big">${esc(cmd.reference)}</div>
      ${serviceBlock(cmd, true)}
      <div class="muted" style="margin-top:4px">${formatDateTime(cmd.createdAt)} · ${esc(cmd.createdBy || '')}</div>
      <div class="muted">Pour : ${formatDate(cmd.receiveDate)} à ${esc(cmd.receiveHour)}h${esc(cmd.receiveMinute)}</div>
    </div>
    <div class="sep"></div>
    <table class="kitchen">${rows}</table>
    ${cmd.note ? `<div class="box"><b>Note :</b> ${esc(cmd.note)}</div>` : ''}
    <div class="sep"></div>
    <div class="center muted">Client : ${esc(cmd.clientName)}</div>
  </body></html>`;
}

/** Client receipt for a command (bon de commande). */
export function buildCommandReceipt(cmd: Command, store: StoreSettings): string {
  const rows = cmd.items
    .map(
      (l) => `<tr><td>${esc(l.productName)}<br/><span class="muted">${l.quantity}${l.sellByUnit && l.sellUnit ? ` ${esc(l.sellUnit)}` : ''} × ${formatCurrency(l.unitPrice)}</span></td><td class="r">${formatCurrency(l.totalPrice)}</td></tr>`
    )
    .join('');
  const lineSum = cmd.items.reduce((s, l) => s + l.totalPrice, 0);
  const reduction = Math.max(0, lineSum - cmd.totalAmount);
  const title = cmd.status === 'finalised' ? 'FACTURE' : 'BON DE COMMANDE';
  return `<html><head><title>${esc(cmd.reference)}</title><style>${ticketCss}</style></head><body>
    <div class="center">
      ${store.logo ? `<img src="${store.logo}" style="width:54px;height:54px;object-fit:cover;border-radius:10px"/>` : ''}
      <div class="store">${esc(store.name)}</div>
      ${store.address ? `<div class="muted">${esc(store.address)}</div>` : ''}
      ${store.phone ? `<div class="muted">📞 ${esc(store.phone)}</div>` : ''}
      <div class="sep"></div>
      <div style="font-weight:800">${title}</div>
      <div class="big">${esc(cmd.reference)}</div>
      ${serviceBlock(cmd, true)}
      <div class="muted" style="margin-top:4px">${formatDateTime(cmd.createdAt)}</div>
    </div>
    <div class="sep"></div>
    <div>Client : <b>${esc(cmd.clientName)}</b>${cmd.clientPhone ? ` · ${esc(cmd.clientPhone)}` : ''}</div>
    <div class="muted">Prévue : ${formatDate(cmd.receiveDate)} à ${esc(cmd.receiveHour)}h${esc(cmd.receiveMinute)}</div>
    <div class="sep"></div>
    <table>${rows}</table>
    <div class="sep"></div>
    ${reduction > 0 ? `<div class="row"><span>Sous-total</span><span>${formatCurrency(lineSum)}</span></div><div class="row"><span>Réduction</span><span>- ${formatCurrency(reduction)}</span></div>` : ''}
    <div class="row total"><span>TOTAL</span><span>${formatCurrency(cmd.totalAmount)}</span></div>
    <div class="row"><span>Payé</span><span>${formatCurrency(cmd.paidAmount)}</span></div>
    <div class="row total"><span>Reste à payer</span><span>${formatCurrency(cmd.restAmount)}</span></div>
    ${cmd.note ? `<div class="box"><b>Note :</b> ${esc(cmd.note)}</div>` : ''}
    <div class="sep"></div>
    <div class="center muted">Merci de votre confiance !</div>
  </body></html>`;
}

export function printKitchenTicket(cmd: Command, store: StoreSettings) {
  printDocument(buildKitchenTicket(cmd, store));
}

export function printCommandReceipt(cmd: Command, store: StoreSettings) {
  printDocument(buildCommandReceipt(cmd, store));
}
