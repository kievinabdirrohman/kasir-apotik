import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDateTime, formatCashierName, isPpnTransaction } from '../utils/formatters';
import { buildReceiptHtml } from '../utils/receiptHtml';
import { Printer, X, CheckCircle, Stethoscope, User, ShoppingBag } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, setIsReceiptModalOpen, lastTransaction, settings } = useApp();
  const didAutoPrint = useRef(false);

  // Auto-print (desktop only): when the receipt opens and the setting is on,
  // silently send the receipt to the configured thermal printer. Each time the
  // modal opens we print exactly once.
  useEffect(() => {
    if (!isReceiptModalOpen) {
      didAutoPrint.current = false;
      return;
    }
    if (!lastTransaction || !window.electronAPI || !settings.autoPrintReceipt) return;
    if (didAutoPrint.current) return;
    didAutoPrint.current = true;
    const paperWidth = settings.paperWidth || '58mm';
    window.electronAPI
      .printReceipt({
        html: buildReceiptHtml({ transaction: lastTransaction, settings, paperWidth }),
        paperWidth,
        printerName: settings.printerName || undefined,
      })
      .catch(() => {
        /* printing failures must never block the receipt modal */
      });
  }, [isReceiptModalOpen, lastTransaction, settings]);

  if (!isReceiptModalOpen || !lastTransaction) return null;

  const handlePrint = () => {
    if (window.electronAPI) {
      const paperWidth = settings.paperWidth || '58mm';
      window.electronAPI.printReceipt({
        html: buildReceiptHtml({ transaction: lastTransaction, settings, paperWidth }),
        paperWidth,
        printerName: settings.printerName || undefined,
      });
    } else {
      // Web mode: keep the original browser print behaviour
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-200" />
              <div>
                <h3 className="font-bold text-lg leading-tight">Transaksi Berhasil</h3>
                <p className="text-xs text-emerald-100">Struk siap dicetak / disimpan</p>
              </div>
            </div>
            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-emerald-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Receipt Thermal Paper Container */}
          <div className="p-6 bg-slate-50 flex-1 overflow-y-auto min-h-0">
          <div
            id="printable-receipt"
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm font-mono text-xs text-slate-800 space-y-4 max-w-[320px] mx-auto"
          >
            {/* Pharmacy Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
              {settings.receiptHeader && (
                <p className="text-[10px] text-slate-500 italic pb-0.5">{settings.receiptHeader}</p>
              )}
              <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                {settings.name}
              </h2>
              <p className="text-[11px] text-slate-600">{settings.address}</p>
              <p className="text-[11px] text-slate-600">Telp: {settings.phone}</p>
              {settings.siaNumber && (
                <p className="text-[10px] text-slate-500">SIA: {settings.siaNumber}</p>
              )}
              {settings.sipaNumber && (
                <p className="text-[10px] text-slate-500">SIPA: {settings.sipaNumber}</p>
              )}
              {settings.apotekerName && (
                <p className="text-[10px] text-slate-500">Apoteker: {settings.apotekerName}</p>
              )}
            </div>

            {/* Transaction Metadata */}
            <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">No Trx:</span>
                <span className="font-semibold text-slate-900">{lastTransaction.trxNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal:</span>
                <span>{formatDateTime(lastTransaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir:</span>
                <span>{formatCashierName(lastTransaction.cashierName)}</span>
              </div>

              {lastTransaction.customerName && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span className="text-slate-500">Customer:</span>
                  <span>
                    {lastTransaction.customerName}{' '}
                    {lastTransaction.customerMemberNo ? `(${lastTransaction.customerMemberNo})` : ''}
                  </span>
                </div>
              )}
              {lastTransaction.isPrescription && lastTransaction.doctorName && (
                <div className="flex justify-between text-indigo-700 font-medium pt-1 border-t border-slate-100 mt-1">
                  <span className="text-slate-500">Dokter Resep:</span>
                  <span>{lastTransaction.doctorName}</span>
                </div>
              )}
              {lastTransaction.isPrescription && lastTransaction.prescriptionNote && (
                <div className="text-[10.5px] text-indigo-950 bg-indigo-50/90 p-2 rounded-lg border border-indigo-200 mt-1.5 leading-snug">
                  <span className="font-bold text-indigo-900">Ket. Resep:</span> <span className="font-semibold text-slate-800">{lastTransaction.prescriptionNote}</span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-2 pb-3 border-b border-dashed border-slate-300">
              <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase">
                <span>Obat (Qty x Harga)</span>
                <span>Subtotal</span>
              </div>
              {lastTransaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-900 text-[11px]">
                    {item.medicineName}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>
                      {item.qty} {item.unit}
                      {(item.unit === 'Lusin' || (item.unitMultiplier && item.unitMultiplier > 1)) ? ` (${item.qty * (item.unit === 'Lusin' ? 12 : (item.unitMultiplier || 1))} pcs)` : ''} x {formatRupiah(item.price)}
                    </span>
                    <span className="font-medium text-slate-900">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}

              {/* Prescription Markup & Racikan Fee Combined */}
              {lastTransaction.isPrescription && (
                <div className="pt-2 mt-2 border-t border-dashed border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-700">
                    <span>Jasa Racikan:</span>
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(
                        (lastTransaction.prescriptionMarkupAmount ??
                          Math.round(
                            (lastTransaction.items.reduce((s, i) => s + i.subtotal, 0) *
                              (lastTransaction.prescriptionMarkupRate ?? 20)) /
                            100
                          )) + (lastTransaction.prescriptionRacikanFee ?? 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations */}
            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex justify-between text-slate-700 font-semibold pb-1 border-b border-dashed border-slate-200">
                <span>Subtotal Produk:</span>
                <span className="font-bold text-slate-900">
                  {formatRupiah(lastTransaction.items.reduce((sum, item) => sum + item.subtotal, 0))}
                </span>
              </div>

              {lastTransaction.isPrescription && (
                <div className="flex justify-between text-indigo-900 pb-1 border-b border-dashed border-slate-200">
                  <span>Jasa & Racikan Resep:</span>
                  <span className="font-bold">
                    +{formatRupiah(
                      (lastTransaction.prescriptionMarkupAmount ?? 0) + (lastTransaction.prescriptionRacikanFee ?? 0)
                    )}
                  </span>
                </div>
              )}

              {isPpnTransaction(lastTransaction) && (
                <div className="space-y-1 pb-1.5 border-b border-dashed border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>DPP (Nilai Bersih):</span>
                    <span>{formatRupiah(lastTransaction.dppAmount ?? Math.round(lastTransaction.totalAmount / 1.11))}</span>
                  </div>
                  <div className="flex justify-between text-blue-800 font-semibold">
                    <span>PPN ({lastTransaction.ppnRate || 11}%):</span>
                    <span>{formatRupiah(lastTransaction.ppnAmount ?? (lastTransaction.totalAmount - Math.round(lastTransaction.totalAmount / 1.11)))}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-slate-700 font-bold text-xs pt-1">
                <span>TOTAL AKHIR:</span>
                <span className="text-emerald-700 font-bold text-sm">
                  {formatRupiah(lastTransaction.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Metode Pembayaran:</span>
                <span className="font-semibold">{lastTransaction.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Bayar:</span>
                <span>{formatRupiah(lastTransaction.paymentAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-semibold border-t border-slate-200 pt-1">
                <span>Kembalian:</span>
                <span className="text-slate-900">{formatRupiah(lastTransaction.changeAmount)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
              {settings.receiptFooter}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => setIsReceiptModalOpen(false)}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak Struk
          </button>
        </div>
      </div>
    </div>
  </div>
);
};
