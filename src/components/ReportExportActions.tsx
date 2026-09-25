import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Download, Loader2, X } from 'lucide-react';
import {
  createDefaultAuditBookDateRange,
  isValidAuditBookDateRange,
  resolveAuditBookDateRange,
  type AuditBookDateRange,
  type AuditDatePreset,
} from '../utils/reportExport';

interface ReportExportActionsProps {
  onExport: () => void | Promise<void>;
  onAuditBook: (range: AuditBookDateRange) => void | Promise<void>;
  isExporting: boolean;
}

const datePresets: Array<{ id: AuditDatePreset; label: string }> = [
  { id: '1_day', label: 'Hari Ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: '7_days', label: '7 Hari' },
  { id: '30_days', label: '30 Hari' },
  { id: 'this_month', label: 'Bulan Ini' },
  { id: 'custom', label: 'Kustom' },
];

export const ReportExportActions: React.FC<ReportExportActionsProps> = ({ onExport, onAuditBook, isExporting }) => {
  const [isAuditBookOpen, setIsAuditBookOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [datePreset, setDatePreset] = useState<AuditDatePreset>('1_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!isAuditBookOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) setIsAuditBookOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuditBookOpen, isSubmitting]);

  const openAuditBook = () => {
    const defaultRange = createDefaultAuditBookDateRange();
    setDatePreset(defaultRange.preset);
    setStartDate(defaultRange.startDate);
    setEndDate(defaultRange.endDate);
    setValidationError('');
    setIsAuditBookOpen(true);
  };

  const handlePresetChange = (preset: AuditDatePreset) => {
    const today = createDefaultAuditBookDateRange().endDate;
    const range = resolveAuditBookDateRange(preset, today, startDate, endDate);
    setDatePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setValidationError('');
  };

  const handleSubmit = async () => {
    const range: AuditBookDateRange = { preset: datePreset, startDate, endDate };
    if (!isValidAuditBookDateRange(range)) {
      setValidationError('Rentang tanggal tidak valid. Pastikan tanggal mulai tidak melewati tanggal akhir.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onAuditBook(range);
      setIsAuditBookOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Unduh PDF
        </button>
        <button
          type="button"
          onClick={openAuditBook}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <BookOpen size={14} />
          Buku Audit Gabungan
        </button>
      </div>

      {isAuditBookOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="audit-book-date-title">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="audit-book-date-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  Rentang Buku Audit Gabungan
                </h2>
                <p className="mt-1 text-xs text-slate-500">Rentang ini diterapkan ke seluruh bagian transaksi, finansial, dan riwayat terkait.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditBookOpen(false)}
                disabled={isSubmitting}
                aria-label="Tutup pilihan rentang audit"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="flex flex-wrap gap-2">
                {datePresets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetChange(preset.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${datePreset === preset.id
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Dari tanggal
                  <input
                    type="date"
                    value={startDate}
                    onChange={event => {
                      setDatePreset('custom');
                      setStartDate(event.target.value);
                      setValidationError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-bold text-slate-600">
                  Sampai tanggal
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={event => {
                      setDatePreset('custom');
                      setEndDate(event.target.value);
                      setValidationError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              {validationError && <p className="text-xs font-semibold text-rose-600" role="alert">{validationError}</p>}
              <p className="text-[11px] text-slate-400">Data pada tanggal mulai dan tanggal akhir ikut dihitung.</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsAuditBookOpen(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isExporting || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                Buat Buku Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
