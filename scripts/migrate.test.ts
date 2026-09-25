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
import { applyMigrations, LATEST_MIGRATION_VERSION } from '../src/server/app.js';

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

// ---------------------------------------------------------------------------
// P11 — Upgrade-safe migration: old DB keeps data, gains no_batch columns
// Validates: "tidak merusak aplikasi electron versi lama" (additive, idempotent)
// ---------------------------------------------------------------------------
console.log('--- P11: old-DB migration preserves data & adds no_batch ---');
{
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Recreate the OLD released schema: medicines & transaction_items WITHOUT no_batch,
  // settings already carrying v1 printer columns. user_version=1 ⇒ only migration v2 runs.
  db.exec(`
    CREATE TABLE settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      printer_name TEXT DEFAULT '',
      paper_width TEXT DEFAULT '58mm'
    );
    CREATE TABLE medicines (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 10,
      unit TEXT NOT NULL,
      expired_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      trx_no TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      cashier_username TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      payment_amount REAL NOT NULL DEFAULT 0,
      change_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Selesai',
      is_prescription INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      medicine_code TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      subtotal REAL NOT NULL
    );
    CREATE TABLE stock_history (
      id TEXT PRIMARY KEY,
      medicine_id TEXT NOT NULL,
      medicine_code TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      prev_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      user_name TEXT NOT NULL
    );
    PRAGMA user_version = 1;
  `);

  // Seed legacy data
  db.prepare(
    `INSERT INTO medicines (id, code, name, category, price, stock, min_stock, unit, expired_date, is_active)
     VALUES ('med-old', 'OLD-001', 'Paracetamol', 'Obat Bebas', 5000, 42, 5, 'Strip', '2030-01-01', 1)`
  ).run();
  db.prepare(
    `INSERT INTO transactions (id, trx_no, date, cashier_name, cashier_username, total_amount, payment_method, payment_amount, change_amount, status, is_prescription)
     VALUES ('tx-old', 'TRX-OLD-1', '2026-01-01', 'Rina', 'rina', 10000, 'Tunai', 10000, 0, 'Selesai', 0)`
  ).run();
  db.prepare(
    `INSERT INTO transaction_items (transaction_id, medicine_id, medicine_code, medicine_name, unit, price, qty, subtotal)
     VALUES ('tx-old', 'med-old', 'OLD-001', 'Paracetamol', 'Strip', 5000, 2, 10000)`
  ).run();

  const colsBefore = (t: string) =>
    (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name);
  assert(!colsBefore('medicines').includes('no_batch'), 'P11 setup: old DB must NOT have no_batch yet');
  assert(!colsBefore('transaction_items').includes('no_batch'), 'P11 setup: old DB must NOT have no_batch yet');
  assert(!colsBefore('stock_history').includes('no_batch'), 'P11 setup: old DB must NOT have stock_history.no_batch yet');

  // Run the real migration
  applyMigrations(db);

  const colsAfter = (t: string) =>
    (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name);
  assert(colsAfter('medicines').includes('no_batch'), 'P11: medicines.no_batch must be added by migration');
  assert(colsAfter('transaction_items').includes('no_batch'), 'P11: transaction_items.no_batch must be added by migration');
  assert(colsAfter('stock_history').includes('no_batch'), 'P11: stock_history.no_batch must be added by migration');

  // Legacy rows survive with NULL batch
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get('med-old') as Record<string, unknown>;
  assert.equal(med['name'], 'Paracetamol', 'P11: legacy medicine name must be preserved');
  assert.equal(med['stock'], 42, 'P11: legacy stock must be preserved');
  assert.equal(med['no_batch'], null, 'P11: legacy no_batch must default to NULL');
  const item = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').get('tx-old') as Record<string, unknown>;
  assert.equal(item['medicine_id'], 'med-old', 'P11: legacy transaction_item must be preserved');
  assert.equal(item['no_batch'], null, 'P11: legacy item no_batch must default to NULL');
  assert(colsAfter('medicine_customer_prices').includes('inherit_parent'), 'P11: normal customer prices must gain inherit_parent');
  assert(colsAfter('medicine_unit_customer_prices').includes('inherit_parent'), 'P11: unit customer prices must gain inherit_parent');
  assert(colsAfter('medicine_custom_price_customers').includes('inherit_parent'), 'P11: custom customer prices must gain inherit_parent');
  for (const table of ['medicine_customer_prices', 'medicine_unit_customer_prices', 'medicine_custom_price_customers']) {
    const column = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; dflt_value: string | null }>).find(item => item.name === 'inherit_parent');
    assert.equal(Number(column?.dflt_value), 0, `P11: ${table}.inherit_parent must default to isolated`);
  }
  assert.equal(db.pragma('user_version', { simple: true }), LATEST_MIGRATION_VERSION, 'P11: user_version must be bumped to latest migration count');

  // Idempotency: running migrations again must not throw (fresh DB case)
  applyMigrations(db);
  assert.equal(db.pragma('user_version', { simple: true }), LATEST_MIGRATION_VERSION, 'P11: re-running migrations must stay at latest count');

  console.log('P11 old-DB migration preserves data & adds no_batch: passed ✓');
}

