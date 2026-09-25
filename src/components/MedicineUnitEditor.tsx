import React, { useEffect, useRef, useState } from 'react';
import type { Customer, MedicineCustomPrice, MedicineCustomPriceCustomer } from '../types';
import { formatRupiah } from '../utils/formatters';
import { AVAILABLE_UNITS, getBaseUnit, markupPctFromPrice, medicineUnitPackageCost, normalizeMedicineUnits, priceFromMarkup, synchronizePrimaryUnit, type MedicineUnitDraft } from '../utils/unitConversion';

export type EditableMedicineUnit = MedicineUnitDraft;
export type EditableCustomPrice = MedicineCustomPrice;

interface Props {
  units: EditableMedicineUnit[];
  customPrices: EditableCustomPrice[];
  normalCustomerPrices?: MedicineCustomPriceCustomer[];
  customers: Customer[];
  /** Margin controls are intentionally limited to edit/restock-existing forms. */
  enableMarginPricing?: boolean;
  /** Retained for caller compatibility; normal-customer rows are standalone. */
  normalPrice?: number;
  normalMarginPct?: number;
  normalBhpAmount?: number;
  /** HPP per satuan dasar used when unit rows have stale or missing values. */
  purchasePricePerBase?: number;
  onAddCustomer?: () => void;
  onChange: (units: EditableMedicineUnit[]) => void;
  onCustomPricesChange: (prices: EditableCustomPrice[]) => void;
  onNormalCustomerPricesChange?: (prices: MedicineCustomPriceCustomer[]) => void;
}

const rowKey = (row: EditableCustomPrice, index: number) => row.id || `custom-${index}`;
const APPLY_BUTTON_CLASS = 'h-9 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-40';

type SellingProfile = { price: number; marginPct: number; bhpAmount: number };

type CustomerPriceTemplate = SellingProfile & { inheritParent: boolean };

function uniformCustomerPriceTemplate(rows: MedicineCustomPriceCustomer[]): CustomerPriceTemplate | undefined {
  if (!rows.length) return undefined;
  const first = rows[0];
  const template = {
    price: Number(first.price ?? 0) || 0,
    marginPct: Number(first.marginPct ?? 0) || 0,
    bhpAmount: Number(first.bhpAmount ?? 0) || 0,
    inheritParent: first.inheritParent === true,
  };
  return rows.every(row =>
    Number(row.price ?? 0) === template.price
    && Number(row.marginPct ?? 0) === template.marginPct
    && Number(row.bhpAmount ?? 0) === template.bhpAmount
    && row.inheritParent === template.inheritParent,
  ) ? template : undefined;
}

