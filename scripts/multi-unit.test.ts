import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyMigrations, createServerApp } from '../src/server/app.js';
import { medicineSellingPriceEntries } from '../src/utils/unitConversion.js';

const dbPath = path.join(os.tmpdir(), `apotek-multi-unit-${Date.now()}.db`);
const { app, db } = createServerApp({ dbPath });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', () => resolve()));
const port = (server.address() as { port: number }).port;
const api = `http://127.0.0.1:${port}`;

async function request(pathname: string, init?: RequestInit): Promise<any> {
  const response = await fetch(api + pathname, { headers: { 'content-type': 'application/json' }, ...init });
  const body = await response.json();
  assert.equal(response.ok, true, `${pathname}: ${body.error || response.status}`);
  return body.data;
}

async function requestRaw(pathname: string, init?: RequestInit): Promise<{ response: Response; body: any }> {
  const response = await fetch(api + pathname, { headers: { 'content-type': 'application/json' }, ...init });
  return { response, body: await response.json() };
}

try {
  const customer = await request('/api/customers', { method: 'POST', body: JSON.stringify({ memberNo: 'MBR-UNIT-001', name: 'Customer Unit', phone: '08123', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-08-25' }) });
  const lusinMedicine = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-lusin', code: 'MU-LUSIN', name: 'Lusin Test', category: 'Obat Bebas', price: 12000, purchasePrice: 6000,
      stock: 120, minStock: 5, unit: 'Lusin', unitMultiplier: 12, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'mu-lusin-base', unit: 'Pcs', multiplierToBase: 1, isPrimary: false },
        { id: 'mu-lusin-unit', unit: 'Lusin', multiplierToBase: 6, isPrimary: true },
      ],
    }),
  });
  assert.equal(lusinMedicine.units.find((unit: any) => unit.unit === 'Lusin').multiplierToBase, 12);
  assert.equal(lusinMedicine.units.find((unit: any) => unit.unit === 'Pcs').purchasePricePerBase, 500);
  assert.equal(lusinMedicine.units.find((unit: any) => unit.unit === 'Lusin').purchasePricePerBase, 500);
  const medicine = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      code: 'MU-001', name: 'Multi Unit Test', category: 'Obat Bebas', price: 1000, purchasePrice: 500,
      stock: 1000, minStock: 5, unit: 'Box', unitMultiplier: 100, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'mu-pcs', unit: 'Pcs', multiplierToBase: 1, pricePerBase: 1000, purchasePricePerBase: 500, isPrimary: false },
        { id: 'mu-strip', unit: 'Strip', multiplierToBase: 10, pricePerBase: 900, purchasePricePerBase: 450, isPrimary: false },
        { id: 'mu-box', unit: 'Box', multiplierToBase: 100, pricePerBase: 800, purchasePricePerBase: 400, isPrimary: true, customerPrices: [{ customerId: customer.id, price: 700, inheritParent: false }] },
      ],
      customPrices: [
        { id: 'mu-custom-box-2', unitId: 'mu-box', quantity: 2, totalPrice: 190000, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 180000, inheritParent: false }] },
        { id: 'mu-custom-strip-10', unitId: 'mu-strip', quantity: 10, totalPrice: 80000, sortOrder: 1 },
      ],
    }),
  });
  assert.equal(medicine.units.length, 3);
  assert.equal(medicine.units[0].id, 'mu-box');
  assert.equal(medicine.units[0].isPrimary, true);
  assert.equal(medicine.units.find((unit: any) => unit.id === 'mu-strip').pricePerBase, 900);
  assert.deepEqual(medicine.units.map((unit: any) => unit.purchasePricePerBase), [5, 5, 5]);
  db.prepare('UPDATE medicine_units SET purchase_price_per_base = 999 WHERE medicine_id = ?').run(medicine.id);
  applyMigrations(db);
  assert.deepEqual(
    (db.prepare('SELECT purchase_price_per_base FROM medicine_units WHERE medicine_id = ? ORDER BY sort_order').all(medicine.id) as Array<{ purchase_price_per_base: number }>).map(unit => unit.purchase_price_per_base),
    [5, 5, 5],
  );
  assert.equal(medicine.customPrices.length, 2);
  assert.equal(medicine.customPrices[0].customerPrices[0].price, 180000);
  const restockCustomPrice = medicine.customPrices.find((price: any) => price.unitName === 'Box');
  const restockCompatibility = await request(`/api/medicines/${medicine.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      units: medicine.units,
      normalCustomerPrices: medicine.normalCustomerPrices,
      customPrices: medicine.customPrices.map((price: any) => ({
        ...price,
        // Stock In can retain the unit name when a legacy/stale unit ID is present.
        unitId: price === restockCustomPrice ? price.unitName : price.unitId,
        customerPrices: price.customerPrices.map((customerPrice: any) => ({ customerId: customerPrice.customerId, price: customerPrice.price })),
      })),
    }),
  });
  assert.equal(restockCompatibility.customPrices[0].unitId, 'mu-box');
  assert.equal(restockCompatibility.customPrices.find((price: any) => price.unitName === 'Box').customerPrices[0].price, 180000);
  const staleUnitIdCompatibility = await request(`/api/medicines/${medicine.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      // Simulate Stock In rebuilding unit rows without preserving their IDs.
      units: medicine.units.map(({ id, ...unit }: any) => unit),
      normalCustomerPrices: restockCompatibility.normalCustomerPrices,
      customPrices: restockCompatibility.customPrices.map((price: any) => ({
        id: price.id,
        // Keep the old unit ID while both package rows are saved again.
        unitId: price.unitId,
        quantity: price.quantity,
        totalPrice: price.totalPrice,
        sortOrder: price.sortOrder,
        isActive: price.isActive,
        customerPrices: [{ customerId: customer.id, price: price.unitName === 'Box' ? 180000 : 75000, inheritParent: false }],
      })),
    }),
  });
  assert.deepEqual(staleUnitIdCompatibility.customPrices.map((price: any) => price.unitName), ['Box', 'Strip']);
  assert.deepEqual(staleUnitIdCompatibility.customPrices.map((price: any) => price.unitId), ['mu-box', 'mu-strip']);
  assert.equal(staleUnitIdCompatibility.customPrices.find((price: any) => price.unitName === 'Strip').customerPrices[0].price, 75000);
  const prices = await request(`/api/medicine_customer_prices?medicine_id=${medicine.id}`);
  assert.equal(prices[0].unitId, 'mu-box');

  const endpointCustom = await request('/api/medicine_custom_prices', {
    method: 'POST',
    body: JSON.stringify({ medicineId: medicine.id, unitId: 'mu-strip', quantity: 2, totalPrice: 1800, customerIds: [customer.id], customerPrice: 1500, inheritParent: false }),
  });
  assert.equal(endpointCustom.quantity, 2);
  assert.equal(endpointCustom.customerPrices[0].price, 1500);
  const endpointCustomUpdated = await request(`/api/medicine_custom_prices/${endpointCustom.id}`, {
    method: 'PUT',
    body: JSON.stringify({ totalPrice: 1700, applyAll: true, customerPrice: 1400, inheritParent: false }),
  });
  assert.equal(endpointCustomUpdated.totalPrice, 1700);
  assert.equal(endpointCustomUpdated.customerPrices[0].price, 1400);
  await request(`/api/medicine_custom_prices/${endpointCustom.id}`, { method: 'DELETE' });

  const mixedTransaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-multi-mixed', trxNo: 'TRX-MULTI-002', date: '2026-08-25 09:00:00',
      cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 11000,
      paymentMethod: 'Tunai', paymentAmount: 11000, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [
        { medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Pcs', unitId: 'mu-pcs', price: 1000, qty: 2, subtotal: 2000, unitMultiplier: 1, purchasePrice: 500, priceSource: 'normal' },
        { medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Strip', unitId: 'mu-strip', price: 900, qty: 1, subtotal: 9000, unitMultiplier: 10, purchasePrice: 450, priceSource: 'normal' },
      ],
    }),
  });
  assert.equal(mixedTransaction.items.length, 2);
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 988);
  await request('/api/transactions/tx-multi-mixed/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const overstockedCombined = await requestRaw('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-multi-overstock', trxNo: 'TRX-MULTI-OVERSTOCK', date: '2026-08-25 09:30:00',
      cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 90000,
      paymentMethod: 'Tunai', paymentAmount: 90000, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [
        { medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'mu-box', price: 1000, qty: 10, subtotal: 10000, unitMultiplier: 100, purchasePrice: 400, priceSource: 'normal', pricingMode: 'normal' },
        { medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Strip', unitId: 'mu-strip', price: 80000, qty: 1, subtotal: 80000, unitMultiplier: 10, purchasePrice: 450, priceSource: 'normal', pricingMode: 'custom', customPriceId: 'mu-custom-strip-10', customQuantity: 10, customUnit: 'Strip', customTotalPrice: 80000 },
      ],
    }),
  });
  assert.equal(overstockedCombined.response.ok, false);
  assert.match(String(overstockedCombined.body.error), /stok item tidak mencukupi/i);
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const transaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-multi-unit', trxNo: 'TRX-MULTI-001', date: '2026-08-25 10:00:00',
      customerId: customer.id, cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 70000,
      paymentMethod: 'Tunai', paymentAmount: 70000, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [{ medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'mu-box', price: 700, qty: 1, subtotal: 70000, unitMultiplier: 100, purchasePrice: 400, customerId: customer.id, customerName: customer.name, priceSource: 'customer' }],
    }),
  });
  assert.equal(transaction.items[0].subtotal, 70000);
  assert.equal(transaction.items[0].unitId, 'mu-box');
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 900);

  await request('/api/transactions/tx-multi-unit/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const normalTransaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-normal-package', trxNo: 'TRX-NORMAL-001', date: '2026-08-25 10:30:00',
      cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 1000,
      paymentMethod: 'Tunai', paymentAmount: 1000, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [{ medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'mu-box', price: 1000, qty: 1, subtotal: 1000, unitMultiplier: 100, purchasePrice: 400, priceSource: 'normal', pricingMode: 'normal' }],
    }),
  });
  assert.equal(normalTransaction.items[0].pricingMode, 'normal');
  assert.equal(normalTransaction.items[0].price, 1000);
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 900);
  await request('/api/transactions/tx-normal-package/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const normalCustomerTransaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-normal-customer', trxNo: 'TRX-NORMAL-CUSTOMER-001', date: '2026-08-25 10:45:00',
      customerId: customer.id, customerName: customer.name, cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 700,
      paymentMethod: 'Tunai', paymentAmount: 700, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [{ medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'mu-box', price: 700, qty: 1, subtotal: 700, unitMultiplier: 100, purchasePrice: 400, priceSource: 'customer', pricingMode: 'normal', customerId: customer.id, customerName: customer.name }],
    }),
  });
  assert.equal(normalCustomerTransaction.items[0].priceSource, 'customer');
  assert.equal(normalCustomerTransaction.items[0].price, 700);
  await request('/api/transactions/tx-normal-customer/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const customTransaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-custom-package', trxNo: 'TRX-CUSTOM-001', date: '2026-08-25 11:00:00',
      customerId: customer.id, cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 360000,
      paymentMethod: 'Tunai', paymentAmount: 360000, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [{ medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'mu-box', price: 180000, qty: 2, subtotal: 360000, unitMultiplier: 100, purchasePrice: 400, priceSource: 'customer', pricingMode: 'custom', customPriceId: 'mu-custom-box-2', customQuantity: 2, customUnit: 'Box', customTotalPrice: 180000, customerId: customer.id, customerName: customer.name }],
    }),
  });
  assert.equal(customTransaction.items[0].pricingMode, 'custom');
  assert.equal(customTransaction.items[0].customQuantity, 2);
  assert.equal(customTransaction.items[0].subtotal, 360000);
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 600);
  await request('/api/transactions/tx-custom-package/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get(medicine.id) as { stock: number }).stock, 1000);

  const exactStockInPayload = await request(`/api/medicines/${medicine.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      price: 9240,
      purchasePrice: 7000,
      units: [
        { id: 'mu-pcs', medicineId: medicine.id, unit: 'Pcs', multiplierToBase: 1, sortOrder: 0, pricePerBase: 9240, purchasePricePerBase: 7000, isPrimary: true },
        { medicineId: medicine.id, unit: 'Sachet', multiplierToBase: 2333, sortOrder: 1, pricePerBase: 400, marginPct: 12, bhpAmount: 8, isPrimary: false },
      ],
      customPrices: [{
        unitId: 'Sachet', unitName: 'Sachet', quantity: 1, totalPrice: 22232, sortOrder: 0, isActive: true,
        customerPrices: [{ customerId: customer.id, price: 222, inheritParent: false }],
      }],
      normalCustomerPrices: [],
    }),
  });
  assert.equal(exactStockInPayload.customPrices[0].unitName, 'Sachet');
  assert.equal(exactStockInPayload.customPrices[0].customerPrices[0].price, 222);
  assert.deepEqual(
    exactStockInPayload.units.find((unit: any) => unit.unit === 'Sachet') && [
      exactStockInPayload.units.find((unit: any) => unit.unit === 'Sachet').sellingPrice,
      exactStockInPayload.units.find((unit: any) => unit.unit === 'Sachet').marginPct,
      exactStockInPayload.units.find((unit: any) => unit.unit === 'Sachet').bhpAmount,
    ],
    [0, 12, 8],
  );

  const marginMedicine = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-margin', code: 'MU-MARGIN', name: 'Margin Snapshot Test', category: 'Obat Bebas',
      price: 1100, purchasePrice: 500, bhpAmount: 100, marginPct: 100,
      stock: 1000, minStock: 5, unit: 'Pcs', unitMultiplier: 1, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'mm-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 500, sellingPrice: 1100, marginPct: 100, bhpAmount: 100, isPrimary: true },
        { id: 'mm-box', unit: 'Box', multiplierToBase: 10, purchasePricePerBase: 200, sellingPrice: 5000, marginPct: 138.095238, bhpAmount: 100, isPrimary: false, customerPrices: [{ customerId: customer.id, price: 4800, marginPct: 140, bhpAmount: 70, inheritParent: false }] },
      ],
      normalCustomerPrices: [{ customerId: customer.id, price: 900, marginPct: 50, bhpAmount: 50, inheritParent: false }],
      customPrices: [{ id: 'mm-custom', unitId: 'mm-box', quantity: 2, totalPrice: 5000, marginPct: 25, bhpAmount: 0, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 4500, marginPct: 7.142857, bhpAmount: 100, inheritParent: false }] }],
    }),
  });
  assert.equal(marginMedicine.normalCustomerPrices[0].marginPct, 50);
  assert.equal(marginMedicine.normalCustomerPrices[0].bhpAmount, 50);
  assert.equal(marginMedicine.units.find((unit: any) => unit.id === 'mm-box').marginPct, 138.095238);
  assert.equal(marginMedicine.units.find((unit: any) => unit.id === 'mm-box').sellingPrice, 5000);
  assert.equal(marginMedicine.units.find((unit: any) => unit.id === 'mm-box').customerPrices[0].bhpAmount, 70);
  assert.deepEqual(marginMedicine.units.map((unit: any) => unit.purchasePricePerBase), [500, 500]);
  assert.equal(marginMedicine.customPrices[0].customerPrices[0].marginPct, 7.142857);
  assert.equal(marginMedicine.customPrices[0].bhpAmount, 0);
  assert.equal(marginMedicine.customPrices[0].customerPrices[0].bhpAmount, 100);

  const marginTransaction = await request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      id: 'tx-margin-snapshot', trxNo: 'TRX-MARGIN-001', date: '2026-08-25 12:00:00',
      customerId: customer.id, customerName: customer.name, cashierName: 'Kasir', cashierUsername: 'kasir', totalAmount: 15600,
      paymentMethod: 'Tunai', paymentAmount: 15600, changeAmount: 0, status: 'Selesai', isPrescription: false,
      items: [
        { medicineId: 'mu-margin', medicineCode: 'MU-MARGIN', medicineName: 'Margin Snapshot Test', unit: 'Pcs', unitId: 'mm-pcs', price: 1100, qty: 1, subtotal: 1100, unitMultiplier: 1, purchasePrice: 500, bhpAmount: 100, marginPct: 100, priceSource: 'normal', pricingMode: 'normal' },
        { medicineId: 'mu-margin', medicineCode: 'MU-MARGIN', medicineName: 'Margin Snapshot Test', unit: 'Box', unitId: 'mm-box', price: 5000, qty: 1, subtotal: 5000, unitMultiplier: 10, purchasePrice: 200, bhpAmount: 100, marginPct: 138.095238, priceSource: 'normal', pricingMode: 'normal' },
        { medicineId: 'mu-margin', medicineCode: 'MU-MARGIN', medicineName: 'Margin Snapshot Test', unit: 'Box', unitId: 'mm-box', price: 5000, qty: 1, subtotal: 5000, unitMultiplier: 10, purchasePrice: 200, bhpAmount: 0, marginPct: 25, priceSource: 'normal', pricingMode: 'custom', customPriceId: 'mm-custom', customQuantity: 2, customUnit: 'Box', customTotalPrice: 5000 },
        { medicineId: 'mu-margin', medicineCode: 'MU-MARGIN', medicineName: 'Margin Snapshot Test', unit: 'Box', unitId: 'mm-box', price: 4500, qty: 1, subtotal: 4500, unitMultiplier: 10, purchasePrice: 200, bhpAmount: 100, marginPct: 7.142857, priceSource: 'customer', pricingMode: 'custom', customPriceId: 'mm-custom', customQuantity: 2, customUnit: 'Box', customTotalPrice: 4500, customerId: customer.id, customerName: customer.name },
      ],
    }),
  });
  assert.deepEqual(marginTransaction.items.map((item: any) => item.profitAmount), [500, -100, -5000, -5700]);
  assert.deepEqual(marginTransaction.items.map((item: any) => item.bhpAmount), [100, 100, 0, 100]);
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get('mu-margin') as { stock: number }).stock, 949);

  await request('/api/medicines/mu-margin', { method: 'PUT', body: JSON.stringify({ price: 999999, purchasePrice: 600, marginPct: 999 }) });
  assert.deepEqual(
    (db.prepare('SELECT purchase_price_per_base FROM medicine_units WHERE medicine_id = ? ORDER BY sort_order').all('mu-margin') as Array<{ purchase_price_per_base: number }>).map(unit => unit.purchase_price_per_base),
    [600, 600],
  );
  const historicalMarginTransaction = (await request('/api/transactions')).find((tx: any) => tx.id === 'tx-margin-snapshot');
  assert.equal(historicalMarginTransaction.items[0].price, 1100);
  assert.deepEqual(historicalMarginTransaction.items.map((item: any) => item.profitAmount), [500, -100, -5000, -5700]);
  await request('/api/transactions/tx-margin-snapshot/cancel', { method: 'PUT', body: JSON.stringify({ cancel_reason: 'test', cancelled_by: 'test' }) });
  assert.equal((db.prepare('SELECT stock FROM medicines WHERE id = ?').get('mu-margin') as { stock: number }).stock, 1000);

  const linkedMedicine = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-linked-parent', code: 'MU-LINKED', name: 'Linked Parent Test', category: 'Obat Bebas',
      price: 1000, purchasePrice: 400, marginPct: 25, bhpAmount: 50,
      stock: 1000, minStock: 5, unit: 'Pcs', unitMultiplier: 1, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'ml-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 400, sellingPrice: 1000, marginPct: 25, bhpAmount: 50, isPrimary: true },
        { id: 'ml-box', unit: 'Box', multiplierToBase: 10, purchasePricePerBase: 40, sellingPrice: 9000, marginPct: 125, bhpAmount: 20, isPrimary: false, customerPrices: [{ customerId: customer.id, price: 1, marginPct: 0, bhpAmount: 0, inheritParent: true }] },
      ],
      normalCustomerPrices: [{ customerId: customer.id, price: 1, marginPct: 0, bhpAmount: 0, inheritParent: true }],
      customPrices: [{ id: 'ml-custom', unitId: 'ml-box', quantity: 2, totalPrice: 17000, marginPct: 100, bhpAmount: 15, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 1, marginPct: 0, bhpAmount: 0, inheritParent: true }] }],
    }),
  });
  assert.deepEqual(
    [linkedMedicine.normalCustomerPrices[0].price, linkedMedicine.normalCustomerPrices[0].marginPct, linkedMedicine.normalCustomerPrices[0].bhpAmount],
    [1000, 25, 50],
  );
  assert.equal(linkedMedicine.normalCustomerPrices[0].inheritParent, false);
  assert.deepEqual(
    [linkedMedicine.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].price, linkedMedicine.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].marginPct, linkedMedicine.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].bhpAmount],
    [9000, 125, 20],
  );
  assert.deepEqual(
    [linkedMedicine.customPrices[0].customerPrices[0].price, linkedMedicine.customPrices[0].customerPrices[0].marginPct, linkedMedicine.customPrices[0].customerPrices[0].bhpAmount],
    [17000, 100, 15],
  );

  const linkedRootChanged = await request('/api/medicines/mu-linked-parent', {
    method: 'PUT',
    body: JSON.stringify({ price: 2000, marginPct: 40, bhpAmount: 60 }),
  });
  assert.deepEqual(
    [linkedRootChanged.normalCustomerPrices[0].price, linkedRootChanged.normalCustomerPrices[0].marginPct, linkedRootChanged.normalCustomerPrices[0].bhpAmount],
    [1000, 25, 50],
  );
  assert.deepEqual(
    [linkedRootChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].price, linkedRootChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].marginPct, linkedRootChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].bhpAmount],
    [9000, 125, 20],
  );

  const isolatedNormal = await request('/api/medicines/mu-linked-parent', {
    method: 'PUT',
    body: JSON.stringify({ normalCustomerPrices: [{ customerId: customer.id, price: 777, marginPct: 7, bhpAmount: 3, inheritParent: false }] }),
  });
  assert.equal(isolatedNormal.normalCustomerPrices[0].inheritParent, false);
  const isolatedRootChanged = await request('/api/medicines/mu-linked-parent', {
    method: 'PUT',
    body: JSON.stringify({ price: 3000, marginPct: 50, bhpAmount: 70 }),
  });
  assert.deepEqual(
    [isolatedRootChanged.normalCustomerPrices[0].price, isolatedRootChanged.normalCustomerPrices[0].marginPct, isolatedRootChanged.normalCustomerPrices[0].bhpAmount],
    [777, 7, 3],
  );

  const unitAndCustomChanged = await request('/api/medicines/mu-linked-parent', {
    method: 'PUT',
    body: JSON.stringify({
      units: isolatedRootChanged.units.map((unit: any) => unit.id === 'ml-box'
        ? { ...unit, sellingPrice: 12000, marginPct: 200, bhpAmount: 30, customerPrices: [{ customerId: customer.id, price: 1, marginPct: 0, bhpAmount: 0, inheritParent: true }] }
        : unit),
      customPrices: isolatedRootChanged.customPrices.map((price: any) => ({
        ...price,
        totalPrice: 22000,
        marginPct: 110,
        bhpAmount: 25,
        customerPrices: [{ customerId: customer.id, price: 1, marginPct: 0, bhpAmount: 0, inheritParent: true }],
      })),
    }),
  });
  assert.deepEqual(
    [unitAndCustomChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].price, unitAndCustomChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].marginPct, unitAndCustomChanged.units.find((unit: any) => unit.id === 'ml-box').customerPrices[0].bhpAmount],
    [12000, 200, 30],
  );
  assert.deepEqual(
    [unitAndCustomChanged.customPrices[0].customerPrices[0].price, unitAndCustomChanged.customPrices[0].customerPrices[0].marginPct, unitAndCustomChanged.customPrices[0].customerPrices[0].bhpAmount],
    [22000, 110, 25],
  );

  const defaultLinkedCustomer = await request('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ memberNo: 'MBR-UNIT-002', name: 'Default Linked Customer', phone: '08124', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-08-25' }),
  });
  const defaultLinkedNormal = await request('/api/medicine_customer_prices', {
    method: 'POST',
    body: JSON.stringify({ medicineId: linkedMedicine.id, unitId: 'ml-pcs', customerId: defaultLinkedCustomer.id, price: 1, marginPct: 1, bhpAmount: 1, inheritParent: true }),
  });
  assert.equal(defaultLinkedNormal.inheritParent, false);
  assert.equal(defaultLinkedNormal.price, 3000);
  const defaultLinkedRootChanged = await request('/api/medicines/mu-linked-parent', {
    method: 'PUT',
    body: JSON.stringify({ price: 3100 }),
  });
  assert.equal(defaultLinkedRootChanged.normalCustomerPrices.find((price: any) => price.customerId === defaultLinkedCustomer.id).price, 3000);

  const defaultLinkedCustom = await request('/api/medicine_custom_prices', {
    method: 'POST',
    body: JSON.stringify({ medicineId: linkedMedicine.id, unitId: 'ml-box', quantity: 3, totalPrice: 24000, customerIds: [customer.id], customerPrice: 1 }),
  });
  assert.equal(defaultLinkedCustom.customerPrices[0].inheritParent, true);
  assert.equal(defaultLinkedCustom.customerPrices[0].price, 24000);
  const defaultLinkedCustomChanged = await request(`/api/medicine_custom_prices/${defaultLinkedCustom.id}`, {
    method: 'PUT',
    body: JSON.stringify({ totalPrice: 25000 }),
  });
  assert.equal(defaultLinkedCustomChanged.customerPrices[0].price, 25000);

  const nonObat = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-non-obat', code: 'MU-NON-OBAT', name: 'Non Obat Customer Test', category: 'Barang Umum', itemType: 'non_obat',
      price: 5000, purchasePrice: 2500, stock: 100, minStock: 5, unit: 'Pcs', unitMultiplier: 1, expiredDate: '2030-01-01', isActive: true,
      units: [{ id: 'mno-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 2500, sellingPrice: 5000, marginPct: 20, bhpAmount: 25, isPrimary: true, customerPrices: [{ customerId: customer.id, price: 4500, marginPct: 15, bhpAmount: 20, inheritParent: false }] }],
      customPrices: [{ id: 'mno-custom', unitId: 'mno-pcs', quantity: 2, totalPrice: 9000, marginPct: 10, bhpAmount: 30, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 8000, marginPct: 5, bhpAmount: 15, inheritParent: false }] }],
    }),
  });
  assert.equal(nonObat.itemType, 'non_obat');

  const autoCustomer = await request('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ memberNo: 'MBR-UNIT-AUTO', name: 'Auto Price Customer', phone: '08125', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-08-25' }),
  });
  const autoNormal = db.prepare('SELECT price, margin_pct, bhp_amount, inherit_parent FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get(nonObat.id, autoCustomer.id) as Record<string, unknown>;
  assert.deepEqual(autoNormal, { price: 4500, margin_pct: 15, bhp_amount: 20, inherit_parent: 0 });
  const autoUnit = db.prepare('SELECT selling_price, margin_pct, bhp_amount, inherit_parent FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? AND customer_id = ?').get('mno-pcs', autoCustomer.id) as Record<string, unknown>;
  assert.equal(autoUnit, undefined);
  const autoCustom = db.prepare('SELECT total_price, margin_pct, bhp_amount, inherit_parent FROM medicine_custom_price_customers WHERE custom_price_id = ? AND customer_id = ?').get('mno-custom', autoCustomer.id) as Record<string, unknown>;
  assert.deepEqual(autoCustom, { total_price: 8000, margin_pct: 5, bhp_amount: 15, inherit_parent: 0 });
  const linkedAutoUnit = db.prepare('SELECT selling_price, margin_pct, bhp_amount, inherit_parent FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? AND customer_id = ?').get('ml-box', autoCustomer.id) as Record<string, unknown>;
  assert.deepEqual(linkedAutoUnit, { selling_price: 12000, margin_pct: 200, bhp_amount: 30, inherit_parent: 1 });
  const linkedAutoCustom = db.prepare('SELECT total_price, margin_pct, bhp_amount, inherit_parent FROM medicine_custom_price_customers WHERE custom_price_id = ? AND customer_id = ?').get('ml-custom', autoCustomer.id) as Record<string, unknown>;
  assert.deepEqual(linkedAutoCustom, { total_price: 22000, margin_pct: 110, bhp_amount: 25, inherit_parent: 1 });

  const legacyCustomer = await request('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ memberNo: 'MBR-UNIT-LEGACY', name: 'Legacy Sync Customer', phone: '08126', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-08-25' }),
  });
  await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-manual-sync', code: 'MU-MANUAL-SYNC', name: 'Manual Sync Test', category: 'Obat Bebas',
      price: 6000, purchasePrice: 3000, stock: 100, minStock: 5, unit: 'Box', unitMultiplier: 10, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'ms-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 300, sellingPrice: 700, marginPct: 100, bhpAmount: 5, isPrimary: false },
        { id: 'ms-box', unit: 'Box', multiplierToBase: 10, purchasePricePerBase: 300, sellingPrice: 6000, marginPct: 90, bhpAmount: 20, isPrimary: true, customerPrices: [{ customerId: customer.id, price: 5500, marginPct: 10, bhpAmount: 30, inheritParent: false }] },
      ],
      normalCustomerPrices: [{ customerId: customer.id, price: 5500, marginPct: 10, bhpAmount: 30, inheritParent: false }],
      customPrices: [{ id: 'ms-custom', unitId: 'ms-box', quantity: 2, totalPrice: 12000, marginPct: 20, bhpAmount: 40, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 10000, marginPct: 12, bhpAmount: 40, inheritParent: false }] }],
    }),
  });
  await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-manual-sync-non-obat', code: 'MU-MANUAL-NON-OBAT', name: 'Manual Sync Non Obat', category: 'Barang Umum', itemType: 'non_obat',
      price: 4500, purchasePrice: 2500, stock: 100, minStock: 5, unit: 'Pcs', unitMultiplier: 1, expiredDate: '2030-01-01', isActive: true,
      units: [{ id: 'ms-no-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 2500, sellingPrice: 4500, marginPct: 20, bhpAmount: 15, isPrimary: true, customerPrices: [{ customerId: customer.id, price: 4200, marginPct: 9, bhpAmount: 11, inheritParent: false }] }],
      normalCustomerPrices: [{ customerId: customer.id, price: 4200, marginPct: 9, bhpAmount: 11, inheritParent: false }],
    }),
  });

  const syncSummary = await request('/api/medicine_customer_prices/sync', { method: 'POST' });
  assert.ok(syncSummary.customersProcessed >= 4);
  assert.ok(syncSummary.totalInserted > 0);
  assert.deepEqual(
    db.prepare('SELECT price, margin_pct, bhp_amount, inherit_parent FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get('mu-manual-sync', legacyCustomer.id),
    { price: 5500, margin_pct: 10, bhp_amount: 30, inherit_parent: 0 },
  );
  assert.equal(
    db.prepare('SELECT id FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? AND customer_id = ?').get('ms-box', legacyCustomer.id),
    undefined,
  );
  assert.deepEqual(
    db.prepare('SELECT total_price, margin_pct, bhp_amount, inherit_parent FROM medicine_custom_price_customers WHERE custom_price_id = ? AND customer_id = ?').get('ms-custom', legacyCustomer.id),
    { total_price: 10000, margin_pct: 12, bhp_amount: 40, inherit_parent: 0 },
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? AND customer_id = ?').get('ms-pcs', legacyCustomer.id) as { count: number }).count,
    0,
  );
  assert.deepEqual(
    db.prepare('SELECT price, margin_pct, bhp_amount, inherit_parent FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get('mu-manual-sync-non-obat', legacyCustomer.id),
    { price: 4200, margin_pct: 9, bhp_amount: 11, inherit_parent: 0 },
  );
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get(lusinMedicine.id, legacyCustomer.id) as { count: number }).count,
    0,
  );
  assert.equal(
    db.prepare('SELECT id FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get('mu-linked-parent', autoCustomer.id),
    undefined,
  );

  const secondSyncSummary = await request('/api/medicine_customer_prices/sync', { method: 'POST' });
  assert.equal(secondSyncSummary.totalInserted, 0);

  const deleteNormalMedicine = await request('/api/medicines', {
    method: 'POST',
    body: JSON.stringify({
      id: 'mu-delete-normal', code: 'MU-DELETE-NORMAL', name: 'Delete Normal Customer Test', category: 'Obat Bebas',
      price: 6000, purchasePrice: 3000, stock: 100, minStock: 5, unit: 'Box', unitMultiplier: 10, expiredDate: '2030-01-01', isActive: true,
      units: [
        { id: 'mdn-box', unit: 'Box', multiplierToBase: 10, purchasePricePerBase: 300, sellingPrice: 6000, marginPct: 90, bhpAmount: 20, isPrimary: true, customerPrices: [{ customerId: customer.id, price: 5500, marginPct: 10, bhpAmount: 30, inheritParent: false }] },
        { id: 'mdn-pcs', unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: 300, sellingPrice: 700, marginPct: 100, bhpAmount: 5, isPrimary: false, customerPrices: [{ customerId: customer.id, price: 650, marginPct: 5, bhpAmount: 3, inheritParent: false }] },
      ],
      normalCustomerPrices: [{ customerId: customer.id, price: 5500, marginPct: 10, bhpAmount: 30, inheritParent: false }],
      customPrices: [{ id: 'mdn-custom', unitId: 'mdn-box', quantity: 2, totalPrice: 12000, marginPct: 20, bhpAmount: 40, sortOrder: 0, customerPrices: [{ customerId: customer.id, price: 10000, marginPct: 12, bhpAmount: 40, inheritParent: false }] }],
    }),
  });
  const savedWithoutNormal = await request('/api/medicines/mu-delete-normal', {
    method: 'PUT',
    body: JSON.stringify({ units: deleteNormalMedicine.units, normalCustomerPrices: [], customPrices: deleteNormalMedicine.customPrices }),
  });
  assert.equal(savedWithoutNormal.normalCustomerPrices.length, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM medicine_customer_prices WHERE medicine_id = ?').get('mu-delete-normal') as { count: number }).count, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM medicine_unit_customer_prices WHERE medicine_unit_id = ?').get('mdn-box') as { count: number }).count, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM medicine_unit_customer_prices WHERE medicine_unit_id = ?').get('mdn-pcs') as { count: number }).count, 1);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM medicine_custom_price_customers WHERE custom_price_id = ?').get('mdn-custom') as { count: number }).count, 1);
  const combinedAfterDelete = await request('/api/medicine_customer_prices?medicine_id=mu-delete-normal');
  assert.equal(combinedAfterDelete.some((row: any) => row.unitId === 'mdn-box'), false);
  assert.equal(combinedAfterDelete.some((row: any) => row.unitId === 'mdn-pcs'), true);
  assert.equal(medicineSellingPriceEntries(savedWithoutNormal).some((entry: any) => entry.kind === 'customer'), false);

  const restoredNormal = await request('/api/medicines/mu-delete-normal', {
    method: 'PUT',
    body: JSON.stringify({
      units: savedWithoutNormal.units,
      normalCustomerPrices: [{ customerId: customer.id, price: 5400, marginPct: 8, bhpAmount: 20, inheritParent: false }],
      customPrices: savedWithoutNormal.customPrices,
    }),
  });
  assert.deepEqual(restoredNormal.normalCustomerPrices.map((price: any) => [price.price, price.marginPct, price.bhpAmount, price.inheritParent]), [[5400, 8, 20, false]]);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM medicine_unit_customer_prices WHERE medicine_unit_id = ?').get('mdn-box') as { count: number }).count, 0);

  const emptyPriceCount = db.prepare(`SELECT COUNT(*) AS count FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?`).get(lusinMedicine.id, autoCustomer.id) as { count: number };
  const emptyUnitCount = db.prepare(`SELECT COUNT(*) AS count FROM medicine_unit_customer_prices WHERE medicine_id = ? AND customer_id = ?`).get(lusinMedicine.id, autoCustomer.id) as { count: number };
  const emptyCustomCount = db.prepare(`SELECT COUNT(*) AS count FROM medicine_custom_price_customers WHERE custom_price_id IN (SELECT id FROM medicine_custom_prices WHERE medicine_id = ?) AND customer_id = ?`).get(lusinMedicine.id, autoCustomer.id) as { count: number };
  assert.deepEqual([emptyPriceCount.count, emptyUnitCount.count, emptyCustomCount.count], [0, 0, 0]);

  const originalNormal = db.prepare('SELECT price, margin_pct, bhp_amount FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get('mu-linked-parent', customer.id) as Record<string, unknown>;
  const linkedAutoNormal = db.prepare('SELECT id FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get('mu-linked-parent', autoCustomer.id);
  assert.deepEqual(originalNormal, { price: 777, margin_pct: 7, bhp_amount: 3 });
  assert.equal(linkedAutoNormal, undefined, 'Divergent customer profiles must not choose an arbitrary template');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get(nonObat.id, autoCustomer.id) as { count: number }).count,
    1,
  );
  console.log('Multi-unit API: passed ✓');
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}
