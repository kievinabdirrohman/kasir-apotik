import assert from 'node:assert/strict';
import { findCustomPriceForUnit, hasMedicinePriceSourceConflict, markupPctFromPrice, medicineBaseUnitName, medicineSellingPriceEntries, medicineUnitPackageCost, priceFromMarkup, synchronizePrimaryUnit, transactionItemBaseDisplayLabel, transactionItemBaseQuantity, transactionItemDisplayLabel, transactionItemPriceTypeLabel, type MedicineUnitDraft } from '../src/utils/unitConversion.js';
import { formatTransactionCustomer } from '../src/utils/formatters.js';

const rows: MedicineUnitDraft[] = [
  { id: 'box', unit: 'Box', multiplierToBase: 100, sortOrder: 0, isPrimary: true },
  { id: 'pcs', unit: 'Pcs', multiplierToBase: 1, sortOrder: 1, isPrimary: false },
];

const selectedExistingUnit = synchronizePrimaryUnit(rows, 'Pcs');
assert.equal(selectedExistingUnit[0].unit, 'Pcs');
assert.equal(selectedExistingUnit[0].id, 'pcs');
assert.equal(selectedExistingUnit[0].multiplierToBase, 1);
assert.equal(selectedExistingUnit[1].unit, 'Box');
assert.equal(selectedExistingUnit.filter(unit => unit.isPrimary).length, 1);

const selectedNewUnit = synchronizePrimaryUnit(rows, 'Botol');
assert.equal(selectedNewUnit[0].unit, 'Botol');
assert.equal(selectedNewUnit[0].multiplierToBase, 100);

const stripPrice = findCustomPriceForUnit([
  { unitId: 'pcs', unitName: 'Pcs', quantity: 1, totalPrice: 1000, sortOrder: 0 },
  { unitId: 'strip', unitName: 'Strip', quantity: 1, totalPrice: 9000, sortOrder: 1 },
], { id: 'strip', unit: 'Strip' });
assert.equal(stripPrice?.totalPrice, 9000);
assert.equal(findCustomPriceForUnit([
  { unitId: 'pcs', unitName: 'Pcs', quantity: 1, totalPrice: 1000, sortOrder: 0 },
], { id: 'strip', unit: 'Strip' }), undefined);

assert.equal(transactionItemBaseQuantity({ qty: 2, pricingMode: 'custom', customQuantity: 2, unitMultiplier: 100 }), 400);
assert.equal(transactionItemDisplayLabel({ qty: 1, pricingMode: 'custom', customQuantity: 2, customUnit: 'Box', unit: 'Box' }), '2 Box');
assert.equal(transactionItemDisplayLabel({ qty: 3, pricingMode: 'normal', unit: 'Strip' }), '3 Strip');
const baseUnitMedicine = {
  id: 'base-unit-medicine', unit: 'Box', unitMultiplier: 100, price: 190000, purchasePrice: 100000,
  units: [
    { id: 'tablet', medicineId: 'base-unit-medicine', unit: 'Tablet', multiplierToBase: 1, sortOrder: 1 },
    { id: 'box', medicineId: 'base-unit-medicine', unit: 'Box', multiplierToBase: 100, sortOrder: 0, isPrimary: true },
  ],
};
assert.equal(medicineBaseUnitName(baseUnitMedicine), 'Tablet');
assert.equal(transactionItemBaseDisplayLabel({ qty: 2, pricingMode: 'custom', customQuantity: 2, unitMultiplier: 100 }, baseUnitMedicine), 'Stok dasar: 400 Tablet');
assert.equal(transactionItemPriceTypeLabel({ qty: 1, unit: 'Tablet', unitMultiplier: 1, pricingMode: 'normal', priceSource: 'normal' }), 'Harga Normal');
assert.equal(transactionItemPriceTypeLabel({ qty: 1, unit: 'Tablet', unitMultiplier: 1, pricingMode: 'normal', priceSource: 'customer' }), 'Harga Customer');
const customReportLine = { qty: 1, unit: 'Box', unitMultiplier: 10, pricingMode: 'custom' as const, customQuantity: 2, customUnit: 'Box', priceSource: 'normal' as const };
const customReportMedicine = { ...baseUnitMedicine, units: [
  { id: 'report-pcs', medicineId: 'base-unit-medicine', unit: 'Pcs', multiplierToBase: 1, sortOrder: 0 },
  { id: 'report-box', medicineId: 'base-unit-medicine', unit: 'Box', multiplierToBase: 10, sortOrder: 1 },
] };
assert.equal(transactionItemPriceTypeLabel(customReportLine, customReportMedicine), 'Harga Normal · 2 Box · Stok dasar: 20 Pcs');
assert.equal(transactionItemPriceTypeLabel({ ...customReportLine, priceSource: 'customer' as const }, customReportMedicine), 'Harga Customer · 2 Box · Stok dasar: 20 Pcs');
assert.equal(transactionItemPriceTypeLabel(customReportLine, customReportMedicine).includes('Multiple'), false);
assert.equal(formatTransactionCustomer({ customerName: 'Apotek A', customerMemberNo: 'MBR-001' }), 'Apotek A (MBR-001)');
assert.equal(formatTransactionCustomer({}), 'Customer Umum');

