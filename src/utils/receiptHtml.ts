import type { Transaction, PharmacySettings } from '../types';
import { formatRupiah, formatDateTime, formatCashierName, isPpnTransaction } from './formatters';
import { normalizePrinterSettings } from './printerSettings';
import { transactionItemReceiptQuantityLabel, transactionItemSalePrice } from './unitConversion';

function esc(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a fully self-contained thermal receipt (inline CSS, no Tailwind) that
 * the Electron main process loads into a hidden window and prints silently.
 * The web app keeps its own @media print path — this file is desktop-only.
 */
export function buildReceiptHtml(params: {
  transaction: Transaction;
  settings: PharmacySettings;
  paperWidth?: string;
}): string {
  const { transaction: t, settings } = params;
  const printer = normalizePrinterSettings(
    settings,
    params.paperWidth === '80mm' ? '80mm' : (settings.paperWidth === '80mm' ? '80mm' : '58mm')
  );
  const widthMm = printer.paperWidth === '80mm' ? 80 : 58;
  const fontSize = printer.fontSize;
  // Software margins follow the printer settings exactly; @page also remains zero.
  const hardwareInsetLeftMm = 0;
  const hardwareInsetRightMm = 0;
  const contentWidthMm = Math.max(40, widthMm - printer.marginLeftMm - printer.marginRightMm - hardwareInsetLeftMm - hardwareInsetRightMm);

  const row = (label: string, value: string, className = '') =>
    `<div class="row ${className}"><span class="label">${esc(label)}</span><span class="val">${esc(value)}</span></div>`;

  const divider = '<div class="dashed"></div>';

  const itemsSubtotal = t.items.reduce((s, i) => s + i.subtotal, 0);

  const jasaRacikan =
    t.isPrescription
      ? (t.prescriptionMarkupAmount ??
        Math.round((itemsSubtotal * (t.prescriptionMarkupRate ?? 20)) / 100)) +
        (t.prescriptionRacikanFee ?? 0)
      : 0;

  const showPpn = isPpnTransaction(t);
  const dpp = t.dppAmount ?? (showPpn ? Math.round(t.totalAmount / 1.11) : t.totalAmount);
  const ppn =
    t.ppnAmount ?? (showPpn ? t.totalAmount - Math.round(t.totalAmount / 1.11) : 0);

  const itemRows = t.items
    .map((item) => {
      const qtyLine = `${transactionItemReceiptQuantityLabel(item)} @ ${formatRupiah(transactionItemSalePrice(item))}`;
      return `
        <div class="item">${esc(item.medicineName)}</div>
        <div class="row item-row"><span class="label">${qtyLine}</span><span class="val">${formatRupiah(item.subtotal)}</span></div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Struk ${esc(t.trxNo)}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0 ${hardwareInsetRightMm}mm 0 ${hardwareInsetLeftMm}mm;
    padding: ${printer.marginTopMm}mm ${printer.marginRightMm}mm ${printer.marginBottomMm}mm ${printer.marginLeftMm}mm;
    width: ${contentWidthMm}mm;
    max-width: ${contentWidthMm}mm;
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: ${fontSize}pt;
    line-height: ${printer.lineHeight};
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .row { display: grid; grid-template-columns: ${printer.labelWidthPct}% minmax(0, 1fr); column-gap: ${printer.columnGapMm}mm; align-items: baseline; }
  .meta { grid-template-columns: 28% minmax(0, 1fr); }
  .label { min-width: 0; overflow-wrap: anywhere; }
  .val { min-width: 0; overflow-wrap: anywhere; white-space: nowrap; text-align: ${printer.amountAlignment}; }
  .meta .val { white-space: normal; }
  .item-row .label { overflow-wrap: anywhere; }
  .dashed { border-top: 1px dashed #000; margin: 5px 0; }
  .item { font-weight: 700; overflow-wrap: anywhere; }
  .small { font-size: ${Math.max(7, fontSize - 1)}pt; }
  .footer { white-space: pre-line; text-align: center; margin-top: 5px; }
  .total { font-size: ${fontSize}pt; font-weight: 700; }
</style>
</head>
<body>
  <div class="center small">${esc(settings.receiptHeader)}</div>
  <div class="center bold">${esc(settings.name)}</div>
  <div class="center">${esc(settings.address)}</div>
  <div class="center">Telp: ${esc(settings.phone)}</div>
  ${settings.siaNumber ? `<div class="center small">SIA: ${esc(settings.siaNumber)}</div>` : ''}
  ${settings.sipaNumber ? `<div class="center small">SIPA: ${esc(settings.sipaNumber)}</div>` : ''}
  ${settings.apotekerName ? `<div class="center small">Apoteker: ${esc(settings.apotekerName)}</div>` : ''}
  ${divider}
  ${row('No Trx:', t.trxNo, 'meta')}
  ${row('Tanggal:', formatDateTime(t.date), 'meta')}
  ${row('Kasir:', formatCashierName(t.cashierName), 'meta')}
  ${t.customerName ? row('Customer:', t.customerName, 'meta') : ''}
  ${t.isPrescription && t.doctorName ? row('Dokter Resep:', t.doctorName, 'meta') : ''}
  ${t.isPrescription && t.prescriptionNote ? `<div class="small">Ket. Resep: ${esc(t.prescriptionNote)}</div>` : ''}
  ${divider}
  ${itemRows}
  ${t.isPrescription ? `${divider}${row('Jasa Racikan:', formatRupiah(jasaRacikan))}` : ''}
  ${divider}
  ${row('Subtotal:', formatRupiah(itemsSubtotal))}
  ${t.isPrescription ? row('Jasa & Racikan Resep:', '+' + formatRupiah(jasaRacikan)) : ''}
  ${showPpn ? row('DPP:', formatRupiah(dpp)) : ''}
  ${showPpn ? row(`PPN (${t.ppnRate || 11}%):`, formatRupiah(ppn)) : ''}
  <div class="row total"><span>Total:</span><span>${formatRupiah(t.totalAmount)}</span></div>
  ${row('Metode Pembayaran:', t.paymentMethod)}
  ${row('Bayar:', formatRupiah(t.paymentAmount))}
  ${row('Kembalian:', formatRupiah(t.changeAmount))}
  ${divider}
  <div class="footer small">${esc(settings.receiptFooter)}</div>
</body>
</html>`;
}
