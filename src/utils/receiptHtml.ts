import type { Transaction, PharmacySettings } from '../types';
import { formatRupiah, formatDateTime, formatCashierName, isPpnTransaction } from './formatters';

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
  const paperWidth = params.paperWidth ?? settings.paperWidth ?? '58mm';
  const widthMm = paperWidth === '80mm' ? 80 : 58;
  const fontSize = paperWidth === '80mm' ? 13 : 11;
  const lineHeight = 1.35;

  const row = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span class="val">${esc(value)}</span></div>`;

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
      const qtyLine =
        item.qty +
        ' ' +
        esc(item.unit) +
        (item.unit === 'Lusin' || (item.unitMultiplier && item.unitMultiplier > 1)
          ? ` (${item.qty * (item.unit === 'Lusin' ? 12 : item.unitMultiplier || 1)} pcs)`
          : '') +
        ' x ' +
        formatRupiah(item.price);
      return `
        <div class="item">${esc(item.medicineName)}</div>
        <div class="row"><span>${qtyLine}</span><span class="val">${formatRupiah(item.subtotal)}</span></div>`;
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
    margin: 0;
    padding: 3mm;
    width: ${widthMm}mm;
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .val { text-align: right; }
  .dashed { border-top: 1px dashed #000; margin: 5px 0; }
  .item { font-weight: 700; }
  .small { font-size: ${fontSize - 1}px; }
  .footer { white-space: pre-line; text-align: center; margin-top: 5px; }
  .total { font-size: ${fontSize + 2}px; font-weight: 700; }
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
  ${row('No Trx:', t.trxNo)}
  ${row('Tanggal:', formatDateTime(t.date))}
  ${row('Kasir:', formatCashierName(t.cashierName))}
  ${t.customerName ? row('Customer:', t.customerName + (t.customerMemberNo ? ` (${t.customerMemberNo})` : '')) : ''}
  ${t.isPrescription && t.doctorName ? row('Dokter Resep:', t.doctorName) : ''}
  ${t.isPrescription && t.prescriptionNote ? `<div class="small">Ket. Resep: ${esc(t.prescriptionNote)}</div>` : ''}
  ${divider}
  <div class="row bold"><span>Obat (Qty x Harga)</span><span>Subtotal</span></div>
  ${itemRows}
  ${t.isPrescription ? `${divider}${row('Jasa Racikan:', formatRupiah(jasaRacikan))}` : ''}
  ${divider}
  ${row('Subtotal Produk:', formatRupiah(itemsSubtotal))}
  ${t.isPrescription ? row('Jasa & Racikan Resep:', '+' + formatRupiah(jasaRacikan)) : ''}
  ${showPpn ? row('DPP (Nilai Bersih):', formatRupiah(dpp)) : ''}
  ${showPpn ? row(`PPN (${t.ppnRate || 11}%):`, formatRupiah(ppn)) : ''}
  <div class="row total"><span>TOTAL AKHIR:</span><span>${formatRupiah(t.totalAmount)}</span></div>
  ${row('Metode Pembayaran:', t.paymentMethod)}
  ${row('Bayar:', formatRupiah(t.paymentAmount))}
  ${row('Kembalian:', formatRupiah(t.changeAmount))}
  ${divider}
  <div class="footer small">${esc(settings.receiptFooter)}</div>
</body>
</html>`;
}
