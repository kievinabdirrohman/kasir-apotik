import React, { useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SyncCustomerPricesButton: React.FC = () => {
  const { syncCustomerPrices } = useApp();
  const pending = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const handleSync = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsSyncing(true);
    setResult(null);
    try {
      const summary = await syncCustomerPrices();
      setResult({
        kind: 'success',
        message: `Sinkronisasi harga selesai. ${summary.totalInserted} harga customer ditambahkan untuk ${summary.customersProcessed} customer.`,
      });
    } catch (error) {
      setResult({
        kind: 'error',
        message: `Sinkronisasi harga gagal: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      pending.current = false;
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex max-w-sm flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        aria-busy={isSyncing}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
      >
        <RefreshCw aria-hidden="true" className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Menyinkronkan...' : 'Sinkron Harga Customer'}
      </button>
      {/* Keep feedback in the renderer: native alerts can leave Electron inputs unfocused. */}
      {result && (
        <div
          role={result.kind === 'success' ? 'status' : 'alert'}
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${result.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
        >
          <p className="min-w-0 break-words">{result.message}</p>
          <button
            type="button"
            onClick={() => setResult(null)}
            aria-label="Tutup notifikasi sinkronisasi harga"
            className="shrink-0 rounded p-0.5 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
