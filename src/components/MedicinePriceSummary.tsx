import React from 'react';
import type { Customer, Medicine } from '../types';
import { formatRupiah } from '../utils/formatters';
import { medicineSellingPriceEntries } from '../utils/unitConversion';

export const MedicinePriceSummary: React.FC<{
  medicine: Medicine;
  customers: Customer[];
  excludePrimaryNormal?: boolean;
}> = ({ medicine, customers, excludePrimaryNormal = false }) => {
  const customerNames = new Map<string, string>(customers.map(customer => [customer.id, customer.name]));
  const entries = medicineSellingPriceEntries(medicine, customerNames)
    .filter(entry => !excludePrimaryNormal || entry.kind !== 'normal');

  if (!entries.length) return <span className="text-[10px] text-slate-400">Tidak ada harga tambahan</span>;

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-[10px]">
      {entries.map(entry => (
        <div key={entry.key} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
          <span className="min-w-0 break-words font-semibold text-slate-600">{entry.label}</span>
          <span className="shrink-0 font-extrabold text-indigo-700">{formatRupiah(entry.price)}</span>
        </div>
      ))}
    </div>
  );
};
