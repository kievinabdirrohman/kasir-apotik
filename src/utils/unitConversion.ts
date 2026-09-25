import type { Medicine, MedicineCustomPrice, MedicineUnit, TransactionItem } from '../types';

export const AVAILABLE_UNITS = [
  'Pcs', 'Tablet', 'Kapsul', 'Ampul', 'Sachet', 'Strip', 'Blister', 'Pack',
  'Box', 'Dus', 'Lusin', 'Botol', 'Tube', 'Vial', 'Suppositoria', 'Syringe',
  'Pasang', 'Set', 'Roll', 'Galon', 'Bag',
] as const;

export const LUSIN_MULTIPLIER = 12;

export type MedicineUnitDraft = Omit<MedicineUnit, 'id' | 'medicineId' | 'multiplierToBase'> & {
  id?: string;
  medicineId?: string;
  /** Empty while the editor is being edited; save-time validation rejects it. */
  multiplierToBase?: number;
};

/**
 * Keep the existing primary unit as the first row without changing its
 * multiplier, price, or identity. The unit with multiplier 1 remains the
 * stock base and may be a different row.
 */
export function normalizeMedicineUnits<T extends MedicineUnitDraft>(units: T[]): T[] {
  if (!units.length) return [];
  const source = units.map((unit, index) => ({ ...unit, sortOrder: Number(unit.sortOrder ?? index) }));
  const primaryIndex = Math.max(0, source.findIndex(unit => Boolean(unit.isPrimary)));
  const primary = source[primaryIndex];
  const rest = source.filter((_, index) => index !== primaryIndex);
  return [primary, ...rest].map((unit, index) => ({
    ...unit,
    multiplierToBase: unit.unit === 'Lusin' ? LUSIN_MULTIPLIER : unit.multiplierToBase,
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

/** Make the selected main unit the first row without losing that row's stock conversion. */
export function synchronizePrimaryUnit<T extends MedicineUnitDraft>(units: T[], unitName: string): T[] {
  const normalized = normalizeMedicineUnits(units);
  const existingIndex = normalized.findIndex((unit, index) => index > 0 && unit.unit === unitName);
  if (existingIndex > 0) {
    const next = [...normalized];
    [next[0], next[existingIndex]] = [next[existingIndex], next[0]];
    return normalizeMedicineUnits(next.map((unit, index) => ({ ...unit, isPrimary: index === 0 })));
  }
  return normalizeMedicineUnits(normalized.map((unit, index) => index === 0
    ? { ...unit, unit: unitName, multiplierToBase: unitName === 'Lusin' ? LUSIN_MULTIPLIER : unit.multiplierToBase }
    : unit));
}

/** Keep one canonical HPP per stock-base item across every selling unit. */
export function synchronizeUnitPurchasePrices<T extends MedicineUnitDraft>(units: T[], purchasePricePerBase: number): T[] {
  const hpp = Math.max(0, Number(purchasePricePerBase) || 0);
  return units.map(unit => ({ ...unit, purchasePricePerBase: hpp }));
}

export function purchasePricePerBaseFromPackage(packagePrice: number, primary?: Pick<MedicineUnitDraft, 'multiplierToBase'>): number {
  return Math.max(0, Number(packagePrice) || 0) / Math.max(1, Number(primary?.multiplierToBase) || 1);
}

export function getBaseUnit(units: MedicineUnitDraft[]): MedicineUnitDraft | undefined {
  return units.find(unit => Number(unit.multiplierToBase) === 1);
}

export function legacyMultiplier(medicine: Pick<Medicine, 'unit' | 'unitMultiplier'>): number {
  return medicine.unit === 'Lusin' ? LUSIN_MULTIPLIER : Math.max(1, Number(medicine.unitMultiplier) || 1);
}

export function legacyPurchasePricePerBase(medicine: Pick<Medicine, 'purchasePrice' | 'unit' | 'unitMultiplier'>): number {
  const multiplier = legacyMultiplier(medicine);
  return (Number(medicine.purchasePrice) || 0) / multiplier;
}

export function getMedicineUnits(medicine: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>): MedicineUnit[] {
  if (medicine.units?.length) {
    return normalizeMedicineUnits([...medicine.units].sort((a, b) => a.sortOrder - b.sortOrder || a.multiplierToBase - b.multiplierToBase)) as MedicineUnit[];
  }

  const multiplier = legacyMultiplier(medicine);
  const purchasePrice = legacyPurchasePricePerBase(medicine);
  if (multiplier > 1 && medicine.unit !== 'Pcs') {
    return normalizeMedicineUnits([
      {
        id: `${medicine.id}-base`, medicineId: medicine.id, unit: 'Pcs', multiplierToBase: 1,
        sortOrder: 0, pricePerBase: Number(medicine.price) || 0, purchasePricePerBase: purchasePrice, isPrimary: false,
      },
      {
        id: `${medicine.id}-legacy`, medicineId: medicine.id, unit: medicine.unit, multiplierToBase: multiplier,
        sortOrder: 1, pricePerBase: Number(medicine.price) || 0, purchasePricePerBase: purchasePrice, isPrimary: true,
      },
    ]) as MedicineUnit[];
  }
  return [{
    id: `${medicine.id}-base`, medicineId: medicine.id, unit: medicine.unit || 'Pcs', multiplierToBase: 1,
    sortOrder: 0, pricePerBase: Number(medicine.price) || 0, purchasePricePerBase: Number(medicine.purchasePrice) || 0, isPrimary: true,
  }];
}

export function getPrimaryUnit(medicine: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>): MedicineUnit {
  const units = getMedicineUnits(medicine);
  return units[0];
}

export type MedicineSellingPriceEntry = {
  key: string;
  label: string;
  price: number;
  kind: 'normal' | 'customer' | 'unit' | 'unit-customer' | 'custom' | 'custom-customer';
};

export function medicineSellingPriceEntries(
  medicine: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units' | 'normalCustomerPrices' | 'customPrices'>,
  customerNames: ReadonlyMap<string, string> = new Map(),
): MedicineSellingPriceEntry[] {
  const units = getMedicineUnits(medicine);
  const primary = units[0];
  const entries: MedicineSellingPriceEntry[] = [];
  const add = (key: string, label: string, price: number, kind: MedicineSellingPriceEntry['kind']) => {
    if (Number(price) > 0) entries.push({ key, label, price: Number(price), kind });
  };
  add('normal', `Normal · ${primary.unit}`, medicine.price, 'normal');
  const normalCustomers = medicine.normalCustomerPrices ?? [];
  const normalCustomer = normalCustomers.find(price => Number(price.price) > 0);
  if (normalCustomer) add('normal-customer', `Customer · ${primary.unit}`, normalCustomer.price, 'customer');

  units.slice(1).forEach(unit => {
    add(`unit-${unit.id}`, `Normal · ${unit.unit}`, Number(unit.sellingPrice || 0), 'unit');
    const customerPrice = (unit.customerPrices || []).find(price => Number(price.price) > 0);
    if (customerPrice) add(`unit-${unit.id}-customer`, `Customer · ${unit.unit}`, customerPrice.price, 'unit-customer');
  });

  [...(medicine.customPrices || [])]
    .filter(price => price.isActive !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((price, index) => {
      const unit = units.find(item => item.id === price.unitId || item.unit === price.unitName) || primary;
      const packageLabel = `${price.quantity} ${unit.unit}`;
      const key = price.id || `custom-${unit.id}-${price.quantity}-${index}`;
      add(key, `Custom · ${packageLabel}`, price.totalPrice, 'custom');
      const customerPrice = (price.customerPrices || []).find(item => Number(item.price) > 0);
      if (customerPrice) add(`${key}-customer`, `Customer · ${packageLabel}`, customerPrice.price, 'custom-customer');
    });

  return entries;
}

export function getUnitById(medicine: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>, unitId?: string): MedicineUnit {
  const units = getMedicineUnits(medicine);
  return units.find(unit => unit.id === unitId) || getPrimaryUnit(medicine);
}

export function validateUnitDefinitions(units: MedicineUnitDraft[]): string | null {
  if (!units.length) return 'Minimal satu unit harus diatur.';
  const names = new Set<string>();
  const multipliers = new Set<number>();
  let baseCount = 0;
  for (const unit of units) {
    const multiplier = Number(unit.multiplierToBase);
    if (!unit.unit?.trim() || names.has(unit.unit.trim().toLowerCase())) return 'Satuan tidak boleh kosong atau duplikat.';
    if (!Number.isInteger(multiplier) || multiplier < 1 || multipliers.has(multiplier)) return 'Multiplier satuan harus bilangan bulat unik.';
    if (unit.unit === 'Lusin' && multiplier !== LUSIN_MULTIPLIER) return 'Multiplier Lusin harus 12.';
    names.add(unit.unit.trim().toLowerCase());
    multipliers.add(multiplier);
    if (multiplier === 1) baseCount += 1;
  }
  if (baseCount !== 1) return 'Harus ada tepat satu satuan dasar dengan multiplier 1.';
  return null;
}

export function unitTotalPrice(unit: Pick<MedicineUnit, 'multiplierToBase' | 'pricePerBase'>): number {
  return Number(unit.multiplierToBase) * Number(unit.pricePerBase || 0);
}

export function customPriceLabel(price: Pick<MedicineCustomPrice, 'quantity' | 'unitName' | 'totalPrice'>): string {
  return `${Number(price.quantity) || 0} ${price.unitName || 'unit'} = ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(price.totalPrice) || 0)}`;
}

export function findCustomPriceForUnit(customPrices: MedicineCustomPrice[], unit: Pick<MedicineUnit, 'id' | 'unit'>, quantity = 1): MedicineCustomPrice | undefined {
  return customPrices.find(price => Number(price.quantity) === quantity && (
    price.unitId === unit.id || price.unitId === unit.unit || price.unitName === unit.unit
  ));
}

export function transactionItemPackageQuantity(item: Pick<TransactionItem, 'pricingMode' | 'customQuantity'>): number {
  return item.pricingMode === 'custom' ? Math.max(1, Number(item.customQuantity) || 1) : 1;
}

export function transactionItemPackageLabel(item: Pick<TransactionItem, 'pricingMode' | 'customQuantity' | 'customUnit' | 'unit'>): string {
  return `${transactionItemPackageQuantity(item)} ${item.customUnit || item.unit || 'Pcs'}`;
}

export function transactionItemDisplayLabel(item: Pick<TransactionItem, 'qty' | 'pricingMode' | 'customQuantity' | 'customUnit' | 'unit'>): string {
  const quantity = Number(item.qty || 0);
  const packageQuantity = transactionItemPackageQuantity(item);
  const unit = item.customUnit || item.unit || 'Pcs';
  if (packageQuantity > 1) return quantity > 1 ? `${quantity} x ${packageQuantity} ${unit}` : `${packageQuantity} ${unit}`;
  return `${quantity} ${unit}`;
}

export function transactionItemReceiptQuantityLabel(item: Pick<TransactionItem, 'qty' | 'pricingMode' | 'customQuantity' | 'customUnit' | 'unit' | 'unitMultiplier'>): string {
  const quantity = Number(item.qty || 0);
  const packageQuantity = transactionItemPackageQuantity(item);
  const quantityLabel = packageQuantity > 1 && quantity > 1 ? `${quantity} x ${packageQuantity}` : String(quantity * packageQuantity);
  const showUnit = item.pricingMode === 'custom' || (item.pricingMode === 'legacy' && Number(item.unitMultiplier) > 1);
  return showUnit ? `${quantityLabel} ${item.customUnit || item.unit || ''}`.trim() : quantityLabel;
}

export function transactionItemSalePrice(item: Pick<TransactionItem, 'price' | 'pricingMode' | 'unitMultiplier'>): number {
  return item.pricingMode === 'normal' || item.pricingMode === 'custom' ? Number(item.price || 0) : Number(item.price || 0) * Math.max(1, Number(item.unitMultiplier) || 1);
}

/** Base stock quantity consumed by a transaction line. Price is never converted here. */
export function transactionItemBaseQuantity(item: Pick<TransactionItem, 'qty' | 'unitMultiplier' | 'pricingMode' | 'customQuantity'>): number {
  return Number(item.qty || 0) * transactionItemPackageQuantity(item) * Math.max(1, Number(item.unitMultiplier) || 1);
}

export function hasMedicinePriceSourceConflict(
  cart: Array<Pick<TransactionItem, 'medicineId' | 'unitId' | 'priceSource' | 'pricingMode' | 'customPriceId'>>,
  candidate: Pick<TransactionItem, 'medicineId' | 'unitId' | 'priceSource' | 'pricingMode' | 'customPriceId'>,
): boolean {
  const category = (item: typeof candidate) => item.pricingMode === 'custom'
    ? `custom|${item.customPriceId ?? ''}`
    : `normal|${item.unitId ?? ''}`;
  const source = candidate.priceSource ?? 'normal';
  const candidateCategory = category(candidate);
  return cart.some(item => item.medicineId === candidate.medicineId && category(item) === candidateCategory && (item.priceSource ?? 'normal') !== source);
}

export function medicineBaseUnitName(medicine?: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>): string {
  const baseUnit = medicine && getMedicineUnits(medicine).find(unit => Number(unit.multiplierToBase) === 1);
  return baseUnit?.unit || 'Pcs';
}

export function transactionItemBaseDisplayLabel(
  item: Pick<TransactionItem, 'qty' | 'unitMultiplier' | 'pricingMode' | 'customQuantity'>,
  medicine?: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>,
): string {
  return `Stok dasar: ${transactionItemBaseQuantity(item)} ${medicineBaseUnitName(medicine)}`;
}

export function transactionItemPriceTypeLabel(
  item: Pick<TransactionItem, 'priceSource' | 'pricingMode' | 'customPriceId' | 'customQuantity' | 'customUnit' | 'unit' | 'qty' | 'unitMultiplier'>,
  medicine?: Pick<Medicine, 'id' | 'unit' | 'unitMultiplier' | 'price' | 'purchasePrice' | 'units'>,
): string {
  const source = item.priceSource === 'customer' ? 'Harga Customer' : 'Harga Normal';
  const isCustom = item.pricingMode === 'custom' || Boolean(item.customPriceId);
  if (!isCustom) return source;
  return `${source} · ${transactionItemPackageLabel(item)} · ${transactionItemBaseDisplayLabel(item, medicine)}`;
}

export function stockUnitParts(stock: number, units: MedicineUnit[]): Array<{ unit: string; qty: number }> {
  let remaining = Math.max(0, Math.floor(Number(stock) || 0));
  return [...units]
    .sort((a, b) => b.multiplierToBase - a.multiplierToBase)
    .flatMap(unit => {
      const qty = Math.floor(remaining / unit.multiplierToBase);
      remaining %= unit.multiplierToBase;
      return qty ? [{ unit: unit.unit, qty }] : [];
    });
}

export function priceFromMarkup(cost: number, marginPct: number): number {
  return Math.round(Math.max(0, Number(cost) || 0) * (1 + (Number(marginPct) || 0) / 100));
}

/** Cost of a custom quantity. Unit multipliers are stock-only. */
export function medicineUnitPackageCost(
  unit: Pick<MedicineUnitDraft, 'multiplierToBase' | 'purchasePricePerBase'> | undefined,
  quantity = 1,
  bhpAmount = 0,
  fallbackPurchasePricePerBase = 0,
): number {
  if (!unit) return 0;
  const unitHpp = Number(unit.purchasePricePerBase);
  const fallbackHpp = Number(fallbackPurchasePricePerBase) || 0;
  const baseHpp = unitHpp > 0 ? unitHpp : fallbackHpp;
  const customQuantity = Math.max(1, Number(quantity) || 1);
  const bhp = Math.max(0, Number(bhpAmount) || 0);
  return customQuantity * (Math.max(0, baseHpp) + bhp);
}

export function markupPctFromPrice(price: number, cost: number): number {
  const safeCost = Number(cost) || 0;
  return safeCost > 0 ? Math.round(((Number(price) - safeCost) / safeCost) * 10000) / 100 : 0;
}

type TransactionCostItem = Pick<TransactionItem, 'qty' | 'unit' | 'unitMultiplier' | 'unitId' | 'purchasePrice' | 'price' | 'pricingMode' | 'customQuantity' | 'subtotal'> & {
  bhpAmount?: number;
  profitAmount?: number;
};

type TransactionCostMedicine = Pick<Medicine, 'unit' | 'unitMultiplier' | 'purchasePrice'> & {
  bhpAmount?: number;
};

/** Cost of one selected package, including the package's BHP snapshot. */
export function transactionItemPackageCost(item: TransactionCostItem, medicine?: TransactionCostMedicine): number {
  const multiplier = Number(item.unitMultiplier) || legacyMultiplier({ unit: item.unit || medicine?.unit || 'Pcs', unitMultiplier: medicine?.unitMultiplier });
  const masterMultiplier = medicine ? legacyMultiplier(medicine) : multiplier;
  const purchase = Number(item.purchasePrice ?? medicine?.purchasePrice ?? Number(item.price) * 0.75);
  const purchasePerBase = item.unitId || item.pricingMode === 'custom' ? purchase : purchase / masterMultiplier;
  // Legacy rows never had a BHP snapshot; reading current master BHP would
  // mutate historical reports, so only explicit transaction BHP is used.
  const bhp = Number(item.bhpAmount ?? 0);
  return Math.round(multiplier * purchasePerBase + bhp);
}

export function transactionItemCost(item: TransactionCostItem, medicine?: TransactionCostMedicine): number {
  // Legacy imports may receive the column default 0 before their cost is
  // backfilled; recompute those rows from their own purchase snapshot.
  if (item.profitAmount !== undefined && item.profitAmount !== null && (item.profitAmount !== 0 || item.pricingMode !== 'legacy')) {
    return Math.round(Number(item.subtotal ?? 0) - Number(item.profitAmount));
  }
  const multiplier = Math.max(1, Number(item.unitMultiplier) || legacyMultiplier({ unit: item.unit || medicine?.unit || 'Pcs', unitMultiplier: medicine?.unitMultiplier }));
  return Math.round((transactionItemBaseQuantity(item) / multiplier) * transactionItemPackageCost(item, medicine));
}

export function transactionItemProfit(item: TransactionCostItem & Pick<TransactionItem, 'subtotal'>, medicine?: TransactionCostMedicine): number {
  return Math.round(Number(item.subtotal || 0) - transactionItemCost(item, medicine));
}

export function transactionItemMarkupPct(item: TransactionCostItem & Pick<TransactionItem, 'subtotal'>, medicine?: TransactionCostMedicine): number {
  const cost = transactionItemCost(item, medicine);
  return markupPctFromPrice(Number(item.subtotal || 0), cost);
}