const CustomerProfileRow: React.FC<{
  customer?: Customer;
  price: MedicineCustomPriceCustomer;
  parent: SellingProfile;
  costForBhp: (bhp: number) => number;
  enableMarginPricing: boolean;
  allowInheritance?: boolean;
  label: string;
  onChange: (patch: Partial<MedicineCustomPriceCustomer>) => void;
  onRemove: () => void;
}> = ({ customer, price, parent, costForBhp, enableMarginPricing, allowInheritance = true, label, onChange, onRemove }) => {
  const followsParent = allowInheritance && price.inheritParent === true;
  const effective = followsParent
    ? parent
    : {
        price: Number(price.price ?? 0),
        marginPct: Number(price.marginPct ?? markupPctFromPrice(price.price, costForBhp(Number(price.bhpAmount ?? 0)))),
        bhpAmount: Number(price.bhpAmount ?? 0),
      };
  const customerLabel = `${customer?.name || 'Customer'} (${customer?.memberNo || '-'})`;
  const toggleInheritance = (checked: boolean) => onChange({
    inheritParent: checked,
    price: parent.price,
    marginPct: parent.marginPct,
    bhpAmount: parent.bhpAmount,
  });

  if (!enableMarginPricing) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
        <div className="min-w-0 flex-1">
          <span className="block break-words font-bold text-indigo-900">{customerLabel}</span>
          {allowInheritance && <label className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800">
            <input type="checkbox" checked={followsParent} onChange={event => toggleInheritance(event.currentTarget.checked)} />
            Ikuti nilai induk (Harga)
          </label>}
        </div>
        <input type="number" min="0" value={effective.price} readOnly={followsParent} onChange={event => onChange({ price: Math.max(0, Number(event.currentTarget.value) || 0), inheritParent: false })} aria-label={`Harga ${label} ${customer?.name || ''}`} className={`w-28 rounded border border-slate-200 px-1.5 py-1 text-xs font-bold ${followsParent ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} />
        <button type="button" onClick={onRemove} className="shrink-0 font-bold text-rose-600">Hapus</button>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(100px,180px)_minmax(80px,130px)_minmax(80px,130px)_auto]">
      <div className="min-w-0">
        <span className="block break-words font-bold text-indigo-900">{customerLabel}</span>
        {allowInheritance && <label className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800">
          <input type="checkbox" checked={followsParent} onChange={event => toggleInheritance(event.currentTarget.checked)} />
          Ikuti nilai induk (Harga, Margin, BHP)
        </label>}
      </div>
      <input type="number" min="0" value={effective.price} readOnly={followsParent} onChange={event => { const nextPrice = Math.max(0, Number(event.currentTarget.value) || 0); onChange({ price: nextPrice, marginPct: markupPctFromPrice(nextPrice, costForBhp(effective.bhpAmount)), inheritParent: false }); }} aria-label={`Harga ${label} ${customer?.name || ''}`} className={`w-full rounded border border-slate-200 px-1.5 py-1 text-xs font-bold ${followsParent ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} />
      <input type="number" min="0" step="0.5" value={effective.marginPct} readOnly={followsParent} onChange={event => { const margin = Number(event.currentTarget.value) || 0; onChange({ marginPct: margin, price: priceFromMarkup(costForBhp(effective.bhpAmount), margin), inheritParent: false }); }} aria-label={`Margin ${label} ${customer?.name || ''}`} className={`w-full rounded border border-slate-200 px-1.5 py-1 text-xs font-bold ${followsParent ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} />
      <input type="number" min="0" value={effective.bhpAmount} readOnly={followsParent} onChange={event => { const bhp = Math.max(0, Number(event.currentTarget.value) || 0); onChange({ bhpAmount: bhp, price: priceFromMarkup(costForBhp(bhp), effective.marginPct), inheritParent: false }); }} aria-label={`BHP ${label} ${customer?.name || ''}`} className={`w-full rounded border border-slate-200 px-1.5 py-1 text-xs font-bold ${followsParent ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} />
      <button type="button" onClick={onRemove} className="font-bold text-rose-600">Hapus</button>
    </div>
  );
};

const CustomerMultiCombobox: React.FC<{
  customers: Customer[];
  value: string[];
  disabled?: boolean;
  onChange: (customerIds: string[]) => void;
}> = ({ customers, value, disabled = false, onChange }) => {
  const selected = new Set(value);
  const label = value.length ? `${value.length} customer dipilih` : 'Pilih customer';
  return (
    <details className="group relative" aria-disabled={disabled}>
      <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 marker:content-none">
        <span>{label}</span><span className="text-slate-400 group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {customers.map(customer => (
          <label key={customer.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold hover:bg-indigo-50">
            <input type="checkbox" checked={selected.has(customer.id)} disabled={disabled} onChange={event => onChange(event.currentTarget.checked ? [...value, customer.id] : value.filter(id => id !== customer.id))} />
            <span>{customer.name} ({customer.memberNo || '-'})</span>
          </label>
        ))}
      </div>
    </details>
  );
};

