/**
 * scripts/migrate.test.ts — Property test P9
 * Validates: Requirements 7.5
 *
 * Run: npx tsx scripts/migrate.test.ts
 *
 * P9: Given a transaction_item referencing a medicine_id not present in the
 * medicines array, the migration report shows skipped >= 1 for transaction_items
 * and no row with that unknown medicine_id is inserted into the DB.
 */

import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Replicate the migration filter from the /migrate page's inline JS
// ---------------------------------------------------------------------------
function filterOrphanedItems(
  transactions: Array<{ id: string; items?: Array<{ medicineId: string; [k: string]: unknown }> }>,
  medicineIds: Set<string>,
): { validatedTransactions: typeof transactions; skipped: number } {
  let skipped = 0;
  const validatedTransactions = transactions.map(tx => {
    const items = tx.items ?? [];
    const validItems = items.filter(item => {
      if (!medicineIds.has(item.medicineId)) {
        skipped++;
        return false;
      }
      return true;
    });
    return { ...tx, items: validItems };
  });
  return { validatedTransactions, skipped };
}

// ---------------------------------------------------------------------------
// DB factory — in-memory, same as server.test.ts
// ---------------------------------------------------------------------------
function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schemaPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
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
// P9 — Migration skips orphaned items
// Validates: Requirements 7.5
// ---------------------------------------------------------------------------
console.log('--- P9: migration skips orphaned transaction_items ---');
{
  const db = makeDb();

  // Seed one known medicine
  db.prepare(
    `INSERT INTO medicines
       (id, code, name, category, price, stock, min_stock, unit, expired_date, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run('med-known', 'PC001', 'Para', 'Obat Bebas', 1000, 50, 5, 'Tab', '2030-01-01', 1);

  const medicines = [{ id: 'med-known' }];
  const medicineIds = new Set(medicines.map(m => m.id));

  // One transaction with 2 items: one valid, one orphaned
  const transactions = [
    {
      id: 'tx-1',
      items: [
        {
          medicineId: 'med-known',
          qty: 1,
          medicineCode: 'PC001',
          medicineName: 'Para',
          unit: 'Tab',
          price: 1000,
          subtotal: 1000,
        },
        {
          medicineId: 'UNKNOWN-MED-999',
          qty: 2,
          medicineCode: 'GHOST',
          medicineName: 'Ghost Med',
          unit: 'Tab',
          price: 500,
          subtotal: 1000,
        },
      ],
    },
  ];

  const { validatedTransactions, skipped } = filterOrphanedItems(transactions, medicineIds);

  // Property: skipped >= 1
  assert(skipped >= 1, `P9: skipped must be >= 1, got ${skipped}`);

  // Only the valid item survives
  assert.equal(validatedTransactions[0].items!.length, 1, 'P9: only 1 valid item should remain');
  assert.equal(
    validatedTransactions[0].items![0].medicineId,
    'med-known',
    'P9: surviving item must be med-known',
  );
  assert(
    !validatedTransactions[0].items!.some(i => i.medicineId === 'UNKNOWN-MED-999'),
    'P9: orphaned item must not be in validatedTransactions',
  );

  // Simulate the reset: insert validated data into DB and confirm no unknown medicine_id row
  db.prepare(
    `INSERT INTO transactions
       (id, trx_no, date, cashier_name, cashier_username, total_amount,
        payment_method, payment_amount, change_amount, status, is_prescription)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run('tx-1', 'TRX-001', '2024-01-01', 'Test', 'test', 1000, 'Tunai', 1000, 0, 'Selesai', 0);

  for (const tx of validatedTransactions) {
    for (const item of tx.items ?? []) {
      db.prepare(
        `INSERT INTO transaction_items
           (transaction_id, medicine_id, medicine_code, medicine_name, unit, price, qty, subtotal)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(tx.id, item.medicineId, item.medicineCode, item.medicineName, item.unit, item.price, item.qty, item.subtotal);
    }
  }

  const insertedItems = db
    .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
    .all('tx-1') as { medicine_id: string }[];

  assert.equal(insertedItems.length, 1, 'P9: exactly 1 item inserted (the valid one)');
  assert(
    insertedItems.every(i => i.medicine_id !== 'UNKNOWN-MED-999'),
    'P9: no orphaned medicine_id in DB',
  );

  console.log('P9 migration skips orphaned items: passed ✓');
}

console.log('\n✅ P9 passed');
