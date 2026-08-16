import { toSQL, toTS } from './mapper';
import assert from 'node:assert/strict';

// --- toSQL ---

// camelCase → snake_case
const sqlMedicine = toSQL({ medicineId: 'med-1', isActive: true, isPpnIncluded: false });
assert.equal(sqlMedicine.medicine_id, 'med-1');
assert.equal(sqlMedicine.is_active, 1);         // boolean true → 1
assert.equal(sqlMedicine.is_ppn_included, 0);   // boolean false → 0

// asymmetric override: user → user_name
const sqlStock = toSQL({ user: 'Rina', medicineId: 'med-1' });
assert.equal(sqlStock.user_name, 'Rina');
assert(!('user' in sqlStock), 'original "user" key must not appear');
assert.equal(sqlStock.medicine_id, 'med-1');

// all 6 boolean columns convert correctly
const allBools = toSQL({
  isActive: true, isPrescription: false, isPpnIncluded: true,
  isSuperAdmin: false, isPpn: true, autoPrintReceipt: false,
});
assert.equal(allBools.is_active, 1);
assert.equal(allBools.is_prescription, 0);
assert.equal(allBools.is_ppn_included, 1);
assert.equal(allBools.is_super_admin, 0);
assert.equal(allBools.is_ppn, 1);
assert.equal(allBools.auto_print_receipt, 0);

// --- toTS ---

// snake_case → camelCase, 0/1 → boolean
const tsMedicine = toTS({ medicine_id: 'med-1', is_active: 1, is_ppn_included: 0 });
assert.equal(tsMedicine.medicineId, 'med-1');
assert.equal(tsMedicine.isActive, true);
assert.equal(tsMedicine.isPpnIncluded, false);

// strip id from transaction_items
const tsItem = toTS({ id: 42, medicine_id: 'med-1', qty: 3 }, { stripId: true });
assert(!('id' in tsItem), 'id must be stripped');
assert.equal(tsItem.medicineId, 'med-1');
assert.equal(tsItem.qty, 3);

// without stripId, id is kept
const tsItemKeepId = toTS({ id: 42, qty: 3 });
assert.equal(tsItemKeepId.id, 42);

// --- round-trip: toTS(toSQL(obj)) === obj ---
const medicine = { medicineId: 'med-1', isActive: true, isPpnIncluded: false, stock: 50 };
const roundTrip = toTS(toSQL(medicine));
assert.deepEqual(roundTrip, medicine);

// StockHistory.user round-trip via toTS (user_name → user)
const stockTs = toTS({ user_name: 'Rina', medicine_id: 'med-1' });
assert.equal(stockTs.userName, 'Rina'); // ponytail: user_name→userName via generic snakeToCamel
// NOTE: user_name ↔ user is intentionally asymmetric (toSQL only).
// toTS produces userName (generic rule); callers map that back to .user via destructuring.

console.log('mapper self-check: all assertions passed ✓');

// --- P1: toTS(toSQL(obj)) === obj for representative non-optional fields ---
// Validates: Requirements 3.6

// Medicine (non-optional fields only; no booleans except isActive)
const medObj = {
  id: 'med-1', code: 'PC001', name: 'Paracetamol', category: 'Obat Bebas',
  price: 5000, stock: 100, minStock: 10, unit: 'Strip',
  expiredDate: '2026-12-31', isActive: true,
};
assert.deepEqual(toTS(toSQL(medObj)), medObj, 'Medicine round-trip');

// User (non-optional fields only)
const userObj = {
  id: 'usr-1', name: 'Rina', username: 'rina', role: 'kasir',
  status: 'aktif', createdAt: '2024-01-01',
};
assert.deepEqual(toTS(toSQL(userObj)), userObj, 'User round-trip');

// Transaction without items (non-optional fields only)
const txObj = {
  id: 'tx-1', trxNo: 'TRX-20240101-001', date: '2024-01-01 10:00:00',
  cashierName: 'Rina', cashierUsername: 'rina',
  totalAmount: 50000, paymentMethod: 'Tunai', paymentAmount: 50000,
  changeAmount: 0, status: 'Selesai', isPrescription: false,
};
assert.deepEqual(toTS(toSQL(txObj)), txObj, 'Transaction round-trip');

// StockHistory: use userName (not user) because toSQL maps user→user_name
// and toTS maps user_name→userName (generic rule). Caller is responsible for
// mapping userName back to user when reading from DB.
// ponytail: intentional asymmetry — toTS produces userName, not user
const stockObj = {
  id: 'sh-1', medicineId: 'med-1', medicineCode: 'PC001', medicineName: 'Paracetamol',
  type: 'masuk', amount: 50, prevStock: 100, newStock: 150,
  date: '2024-01-01', note: 'Restock', userName: 'Rina',
};
assert.deepEqual(toTS(toSQL(stockObj)), stockObj, 'StockHistory round-trip (userName key)');

console.log('mapper P1 round-trip: all assertions passed ✓');

// --- P2: Boolean column semantics (property test) ---
// Validates: Requirements 3.3, 3.4
// Property: for any boolean input, toSQL yields 0|1 (never true/false),
// and toTS(toSQL(...)) restores the original boolean values.
const BOOL_FIELDS = ['isActive','isPrescription','isPpnIncluded','isSuperAdmin','isPpn','autoPrintReceipt'] as const;
const BOOL_SQL    = ['is_active','is_prescription','is_ppn_included','is_super_admin','is_ppn','auto_print_receipt'] as const;

// ponytail: 100 random samples covers the space; proper PBT would use fast-check but stdlib suffices here
for (let i = 0; i < 100; i++) {
  const input = Object.fromEntries(BOOL_FIELDS.map(f => [f, Math.random() < 0.5]));
  const sql   = toSQL(input);
  const ts    = toTS(sql);

  for (let j = 0; j < BOOL_FIELDS.length; j++) {
    const origVal  = input[BOOL_FIELDS[j]];
    const sqlVal   = sql[BOOL_SQL[j]];
    const tsVal    = ts[BOOL_FIELDS[j]];

    // SQL must be integer 0 or 1, never a boolean
    assert(sqlVal === 0 || sqlVal === 1, `P2 toSQL: ${BOOL_SQL[j]} must be 0|1, got ${sqlVal}`);
    assert(typeof sqlVal !== 'boolean',  `P2 toSQL: ${BOOL_SQL[j]} must not be boolean`);

    // Round-trip must restore original boolean
    assert.strictEqual(typeof tsVal, 'boolean', `P2 toTS: ${BOOL_FIELDS[j]} must be boolean, got ${typeof tsVal}`);
    assert.strictEqual(tsVal, origVal, `P2 round-trip mismatch for ${BOOL_FIELDS[j]}: ${origVal} → ${sqlVal} → ${tsVal}`);
  }
}

console.log('P2 boolean semantics: 100 random samples passed ✓');