export const MedicineUnitEditor: React.FC<Props> = ({
  units,
  customPrices,
  normalCustomerPrices = [],
  customers,
  enableMarginPricing = false,
  normalPrice,
  normalMarginPct,
  normalBhpAmount,
  purchasePricePerBase,
  onAddCustomer,
  onChange,
  onCustomPricesChange,
  onNormalCustomerPricesChange,
}) => {
  const activeCustomers = customers.filter(customer => customer.status === 'Aktif');
  const baseUnitName = getBaseUnit(units)?.unit || 'satuan dasar';
  const knownActiveCustomerIds = useRef(new Set(activeCustomers.map(customer => customer.id)));
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string[]>>({});
  const [batchPrices, setBatchPrices] = useState<Record<string, number>>({});
  const [batchMargins, setBatchMargins] = useState<Record<string, number>>({});
  const [batchBhps, setBatchBhps] = useState<Record<string, number>>({});
  const [batchInheritParent, setBatchInheritParent] = useState<Record<string, boolean>>({});
  const [applyAll, setApplyAll] = useState<Record<string, boolean>>({});
  const [applyAllUnits, setApplyAllUnits] = useState<Record<string, boolean>>({});
  const [multiplierInputs, setMultiplierInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const addedCustomers = activeCustomers.filter(customer => !knownActiveCustomerIds.current.has(customer.id));
    knownActiveCustomerIds.current = new Set(activeCustomers.map(customer => customer.id));
    if (!addedCustomers.length) return;

    let nextNormalPrices = normalCustomerPrices;
    let nextUnits = units;
    let nextCustomPrices = customPrices;
    let normalChanged = false;
    let unitsChanged = false;
    let customPricesChanged = false;

    for (const customer of addedCustomers) {
      const normalTemplate = uniformCustomerPriceTemplate(nextNormalPrices);
      if (normalTemplate && !nextNormalPrices.some(row => row.customerId === customer.id)) {
        nextNormalPrices = [...nextNormalPrices, { customerId: customer.id, ...normalTemplate, inheritParent: false }];
        normalChanged = true;
      }

      nextUnits = nextUnits.map(unit => {
        const rows = unit.customerPrices || [];
        const template = uniformCustomerPriceTemplate(rows);
        if (!template || rows.some(row => row.customerId === customer.id)) return unit;
        unitsChanged = true;
        return { ...unit, customerPrices: [...rows, { customerId: customer.id, ...template }] };
      });

      nextCustomPrices = nextCustomPrices.map(price => {
        const rows = price.customerPrices || [];
        const template = uniformCustomerPriceTemplate(rows);
        if (!template || rows.some(row => row.customerId === customer.id)) return price;
        customPricesChanged = true;
        return { ...price, customerPrices: [...rows, { customerId: customer.id, ...template }] };
      });
    }

    if (normalChanged) onNormalCustomerPricesChange?.(nextNormalPrices);
    if (unitsChanged) onChange(nextUnits);
    if (customPricesChanged) onCustomPricesChange(nextCustomPrices);
  }, [activeCustomers, customPrices, normalCustomerPrices, onChange, onCustomPricesChange, onNormalCustomerPricesChange, units]);

  const unitPackageCost = (unit?: EditableMedicineUnit, profileBhp?: number) => {
    if (!unit) return 0;
    const bhp = profileBhp === undefined ? Number(unit.bhpAmount ?? 0) : Number(profileBhp);
    const formHpp = Number(purchasePricePerBase) || 0;
    const baseHpp = Math.max(0, formHpp > 0 ? formHpp : Number(units[0]?.purchasePricePerBase ?? unit.purchasePricePerBase) || 0);
    return baseHpp * Math.max(1, Number(unit.multiplierToBase) || 1) + Math.max(0, bhp || 0);
  };

  const fallbackBaseHpp = Number(purchasePricePerBase) || Number(units[0]?.purchasePricePerBase) || 0;

  const customPackageCost = (price: EditableCustomPrice, profileBhp = price.bhpAmount) => {
    const selectedUnit = units.find(unit => (price.unitId && (unit.id === price.unitId || unit.unit === price.unitId)) || (price.unitName && unit.unit === price.unitName)) || units[0];
    return medicineUnitPackageCost(selectedUnit, price.quantity, profileBhp, fallbackBaseHpp);
  };

  const mainNormalProfile: SellingProfile = {
    price: Number(normalPrice ?? units[0]?.sellingPrice ?? (Number(units[0]?.pricePerBase) || 0) * Math.max(1, Number(units[0]?.multiplierToBase) || 1)),
    marginPct: Number(normalMarginPct ?? 0),
    bhpAmount: Number(normalBhpAmount ?? 0),
  };

  const setBatchInheritance = (key: string, checked: boolean, parent: SellingProfile) => {
    setBatchInheritParent(prev => ({ ...prev, [key]: checked }));
    if (!checked) {
      setBatchPrices(prev => ({ ...prev, [key]: parent.price }));
      setBatchMargins(prev => ({ ...prev, [key]: parent.marginPct }));
      setBatchBhps(prev => ({ ...prev, [key]: parent.bhpAmount }));
    }
  };

  const batchFollowsParent = (key: string) => batchInheritParent[key] !== false;

  const updateUnit = (index: number, patch: Partial<EditableMedicineUnit>) => {
    if (index === 0 && patch.unit) {
      onChange(synchronizePrimaryUnit(units, patch.unit));
      return;
    }
    onChange(normalizeMedicineUnits(units.map((unit, unitIndex) => unitIndex === index ? { ...unit, ...patch } : unit)));
  };

  const addUnit = () => {
    const usedNames = new Set(units.map(unit => unit.unit));
    const unitName = AVAILABLE_UNITS.find(unit => !usedNames.has(unit)) || 'Box';
    const maxMultiplier = Math.max(1, ...units.map(unit => Number(unit.multiplierToBase) || 1));
    const multiplier = unitName === 'Lusin' && !units.some(unit => unit.unit === 'Lusin') ? 12 : maxMultiplier + 1;
    onChange(normalizeMedicineUnits([...units, { unit: unitName, multiplierToBase: multiplier, sortOrder: units.length, isPrimary: false }]));
  };

  const customPriceBelongsToUnit = (price: EditableCustomPrice, unit: EditableMedicineUnit) =>
    Boolean(price.unitId && (price.unitId === unit.id || price.unitId === unit.unit)) || Boolean(price.unitName && price.unitName === unit.unit);

  const customPriceUnitIndex = (price: EditableCustomPrice) => {
    const index = units.findIndex(unit => customPriceBelongsToUnit(price, unit));
    return index >= 0 ? index : 0;
  };

  const removeUnit = (index: number) => {
    if (units.length <= 1) return;
    const removed = units[index];
    const next = units.filter((_, unitIndex) => unitIndex !== index).map((unit, unitIndex) => ({ ...unit, sortOrder: unitIndex }));
    onChange(normalizeMedicineUnits(next));
    onCustomPricesChange(customPrices.filter(price => !customPriceBelongsToUnit(price, removed)));
  };

  const addCustomPrice = (unit: EditableMedicineUnit, index: number) => {
    if (index === 0 || !unit) return;
    onCustomPricesChange([...customPrices, { unitId: unit.id || unit.unit, unitName: unit.unit, quantity: 1, totalPrice: 0, sortOrder: customPrices.length, isActive: true, customerPrices: [] }]);
  };

  const updateCustomPrice = (index: number, patch: Partial<EditableCustomPrice>) => onCustomPricesChange(customPrices.map((price, priceIndex) => priceIndex === index ? { ...price, ...patch } : price));
  const removeCustomPrice = (index: number) => onCustomPricesChange(customPrices.filter((_, priceIndex) => priceIndex !== index).map((price, sortOrder) => ({ ...price, sortOrder })));

  const applyCustomerPrice = (price: EditableCustomPrice, index: number) => {
    const key = rowKey(price, index);
    const ids = applyAll[key] ? activeCustomers.map(customer => customer.id) : (selectedCustomers[key] || []);
    const followsParent = batchFollowsParent(key);
    const totalPrice = Number(batchPrices[key] || 0);
    const customerBhp = enableMarginPricing ? Number(batchBhps[key] ?? 0) : 0;
    const marginPct = enableMarginPricing ? Number(batchMargins[key] ?? markupPctFromPrice(totalPrice, customPackageCost(price, customerBhp))) : 0;
    if (!ids.length || (!followsParent && totalPrice <= 0)) return;
    const targetIndexes = applyAllUnits[key] ? customPrices.map((_, priceIndex) => priceIndex) : [index];
    onCustomPricesChange(customPrices.map((candidate, candidateIndex) => {
      if (!targetIndexes.includes(candidateIndex)) return candidate;
      const next = [...(candidate.customerPrices || [])];
      ids.forEach(customerId => {
        const existingIndex = next.findIndex(item => item.customerId === customerId);
        const parent = { price: Number(candidate.totalPrice ?? 0), marginPct: Number(candidate.marginPct ?? 0), bhpAmount: Number(candidate.bhpAmount ?? 0) };
        const local = { price: totalPrice, marginPct, bhpAmount: enableMarginPricing ? customerBhp : 0 };
        const effective = followsParent ? parent : local;
        const customerPrice: MedicineCustomPriceCustomer = { customerId, price: effective.price, marginPct: effective.marginPct, bhpAmount: effective.bhpAmount, inheritParent: followsParent };
        if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...customerPrice };
        else next.push(customerPrice);
      });
      return { ...candidate, customerPrices: next };
    }));
    setSelectedCustomers(prev => ({ ...prev, [key]: [] }));
    setBatchPrices(prev => ({ ...prev, [key]: 0 }));
    setBatchMargins(prev => ({ ...prev, [key]: 0 }));
    setBatchBhps(prev => ({ ...prev, [key]: 0 }));
    setBatchInheritParent(prev => ({ ...prev, [key]: true }));
    setApplyAll(prev => ({ ...prev, [key]: false }));
    setApplyAllUnits(prev => ({ ...prev, [key]: false }));
  };

  const applyNormalCustomerPrice = () => {
    if (!onNormalCustomerPricesChange) return;
    const ids = applyAll.normal ? activeCustomers.map(customer => customer.id) : (selectedCustomers.normal || []);
    const price = Number(batchPrices.normal || 0);
    const bhp = enableMarginPricing ? Number(batchBhps.normal ?? 0) : 0;
    const marginPct = enableMarginPricing ? Number(batchMargins.normal ?? markupPctFromPrice(price, unitPackageCost(units[0], bhp))) : 0;
    if (!ids.length || price <= 0) return;
    const next = [...normalCustomerPrices];
    ids.forEach(customerId => {
      const existingIndex = next.findIndex(item => item.customerId === customerId);
      const row = { customerId, price, marginPct, bhpAmount: bhp, inheritParent: false };
      if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...row };
      else next.push(row);
    });
    onNormalCustomerPricesChange(next);
    setSelectedCustomers(prev => ({ ...prev, normal: [] }));
    setBatchPrices(prev => ({ ...prev, normal: 0 }));
    setBatchMargins(prev => ({ ...prev, normal: 0 }));
    setBatchBhps(prev => ({ ...prev, normal: 0 }));
    setApplyAll(prev => ({ ...prev, normal: false }));
  };

  const applyUnitCustomerPrice = (unit: EditableMedicineUnit, index: number) => {
    const key = `unit-customer:${unit.id || `unit-${index}`}`;
    const ids = applyAll[key] ? activeCustomers.map(customer => customer.id) : (selectedCustomers[key] || []);
    const followsParent = batchFollowsParent(key);
    const price = Number(batchPrices[key] || 0);
    const bhp = enableMarginPricing ? Number(batchBhps[key] ?? 0) : 0;
    const marginPct = Number(batchMargins[key] ?? markupPctFromPrice(price, unitPackageCost(unit, bhp)));
    if (!ids.length || (!followsParent && price <= 0)) return;
    const nextUnits = units.map((candidate, candidateIndex) => {
      if (candidateIndex !== index) return candidate;
      const rows = [...(candidate.customerPrices || [])];
      ids.forEach(customerId => {
        const existingIndex = rows.findIndex(item => item.customerId === customerId);
        const profile = followsParent
          ? { price: Number(unit.sellingPrice ?? 0), marginPct: Number(unit.marginPct ?? 0), bhpAmount: Number(unit.bhpAmount ?? 0) }
          : { price, marginPct, bhpAmount: bhp };
        const row: MedicineCustomPriceCustomer = { customerId, ...profile, inheritParent: followsParent };
        if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...row };
        else rows.push(row);
      });
      return { ...candidate, customerPrices: rows };
    });
    onChange(nextUnits);
    setSelectedCustomers(prev => ({ ...prev, [key]: [] }));
    setBatchPrices(prev => ({ ...prev, [key]: 0 }));
    setBatchMargins(prev => ({ ...prev, [key]: 0 }));
    setBatchBhps(prev => ({ ...prev, [key]: 0 }));
    setBatchInheritParent(prev => ({ ...prev, [key]: true }));
    setApplyAll(prev => ({ ...prev, [key]: false }));
  };

  const renderNormalCustomerPrices = () => {
    if (!onNormalCustomerPricesChange || !units[0]) return null;
    return (
      <div className="space-y-2 rounded-lg border border-indigo-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2"><div><h5 className="text-sm font-extrabold text-indigo-950">Harga Customer Normal (Opsional)</h5><p className="text-xs text-indigo-700">Berlaku untuk Satuan 1 (Utama): {units[0].unit}. Harga total mandiri, tidak mengikuti harga normal utama.</p></div>{onAddCustomer && <button type="button" onClick={onAddCustomer} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">+ Customer</button>}</div>
        <div className="flex flex-col gap-2">
          {enableMarginPricing && <><label><span className="mb-1 block text-xs font-bold text-slate-600">Margin customer normal (%)</span><input type="number" min="0" step="0.5" value={batchMargins.normal ?? ''} onChange={event => { const margin = Number(event.currentTarget.value) || 0; setBatchMargins(prev => ({ ...prev, normal: margin })); setBatchPrices(prev => ({ ...prev, normal: priceFromMarkup(unitPackageCost(units[0], Number(batchBhps.normal ?? 0)), margin) })); }} placeholder="0" className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm font-bold" /></label><label><span className="mb-1 block text-xs font-bold text-slate-600">BHP customer normal (Rp)</span><input type="number" min="0" value={batchBhps.normal ?? 0} onChange={event => { const bhp = Math.max(0, Number(event.currentTarget.value) || 0); const margin = Number(batchMargins.normal ?? 0); setBatchBhps(prev => ({ ...prev, normal: bhp })); setBatchPrices(prev => ({ ...prev, normal: priceFromMarkup(unitPackageCost(units[0], bhp), margin) })); }} placeholder="0" className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm font-bold" /></label></>}
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Harga customer normal (total)</span><input type="number" min="1" value={batchPrices.normal || ''} onChange={event => { const price = Math.max(0, Number(event.currentTarget.value) || 0); setBatchPrices(prev => ({ ...prev, normal: price })); setBatchMargins(prev => ({ ...prev, normal: markupPctFromPrice(price, unitPackageCost(units[0], Number(batchBhps.normal ?? 0))) })); }} placeholder="Rp" className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm font-bold" /></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo-800"><input type="checkbox" checked={Boolean(applyAll.normal)} onChange={event => { const checked = event.currentTarget.checked; setApplyAll(prev => ({ ...prev, normal: checked })); }} />Terapkan harga ini ke semua customer aktif</label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Pilih customer (bisa banyak)</span><CustomerMultiCombobox customers={activeCustomers} value={applyAll.normal ? activeCustomers.map(customer => customer.id) : (selectedCustomers.normal || [])} disabled={Boolean(applyAll.normal)} onChange={customerIds => setSelectedCustomers(prev => ({ ...prev, normal: customerIds }))} /></label>
          <button type="button" onClick={applyNormalCustomerPrice} disabled={(!applyAll.normal && !(selectedCustomers.normal || []).length) || !(batchPrices.normal > 0)} className={APPLY_BUTTON_CLASS}>Terapkan</button>
        </div>
        {normalCustomerPrices.map(price => <CustomerProfileRow key={price.customerId} customer={customers.find(item => item.id === price.customerId)} price={price} parent={mainNormalProfile} allowInheritance={false} costForBhp={bhp => unitPackageCost(units[0], bhp)} enableMarginPricing={enableMarginPricing} label="customer normal" onChange={patch => onNormalCustomerPricesChange?.(normalCustomerPrices.map(item => item.customerId === price.customerId ? { ...item, ...patch, inheritParent: false } : item))} onRemove={() => onNormalCustomerPricesChange?.(normalCustomerPrices.filter(item => item.customerId !== price.customerId))} />)}
      </div>
    );
  };

  const renderCustomPrice = (price: EditableCustomPrice, index: number, unit: EditableMedicineUnit, legacy = false) => {
    const key = rowKey(price, index);
    const selectedUnit = units.find(candidate => (price.unitId && (candidate.id === price.unitId || candidate.unit === price.unitId)) || (price.unitName && candidate.unit === price.unitName)) || unit;
    const customerRows = price.customerPrices || [];
    const packageCost = customPackageCost(price);
    const customMargin = price.marginPct ?? markupPctFromPrice(price.totalPrice, packageCost);
    const linked = batchFollowsParent(key);
    return (
      <div key={key} className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3">
        <div className={`grid grid-cols-1 items-end gap-2 ${enableMarginPricing ? 'sm:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'sm:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_auto]'}`}>
          <div><span className="mb-1 block text-xs font-bold text-slate-600">Satuan paket</span><div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-bold text-slate-800">{selectedUnit.unit}</div></div>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Jumlah</span><input type="number" min="1" step="1" value={price.quantity} onChange={event => updateCustomPrice(index, { quantity: Math.max(1, Number(event.currentTarget.value) || 1) })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold" /></label>
          {enableMarginPricing && <label><span className="mb-1 block text-xs font-bold text-slate-600">Margin paket (%)</span><input type="number" min="0" step="0.5" value={customMargin} onChange={event => { const margin = Number(event.currentTarget.value) || 0; updateCustomPrice(index, { marginPct: margin, totalPrice: priceFromMarkup(packageCost, margin) }); }} className="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm font-bold text-emerald-800" /></label>}
          {enableMarginPricing && <label><span className="mb-1 block text-xs font-bold text-slate-600">BHP paket (Rp)</span><input type="number" min="0" value={price.bhpAmount ?? 0} onChange={event => { const bhp = Math.max(0, Number(event.currentTarget.value) || 0); updateCustomPrice(index, { bhpAmount: bhp, totalPrice: priceFromMarkup(customPackageCost(price, bhp), customMargin) }); }} className="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm font-bold text-emerald-800" /></label>}
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Harga jual paket (total)</span><input type="number" min="1" value={price.totalPrice} onChange={event => { const totalPrice = Math.max(0, Number(event.currentTarget.value) || 0); updateCustomPrice(index, { totalPrice, ...(enableMarginPricing ? { marginPct: markupPctFromPrice(totalPrice, packageCost) } : {}) }); }} className="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm font-bold text-emerald-800" /></label>
          <button type="button" onClick={() => removeCustomPrice(index)} className="h-8 rounded-lg bg-rose-50 px-2 text-xs font-bold text-rose-700">Hapus</button>
        </div>
        <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-800">Preview: {price.quantity} {selectedUnit.unit} = {formatRupiah(price.totalPrice)}{legacy ? ' (legacy)' : ''}</div>
        <div className="space-y-2 rounded-lg border-t border-slate-100 bg-white p-2">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold text-slate-700">Harga customer untuk paket ini</span>{onAddCustomer && <button type="button" onClick={onAddCustomer} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">+ Customer</button>}</div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-indigo-800"><input type="checkbox" checked={linked} onChange={event => setBatchInheritance(key, event.currentTarget.checked, { price: price.totalPrice, marginPct: Number(price.marginPct ?? 0), bhpAmount: Number(price.bhpAmount ?? 0) })} />Ikuti nilai induk (Harga{enableMarginPricing ? ', Margin, BHP' : ''})</label>
            {enableMarginPricing && <><label><span className="mb-1 block text-xs font-bold text-slate-600">Margin customer paket (%)</span><input type="number" min="0" step="0.5" value={linked ? customMargin : (batchMargins[key] ?? '')} readOnly={linked} onChange={event => { const margin = Number(event.currentTarget.value) || 0; const customerBhp = Number(batchBhps[key] ?? 0); setBatchMargins(prev => ({ ...prev, [key]: margin })); setBatchPrices(prev => ({ ...prev, [key]: priceFromMarkup(customPackageCost(price, customerBhp), margin) })); }} placeholder="0" className={`w-full rounded-lg border border-indigo-200 px-2 py-1.5 text-sm font-bold ${linked ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} /></label><label><span className="mb-1 block text-xs font-bold text-slate-600">BHP customer paket (Rp)</span><input type="number" min="0" value={linked ? (price.bhpAmount ?? 0) : (batchBhps[key] ?? 0)} readOnly={linked} onChange={event => { const customerBhp = Math.max(0, Number(event.currentTarget.value) || 0); const margin = Number(batchMargins[key] ?? 0); setBatchBhps(prev => ({ ...prev, [key]: customerBhp })); setBatchPrices(prev => ({ ...prev, [key]: priceFromMarkup(customPackageCost(price, customerBhp), margin) })); }} placeholder="0" className={`w-full rounded-lg border border-indigo-200 px-2 py-1.5 text-sm font-bold ${linked ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} /></label></>}
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Harga customer paket (total)</span><input type="number" min="1" value={linked ? price.totalPrice : (batchPrices[key] || '')} readOnly={linked} onChange={event => { const totalPrice = Math.max(0, Number(event.currentTarget.value) || 0); const customerBhp = Number(batchBhps[key] ?? 0); setBatchPrices(prev => ({ ...prev, [key]: totalPrice })); setBatchMargins(prev => ({ ...prev, [key]: markupPctFromPrice(totalPrice, customPackageCost(price, customerBhp)) })); }} placeholder="Rp" className={`w-full rounded-lg border border-indigo-200 px-2 py-1.5 text-sm font-bold ${linked ? 'bg-slate-100 text-slate-500' : 'bg-white'}`} /></label>
            {enableMarginPricing && <p className="text-xs font-semibold text-indigo-700">Harga dari margin: {formatRupiah(linked ? price.totalPrice : priceFromMarkup(customPackageCost(price, Number(batchBhps[key] ?? 0)), Number(batchMargins[key] ?? 0)))}</p>}
            <label className="flex items-center gap-2 text-xs font-semibold text-indigo-800"><input type="checkbox" checked={Boolean(applyAll[key])} onChange={event => { const checked = event.currentTarget.checked; setApplyAll(prev => ({ ...prev, [key]: checked })); }} />Terapkan harga ini ke semua customer aktif</label>
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Pilih customer (bisa banyak)</span><CustomerMultiCombobox customers={activeCustomers} value={applyAll[key] ? activeCustomers.map(customer => customer.id) : (selectedCustomers[key] || [])} disabled={Boolean(applyAll[key])} onChange={customerIds => setSelectedCustomers(prev => ({ ...prev, [key]: customerIds }))} /></label>
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Cakupan harga customer</span><select value={applyAllUnits[key] ? 'all' : 'unit'} onChange={event => setApplyAllUnits(prev => ({ ...prev, [key]: event.currentTarget.value === 'all' }))} className="w-full rounded-lg border border-indigo-200 px-2 py-1.5 text-sm font-bold"><option value="unit">Satuan ini</option><option value="all">Semua satuan</option></select></label>
            <button type="button" onClick={() => applyCustomerPrice(price, index)} disabled={(!applyAll[key] && !(selectedCustomers[key] || []).length) || (!linked && !(batchPrices[key] > 0))} className={APPLY_BUTTON_CLASS}>Terapkan</button>
          </div>
          {customerRows.length > 0 && <div className="space-y-1">{customerRows.map(customerPrice => <CustomerProfileRow key={customerPrice.customerId} customer={customers.find(item => item.id === customerPrice.customerId)} price={customerPrice} parent={{ price: price.totalPrice, marginPct: Number(price.marginPct ?? 0), bhpAmount: Number(price.bhpAmount ?? 0) }} costForBhp={bhp => customPackageCost(price, bhp)} enableMarginPricing={enableMarginPricing} label="custom paket" onChange={patch => updateCustomPrice(index, { customerPrices: customerRows.map(item => item.customerId === customerPrice.customerId ? { ...item, ...patch } : item) })} onRemove={() => updateCustomPrice(index, { customerPrices: customerRows.filter(item => item.customerId !== customerPrice.customerId) })} />)}</div>}
        </div>
      </div>
    );
  };

  const renderCustomSection = (unit: EditableMedicineUnit, index: number) => {
    const entries = customPrices.map((price, priceIndex) => ({ price, priceIndex })).filter(({ price }) => customPriceUnitIndex(price) === index);
    if (index === 0 && entries.length === 0) return null;
    return (
      <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-2">
        <div className="flex items-center justify-between gap-2"><div><h5 className="text-sm font-extrabold text-indigo-950">Harga Custom Multiple {index === 0 ? 'Legacy — Satuan 1' : `— ${unit.unit}`} (Opsional)</h5><p className="text-xs text-indigo-700">{index === 0 ? 'Data lama pada Satuan 1 tetap ditampilkan; harga custom baru dibuat pada satuan tambahan.' : `Terikat otomatis ke Satuan ${index + 1}: ${unit.unit}. Harga tidak dibagi multiplier.`}</p></div>{index > 0 && <button type="button" onClick={() => addCustomPrice(unit, index)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-indigo-700">+ Tambah Harga Custom</button>}</div>
        {index > 0 && entries.length === 0 && <p className="rounded-lg border border-dashed border-indigo-300 bg-white p-3 text-xs text-slate-500">Belum ada harga custom untuk {unit.unit}.</p>}
        {entries.map(({ price, priceIndex }) => renderCustomPrice(price, priceIndex, unit, index === 0))}
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3">
      <div><h4 className="font-extrabold text-indigo-950">Satuan Stok & Harga Custom Multiple</h4><p className="text-xs text-indigo-700">Satuan dan multiplier hanya untuk stok. Harga normal dan harga custom adalah harga total paket; HPP mengikuti induk utama.</p></div>
      <div className="space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Konfigurasi satuan stok</div>
        <p className="text-xs text-slate-500">Satuan 1 adalah satuan utama. Unit dasar stok adalah unit dengan isi 1 dan dipakai untuk konversi persediaan.</p>
        {units.map((row, index) => {
          const unitKey = row.id || `unit-${index}`;
          const multiplierValue = Object.prototype.hasOwnProperty.call(multiplierInputs, unitKey) ? multiplierInputs[unitKey] : (row.multiplierToBase ?? '');
          return (
            <div key={row.id || `unit-${index}`} className="space-y-2 rounded-xl border border-indigo-200 bg-white p-2.5">
              <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-5">
                <label className="block md:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Satuan {index + 1}{index === 0 ? ' (Utama)' : ''}</span><select value={row.unit} onChange={event => { const nextUnit = event.currentTarget.value; setMultiplierInputs(prev => { const next = { ...prev }; if (nextUnit === 'Lusin') next[unitKey] = '12'; else delete next[unitKey]; return next; }); updateUnit(index, { unit: nextUnit }); }} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold">{AVAILABLE_UNITS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Isi ({baseUnitName})</span><input type="number" min="1" step="1" value={multiplierValue} readOnly={index === 0} disabled={row.unit === 'Lusin'} onChange={event => { const raw = event.currentTarget.value; setMultiplierInputs(prev => ({ ...prev, [unitKey]: raw })); updateUnit(index, { multiplierToBase: raw === '' ? undefined : Number(raw) }); }} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold disabled:bg-slate-100" /></label>
                <div className="flex h-8 items-center rounded-lg bg-emerald-50 px-2 text-xs font-bold text-emerald-800">{index === 0 ? 'Harga normal memakai satuan ini' : `Konversi ke ${baseUnitName}`}</div>
                <button type="button" onClick={() => removeUnit(index)} disabled={units.length <= 1} className="h-8 rounded-lg bg-rose-50 px-2 text-xs font-bold text-rose-700 disabled:opacity-30">Hapus</button>
              </div>
              {index === 0 && renderNormalCustomerPrices()}
              {renderCustomSection(row, index)}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={addUnit} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-extrabold text-white">+ Tambah Satuan Stok</button>
    </section>
  );
};
