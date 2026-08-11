import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getDaysUntilExpired, getExpiredStatus, formatStockDisplay } from '../utils/formatters';
import { Bell, AlertTriangle, Clock, AlertCircle, ChevronRight, Check } from 'lucide-react';

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expiryThreshold, setExpiryThreshold] = useState<number>(180); // Default to 180 days (6 months) as requested
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { medicines, setActiveTab } = useApp();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter urgent medicines
  const lowStockItems = medicines.filter(m => m.stock <= m.minStock && m.isActive);
  
  const expiredItems = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days < 0 && m.isActive;
  });

  const expiringItems = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days >= 0 && days <= expiryThreshold && m.isActive;
  });

  const totalAlerts = lowStockItems.length + expiredItems.length + expiringItems.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        title="Notifikasi Stok & Kedaluwarsa"
      >
        <Bell className="w-5 h-5" />
        {totalAlerts > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-3 bg-slate-50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-800">Pusat Notifikasi Apotek</h4>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {totalAlerts} Perhatian
              </span>
            </div>

            {/* Threshold Selector Tabs */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 text-[10px]">
              <span className="text-slate-500 font-medium">Pantau Expired:</span>
              <div className="flex gap-1">
                {[
                  { label: '30 Hr', val: 30 },
                  { label: '60 Hr', val: 60 },
                  { label: '90 Hr', val: 90 },
                  { label: '6 Bulan', val: 180 },
                ].map(tab => (
                  <button
                    key={tab.val}
                    onClick={() => setExpiryThreshold(tab.val)}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                      expiryThreshold === tab.val
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 text-xs">
            {totalAlerts === 0 ? (
              <div className="p-6 text-center text-slate-500 space-y-1">
                <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-700">Semua Stok & Expiry Aman</p>
                <p className="text-[11px] text-slate-400">
                  Tidak ada obat expired (&le; {expiryThreshold === 180 ? '6 bulan' : `${expiryThreshold} hari`}) atau stok menipis saat ini.
                </p>
              </div>
            ) : (
              <>
                {/* Expired Items */}
                {expiredItems.map(med => (
                  <div
                    key={`exp-${med.id}`}
                    onClick={() => {
                      setActiveTab('medicines');
                      setIsOpen(false);
                    }}
                    className="p-3 hover:bg-rose-50/50 cursor-pointer transition-colors flex items-start gap-3 group"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900 truncate">{med.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0">
                          Expired
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Expired pada {med.expiredDate} ({med.code})
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0 self-center" />
                  </div>
                ))}

                {/* Expiring Soon Items (Filtered up to threshold e.g. 6 months) */}
                {expiringItems.map(med => {
                  const days = getDaysUntilExpired(med.expiredDate);
                  const expStatus = getExpiredStatus(med.expiredDate);
                  return (
                    <div
                      key={`expiring-${med.id}`}
                      onClick={() => {
                        setActiveTab('medicines');
                        setIsOpen(false);
                      }}
                      className="p-3 hover:bg-amber-50/50 cursor-pointer transition-colors flex items-start gap-3 group"
                    >
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-900 truncate">{med.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 border ${expStatus.badgeColor}`}>
                            Exp {days} hr lagi
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Tgl Expired: {med.expiredDate} • Stok: {formatStockDisplay(med.stock, med.unit, med.unitMultiplier)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0 self-center" />
                    </div>
                  );
                })}

                {/* Low Stock Items */}
                {lowStockItems.map(med => (
                  <div
                    key={`stock-${med.id}`}
                    onClick={() => {
                      setActiveTab('medicines');
                      setIsOpen(false);
                    }}
                    className="p-3 hover:bg-orange-50/50 cursor-pointer transition-colors flex items-start gap-3 group"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-100 text-orange-700 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900 truncate">{med.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 shrink-0">
                          Stok: {formatStockDisplay(med.stock, med.unit, med.unitMultiplier)}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Sisa {formatStockDisplay(med.stock, med.unit, med.unitMultiplier)} (Min: {med.minStock})
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0 self-center" />
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="p-2 bg-slate-50 text-center">
            <button
              onClick={() => {
                setActiveTab('medicines');
                setIsOpen(false);
              }}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold text-center w-full py-1 rounded hover:bg-emerald-50 transition-colors"
            >
              Lihat Kelola Stok Obat →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