// ---------------------------------------------------------------------------
// P12 — Fresh DB (full schema) must not crash on migration (guard per-table)
// Validates: new installs built from schema.sql never hit "duplicate column"
// ---------------------------------------------------------------------------
console.log('--- P12: fresh-DB migration is a no-op (per-table guard) ---');
{
  const db = makeDb(); // full new schema.sql, no_batch already present
  assert.equal(db.pragma('user_version', { simple: true }), 0, 'P12 setup: fresh DB starts at v0');

  // v1 (settings printer) + v2/v3 (no_batch columns) must all be no-ops
  applyMigrations(db);

  const cols = (t: string) =>
    (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name);
  assert(cols('medicines').includes('no_batch'), 'P12: medicines.no_batch must exist');
  assert(cols('transaction_items').includes('no_batch'), 'P12: transaction_items.no_batch must exist');
  assert(cols('stock_history').includes('no_batch'), 'P12: stock_history.no_batch must exist');
  for (const table of ['medicine_customer_prices', 'medicine_unit_customer_prices', 'medicine_custom_price_customers']) {
    const column = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; dflt_value: string | null }>).find(item => item.name === 'inherit_parent');
    assert.equal(Number(column?.dflt_value), 1, `P12: ${table}.inherit_parent must default to linked`);
  }
    assert.equal(db.pragma('user_version', { simple: true }), LATEST_MIGRATION_VERSION, 'P12: user_version must reach latest migration count');

  console.log('P12 fresh-DB migration is a no-op: passed ✓');
}

// ---------------------------------------------------------------------------
// P13 — v54 detaches legacy normal customer inheritance with a snapshot
// ---------------------------------------------------------------------------
console.log('--- P13: normal customer inheritance is migrated to a snapshot ---');
{
  const db = makeDb();
  applyMigrations(db);
  db.prepare(`INSERT INTO medicines (id, code, name, category, price, purchase_price, unit, unit_multiplier, expired_date, margin_pct, bhp_amount)
    VALUES ('med-snapshot', 'SNAP-001', 'Snapshot', 'Obat Bebas', 2500, 1000, 'Pcs', 1, '2030-01-01', 25, 40)`).run();
  db.prepare(`INSERT INTO customers (id, member_no, name, phone, created_at) VALUES ('customer-snapshot', 'SNAP-C', 'Snapshot Customer', '08000', '2026-08-27')`).run();
  db.prepare(`INSERT INTO medicine_customer_prices (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent)
    VALUES ('normal-snapshot', 'med-snapshot', 'customer-snapshot', 1, 1, 1, 1)`).run();
  db.pragma('user_version = 53');
  db.prepare('UPDATE medicines SET price = 3000, margin_pct = 30, bhp_amount = 50 WHERE id = ?').run('med-snapshot');
  applyMigrations(db);
  const snapshot = db.prepare('SELECT price, margin_pct, bhp_amount, inherit_parent FROM medicine_customer_prices WHERE id = ?').get('normal-snapshot') as Record<string, number>;
  assert.deepEqual(snapshot, { price: 3000, margin_pct: 30, bhp_amount: 50, inherit_parent: 0 }, 'P13: inherited normal price must become a current parent snapshot');
  db.close();
  console.log('P13 normal customer inheritance snapshot: passed ✓');
}

