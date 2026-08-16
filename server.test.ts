/**
 * server.test.ts — Property tests P4–P7, P10
 * Run: npx tsx server.test.ts
 *
 * Tests call transaction logic directly against an in-memory DB.
 * No HTTP server needed.
 */

import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSQL, toTS } from './src/mapper.js';

// ---------------------------------------------------------------------------
// DB factory — in-memory, schema applied, DROP TABLE lines stripped
// ---------------------------------------------------------------------------
function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'sqlite',
    'schema.sql',
  );
  const sql = fs
    .readFileSync(schemaPath, 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('DROP TABLE'))
    .join('\n')
    .replace(/CREATE TABLE (?!IF NOT EXISTS)/g, 'CREATE TABLE IF NOT EXISTS ');
  db.exec(sql);
  return db;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
function seedMedicine(db: Database.Database, id: string, stock: number): void {
  db.prepare(
    `INSERT INTO medicines
       (id, code, name, category, price, stock, min_stock, unit, expired_date, is_active)
     VALUES
       (@id, @code, @name, @category, @price, @stock, @min_stock, @unit, @expired_date, @is_active)`,
  ).run({
    id,
    code: 'MED-' + id,
    name: 'Test Med',
    category: 'Obat Bebas',
    price: 1000,
    stock,
    min_stock: 5,
    unit: 'Tablet',
    expired_date: '2030-01-01',
    is_active: 1,
  });
}

function seedTransaction(
  db: Database.Database,
  trxId: string,
  items: { medicineId: string; qty: number; unitMultiplier: number }[],
): void {
  db.prepare(
    `INSERT INTO transactions
       (id, trx_no, date, cashier_name, cashier_username, total_amount,
        payment_method, payment_amount, change_amount, status, is_prescription)
     VALUES
       (@id, @trx_no, @date, @cashier_name, @cashier_username, @total_amount,
        @payment_method, @payment_amount, @change_amount, @status, @is_prescription)`,
  ).run({
    id: trxId,
    trx_no: 'TRX-' + trxId,
    date: new Date().toISOString(),
    cashier_name: 'Test',
    cashier_username: 'test',
    total_amount: 1000,
    payment_method: 'Tunai',
    payment_amount: 1000,
    change_amount: 0,
    status: 'Selesai',
    is_prescription: 0,
  });
  for (const item of items) {
    db.prepare(
      `INSERT INTO transaction_items
         (transaction_id, medicine_id, medicine_code, medicine_name, unit,
          price, qty, subtotal, unit_multiplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(trxId, item.medicineId, 'CODE', 'Med', 'Tablet', 1000, item.qty, item.qty * 1000, item.unitMultiplier);
    db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ?').run(
      item.qty * item.unitMultiplier,
      item.medicineId,
    );
  }
}

// ---------------------------------------------------------------------------
// Inline transaction logic — mirrors server.ts runCreate / runCancel
// ---------------------------------------------------------------------------
function createTransaction(db: Database.Database, body: Record<string, unknown>): void {
  const items = (body.items ?? []) as Record<string, unknown>[];
  const headerInput = Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'items'));
  const headerRow = toSQL(headerInput) as Record<string, unknown>;

  const run = db.transaction(() => {
    const hCols = Object.keys(headerRow);
    db.prepare(
      `INSERT INTO transactions (${hCols.join(', ')}) VALUES (${hCols.map(c => '@' + c).join(', ')})`,
    ).run(headerRow);

    for (const item of items) {
      const itemRow = { ...(toSQL(item) as Record<string, unknown>), transaction_id: headerRow['id'] };
      const iCols = Object.keys(itemRow);
      db.prepare(
        `INSERT INTO transaction_items (${iCols.join(', ')}) VALUES (${iCols.map(c => '@' + c).join(', ')})`,
      ).run(itemRow);

      const qty = (item['qty'] as number) ?? 0;
      const unitMultiplier = (item['unitMultiplier'] as number) ?? 1;
      const medicineId = item['medicineId'] as string;

      db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ?').run(qty * unitMultiplier, medicineId);

      const med = db.prepare('SELECT stock, item_type FROM medicines WHERE id = ?').get(medicineId) as
        | { stock: number; item_type: string | null }
        | undefined;

      // stock_history INSERT — references medicines(id) via FK; if med is undefined this still inserts
      // but the medicines FK on stock_history is ON DELETE CASCADE (not RESTRICT), so it won't throw.
      // We still need to produce a valid stock history row, so only insert when medicine exists.
      if (med) {
        db.prepare(
          `INSERT INTO stock_history
             (id, medicine_id, medicine_code, medicine_name, type, amount,
              prev_stock, new_stock, date, note, user_name, item_type)
           VALUES (?, ?, ?, ?, 'keluar', ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          medicineId,
          item['medicineCode'] ?? 'CODE',
          item['medicineName'] ?? 'Med',
          qty * unitMultiplier,
          med.stock + qty * unitMultiplier,
          med.stock,
          new Date().toISOString(),
          'test',
          'Test User',
          med.item_type ?? 'obat',
        );
      }
    }
  });
  run();
}