const customBox = { unit: 'Box', multiplierToBase: 10, purchasePricePerBase: 400 };
const customBoxCost = medicineUnitPackageCost(customBox, 1, 0, 1000);
assert.equal(customBoxCost, 400);
assert.equal(medicineUnitPackageCost({ ...customBox, multiplierToBase: 1 }, 1, 0, 1000), customBoxCost);
assert.equal(markupPctFromPrice(400, customBoxCost), 0);
assert.equal(priceFromMarkup(customBoxCost, 10), 440);
assert.equal(medicineUnitPackageCost(customBox, 2, 50, 1000), 900);
assert.equal(medicineUnitPackageCost({ ...customBox, purchasePricePerBase: 0 }, 1, 0, 1000), 1000);

const normalPcsLine = { medicineId: 'med-a', unitId: 'pcs', pricingMode: 'normal' as const, priceSource: 'normal' as const };
const customerPcsLine = { ...normalPcsLine, priceSource: 'customer' as const };
const normalBoxLine = { ...normalPcsLine, unitId: 'box' };
const customerBoxLine = { ...normalBoxLine, priceSource: 'customer' as const };
const customALine = { medicineId: 'med-a', unitId: 'box', pricingMode: 'custom' as const, customPriceId: 'custom-a', priceSource: 'normal' as const };
const customerCustomALine = { ...customALine, priceSource: 'customer' as const };
const customerCustomBLine = { ...customerCustomALine, customPriceId: 'custom-b' };
assert.equal(hasMedicinePriceSourceConflict([normalPcsLine], customerPcsLine), true);
assert.equal(hasMedicinePriceSourceConflict([customerPcsLine], normalPcsLine), true);
assert.equal(hasMedicinePriceSourceConflict([normalPcsLine], customerBoxLine), false);
assert.equal(hasMedicinePriceSourceConflict([normalPcsLine], customerCustomALine), false);
assert.equal(hasMedicinePriceSourceConflict([customALine], customerCustomALine), true);
assert.equal(hasMedicinePriceSourceConflict([customALine], customerCustomBLine), false);
assert.equal(hasMedicinePriceSourceConflict([normalBoxLine], { ...normalBoxLine }), false);
assert.equal(hasMedicinePriceSourceConflict([normalPcsLine], { ...customerPcsLine, medicineId: 'med-b' }), false);
assert.equal(hasMedicinePriceSourceConflict([{ medicineId: 'med-a', unitId: 'pcs' }], customerPcsLine), true);

const priceEntries = medicineSellingPriceEntries({
  id: 'med-price', unit: 'Pcs', unitMultiplier: 1, price: 1000, purchasePrice: 400,
  units: [
    { id: 'price-pcs', medicineId: 'med-price', unit: 'Pcs', multiplierToBase: 1, sortOrder: 0, isPrimary: true },
    { id: 'price-box', medicineId: 'med-price', unit: 'Box', multiplierToBase: 10, sortOrder: 1, sellingPrice: 5000, customerPrices: [{ customerId: 'cust-b', price: 4500 }, { customerId: 'cust-a', price: 4400 }] },
  ],
  normalCustomerPrices: [{ customerId: 'cust-a', price: 900 }, { customerId: 'cust-b', price: 850 }],
  customPrices: [{ id: 'custom-box-2', unitId: 'price-box', quantity: 2, totalPrice: 8000, sortOrder: 0, customerPrices: [{ customerId: 'cust-a', price: 7500 }, { customerId: 'cust-b', price: 7400 }] }],
}, new Map([['cust-a', 'Apotek A'], ['cust-b', 'Apotek B']]));
assert.deepEqual(priceEntries.map(entry => [entry.label, entry.price]), [
  ['Normal · Pcs', 1000],
  ['Customer · Pcs', 900],
  ['Normal · Box', 5000],
  ['Customer · Box', 4500],
  ['Custom · 2 Box', 8000],
  ['Customer · 2 Box', 7500],
]);

console.log('Primary unit synchronization test passed.');