// ---------------------------------------------------------------------------
// P16 — Old DB migration adds customer_id/customer_name to transaction_items
// ---------------------------------------------------------------------------
console.log('--- P16: old-DB migration adds customer columns to transaction_items ---');
{
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Recreate a DB that has transaction_items WITHOUT customer columns
  // but has no_batch already present, so migration v5 applies
  db.exec(`
    CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, printer_name TEXT DEFAULT '', paper_width TEXT DEFAULT '58mm');
    CREATE TABLE medicines (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, price REAL DEFAULT 0, purchase_price REAL DEFAULT 0, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 10, unit TEXT NOT NULL, unit_multiplier INTEGER DEFAULT 1, expired_date TEXT NOT NULL, no_batch TEXT, is_active INTEGER DEFAULT 1, location TEXT, item_type TEXT DEFAULT 'obat', margin_pct REAL DEFAULT 0, bhp_amount REAL DEFAULT 0, ppn_rate REAL DEFAULT 11, is_ppn_included INTEGER DEFAULT 1, purchase_price_non_ppn REAL DEFAULT 0, purchase_price_inc_ppn REAL DEFAULT 0, price_non_ppn REAL DEFAULT 0, price_inc_ppn REAL DEFAULT 0);
    CREATE TABLE customers (id TEXT PRIMARY KEY, member_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT, status TEXT DEFAULT 'Aktif', total_spent REAL DEFAULT 0, total_transactions INTEGER DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE transaction_items (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL, medicine_id TEXT NOT NULL, medicine_code TEXT NOT NULL, medicine_name TEXT NOT NULL, unit TEXT NOT NULL, price REAL NOT NULL, qty INTEGER NOT NULL, subtotal REAL NOT NULL, no_batch TEXT);
    CREATE TABLE stock_history (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, medicine_code TEXT NOT NULL, medicine_name TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, prev_stock INTEGER NOT NULL, new_stock INTEGER NOT NULL, date TEXT NOT NULL, note TEXT, user_name TEXT NOT NULL, item_type TEXT DEFAULT 'obat', no_batch TEXT);
    PRAGMA user_version = 3;
  `);

  const colsBefore = db.prepare('PRAGMA table_info(transaction_items)').all() as { name: string }[];
  assert.ok(!colsBefore.some(c => c.name === 'customer_id'), 'P16 setup: old DB must NOT have customer_id yet');
  assert.ok(!colsBefore.some(c => c.name === 'customer_name'), 'P16 setup: old DB must NOT have customer_name yet');

  applyMigrations(db);

  const colsAfter = db.prepare('PRAGMA table_info(transaction_items)').all() as { name: string }[];
  assert.ok(colsAfter.some(c => c.name === 'customer_id'), 'P16: customer_id must be added by migration');
  assert.ok(colsAfter.some(c => c.name === 'customer_name'), 'P16: customer_name must be added by migration');
    assert.equal(db.pragma('user_version', { simple: true }), LATEST_MIGRATION_VERSION, 'P16: user_version must reach latest');

  console.log('P16 old-DB migration adds customer columns: passed ✓');
}

console.log('\n✅ P9, P11, P12, P13, P16 passed');