function cancelTransaction(
  db: Database.Database,
  id: string,
  cancelReason = '',
  cancelledBy = '',
): void {
  const existing = db.prepare('SELECT status FROM transactions WHERE id = ?').get(id) as
    | { status: string }
    | undefined;
  if (existing?.status === 'Dibatalkan') {
    throw Object.assign(new Error('already cancelled'), { statusCode: 400 });
  }

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE transactions SET status='Dibatalkan', cancel_reason=?, cancelled_by=?, cancelled_at=? WHERE id=?`,
    ).run(cancelReason, cancelledBy, new Date().toISOString(), id);

    const txItems = db
      .prepare('SELECT medicine_id, qty, unit_multiplier FROM transaction_items WHERE transaction_id = ?')
      .all(id) as { medicine_id: string; qty: number; unit_multiplier: number | null }[];

    for (const item of txItems) {
      db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ?').run(
        item.qty * (item.unit_multiplier ?? 1),
        item.medicine_id,
      );
    }
  });
  run();
}

// ---------------------------------------------------------------------------
// P4 — Atomicity: no partial writes on transaction failure
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------
console.log('--- P4: transaction atomicity ---');
{
  const db = makeDb();
  seedMedicine(db, 'med-1', 100);

  const countBefore = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as { c: number }).c;
  const itemsBefore = (db.prepare('SELECT COUNT(*) as c FROM transaction_items').get() as { c: number }).c;
  const stockBefore = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-1') as { stock: number }).stock;

  // INVALID-MEDICINE-ID does not exist → FK RESTRICT on transaction_items.medicine_id will throw
  try {
    createTransaction(db, {
      id: randomUUID(),
      trxNo: 'TRX-P4-FAIL',
      date: new Date().toISOString(),
      cashierName: 'Test',
      cashierUsername: 'test',
      totalAmount: 1000,
      paymentMethod: 'Tunai',
      paymentAmount: 1000,
      changeAmount: 0,
      status: 'Selesai',
      isPrescription: false,
      items: [
        {
          medicineId: 'INVALID-ID-THAT-DOES-NOT-EXIST',
          qty: 10,
          unitMultiplier: 1,
          medicineCode: 'X',
          medicineName: 'X',
          unit: 'Tab',
          price: 100,
          subtotal: 1000,
        },
      ],
    });
    // If createTransaction didn't throw, the FK constraint wasn't triggered.
    // In that case verify stock is unchanged (INSERT succeeded but UPDATE found no row = no-op).
  } catch {
    // expected — FK violation on transaction_items.medicine_id
  }

  const countAfter = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as { c: number }).c;
  const itemsAfter = (db.prepare('SELECT COUNT(*) as c FROM transaction_items').get() as { c: number }).c;
  const stockAfter = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-1') as { stock: number }).stock;

  // The FK on transaction_items(medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
  // means the INSERT into transaction_items will fail with SQLITE_CONSTRAINT_FOREIGNKEY.
  // db.transaction() wraps all steps — if any step throws, the whole transaction rolls back.
  // So counts must be exactly as before and stock of the valid medicine must be unchanged.
  assert.equal(countAfter, countBefore, 'P4: transactions count must be unchanged after rollback');
  assert.equal(itemsAfter, itemsBefore, 'P4: transaction_items count must be unchanged after rollback');
  assert.equal(stockAfter, stockBefore, 'P4: medicines.stock must be unchanged after rollback');

  console.log('P4 transaction atomicity: passed ✓');
}

// ---------------------------------------------------------------------------
// P5 — Stock conservation on createTransaction
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------
console.log('--- P5: stock conservation on createTransaction ---');
{
  const db = makeDb();
  seedMedicine(db, 'med-a', 200);
  seedMedicine(db, 'med-b', 150);

  const stockABefore = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-a') as { stock: number }).stock;
  const stockBBefore = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-b') as { stock: number }).stock;
  const totalBefore = stockABefore + stockBBefore;

  const items = [
    { medicineId: 'med-a', qty: 5, unitMultiplier: 2, medicineCode: 'A', medicineName: 'Med A', unit: 'Tab', price: 1000, subtotal: 5000 },
    { medicineId: 'med-b', qty: 3, unitMultiplier: 1, medicineCode: 'B', medicineName: 'Med B', unit: 'Tab', price: 500, subtotal: 1500 },
  ];
  const deducted = items.reduce((s, i) => s + i.qty * i.unitMultiplier, 0); // 5*2 + 3*1 = 13

  createTransaction(db, {
    id: randomUUID(),
    trxNo: 'TRX-P5',
    date: new Date().toISOString(),
    cashierName: 'Test',
    cashierUsername: 'test',
    totalAmount: 6500,
    paymentMethod: 'Tunai',
    paymentAmount: 6500,
    changeAmount: 0,
    status: 'Selesai',
    isPrescription: false,
    items,
  });

  const stockAAfter = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-a') as { stock: number }).stock;
  const stockBAfter = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-b') as { stock: number }).stock;
  const totalAfter = stockAAfter + stockBAfter;

  assert.equal(
    totalAfter,
    totalBefore - deducted,
    `P5: stock conservation. expected ${totalBefore - deducted}, got ${totalAfter}`,
  );
  console.log('P5 stock conservation on createTransaction: passed ✓');
}

// ---------------------------------------------------------------------------
// P6 — Stock conservation on cancelTransaction
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------
console.log('--- P6: stock conservation on cancelTransaction ---');
{
  const db = makeDb();
  seedMedicine(db, 'med-c', 100);

  const stockBeforeTx = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-c') as { stock: number }).stock;

  const txId = randomUUID();
  seedTransaction(db, txId, [{ medicineId: 'med-c', qty: 7, unitMultiplier: 2 }]);

  const stockAfterCreate = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-c') as { stock: number }).stock;
  assert.equal(stockAfterCreate, stockBeforeTx - 14, 'P6 setup: stock deducted correctly (7×2=14)');

  cancelTransaction(db, txId, 'test cancel', 'admin');

  const stockAfterCancel = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-c') as { stock: number }).stock;
  assert.equal(
    stockAfterCancel,
    stockBeforeTx,
    `P6: stock fully restored. expected ${stockBeforeTx}, got ${stockAfterCancel}`,
  );
  console.log('P6 stock conservation on cancelTransaction: passed ✓');
}

// ---------------------------------------------------------------------------
// P7 — Cancel idempotency guard
// Validates: Requirements 2.9, 6.5
// ---------------------------------------------------------------------------
console.log('--- P7: cancel idempotency guard ---');
{
  const db = makeDb();
  seedMedicine(db, 'med-d', 50);

  const txId = randomUUID();
  seedTransaction(db, txId, [{ medicineId: 'med-d', qty: 2, unitMultiplier: 1 }]);

  // First cancel — should succeed
  cancelTransaction(db, txId, 'reason', 'admin');
  const status = (db.prepare('SELECT status FROM transactions WHERE id=?').get(txId) as { status: string }).status;
  assert.equal(status, 'Dibatalkan', 'P7: first cancel sets status to Dibatalkan');

  const stockAfterFirstCancel = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-d') as { stock: number }).stock;

  // Second cancel — must throw with statusCode 400
  let threw400 = false;
  try {
    cancelTransaction(db, txId, 'again', 'admin');
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 400) threw400 = true;
  }
  assert(threw400, 'P7: second cancel must throw statusCode 400');

  // DB state must be unchanged — status still Dibatalkan, stock not modified again
  const statusAfter = (db.prepare('SELECT status FROM transactions WHERE id=?').get(txId) as { status: string }).status;
  assert.equal(statusAfter, 'Dibatalkan', 'P7: status unchanged after second cancel attempt');

  const stockAfterSecondCancel = (db.prepare('SELECT stock FROM medicines WHERE id=?').get('med-d') as { stock: number }).stock;
  assert.equal(stockAfterSecondCancel, stockAfterFirstCancel, 'P7: stock not modified by second cancel attempt');

  console.log('P7 cancel idempotency guard: passed ✓');
}

// ---------------------------------------------------------------------------
// P10 — TransactionItem excludes AUTOINCREMENT id
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
console.log('--- P10: TransactionItem excludes AUTOINCREMENT id ---');
{
  // toTS with stripId:true must remove the id field from transaction_items rows
  const itemRow = {
    id: 42,
    transaction_id: 'tx-1',
    medicine_id: 'med-1',
    medicine_code: 'PC001',
    medicine_name: 'Para',
    unit: 'Tab',
    price: 1000,
    qty: 2,
    subtotal: 2000,
  };
  const tsItem = toTS(itemRow, { stripId: true });
  assert(!('id' in tsItem), 'P10: id must be stripped from transaction_items rows');
  assert('medicineId' in tsItem, 'P10: medicineId must be present');
  assert.equal(tsItem.qty, 2, 'P10: other fields must be preserved');

  // Also verify via an actual DB round-trip: insert a transaction + item, read back, confirm no id
  const db = makeDb();
  seedMedicine(db, 'med-p10', 50);
  const txId = randomUUID();
  seedTransaction(db, txId, [{ medicineId: 'med-p10', qty: 1, unitMultiplier: 1 }]);

  const rawItems = db
    .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
    .all(txId) as Record<string, unknown>[];
  assert(rawItems.length > 0, 'P10 setup: transaction_items must have rows');
  assert('id' in rawItems[0], 'P10 setup: raw DB row must have AUTOINCREMENT id');

  const tsItems = rawItems.map(r => toTS(r, { stripId: true }));
  for (const item of tsItems) {
    assert(!('id' in item), 'P10: toTS with stripId:true must exclude id from every item');
  }

  console.log('P10 TransactionItem excludes AUTOINCREMENT id: passed ✓');
}

console.log('\n✅ All property tests passed (P4, P5, P6, P7, P10)');
