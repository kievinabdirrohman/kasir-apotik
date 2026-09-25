import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import Database from 'better-sqlite3';
import { toSQL, toTS } from '../mapper.js';
import { legacyMultiplier, legacyPurchasePricePerBase, validateUnitDefinitions } from '../utils/unitConversion.js';


// ---------------------------------------------------------------------------
// Migration page (served at GET /migrate)
// ---------------------------------------------------------------------------
const MIGRATE_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Migrasi Data localStorage → SQLite</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1d4ed8; }
    button { background: #1d4ed8; color: white; padding: 10px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    #log { white-space: pre-wrap; background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; margin-top: 16px; min-height: 60px; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #e2e8f0; }
    .success { color: #16a34a; font-weight: bold; }
    .error { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Migrasi Data: localStorage → SQLite</h1>
  <p>Klik tombol di bawah untuk memindahkan data dari localStorage browser ke database SQLite.</p>
  <button id="btnMigrate" onclick="runMigration()">Mulai Migrasi</button>
  <div id="log">Siap untuk migrasi...</div>
  <div id="report"></div>

  <script>
    const API = 'http://localhost:3001';

    function safeParseLS(key, fallback) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        return val ?? fallback;
      } catch { return fallback; }
    }

    function log(msg) {
      document.getElementById('log').textContent += '\\n' + msg;
    }

    async function runMigration() {
      const btn = document.getElementById('btnMigrate');
      btn.disabled = true;
      document.getElementById('log').textContent = 'Memulai migrasi...';
      document.getElementById('report').innerHTML = '';

      try {
        // 1. Read all 8 localStorage keys
        const medicines    = safeParseLS('apotek_medicines', []);
        const users        = safeParseLS('apotek_users', []);
        const transactions = safeParseLS('apotek_transactions', []);
        const customers    = safeParseLS('apotek_customers', []);
        const doctors      = safeParseLS('apotek_doctors', []);
        const stockHistory = safeParseLS('apotek_stock_history', []);
        const cashFlows    = safeParseLS('apotek_cash_flows', []);
        const settings     = safeParseLS('apotek_settings', null);

        log('Data dibaca dari localStorage: medicines=' + medicines.length + ', transactions=' + transactions.length);

        // 2. Check if DB already has data
        const checkRes = await fetch(API + '/api/medicines');
        const checkData = await checkRes.json();
        if (checkData.data && checkData.data.length > 0) {
          const confirmed = confirm('Database sudah memiliki data (' + checkData.data.length + ' obat). Lanjutkan dan timpa semua data?');
          if (!confirmed) {
            log('Migration aborted');
            btn.disabled = false;
            return;
          }
        }

        // 3. Validate transaction_items — filter orphaned items (Requirement 7.5)
        const medicineIds = new Set(medicines.map(m => m.id));
        let totalItemsSkipped = 0;
        const validatedTransactions = transactions.map(tx => {
          const items = tx.items || [];
          const validItems = items.filter(item => {
            if (!medicineIds.has(item.medicineId)) {
              console.warn('WARN: skipped transaction_item — referenced medicine ' + item.medicineId + ' not found');
              log('WARN: skipped transaction_item — referenced medicine ' + item.medicineId + ' not found');
              totalItemsSkipped++;
              return false;
            }
            return true;
          });
          return { ...tx, items: validItems };
        });

        // 4. Call POST /api/reset with full validated payload
        log('Mengirim data ke server...');
        const resetRes = await fetch(API + '/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings || {},
            users,
            medicines,
            customers,
            doctors,
            transactions: validatedTransactions,
            stockHistory,
            cashFlows,
          }),
        });

        if (!resetRes.ok) {
          const err = await resetRes.json().catch(() => ({}));
          throw new Error(err.error || 'HTTP ' + resetRes.status);
        }

        // 5. Set migration flag
        localStorage.setItem('apotek_migrated_to_sqlite', 'true');

        log('\\n✅ Migrasi berhasil!');

        // 6. Show report table
        const reportData = [
          { table: 'settings',          migrated: settings ? 1 : 0,      skipped: 0 },
          { table: 'users',             migrated: users.length,           skipped: 0 },
          { table: 'medicines',         migrated: medicines.length,       skipped: 0 },
          { table: 'customers',         migrated: customers.length,       skipped: 0 },
          { table: 'doctors',           migrated: doctors.length,         skipped: 0 },
          { table: 'transactions',      migrated: validatedTransactions.length, skipped: 0 },
          { table: 'transaction_items', migrated: validatedTransactions.reduce((s,t) => s + (t.items||[]).length, 0), skipped: totalItemsSkipped },
          { table: 'stock_history',     migrated: stockHistory.length,    skipped: 0 },
          { table: 'cash_flows',        migrated: cashFlows.length,       skipped: 0 },
        ];

        let tableHtml = '<h2>Laporan Migrasi</h2><table><tr><th>Tabel</th><th>Dimigrasikan</th><th>Dilewati</th></tr>';
        reportData.forEach(r => {
          tableHtml += '<tr><td>' + r.table + '</td><td>' + r.migrated + '</td><td>' + r.skipped + '</td></tr>';
        });
        tableHtml += '</table><p class="success">Migrasi selesai. Anda dapat menutup halaman ini dan membuka aplikasi.</p>';
        document.getElementById('report').innerHTML = tableHtml;

      } catch (err) {
        log('\\n❌ Error: ' + err.message);
        document.getElementById('report').innerHTML = '<p class="error">Migrasi gagal: ' + err.message + '</p>';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Schema location & migrations (upgrade-safe DB)
// ---------------------------------------------------------------------------

export interface ServerOptions {
  dbPath: string;
  /** CORS origin for the frontend. Defaults to the Vite dev server origin. */
  corsOrigin?: string;
}

/**
 * Locate sqlite/schema.sql. Works in three contexts:
 *  - dev CLI  : `tsx server.ts` from the repo root (cwd)
 *  - dev shell: `tsx electron/main.ts` from the repo root (cwd)
 *  - packaged : electron-builder `extraResources` → resources/sqlite/schema.sql
 * Optionally overridable with SCHEMA_PATH.
 */
function resolveSchemaSql(): string {
  // process.resourcesPath only exists inside an Electron (packaged) runtime
  const resourcesDir = typeof process !== 'undefined' ? (process as any).resourcesPath : '';
  const candidates = [
    process.env.SCHEMA_PATH,
    resourcesDir ? path.join(resourcesDir, 'sqlite', 'schema.sql') : '',
    path.resolve('sqlite', 'schema.sql'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }
  throw new Error('sqlite/schema.sql tidak ditemukan. Jalankan dari root proyek atau set env SCHEMA_PATH.');
}

/**
 * Additive migrations — the heart of "upgradable without breaking the DB".
 *
 * Fresh databases get the full schema from schema.sql (including every column
 * below). Existing databases skip the CREATE TABLE (IF NOT EXISTS) and then
 * receive only the missing pieces here — no DROP, no destructive rewrite — so
 * data is preserved across app upgrades.
 *
 * Versioning: SCHEMA_VERSION tracks the newest schema this build knows about.
 * Applied migrations are recorded in PRAGMA user_version, so each migration
 * runs exactly once per database.
 */
const SCHEMA_VERSION = 54;
const MIGRATIONS: { sql: string }[] = [
  // v1: thermal printer settings for the desktop (Electron) auto-print feature
  { sql: `ALTER TABLE settings ADD COLUMN printer_name TEXT DEFAULT ''` },
  { sql: `ALTER TABLE settings ADD COLUMN paper_width TEXT DEFAULT '58mm'` },
  // v2: optional batch number (no_batch) on medicine master data & sale items
  { sql: `ALTER TABLE medicines ADD COLUMN no_batch TEXT` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN no_batch TEXT` },
  // v3: batch number on stock history rows so every stock movement records its batch
  { sql: `ALTER TABLE stock_history ADD COLUMN no_batch TEXT` },
  // v4: customer-specific pricing table
  { sql: `CREATE TABLE IF NOT EXISTS medicine_customer_prices (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, customer_id TEXT NOT NULL, price REAL NOT NULL DEFAULT 0, UNIQUE(medicine_id, customer_id), FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)` },
  // v5: customer tracking on transaction items
  { sql: `ALTER TABLE transaction_items ADD COLUMN customer_id TEXT` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN customer_name TEXT` },
  // v9: explicit price source snapshot on sale items
  { sql: `ALTER TABLE transaction_items ADD COLUMN price_source TEXT DEFAULT 'normal'` },
  // v10: configurable thermal receipt layout
  { sql: `ALTER TABLE settings ADD COLUMN margin_top_mm REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE settings ADD COLUMN margin_right_mm REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE settings ADD COLUMN margin_bottom_mm REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE settings ADD COLUMN margin_left_mm REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE settings ADD COLUMN printer_font_size REAL NOT NULL DEFAULT 7` },
  { sql: `ALTER TABLE settings ADD COLUMN printer_line_height REAL NOT NULL DEFAULT 1.2` },
  { sql: `ALTER TABLE settings ADD COLUMN printer_label_width_pct REAL NOT NULL DEFAULT 56` },
  { sql: `ALTER TABLE settings ADD COLUMN printer_column_gap_mm REAL NOT NULL DEFAULT 2` },
  { sql: `ALTER TABLE settings ADD COLUMN printer_amount_alignment TEXT NOT NULL DEFAULT 'right'` },
  // v11: use zero software margins by default; hardware safe-area remains in the renderer
  { sql: `UPDATE settings SET margin_top_mm = 0, margin_right_mm = 0, margin_bottom_mm = 0, margin_left_mm = 0` },
  // v12: change the legacy printer default from 10pt to 7pt
  { sql: `UPDATE settings SET printer_font_size = 7 WHERE printer_font_size = 10` },
  // v13: unit-aware sale and stock snapshots
  { sql: `ALTER TABLE transaction_items ADD COLUMN unit_id TEXT` },
  { sql: `ALTER TABLE stock_history ADD COLUMN input_unit_id TEXT` },
  { sql: `ALTER TABLE stock_history ADD COLUMN input_unit TEXT` },
  { sql: `ALTER TABLE stock_history ADD COLUMN input_qty INTEGER` },
  { sql: `ALTER TABLE stock_history ADD COLUMN input_multiplier INTEGER` },
  // v14: additive multi-unit master and customer pricing
  { sql: `CREATE TABLE IF NOT EXISTS medicine_units (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, unit TEXT NOT NULL, multiplier_to_base INTEGER NOT NULL DEFAULT 1 CHECK (multiplier_to_base >= 1), sort_order INTEGER NOT NULL DEFAULT 0, price_per_base REAL NOT NULL DEFAULT 0, purchase_price_per_base REAL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0, UNIQUE(medicine_id, unit), UNIQUE(medicine_id, sort_order), FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE)` },
  { sql: `CREATE TABLE IF NOT EXISTS medicine_unit_customer_prices (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, medicine_unit_id TEXT NOT NULL, customer_id TEXT NOT NULL, price_per_base REAL NOT NULL DEFAULT 0, UNIQUE(medicine_unit_id, customer_id), FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE, FOREIGN KEY (medicine_unit_id) REFERENCES medicine_units(id) ON DELETE CASCADE, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_medicine_units_medicine ON medicine_units(medicine_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_medicine_unit_customer_prices_unit ON medicine_unit_customer_prices(medicine_unit_id)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_medicine_unit_customer_prices_customer ON medicine_unit_customer_prices(customer_id)` },
  // v31-v33: custom package prices; unit multipliers remain stock-only
  { sql: `CREATE TABLE IF NOT EXISTS medicine_custom_prices (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, unit_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), total_price REAL NOT NULL CHECK (total_price >= 0), sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, UNIQUE(medicine_id, unit_id, quantity), FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE, FOREIGN KEY (unit_id) REFERENCES medicine_units(id) ON DELETE CASCADE)` },
  { sql: `CREATE TABLE IF NOT EXISTS medicine_custom_price_customers (id TEXT PRIMARY KEY, custom_price_id TEXT NOT NULL, customer_id TEXT NOT NULL, total_price REAL NOT NULL CHECK (total_price >= 0), UNIQUE(custom_price_id, customer_id), FOREIGN KEY (custom_price_id) REFERENCES medicine_custom_prices(id) ON DELETE CASCADE, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)` },
  { sql: `CREATE INDEX IF NOT EXISTS idx_medicine_custom_prices_medicine ON medicine_custom_prices(medicine_id); CREATE INDEX IF NOT EXISTS idx_medicine_custom_price_customers_price ON medicine_custom_price_customers(custom_price_id); CREATE INDEX IF NOT EXISTS idx_medicine_custom_price_customers_customer ON medicine_custom_price_customers(customer_id)` },
  // v34-v38: immutable pricing snapshot metadata on transaction items
  { sql: `ALTER TABLE transaction_items ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'legacy'` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN custom_price_id TEXT` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN custom_quantity INTEGER DEFAULT 1` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN custom_unit TEXT` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN custom_total_price REAL` },
  // v39: reserve a migration version for primary-unit row normalization
  { sql: `SELECT 1` },
  // v40-v41: track the latest product update for deterministic catalogue ordering
  { sql: `ALTER TABLE medicines ADD COLUMN updated_at TEXT` },
  { sql: `UPDATE medicines SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL` },
  // v42-v43: track stock-history insertion/update ordering
  { sql: `ALTER TABLE stock_history ADD COLUMN updated_at TEXT` },
  { sql: `UPDATE stock_history SET updated_at = COALESCE(date, CURRENT_TIMESTAMP) WHERE updated_at IS NULL` },
  // v44: margin and immutable cost/profit snapshots for every selling profile
  { sql: `ALTER TABLE medicine_customer_prices ADD COLUMN margin_pct REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_units ADD COLUMN selling_price REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_units ADD COLUMN margin_pct REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_unit_customer_prices ADD COLUMN selling_price REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_unit_customer_prices ADD COLUMN margin_pct REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_custom_prices ADD COLUMN margin_pct REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_custom_price_customers ADD COLUMN margin_pct REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN margin_pct REAL DEFAULT 0` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN bhp_amount REAL DEFAULT 0` },
  { sql: `ALTER TABLE transaction_items ADD COLUMN profit_amount REAL DEFAULT 0` },
  // v45: reserve a version for the one-time legacy profile backfill below
  { sql: `SELECT 1` },
  // v46-v50: isolated BHP snapshots for every selling profile. Existing rows
  // deliberately default to zero; historical transactions are untouched.
  { sql: `ALTER TABLE medicine_customer_prices ADD COLUMN bhp_amount REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_units ADD COLUMN bhp_amount REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_unit_customer_prices ADD COLUMN bhp_amount REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_custom_prices ADD COLUMN bhp_amount REAL NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_custom_price_customers ADD COLUMN bhp_amount REAL NOT NULL DEFAULT 0` },
  // v51-v53: new customer prices follow their matching parent by default.
  // Existing rows are explicitly isolated so an upgrade never changes prices.
  { sql: `ALTER TABLE medicine_customer_prices ADD COLUMN inherit_parent INTEGER NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_unit_customer_prices ADD COLUMN inherit_parent INTEGER NOT NULL DEFAULT 0` },
  { sql: `ALTER TABLE medicine_custom_price_customers ADD COLUMN inherit_parent INTEGER NOT NULL DEFAULT 0` },
  // v54: normal customer prices are standalone snapshots, including legacy
  // rows that were previously linked to the medicine's main selling profile.
  { sql: `UPDATE medicine_customer_prices
    SET price = COALESCE((SELECT price FROM medicines m WHERE m.id = medicine_customer_prices.medicine_id), price),
        margin_pct = COALESCE((SELECT margin_pct FROM medicines m WHERE m.id = medicine_customer_prices.medicine_id), margin_pct),
        bhp_amount = COALESCE((SELECT bhp_amount FROM medicines m WHERE m.id = medicine_customer_prices.medicine_id), bhp_amount),
        inherit_parent = 0
    WHERE inherit_parent = 1` },
];

export const LATEST_MIGRATION_VERSION = MIGRATIONS.length;

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function migrateLegacyUnits(db: Database.Database): void {
  if (!tableExists(db, 'medicines') || !tableExists(db, 'medicine_units')) return;
  const hasLegacyPrices = tableExists(db, 'medicine_customer_prices');
  const hasNewPrices = tableExists(db, 'medicine_unit_customer_prices');
  const medicineColumns = (db.prepare('PRAGMA table_info(medicines)').all() as { name: string }[]).map(column => column.name);
  const selectColumn = (name: string, fallback: string) => medicineColumns.includes(name) ? name : `${fallback} AS ${name}`;
  const medicines = db.prepare(`SELECT id, ${selectColumn('unit', "'Pcs'")}, ${selectColumn('unit_multiplier', '1')}, ${selectColumn('price', '0')}, ${selectColumn('purchase_price', '0')} FROM medicines`).all() as Record<string, unknown>[];
  const run = db.transaction(() => {
    for (const medicine of medicines) {
      const existing = db.prepare('SELECT id FROM medicine_units WHERE medicine_id = ? LIMIT 1').get(medicine.id);
      if (!existing) {
        const multiplier = legacyMultiplier({ unit: String(medicine.unit ?? 'Pcs'), unitMultiplier: Number(medicine.unit_multiplier ?? 1) });
        const price = Number(medicine.price ?? 0);
        const purchase = Number(medicine.purchase_price ?? 0) / multiplier;
        const baseId = `${medicine.id}-base`;
        db.prepare(`INSERT OR IGNORE INTO medicine_units
          (id, medicine_id, unit, multiplier_to_base, sort_order, price_per_base, purchase_price_per_base, is_primary)
          VALUES (?, ?, ?, 1, 0, ?, ?, ?)`)
          .run(baseId, medicine.id, multiplier > 1 && medicine.unit !== 'Pcs' ? 'Pcs' : String(medicine.unit ?? 'Pcs'), price, multiplier > 1 ? purchase : Number(medicine.purchase_price ?? 0), multiplier === 1 ? 1 : 0);
        if (multiplier > 1 && medicine.unit !== 'Pcs') {
          db.prepare(`INSERT OR IGNORE INTO medicine_units
            (id, medicine_id, unit, multiplier_to_base, sort_order, price_per_base, purchase_price_per_base, is_primary)
            VALUES (?, ?, ?, ?, 1, ?, ?, 1)`)
            .run(`${medicine.id}-legacy`, medicine.id, String(medicine.unit), multiplier, price, purchase);
        }
      }
      if (hasLegacyPrices && hasNewPrices) {
        const primary = db.prepare('SELECT id FROM medicine_units WHERE medicine_id = ? ORDER BY is_primary DESC, sort_order DESC LIMIT 1').get(medicine.id) as { id?: string } | undefined;
        if (primary?.id) {
          const prices = db.prepare('SELECT id, customer_id, price FROM medicine_customer_prices WHERE medicine_id = ?').all(medicine.id) as Record<string, unknown>[];
          for (const price of prices) {
            db.prepare(`INSERT OR IGNORE INTO medicine_unit_customer_prices
              (id, medicine_id, medicine_unit_id, customer_id, price_per_base)
              VALUES (?, ?, ?, ?, ?)`)
              .run(`legacy-${price.id}`, medicine.id, primary.id, price.customer_id, price.price);
          }
        }
      }
    }
  });
  run();
}

/** Promote primary-unit customer rows to the isolated normal-price profile. */
function migratePrimaryUnitCustomerPrices(db: Database.Database): void {
  if (!tableExists(db, 'customers') || !tableExists(db, 'medicine_customer_prices') || !tableExists(db, 'medicine_unit_customer_prices')) return;
  db.prepare(`
    INSERT OR IGNORE INTO medicine_customer_prices
      (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent)
    SELECT 'legacy-primary-customer-' || p.id,
      p.medicine_id,
      p.customer_id,
      COALESCE(NULLIF(p.selling_price, 0), p.price_per_base * MAX(1, u.multiplier_to_base)),
      COALESCE(p.margin_pct, 0),
      COALESCE(p.bhp_amount, 0),
      0
    FROM medicine_unit_customer_prices p
    JOIN medicine_units u ON u.id = p.medicine_unit_id AND u.medicine_id = p.medicine_id
    WHERE u.is_primary = 1
      AND NOT EXISTS (
        SELECT 1 FROM medicine_customer_prices n
        WHERE n.medicine_id = p.medicine_id AND n.customer_id = p.customer_id
      )
  `).run();
}

function migrateLegacyCustomPrices(db: Database.Database): void {
  if (!tableExists(db, 'medicine_custom_prices') || !tableExists(db, 'medicine_custom_price_customers')) return;
  const medicines = db.prepare('SELECT id, price FROM medicines').all() as { id: string; price: number }[];
  db.transaction(() => {
    for (const medicine of medicines) {
      const units = db.prepare('SELECT * FROM medicine_units WHERE medicine_id = ? ORDER BY sort_order').all(medicine.id) as Record<string, unknown>[];
      if (!units.length) continue;
      const primary = units.find(unit => Number(unit.is_primary) === 1) || units[units.length - 1];
      const primaryBasePrice = Number(primary.price_per_base || 0);
      const primaryMultiplier = Math.max(1, Number(primary.multiplier_to_base) || 1);

      // The multi-unit release stored prices per base item. Convert only once
      // into the new normal price, whose value is the total primary package.
      if (primaryBasePrice > 0) {
        db.prepare('UPDATE medicines SET price = ? WHERE id = ?').run(primaryBasePrice * primaryMultiplier, medicine.id);
      }

      const oldCustomerPrices = db.prepare(`
        SELECT p.customer_id, p.price_per_base, p.medicine_unit_id, u.multiplier_to_base, u.is_primary
        FROM medicine_unit_customer_prices p
        JOIN medicine_units u ON u.id = p.medicine_unit_id
        WHERE p.medicine_id = ?
      `).all(medicine.id) as Record<string, unknown>[];
      for (const price of oldCustomerPrices) {
        const totalPrice = Number(price.price_per_base || 0) * Math.max(1, Number(price.multiplier_to_base) || 1);
        if (totalPrice <= 0) continue;
        if (Number(price.is_primary) === 1) {
          db.prepare(`UPDATE medicine_customer_prices SET price = ? WHERE medicine_id = ? AND customer_id = ?`)
            .run(totalPrice, medicine.id, price.customer_id);
          continue;
        }
        const customId = `legacy-custom-${price.medicine_unit_id}`;
        db.prepare(`INSERT OR IGNORE INTO medicine_custom_prices
          (id, medicine_id, unit_id, quantity, total_price, sort_order, is_active)
          VALUES (?, ?, ?, 1, ?, ?, 1)`)
          .run(customId, medicine.id, price.medicine_unit_id, totalPrice, Number(price.multiplier_to_base) || 1);
          db.prepare(`INSERT OR IGNORE INTO medicine_custom_price_customers
           (id, custom_price_id, customer_id, total_price, inherit_parent) VALUES (?, ?, ?, ?, 0)`)
          .run(`legacy-custom-customer-${price.medicine_unit_id}-${price.customer_id}`, customId, price.customer_id, totalPrice);
      }

      for (const unit of units) {
        if (unit.id === primary.id || Number(unit.price_per_base || 0) <= 0) continue;
        const customId = `legacy-unit-custom-${unit.id}`;
        const totalPrice = Number(unit.price_per_base) * Math.max(1, Number(unit.multiplier_to_base) || 1);
        db.prepare(`INSERT OR IGNORE INTO medicine_custom_prices
          (id, medicine_id, unit_id, quantity, total_price, sort_order, is_active)
          VALUES (?, ?, ?, 1, ?, ?, 1)`)
          .run(customId, medicine.id, unit.id, totalPrice, Number(unit.sort_order) || 0);
      }
    }
  })();
}

/** Keep the old primary unit and move its row to position 1. */
function normalizePrimaryUnitRows(db: Database.Database): void {
  if (!tableExists(db, 'medicines') || !tableExists(db, 'medicine_units')) return;
  const medicineColumns = (db.prepare('PRAGMA table_info(medicines)').all() as Array<{ name: string }>).map(column => column.name);
  const selectColumn = (name: string, fallback: string) => medicineColumns.includes(name) ? name : `${fallback} AS ${name}`;
  const medicines = db.prepare(`SELECT id, ${selectColumn('unit', "'Pcs'")}, ${selectColumn('unit_multiplier', '1')} FROM medicines`).all() as Array<{ id: string; unit?: string; unit_multiplier?: number }>;
  db.transaction(() => {
    for (const medicine of medicines) {
      const rows = db.prepare('SELECT id, unit, multiplier_to_base, sort_order, is_primary FROM medicine_units WHERE medicine_id = ? ORDER BY sort_order, id').all(medicine.id) as Array<Record<string, unknown>>;
      if (!rows.length) continue;
      const flagged = rows.find(row => Number(row.is_primary) === 1);
      const matched = rows.find(row => String(row.unit) === String(medicine.unit ?? '') && Number(row.multiplier_to_base) === Number(medicine.unit_multiplier ?? 0));
      const primary = flagged || matched || rows[0];
      const ordered = [primary, ...rows.filter(row => row.id !== primary.id)];

      db.prepare('UPDATE medicine_units SET sort_order = ?, is_primary = 0 WHERE id = ? AND medicine_id = ?')
        .run(-1000000, primary.id, medicine.id);
      ordered.slice(1).forEach((row, index) => {
        db.prepare('UPDATE medicine_units SET sort_order = ?, is_primary = 0 WHERE id = ? AND medicine_id = ?')
          .run(index + 1000000, row.id, medicine.id);
      });
      ordered.forEach((row, index) => {
        db.prepare('UPDATE medicine_units SET sort_order = ?, is_primary = ? WHERE id = ? AND medicine_id = ?')
          .run(index, index === 0 ? 1 : 0, row.id, medicine.id);
      });
      if (medicineColumns.includes('unit_multiplier')) {
        db.prepare('UPDATE medicines SET unit = ?, unit_multiplier = ? WHERE id = ?')
          .run(primary.unit, primary.multiplier_to_base, medicine.id);
      } else {
        db.prepare('UPDATE medicines SET unit = ? WHERE id = ?').run(primary.unit, medicine.id);
      }
    }
  })();
}

/** Keep master HPP in the shared base-unit field; transaction snapshots stay untouched. */
function normalizeMedicinePurchasePrices(db: Database.Database, medicineId: string, packageHpp: number): void {
  const primary = db.prepare(`
    SELECT multiplier_to_base
    FROM medicine_units
    WHERE medicine_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC
    LIMIT 1
  `).get(medicineId) as { multiplier_to_base?: number } | undefined;
  if (!primary) return;
  const multiplier = Math.max(1, Number(primary.multiplier_to_base) || 1);
  const purchasePricePerBase = Math.max(0, Number(packageHpp) || 0) / multiplier;
  db.prepare('UPDATE medicine_units SET purchase_price_per_base = ? WHERE medicine_id = ?')
    .run(purchasePricePerBase, medicineId);
}

function normalizeUnitPurchasePrices(db: Database.Database): void {
  if (!tableExists(db, 'medicines') || !tableExists(db, 'medicine_units')) return;
  const medicineColumns = (db.prepare('PRAGMA table_info(medicines)').all() as Array<{ name: string }>).map(column => column.name);
  const unitColumns = (db.prepare('PRAGMA table_info(medicine_units)').all() as Array<{ name: string }>).map(column => column.name);
  if (!medicineColumns.includes('purchase_price') || !unitColumns.includes('purchase_price_per_base')) return;

  const medicines = db.prepare('SELECT id, purchase_price FROM medicines').all() as Array<{ id: string; purchase_price?: number }>;
  db.transaction(() => {
    for (const medicine of medicines) normalizeMedicinePurchasePrices(db, medicine.id, Number(medicine.purchase_price) || 0);
  })();
}

/** Backfill only newly-added columns; never change historical sale prices. */
function backfillMarginPricing(db: Database.Database): void {
  const medicineColumns = (db.prepare('PRAGMA table_info(medicines)').all() as Array<{ name: string }>).map(column => column.name);
  const medicineBhp = medicineColumns.includes('bhp_amount') ? 'COALESCE(m.bhp_amount, 0)' : '0';
  const transactionColumns = (db.prepare('PRAGMA table_info(transaction_items)').all() as Array<{ name: string }>).map(column => column.name);
  const canBackfillTransactionCost = ['pricing_mode', 'purchase_price', 'unit_multiplier', 'custom_quantity', 'bhp_amount', 'profit_amount', 'margin_pct'].every(column => transactionColumns.includes(column));
  db.transaction(() => {
    db.exec(`
      UPDATE medicine_units
      SET selling_price = CASE
        WHEN sort_order = 0 THEN COALESCE((SELECT price FROM medicines m WHERE m.id = medicine_units.medicine_id), 0)
        ELSE 0
      END
      WHERE selling_price IS NULL OR selling_price = 0;

      UPDATE medicine_unit_customer_prices
      SET selling_price = COALESCE(price_per_base, 0) * MAX(1, COALESCE((SELECT multiplier_to_base FROM medicine_units u WHERE u.id = medicine_unit_customer_prices.medicine_unit_id), 1))
      WHERE selling_price IS NULL OR selling_price = 0;

      UPDATE medicine_customer_prices
      SET margin_pct = COALESCE((
        SELECT CASE
          WHEN (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}) > 0
          THEN ((medicine_customer_prices.price - (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) /
            (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) * 100
          ELSE 0
        END
        FROM medicines m JOIN medicine_units u ON u.medicine_id = m.id AND u.is_primary = 1
        WHERE m.id = medicine_customer_prices.medicine_id
      ), 0)
      WHERE margin_pct IS NULL OR margin_pct = 0;

      UPDATE medicine_units
      SET margin_pct = COALESCE((
        SELECT CASE
          WHEN (COALESCE(medicine_units.purchase_price_per_base, 0) * MAX(1, COALESCE(medicine_units.multiplier_to_base, 1)) + ${medicineColumns.includes('bhp_amount') ? 'COALESCE(medicine_units.bhp_amount, 0)' : '0'}) > 0
          THEN ((medicine_units.selling_price - (COALESCE(medicine_units.purchase_price_per_base, 0) * MAX(1, COALESCE(medicine_units.multiplier_to_base, 1)) + ${medicineColumns.includes('bhp_amount') ? 'COALESCE(medicine_units.bhp_amount, 0)' : '0'})) /
            (COALESCE(medicine_units.purchase_price_per_base, 0) * MAX(1, COALESCE(medicine_units.multiplier_to_base, 1)) + ${medicineColumns.includes('bhp_amount') ? 'COALESCE(medicine_units.bhp_amount, 0)' : '0'})) * 100
          ELSE 0
        END FROM medicines m WHERE m.id = medicine_units.medicine_id
      ), 0)
      WHERE (margin_pct IS NULL OR margin_pct = 0) AND sort_order = 0;

      UPDATE medicine_unit_customer_prices
      SET margin_pct = COALESCE((
        SELECT CASE
          WHEN (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}) > 0
          THEN ((medicine_unit_customer_prices.selling_price - (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) /
            (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) * 100
          ELSE 0
        END FROM medicines m JOIN medicine_units u ON u.medicine_id = m.id
        WHERE u.id = medicine_unit_customer_prices.medicine_unit_id
      ), 0)
      WHERE margin_pct IS NULL OR margin_pct = 0;

      UPDATE medicine_custom_prices
      SET margin_pct = COALESCE((
        SELECT CASE
          WHEN (COALESCE(p.quantity, 1) * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) > 0
          THEN ((p.total_price - (p.quantity * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}))) /
            (p.quantity * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}))) * 100
          ELSE 0
        END FROM medicine_custom_prices p JOIN medicine_units u ON u.id = p.unit_id JOIN medicines m ON m.id = p.medicine_id
        WHERE p.id = medicine_custom_prices.id
      ), 0)
      WHERE margin_pct IS NULL OR margin_pct = 0;

      UPDATE medicine_custom_price_customers
      SET margin_pct = COALESCE((
        SELECT CASE
          WHEN (COALESCE(p.quantity, 1) * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp})) > 0
          THEN ((medicine_custom_price_customers.total_price - (p.quantity * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}))) /
            (p.quantity * (COALESCE(u.purchase_price_per_base, 0) * MAX(1, COALESCE(u.multiplier_to_base, 1)) + ${medicineBhp}))) * 100
          ELSE 0
        END FROM medicine_custom_price_customers cp JOIN medicine_custom_prices p ON p.id = cp.custom_price_id
          JOIN medicine_units u ON u.id = p.unit_id JOIN medicines m ON m.id = p.medicine_id
        WHERE cp.id = medicine_custom_price_customers.id
      ), 0)
      WHERE margin_pct IS NULL OR margin_pct = 0;

    `);
    if (canBackfillTransactionCost) {
      db.exec(`
        UPDATE transaction_items
        SET profit_amount = subtotal - CASE
          WHEN pricing_mode = 'legacy' THEN qty * COALESCE(purchase_price, 0)
          ELSE qty * MAX(1, COALESCE(custom_quantity, 1)) *
            (MAX(1, COALESCE(unit_multiplier, 1)) * COALESCE(purchase_price, 0) + COALESCE(bhp_amount, 0))
        END,
        margin_pct = CASE
          WHEN (CASE
            WHEN pricing_mode = 'legacy' THEN qty * COALESCE(purchase_price, 0)
            ELSE qty * MAX(1, COALESCE(custom_quantity, 1)) *
              (MAX(1, COALESCE(unit_multiplier, 1)) * COALESCE(purchase_price, 0) + COALESCE(bhp_amount, 0))
          END) > 0
          THEN ((subtotal - CASE
            WHEN pricing_mode = 'legacy' THEN qty * COALESCE(purchase_price, 0)
            ELSE qty * MAX(1, COALESCE(custom_quantity, 1)) *
              (MAX(1, COALESCE(unit_multiplier, 1)) * COALESCE(purchase_price, 0) + COALESCE(bhp_amount, 0))
          END) /
          (CASE
            WHEN pricing_mode = 'legacy' THEN qty * COALESCE(purchase_price, 0)
            ELSE qty * MAX(1, COALESCE(custom_quantity, 1)) *
              (MAX(1, COALESCE(unit_multiplier, 1)) * COALESCE(purchase_price, 0) + COALESCE(bhp_amount, 0))
          END)) * 100
          ELSE 0
        END
        WHERE profit_amount IS NULL OR profit_amount = 0;
      `);
    }
  })();
}

export function applyMigrations(db: Database.Database): void {
  const tableColumns = (table: string): string[] =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
  let version = db.pragma('user_version', { simple: true }) as number;
  const initialVersion = version;
  for (let i = version; i < MIGRATIONS.length; i++) {
    const stmt = MIGRATIONS[i].sql;
    const addCol = stmt.match(/ADD COLUMN\s+(\w+)/i)?.[1];
    // Guard ADD COLUMN by existence check against the *target table* (parsed
    // from the ALTER statement), so fresh DBs built from the full schema.sql
    // never hit "duplicate column name" and chained adds are detected correctly.
    const targetTable = stmt.match(/ALTER TABLE\s+(\w+)/i)?.[1];
    if (!addCol || !targetTable || !tableColumns(targetTable).includes(addCol)) {
      db.exec(stmt);
      console.log(`[migrate] applied migration ${i + 1}: ${stmt}`);
    }
    version = i + 1;
  }
  db.pragma(`user_version = ${Math.max(version, SCHEMA_VERSION)}`);
  migrateLegacyUnits(db);
  migratePrimaryUnitCustomerPrices(db);
  if (initialVersion < 38) migrateLegacyCustomPrices(db);
  normalizePrimaryUnitRows(db);
  normalizeUnitPurchasePrices(db);
  if (initialVersion < MIGRATIONS.length) backfillMarginPricing(db);
}

type UnitInput = {
  id?: string;
  unit?: string;
  multiplierToBase?: number;
  multiplier_to_base?: number;
  sortOrder?: number;
  sort_order?: number;
  pricePerBase?: number;
  price_per_base?: number;
  purchasePricePerBase?: number;
  purchase_price_per_base?: number;
  sellingPrice?: number;
  selling_price?: number;
  marginPct?: number;
  margin_pct?: number;
  bhpAmount?: number;
  bhp_amount?: number;
  inheritParent?: boolean;
  inherit_parent?: boolean | number;
  isPrimary?: boolean;
  is_primary?: boolean;
  customerPrices?: Array<{ customerId?: string; customer_id?: string; price?: number; pricePerBase?: number; sellingPrice?: number; selling_price?: number; marginPct?: number; margin_pct?: number; bhpAmount?: number; bhp_amount?: number; inheritParent?: boolean; inherit_parent?: boolean | number }>;
};

type CustomPriceCustomerInput = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  price?: number;
  totalPrice?: number;
  total_price?: number;
  marginPct?: number;
  margin_pct?: number;
  bhpAmount?: number;
  bhp_amount?: number;
  inheritParent?: boolean;
  inherit_parent?: boolean | number;
};

type CustomPriceInput = {
  id?: string;
  unitId?: string;
  unit_id?: string;
  unitName?: string;
  unit_name?: string;
  quantity?: number;
  totalPrice?: number;
  total_price?: number;
  sortOrder?: number;
  sort_order?: number;
  isActive?: boolean;
  is_active?: boolean;
  marginPct?: number;
  margin_pct?: number;
  bhpAmount?: number;
  bhp_amount?: number;
  customerPrices?: CustomPriceCustomerInput[];
};

type SellingProfile = { price: number; marginPct: number; bhpAmount: number };

const numberValue = (row: Record<string, unknown>, key: string): number => Number(row[key] ?? 0) || 0;

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function medicineSellingProfile(row: Record<string, unknown>): SellingProfile {
  return {
    price: numberValue(row, 'price'),
    marginPct: numberValue(row, 'margin_pct'),
    bhpAmount: numberValue(row, 'bhp_amount'),
  };
}

function unitSellingProfile(row: Record<string, unknown>): SellingProfile {
  return {
    price: numberValue(row, 'selling_price'),
    marginPct: numberValue(row, 'margin_pct'),
    bhpAmount: numberValue(row, 'bhp_amount'),
  };
}

function normalCustomerProfile(row: Record<string, unknown>): SellingProfile {
  return {
    price: numberValue(row, 'price'),
    marginPct: numberValue(row, 'margin_pct'),
    bhpAmount: numberValue(row, 'bhp_amount'),
  };
}

function customSellingProfile(row: Record<string, unknown>): SellingProfile {
  return {
    price: numberValue(row, 'total_price'),
    marginPct: numberValue(row, 'margin_pct'),
    bhpAmount: numberValue(row, 'bhp_amount'),
  };
}

function effectiveCustomerProfile(row: Record<string, unknown>, parent: SellingProfile, local: SellingProfile): SellingProfile {
  return Number(row.inherit_parent) === 1 ? parent : local;
}

function medicineUnits(db: Database.Database, medicineId: string): Record<string, unknown>[] {
  const rows = db.prepare('SELECT * FROM medicine_units WHERE medicine_id = ? ORDER BY sort_order').all(medicineId) as Record<string, unknown>[];
  const medicine = db.prepare('SELECT price, margin_pct, bhp_amount FROM medicines WHERE id = ?').get(medicineId) as Record<string, unknown> | undefined;
  const medicineProfile = medicineSellingProfile(medicine || {});
  const unitProfiles = new Map(rows.map(row => [String(row.id), unitSellingProfile(row)]));
  const primary = rows.find(row => Number(row.is_primary) === 1) || rows[0];
  const prices = db.prepare(`
    SELECT p.id, p.medicine_id, p.medicine_unit_id, p.customer_id,
      p.selling_price,
      p.price_per_base, u.multiplier_to_base AS unit_multiplier,
      p.margin_pct, p.bhp_amount, p.inherit_parent,
      c.name AS customer_name, c.member_no AS customer_member_no
    FROM medicine_unit_customer_prices p
    JOIN medicine_units u ON u.id = p.medicine_unit_id AND u.medicine_id = p.medicine_id
    JOIN customers c ON c.id = p.customer_id AND c.status = 'Aktif'
    WHERE p.medicine_id = ?
    ORDER BY c.name
  `).all(medicineId) as Record<string, unknown>[];
  return rows.map(row => ({
    ...toTS(row),
    customerPrices: prices
      .filter(price => price.medicine_unit_id === row.id)
      .map(price => {
        const parent = primary && String(row.id) === String(primary.id)
          ? medicineProfile
          : unitProfiles.get(String(row.id)) || unitSellingProfile(row);
        const effective = primary && String(row.id) === String(primary.id)
          ? unitSellingProfile({ ...price, multiplier_to_base: price.unit_multiplier })
          : effectiveCustomerProfile(price, parent, {
              ...unitSellingProfile({ ...price, multiplier_to_base: price.unit_multiplier }),
            });
        return toTS({
          id: price.id,
          medicine_id: price.medicine_id,
          unit_id: price.medicine_unit_id,
          customer_id: price.customer_id,
          price: effective.price,
          selling_price: effective.price,
          margin_pct: effective.marginPct,
          bhp_amount: effective.bhpAmount,
          inherit_parent: primary && String(row.id) === String(primary.id) ? 0 : price.inherit_parent,
          customer_name: price.customer_name,
          customer_member_no: price.customer_member_no,
        });
      }),
  }));
}

function medicineCustomPrices(db: Database.Database, medicineId: string): Record<string, unknown>[] {
  const rows = db.prepare(`
    SELECT p.*, u.unit AS unit_name
    FROM medicine_custom_prices p
    JOIN medicine_units u ON u.id = p.unit_id
    WHERE p.medicine_id = ? AND p.is_active = 1
    ORDER BY p.sort_order, p.quantity, p.id
  `).all(medicineId) as Record<string, unknown>[];
  const customers = db.prepare(`
    SELECT c.id AS customer_id, c.name, c.member_no, p.id, p.custom_price_id, p.total_price, p.margin_pct, p.bhp_amount, p.inherit_parent
    FROM medicine_custom_price_customers p
    JOIN customers c ON c.id = p.customer_id
    WHERE p.custom_price_id IN (SELECT id FROM medicine_custom_prices WHERE medicine_id = ?)
      AND c.status = 'Aktif'
    ORDER BY c.name
  `).all(medicineId) as Record<string, unknown>[];
  return rows.map(row => ({
    ...toTS(row),
    customerPrices: customers
      .filter(price => price.custom_price_id === row.id)
      .map(price => {
        const effective = effectiveCustomerProfile(price, customSellingProfile(row), customSellingProfile(price));
        return toTS({
          id: price.id,
          custom_price_id: price.custom_price_id,
          customer_id: price.customer_id,
          price: effective.price,
          margin_pct: effective.marginPct,
          bhp_amount: effective.bhpAmount,
          inherit_parent: price.inherit_parent,
          customer_name: price.name,
          customer_member_no: price.member_no,
        });
      }),
  }));
}

function medicineNormalCustomerPrices(db: Database.Database, medicineId: string): Record<string, unknown>[] {
  return (db.prepare(`
    SELECT p.id, p.medicine_id, p.customer_id, p.price, p.margin_pct, p.bhp_amount,
      u.id AS unit_id, u.unit AS unit_name
    FROM medicine_customer_prices p
    JOIN medicine_units u ON u.medicine_id = p.medicine_id AND u.is_primary = 1
    WHERE p.medicine_id = ?
    ORDER BY p.id
  `).all(medicineId) as Record<string, unknown>[]).map(row => {
    const effective = normalCustomerProfile(row);
    return toTS({
      id: row.id,
      medicine_id: row.medicine_id,
      customer_id: row.customer_id,
      price: effective.price,
      margin_pct: effective.marginPct,
      bhp_amount: effective.bhpAmount,
      inherit_parent: 0,
      unit_id: row.unit_id,
      unit_name: row.unit_name,
    });
  });
}

function medicineResponse(db: Database.Database, row: Record<string, unknown>): Record<string, unknown> {
  return { ...toTS(row), units: medicineUnits(db, String(row.id)), normalCustomerPrices: medicineNormalCustomerPrices(db, String(row.id)), customPrices: medicineCustomPrices(db, String(row.id)) };
}

function normaliseUnits(rawUnits: unknown, medicine: Record<string, unknown>): UnitInput[] {
  const normalizeOrder = (rows: UnitInput[]): UnitInput[] => {
    if (!rows.length) return rows;
    const primaryIndex = Math.max(0, rows.findIndex(unit => Boolean(unit.isPrimary ?? unit.is_primary)));
    const ordered = [rows[primaryIndex], ...rows.filter((_, index) => index !== primaryIndex)];
    return ordered.map((unit, index) => ({ ...unit, sortOrder: index, isPrimary: index === 0 }));
  };

  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    const multiplier = legacyMultiplier({ unit: String(medicine.unit ?? 'Pcs'), unitMultiplier: Number(medicine.unitMultiplier ?? 1) });
    const base = {
      unit: String(medicine.unit ?? 'Pcs'), multiplierToBase: multiplier, sortOrder: 0,
      pricePerBase: Number(medicine.price ?? 0),
      purchasePricePerBase: Number(medicine.purchasePrice ?? 0) / multiplier,
      sellingPrice: Number(medicine.price ?? 0),
      marginPct: Number(medicine.marginPct ?? 0),
      isPrimary: multiplier === 1,
    };
    if (multiplier > 1 && base.unit !== 'Pcs') {
       return normalizeOrder([{ ...base, unit: 'Pcs', multiplierToBase: 1, purchasePricePerBase: Number(medicine.purchasePrice ?? 0) / multiplier, sellingPrice: 0, isPrimary: false }, { ...base, sortOrder: 1, isPrimary: true }]);
    }
    return normalizeOrder([base]);
  }
  const configuredUnits = (rawUnits as UnitInput[]).map((unit, index) => {
    const unitName = String(unit.unit ?? '').trim();
    const multiplier = unitName === 'Lusin'
      ? 12
      : Number(unit.multiplierToBase ?? unit.multiplier_to_base ?? (index === 0 ? 1 : 1));
    const purchasePriceInput = unit.purchasePricePerBase ?? unit.purchase_price_per_base;
    const sellingPriceInput = unit.sellingPrice ?? unit.selling_price;
    const marginInput = unit.marginPct ?? unit.margin_pct;
    const bhpInput = unit.bhpAmount ?? unit.bhp_amount;
    return {
      ...unit,
      unit: unitName,
      multiplierToBase: multiplier,
      sortOrder: index,
      pricePerBase: Number(unit.pricePerBase ?? unit.price_per_base ?? 0),
      purchasePricePerBase: purchasePriceInput === undefined ? undefined : Number(purchasePriceInput),
      sellingPrice: sellingPriceInput === undefined ? undefined : Number(sellingPriceInput),
      marginPct: marginInput === undefined ? undefined : Number(marginInput),
      bhpAmount: bhpInput === undefined ? undefined : Number(bhpInput),
      isPrimary: Boolean(unit.isPrimary ?? unit.is_primary ?? index === 0),
    };
  });
  return normalizeOrder(configuredUnits).map((unit, index) => ({
    ...unit,
    purchasePricePerBase: unit.purchasePricePerBase ?? (index === 0
      ? Number(medicine.purchasePrice ?? 0) / Math.max(1, Number(unit.multiplierToBase) || 1)
      : 0),
    sellingPrice: unit.sellingPrice ?? (index === 0
      ? Number(medicine.price ?? 0)
      : 0),
    // Explicit unit rows are independent selling profiles. Only the
    // legacy no-units branch above may derive values from the medicine row.
    marginPct: unit.marginPct ?? 0,
    bhpAmount: unit.bhpAmount ?? 0,
  }));
}

function saveMedicineUnits(db: Database.Database, medicineId: string, rawUnits: unknown, medicine: Record<string, unknown>): void {
  const units = normaliseUnits(rawUnits, medicine);
  const existingUnits = db.prepare('SELECT id, unit FROM medicine_units WHERE medicine_id = ?').all(medicineId) as { id: string; unit: string }[];
  const existingCustomerInheritance = new Map<string, boolean>(
    (db.prepare('SELECT medicine_unit_id, customer_id, inherit_parent FROM medicine_unit_customer_prices WHERE medicine_id = ?').all(medicineId) as Array<{ medicine_unit_id: string; customer_id: string; inherit_parent?: number }>)
      .map(row => [`${row.medicine_unit_id}|${row.customer_id}`, Number(row.inherit_parent) === 1]),
  );
  const existingIds = new Set(existingUnits.map(unit => unit.id));
  const existingIdsByName = new Map(existingUnits.map(unit => [unit.unit.trim().toLowerCase(), unit.id]));
  const validationError = validateUnitDefinitions(units.map(unit => ({
    unit: unit.unit ?? '', multiplierToBase: unit.multiplierToBase ?? 1,
    sortOrder: unit.sortOrder ?? 0,
    isPrimary: unit.isPrimary,
  })));
  if (validationError) throw new Error(validationError);

  db.prepare('DELETE FROM medicine_unit_customer_prices WHERE medicine_id = ?').run(medicineId);
  db.prepare('DELETE FROM medicine_units WHERE medicine_id = ?').run(medicineId);

  const insertUnit = db.prepare(`INSERT INTO medicine_units
    (id, medicine_id, unit, multiplier_to_base, sort_order, price_per_base, purchase_price_per_base, selling_price, margin_pct, bhp_amount, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertCustomerPrice = db.prepare(`INSERT INTO medicine_unit_customer_prices
    (id, medicine_id, medicine_unit_id, customer_id, price_per_base, selling_price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const primary = units[0];
  const medicinePurchasePrice = Number(medicine['purchasePrice'] ?? medicine['purchase_price'] ?? 0);
  const primaryMultiplier = Math.max(1, Number(primary?.multiplierToBase) || 1);
  const purchasePricePerBase = Math.max(0, medicinePurchasePrice) / primaryMultiplier;
  for (const [index, unit] of units.entries()) {
    const requestedId = String(unit.id ?? '').trim();
    const unitNameKey = String(unit.unit ?? '').trim().toLowerCase();
    const id = existingIds.has(requestedId) ? requestedId : existingIdsByName.get(unitNameKey) || requestedId || randomUUID();
    const multiplier = Math.max(1, Number(unit.multiplierToBase) || 1);
    const sellingPrice = unit.sellingPrice === undefined
      ? (unit === primary ? Number(medicine['price'] ?? 0) : 0)
      : Number(unit.sellingPrice || 0);
    const pricePerBase = unit.pricePerBase === undefined
      ? (unit === primary ? sellingPrice / multiplier : 0)
      : Number(unit.pricePerBase || 0);
    const marginPct = Number(unit.marginPct ?? 0);
    const bhpAmount = Number(unit.bhpAmount ?? 0);
    if (!Number.isFinite(marginPct) || marginPct < 0) throw new Error('Margin harga normal harus >= 0');
    if (!Number.isFinite(bhpAmount) || bhpAmount < 0) throw new Error('BHP harga normal harus >= 0');
    insertUnit.run(id, medicineId, unit.unit, multiplier, index, pricePerBase, purchasePricePerBase, sellingPrice, marginPct, bhpAmount, unit === primary ? 1 : 0);
    const seenCustomers = new Set<string>();
    for (const customerPrice of unit.customerPrices ?? []) {
      const customerId = customerPrice.customerId ?? customerPrice.customer_id;
      const configuredSellingPrice = customerPrice.sellingPrice ?? customerPrice.selling_price;
      const oldPricePerBase = customerPrice.pricePerBase;
      const rawPrice = configuredSellingPrice === undefined
        ? Number(customerPrice.price)
        : Number(configuredSellingPrice);
      const price = oldPricePerBase !== undefined && configuredSellingPrice === undefined
        ? Number(oldPricePerBase) * multiplier
        : rawPrice;
      if (!customerId) continue;
      if (seenCustomers.has(customerId)) throw new Error('Harga customer untuk item dan satuan ini tidak boleh duplikat');
      seenCustomers.add(customerId);
      if (!db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(customerId)) {
        throw new Error('Customer aktif tidak ditemukan');
      }
      const customerMargin = Number(customerPrice.marginPct ?? customerPrice.margin_pct ?? 0);
      if (!Number.isFinite(customerMargin) || customerMargin < 0) throw new Error('Margin harga customer harus >= 0');
      const customerBhp = Number(customerPrice.bhpAmount ?? customerPrice.bhp_amount ?? 0);
      if (!Number.isFinite(customerBhp) || customerBhp < 0) throw new Error('BHP harga customer harus >= 0');
      const rawInheritance = customerPrice.inheritParent ?? customerPrice.inherit_parent;
      const isPrimary = unit === primary;
      const requestedInheritance = booleanValue(rawInheritance, isPrimary ? false : (existingCustomerInheritance.get(`${id}|${customerId}`) ?? true));
      const parentProfile = unit === primary
        ? {
            price: Number(medicine['price'] ?? 0),
            marginPct: Number(medicine['marginPct'] ?? medicine['margin_pct'] ?? 0),
            bhpAmount: Number(medicine['bhpAmount'] ?? medicine['bhp_amount'] ?? 0),
          }
        : { price: sellingPrice, marginPct, bhpAmount };
      const effective = requestedInheritance ? parentProfile : { price, marginPct: customerMargin, bhpAmount: customerBhp };
      if (!requestedInheritance && (!Number.isFinite(price) || price <= 0)) continue;
      if (!Number.isFinite(effective.price) || effective.price <= 0) continue;
      insertCustomerPrice.run(randomUUID(), medicineId, id, customerId, effective.price / multiplier, effective.price, effective.marginPct, effective.bhpAmount, isPrimary ? 0 : (requestedInheritance ? 1 : 0));
      if (isPrimary) {
        db.prepare(`INSERT INTO medicine_customer_prices (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(medicine_id, customer_id) DO UPDATE SET price = excluded.price, margin_pct = excluded.margin_pct, bhp_amount = excluded.bhp_amount, inherit_parent = excluded.inherit_parent`)
          .run(randomUUID(), medicineId, customerId, effective.price, effective.marginPct, effective.bhpAmount, 0);
      }
    }
  }
  db.prepare(`UPDATE medicines SET unit = ?, unit_multiplier = ?, price = ?, purchase_price = ?, updated_at = ? WHERE id = ?`)
    .run(primary.unit, primary.multiplierToBase, medicine['price'] ?? 0, medicinePurchasePrice, new Date().toISOString(), medicineId);
}

function saveNormalCustomerPrices(db: Database.Database, medicineId: string, rawPrices: unknown): void {
  if (!Array.isArray(rawPrices)) return;
  const parent = db.prepare('SELECT price, margin_pct, bhp_amount FROM medicines WHERE id = ?').get(medicineId) as Record<string, unknown> | undefined;
  db.prepare('DELETE FROM medicine_customer_prices WHERE medicine_id = ?').run(medicineId);
  db.prepare(`DELETE FROM medicine_unit_customer_prices
    WHERE medicine_id = ?
      AND medicine_unit_id IN (SELECT id FROM medicine_units WHERE medicine_id = ? AND is_primary = 1)`).run(medicineId, medicineId);
  const insert = db.prepare(`INSERT INTO medicine_customer_prices (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const seen = new Set<string>();
  for (const raw of rawPrices as Record<string, unknown>[]) {
    const customerId = String(raw.customerId ?? raw.customer_id ?? '');
    const price = Number(raw.price ?? raw.totalPrice ?? raw.total_price ?? 0);
    const marginPct = Number(raw.marginPct ?? raw.margin_pct ?? 0);
    const bhpAmount = Number(raw.bhpAmount ?? raw.bhp_amount ?? 0);
    if (!customerId) continue;
    if (!Number.isFinite(marginPct) || marginPct < 0) throw new Error('Margin harga customer harus >= 0');
    if (!Number.isFinite(bhpAmount) || bhpAmount < 0) throw new Error('BHP harga customer harus >= 0');
    if (seen.has(customerId)) throw new Error('Harga customer normal tidak boleh duplikat');
    if (!db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(customerId)) throw new Error('Customer aktif tidak ditemukan');
    seen.add(customerId);
    const rawInheritance = raw.inheritParent ?? raw.inherit_parent;
    const requestedInheritance = booleanValue(rawInheritance, false);
    const effective = requestedInheritance
      ? medicineSellingProfile(parent || {})
      : { price, marginPct, bhpAmount };
    if (!requestedInheritance && (!Number.isFinite(price) || price <= 0)) continue;
    if (!Number.isFinite(effective.price) || effective.price <= 0) continue;
    insert.run(randomUUID(), medicineId, customerId, effective.price, effective.marginPct, effective.bhpAmount, 0);
  }
}

function saveCustomPrices(db: Database.Database, medicineId: string, rawPrices: unknown, inheritedCustomerFlags?: Map<string, boolean>): void {
  if (!Array.isArray(rawPrices)) return;
  const units = db.prepare('SELECT id, unit FROM medicine_units WHERE medicine_id = ?').all(medicineId) as { id: string; unit: string }[];
  const unitIds = new Map(units.map(unit => [unit.id, unit.id]));
  const unitNames = new Map(units.map(unit => [unit.unit.trim().toLowerCase(), unit.id]));
  const existingCustomerInheritance = inheritedCustomerFlags || new Map<string, boolean>(
    (db.prepare(`SELECT p.custom_price_id, p.customer_id, p.inherit_parent
      FROM medicine_custom_price_customers p
      JOIN medicine_custom_prices cp ON cp.id = p.custom_price_id
      WHERE cp.medicine_id = ?`).all(medicineId) as Array<{ custom_price_id: string; customer_id: string; inherit_parent?: number }>)
      .map(row => [`${row.custom_price_id}|${row.customer_id}`, Number(row.inherit_parent) === 1]),
  );
  db.prepare('DELETE FROM medicine_custom_price_customers WHERE custom_price_id IN (SELECT id FROM medicine_custom_prices WHERE medicine_id = ?)').run(medicineId);
  db.prepare('DELETE FROM medicine_custom_prices WHERE medicine_id = ?').run(medicineId);
  const insertPrice = db.prepare(`INSERT INTO medicine_custom_prices
    (id, medicine_id, unit_id, quantity, total_price, margin_pct, bhp_amount, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertCustomer = db.prepare(`INSERT INTO medicine_custom_price_customers
    (id, custom_price_id, customer_id, total_price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const seen = new Set<string>();
  for (const [index, raw] of (rawPrices as CustomPriceInput[]).entries()) {
    const rawUnitId = String(raw.unitId ?? raw.unit_id ?? '').trim();
    const rawUnitName = String(raw.unitName ?? raw.unit_name ?? '').trim().toLowerCase();
    const unitId = unitIds.get(rawUnitId) || unitNames.get(rawUnitName) || unitNames.get(rawUnitId.toLowerCase());
    const quantity = Number(raw.quantity ?? 0);
    const totalPrice = Number(raw.totalPrice ?? raw.total_price ?? 0);
    const marginPct = Number(raw.marginPct ?? raw.margin_pct ?? 0);
    const bhpAmount = Number(raw.bhpAmount ?? raw.bhp_amount ?? 0);
    if (!unitId) throw new Error('Satuan custom price bukan milik item');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Jumlah custom price harus bilangan bulat lebih dari 0');
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw new Error('Harga custom harus lebih dari 0');
    if (!Number.isFinite(marginPct) || marginPct < 0) throw new Error('Margin harga custom harus >= 0');
    if (!Number.isFinite(bhpAmount) || bhpAmount < 0) throw new Error('BHP harga custom harus >= 0');
    const duplicateKey = `${unitId}|${quantity}`;
    if (seen.has(duplicateKey)) throw new Error('Kombinasi jumlah dan satuan custom tidak boleh duplikat');
    seen.add(duplicateKey);
    const id = String(raw.id || randomUUID());
    const isActive = raw.isActive === false || raw.is_active === false ? 0 : 1;
    insertPrice.run(id, medicineId, unitId, quantity, totalPrice, marginPct, bhpAmount, Number(raw.sortOrder ?? raw.sort_order ?? index), isActive);
    const customerSeen = new Set<string>();
    for (const customerPrice of raw.customerPrices ?? []) {
      const customerId = String(customerPrice.customerId ?? customerPrice.customer_id ?? '');
      const customerTotal = Number(customerPrice.price ?? customerPrice.totalPrice ?? customerPrice.total_price ?? 0);
      const customerMargin = Number(customerPrice.marginPct ?? customerPrice.margin_pct ?? 0);
      const customerBhp = Number(customerPrice.bhpAmount ?? customerPrice.bhp_amount ?? 0);
      if (!customerId) continue;
      if (!Number.isFinite(customerMargin) || customerMargin < 0) throw new Error('Margin harga customer custom harus >= 0');
      if (!Number.isFinite(customerBhp) || customerBhp < 0) throw new Error('BHP harga customer custom harus >= 0');
      if (customerSeen.has(customerId)) throw new Error('Harga customer custom tidak boleh duplikat');
      if (!db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(customerId)) throw new Error('Customer aktif tidak ditemukan');
      customerSeen.add(customerId);
      const rawInheritance = customerPrice.inheritParent ?? customerPrice.inherit_parent;
      const inheritParent = booleanValue(rawInheritance, existingCustomerInheritance.get(`${id}|${customerId}`) ?? true);
      const parentProfile = { price: totalPrice, marginPct, bhpAmount };
      const effective = inheritParent ? parentProfile : { price: customerTotal, marginPct: customerMargin, bhpAmount: customerBhp };
      if (!inheritParent && (!Number.isFinite(customerTotal) || customerTotal <= 0)) continue;
      if (!Number.isFinite(effective.price) || effective.price <= 0) continue;
      insertCustomer.run(String(customerPrice.id || randomUUID()), id, customerId, effective.price, effective.marginPct, effective.bhpAmount, inheritParent ? 1 : 0);
    }
  }
}

function uniformCustomerPriceTemplate(rows: Record<string, unknown>[], keys: string[]): Record<string, unknown> | undefined {
  if (!rows.length) return undefined;
  const first = rows[0];
  return rows.every(row => keys.every(key => numberValue(row, key) === numberValue(first, key))) ? first : undefined;
}

/** Copy only already-configured, uniform customer prices to a newly-created customer. */
type CustomerPriceSyncSummary = {
  customersProcessed: number;
  normalInserted: number;
  unitInserted: number;
  customInserted: number;
  totalInserted: number;
};

function emptyCustomerPriceSyncSummary(): CustomerPriceSyncSummary {
  return { customersProcessed: 0, normalInserted: 0, unitInserted: 0, customInserted: 0, totalInserted: 0 };
}

function addCustomerPriceSyncSummary(target: CustomerPriceSyncSummary, source: CustomerPriceSyncSummary): void {
  target.customersProcessed += source.customersProcessed;
  target.normalInserted += source.normalInserted;
  target.unitInserted += source.unitInserted;
  target.customInserted += source.customInserted;
  target.totalInserted += source.totalInserted;
}

function syncCustomerPricesForNewCustomer(db: Database.Database, customerId: string): CustomerPriceSyncSummary {
  const summary = emptyCustomerPriceSyncSummary();
  summary.customersProcessed = 1;
  const medicines = db.prepare('SELECT id FROM medicines ORDER BY id').all() as Array<{ id: string }>;
  const normalRows = db.prepare(`INSERT OR IGNORE INTO medicine_customer_prices
    (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const unitRows = db.prepare(`INSERT OR IGNORE INTO medicine_unit_customer_prices
    (id, medicine_id, medicine_unit_id, customer_id, price_per_base, selling_price, margin_pct, bhp_amount, inherit_parent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const customRows = db.prepare(`INSERT OR IGNORE INTO medicine_custom_price_customers
    (id, custom_price_id, customer_id, total_price, margin_pct, bhp_amount, inherit_parent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  for (const medicine of medicines) {
    const normalTemplate = uniformCustomerPriceTemplate(
      db.prepare(`SELECT price, margin_pct, bhp_amount, inherit_parent
        FROM medicine_customer_prices WHERE medicine_id = ? ORDER BY id`).all(medicine.id) as Record<string, unknown>[],
      ['price', 'margin_pct', 'bhp_amount', 'inherit_parent'],
    );
    if (normalTemplate) {
      const result = normalRows.run(randomUUID(), medicine.id, customerId, numberValue(normalTemplate, 'price'), numberValue(normalTemplate, 'margin_pct'), numberValue(normalTemplate, 'bhp_amount'), numberValue(normalTemplate, 'inherit_parent'));
      summary.normalInserted += result.changes;
      summary.totalInserted += result.changes;
    }

    const units = db.prepare('SELECT id FROM medicine_units WHERE medicine_id = ? AND is_primary = 0 ORDER BY sort_order').all(medicine.id) as Array<{ id: string }>;
    for (const unit of units) {
      const unitTemplate = uniformCustomerPriceTemplate(
        db.prepare(`SELECT price_per_base, selling_price, margin_pct, bhp_amount, inherit_parent
          FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? ORDER BY id`).all(unit.id) as Record<string, unknown>[],
        ['price_per_base', 'selling_price', 'margin_pct', 'bhp_amount', 'inherit_parent'],
      );
      if (unitTemplate) {
        const result = unitRows.run(randomUUID(), medicine.id, unit.id, customerId, numberValue(unitTemplate, 'price_per_base'), numberValue(unitTemplate, 'selling_price'), numberValue(unitTemplate, 'margin_pct'), numberValue(unitTemplate, 'bhp_amount'), numberValue(unitTemplate, 'inherit_parent'));
        summary.unitInserted += result.changes;
        summary.totalInserted += result.changes;
      }
    }

    const customPrices = db.prepare('SELECT id FROM medicine_custom_prices WHERE medicine_id = ? ORDER BY sort_order, id').all(medicine.id) as Array<{ id: string }>;
    for (const customPrice of customPrices) {
      const customTemplate = uniformCustomerPriceTemplate(
        db.prepare(`SELECT total_price, margin_pct, bhp_amount, inherit_parent
          FROM medicine_custom_price_customers WHERE custom_price_id = ? ORDER BY id`).all(customPrice.id) as Record<string, unknown>[],
        ['total_price', 'margin_pct', 'bhp_amount', 'inherit_parent'],
      );
      if (customTemplate) {
        const result = customRows.run(randomUUID(), customPrice.id, customerId, numberValue(customTemplate, 'total_price'), numberValue(customTemplate, 'margin_pct'), numberValue(customTemplate, 'bhp_amount'), numberValue(customTemplate, 'inherit_parent'));
        summary.customInserted += result.changes;
        summary.totalInserted += result.changes;
      }
    }
  }
  return summary;
}

function syncCustomerPricesForAllCustomers(db: Database.Database): CustomerPriceSyncSummary {
  const summary = emptyCustomerPriceSyncSummary();
  const customers = db.prepare('SELECT id FROM customers ORDER BY id').all() as Array<{ id: string }>;
  db.transaction(() => {
    for (const customer of customers) {
      addCustomerPriceSyncSummary(summary, syncCustomerPricesForNewCustomer(db, customer.id));
    }
  })();
  return summary;
}

function findUnit(db: Database.Database, medicineId: string, unitId?: string, unitName?: string, multiplier?: number): Record<string, unknown> | undefined {
  if (unitId) {
    return db.prepare('SELECT * FROM medicine_units WHERE id = ? AND medicine_id = ?').get(unitId, medicineId) as Record<string, unknown> | undefined;
  }
  if (unitName) {
    const byName = db.prepare('SELECT * FROM medicine_units WHERE medicine_id = ? AND unit = ?').get(medicineId, unitName) as Record<string, unknown> | undefined;
    return byName && (!multiplier || Number(byName.multiplier_to_base) === Number(multiplier)) ? byName : undefined;
  }
  return db.prepare('SELECT * FROM medicine_units WHERE medicine_id = ? ORDER BY is_primary DESC, sort_order DESC LIMIT 1').get(medicineId) as Record<string, unknown> | undefined;
}

type ConfiguredSellingPrice = SellingProfile;

function configuredUnitSellingPrice(db: Database.Database, medicineId: string, unitId: string): ConfiguredSellingPrice | undefined {
  const row = db.prepare('SELECT * FROM medicine_units WHERE id = ? AND medicine_id = ?').get(unitId, medicineId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const profile = unitSellingProfile(row);
  return profile.price > 0 ? profile : undefined;
}

function configuredCustomerPrice(db: Database.Database, medicineId: string, unitId: string, customerId: string): ConfiguredSellingPrice | undefined {
  const unit = db.prepare('SELECT * FROM medicine_units WHERE id = ? AND medicine_id = ?').get(unitId, medicineId) as Record<string, unknown> | undefined;
  if (!unit) return undefined;
  if (Number(unit.is_primary) === 1) {
    const normal = db.prepare('SELECT * FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').get(medicineId, customerId) as Record<string, unknown> | undefined;
    if (!normal) return undefined;
    const profile = normalCustomerProfile(normal);
    return profile.price > 0 ? profile : undefined;
  }
  const unitPrice = db.prepare(`
    SELECT *
    FROM medicine_unit_customer_prices
    WHERE medicine_id = ? AND medicine_unit_id = ? AND customer_id = ?
  `).get(medicineId, unitId, customerId) as Record<string, unknown> | undefined;
  if (unitPrice) {
    const profile = effectiveCustomerProfile(unitPrice, unitSellingProfile(unit), unitSellingProfile({ ...unitPrice, multiplier_to_base: unit.multiplier_to_base }));
    return profile.price > 0 ? profile : undefined;
  }
  return undefined;
}

function configuredCustomPrice(db: Database.Database, customPriceId: string, customerId?: string): ConfiguredSellingPrice | undefined {
  const normal = db.prepare('SELECT * FROM medicine_custom_prices WHERE id = ? AND is_active = 1').get(customPriceId) as Record<string, unknown> | undefined;
  if (!normal) return undefined;
  if (customerId) {
    const customer = db.prepare('SELECT * FROM medicine_custom_price_customers WHERE custom_price_id = ? AND customer_id = ?').get(customPriceId, customerId) as Record<string, unknown> | undefined;
    if (customer) {
      const profile = effectiveCustomerProfile(customer, customSellingProfile(normal), customSellingProfile(customer));
      if (profile.price > 0) return profile;
    }
  }
  const profile = customSellingProfile(normal);
  return profile.price > 0 ? profile : undefined;
}

// ---------------------------------------------------------------------------
// Express app factory — shared by the web CLI (server.ts) and Electron main
// ---------------------------------------------------------------------------
export function createServerApp(options: ServerOptions) {
  const { dbPath } = options;
  const corsOrigin = options.corsOrigin ?? 'http://localhost:3000';

  // Ensure the DB directory exists (userData dir inside Electron)
  const dbDir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------------
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Run schema idempotently — strip DROP TABLE lines so restarts never wipe data
  const schemaSql = resolveSchemaSql();
  const idempotentSql = schemaSql
    .split('\n')
    .filter(line => !line.trim().startsWith('DROP TABLE'))
    .join('\n')
    // schema.sql uses bare CREATE TABLE (not IF NOT EXISTS); make it idempotent
    .replace(/CREATE TABLE (?!IF NOT EXISTS)/g, 'CREATE TABLE IF NOT EXISTS ');
  db.exec(idempotentSql);

  // Upgrade existing databases without touching their data
  applyMigrations(db);

  // ---------------------------------------------------------------------------
  // Express app
  // ---------------------------------------------------------------------------
  const app = express();

// CORS — allow the Vite dev server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.json());

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
app.get('/api/customers', (req, res) => {
  try {
    const rows = (db.prepare('SELECT * FROM customers').all() as Record<string, unknown>[]).map(r => toTS(r));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const body = { ...req.body, id: req.body.id ?? randomUUID() };
    const row = toSQL(body) as Record<string, unknown>;
    const cols = Object.keys(row);
    db.transaction(() => {
      db.prepare(`INSERT INTO customers (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      syncCustomerPricesForNewCustomer(db, String(row.id));
    })();
    const inserted = db.prepare('SELECT * FROM customers WHERE id = ?').get(row.id as string) as Record<string, unknown>;
    res.json({ success: true, data: toTS(inserted) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const row = toSQL(req.body) as Record<string, unknown>;
    delete row['id'];
    const setCols = Object.keys(row).map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE customers SET ${setCols} WHERE id = @_id`).run({ ...row, _id: req.params.id });
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ success: true, data: toTS(updated) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Medicine Customer Prices (Harga Jual Spesifik per Customer)
// ---------------------------------------------------------------------------
app.get('/api/medicine_customer_prices', (req, res) => {
  try {
    const { medicine_id } = req.query;
    const filter = medicine_id ? 'AND p.medicine_id = ?' : '';
    const params = medicine_id ? [medicine_id] : [];
    const normalRows = db.prepare(`
      SELECT p.id, p.medicine_id, p.customer_id, p.price, p.margin_pct, p.bhp_amount, p.inherit_parent,
        m.price AS parent_price, m.margin_pct AS parent_margin_pct, m.bhp_amount AS parent_bhp_amount,
        u.id AS unit_id, u.unit AS unit_name, 1 AS is_primary
      FROM medicine_customer_prices p
      JOIN medicines m ON m.id = p.medicine_id
      JOIN medicine_units u ON u.medicine_id = p.medicine_id AND u.is_primary = 1
      WHERE 1 = 1 ${filter}
    `).all(...params) as Record<string, unknown>[];
    const unitRows = db.prepare(`
      SELECT p.id, p.medicine_id, p.customer_id, p.selling_price, p.price_per_base,
        p.margin_pct, p.bhp_amount, p.inherit_parent, p.medicine_unit_id AS unit_id,
        u.unit AS unit_name, u.multiplier_to_base AS unit_multiplier,
        u.selling_price AS parent_selling_price, u.price_per_base AS parent_price_per_base,
        u.margin_pct AS parent_margin_pct, u.bhp_amount AS parent_bhp_amount,
        u.multiplier_to_base AS parent_multiplier, u.is_primary
      FROM medicine_unit_customer_prices p
      JOIN medicine_units u ON u.id = p.medicine_unit_id AND u.medicine_id = p.medicine_id
      WHERE u.is_primary = 0 ${filter}
    `).all(...params) as Record<string, unknown>[];
    const rows = [...normalRows, ...unitRows].map(row => {
      const parent = Number(row.is_primary) === 1
        ? { price: numberValue(row, 'parent_price'), marginPct: numberValue(row, 'parent_margin_pct'), bhpAmount: numberValue(row, 'parent_bhp_amount') }
        : unitSellingProfile({ selling_price: row.parent_selling_price, price_per_base: row.parent_price_per_base, multiplier_to_base: row.parent_multiplier, margin_pct: row.parent_margin_pct, bhp_amount: row.parent_bhp_amount });
      const local = Number(row.is_primary) === 1
        ? normalCustomerProfile(row)
        : unitSellingProfile({ selling_price: row.selling_price, price_per_base: row.price_per_base, multiplier_to_base: row.unit_multiplier, margin_pct: row.margin_pct, bhp_amount: row.bhp_amount });
      const isPrimary = Number(row.is_primary) === 1;
      const effective = isPrimary ? local : effectiveCustomerProfile(row, parent, local);
      return toTS({
        id: row.id,
        medicine_id: row.medicine_id,
        customer_id: row.customer_id,
        price: effective.price,
        margin_pct: effective.marginPct,
        bhp_amount: effective.bhpAmount,
        inherit_parent: isPrimary ? 0 : row.inherit_parent,
        unit_id: row.unit_id,
        unit_name: row.unit_name,
      });
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/medicine_customer_prices/sync', (req, res) => {
  try {
    const summary = syncCustomerPricesForAllCustomers(db);
    res.json({ success: true, data: summary });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/medicine_customer_prices', (req, res) => {
  try {
    const body = { ...req.body, id: req.body.id ?? randomUUID() };
    if (!body.medicineId || !body.customerId) {
      return res.status(400).json({ success: false, error: 'Item dan customer wajib dipilih' });
    }
    if (!db.prepare('SELECT id FROM medicines WHERE id = ?').get(body.medicineId)) {
      return res.status(400).json({ success: false, error: 'Item tidak ditemukan' });
    }
    if (!db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(body.customerId)) {
      return res.status(400).json({ success: false, error: 'Customer aktif tidak ditemukan' });
    }
    const unit = findUnit(db, body.medicineId, body.unitId, body.unitName, body.unitMultiplier);
    if (!unit) return res.status(400).json({ success: false, error: 'Satuan item tidak ditemukan' });
    const isPrimary = Number((unit as Record<string, unknown>).is_primary) === 1;
    const requestedInheritance = booleanValue(body.inheritParent ?? body.inherit_parent, isPrimary ? false : true);
    if (db.prepare('SELECT id FROM medicine_unit_customer_prices WHERE medicine_unit_id = ? AND customer_id = ?').get(unit.id, body.customerId)) {
      return res.status(409).json({ success: false, error: 'Harga customer untuk item dan satuan ini sudah ada' });
    }
    const multiplier = Math.max(1, Number(unit.multiplier_to_base) || 1);
    const sellingPrice = body.sellingPrice === undefined
      ? (isPrimary ? Number(body.price) : Number(body.price) * multiplier)
      : Number(body.sellingPrice);
    const marginPct = Number(body.marginPct ?? body.margin_pct ?? 0);
    const bhpAmount = Number(body.bhpAmount ?? body.bhp_amount ?? 0);
    if (!Number.isFinite(marginPct) || marginPct < 0) return res.status(400).json({ success: false, error: 'Margin harga customer harus >= 0' });
    if (!Number.isFinite(bhpAmount) || bhpAmount < 0) return res.status(400).json({ success: false, error: 'BHP harga customer harus >= 0' });
    if (!requestedInheritance && (!Number.isFinite(sellingPrice) || sellingPrice <= 0)) return res.status(400).json({ success: false, error: 'Harga customer harus lebih dari 0' });
    const parent = isPrimary
      ? medicineSellingProfile(db.prepare('SELECT price, margin_pct, bhp_amount FROM medicines WHERE id = ?').get(body.medicineId) as Record<string, unknown> | undefined || {})
      : unitSellingProfile(unit);
    const effective = requestedInheritance ? parent : { price: sellingPrice, marginPct, bhpAmount };
    if (!Number.isFinite(effective.price) || effective.price <= 0) {
      return res.status(400).json({ success: false, error: 'Harga induk customer harus lebih dari 0' });
    }
    db.prepare(`INSERT INTO medicine_unit_customer_prices
      (id, medicine_id, medicine_unit_id, customer_id, price_per_base, selling_price, margin_pct, bhp_amount, inherit_parent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(body.id, body.medicineId, unit.id, body.customerId, effective.price / multiplier, effective.price, effective.marginPct, effective.bhpAmount, isPrimary ? 0 : (requestedInheritance ? 1 : 0));
    if (isPrimary) {
      db.prepare(`INSERT INTO medicine_customer_prices (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(medicine_id, customer_id) DO UPDATE SET price = excluded.price, margin_pct = excluded.margin_pct, bhp_amount = excluded.bhp_amount, inherit_parent = excluded.inherit_parent`)
        .run(randomUUID(), body.medicineId, body.customerId, effective.price, effective.marginPct, effective.bhpAmount, 0);
    }
    const inserted = {
      id: body.id,
      medicineId: body.medicineId,
      customerId: body.customerId,
      unitId: unit.id,
      unitName: unit.unit,
      price: effective.price,
      marginPct: effective.marginPct,
      bhpAmount: effective.bhpAmount,
      inheritParent: isPrimary ? false : requestedInheritance,
    };
    res.json({ success: true, data: inserted });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, error: 'Harga customer untuk item dan satuan ini sudah ada' });
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/medicine_customer_prices/:id', (req, res) => {
  try {
    const newRow = db.prepare('SELECT medicine_id, customer_id, medicine_unit_id FROM medicine_unit_customer_prices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    const oldRow = db.prepare('SELECT medicine_id, customer_id FROM medicine_customer_prices WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (newRow) {
      db.prepare('DELETE FROM medicine_unit_customer_prices WHERE id = ?').run(req.params.id);
      const primary = db.prepare('SELECT id FROM medicine_units WHERE medicine_id = ? AND is_primary = 1').get(newRow.medicine_id) as { id?: string } | undefined;
      if (primary?.id === newRow.medicine_unit_id) db.prepare('DELETE FROM medicine_customer_prices WHERE medicine_id = ? AND customer_id = ?').run(newRow.medicine_id, newRow.customer_id);
    }
    db.prepare('DELETE FROM medicine_customer_prices WHERE id = ?').run(req.params.id);
    if (oldRow) db.prepare('DELETE FROM medicine_unit_customer_prices WHERE medicine_id = ? AND customer_id = ? AND medicine_unit_id IN (SELECT id FROM medicine_units WHERE medicine_id = ? AND is_primary = 1)').run(oldRow.medicine_id, oldRow.customer_id, oldRow.medicine_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/medicine_customer_prices/by-medicine/:medicineId', (req, res) => {
  try {
    db.prepare('DELETE FROM medicine_unit_customer_prices WHERE medicine_id = ?').run(req.params.medicineId);
    db.prepare('DELETE FROM medicine_customer_prices WHERE medicine_id = ?').run(req.params.medicineId);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// New package-price API. The medicine PUT route remains the atomic form path;
// these routes are for integrations that edit one custom package at a time.
function customPriceWriteInput(db: Database.Database, body: Record<string, unknown>, existingId?: string) {
  const existing = existingId
    ? db.prepare('SELECT * FROM medicine_custom_prices WHERE id = ?').get(existingId) as Record<string, unknown> | undefined
    : undefined;
  const medicineId = String(body.medicineId ?? existing?.medicine_id ?? '');
  const unitId = String(body.unitId ?? existing?.unit_id ?? '');
  if (!medicineId || !db.prepare('SELECT id FROM medicines WHERE id = ?').get(medicineId)) throw new Error('Item tidak ditemukan');
  const unit = db.prepare('SELECT id FROM medicine_units WHERE id = ? AND medicine_id = ?').get(unitId, medicineId);
  if (!unit) throw new Error('Satuan item tidak ditemukan');
  const quantity = Number(body.quantity ?? existing?.quantity ?? 0);
  const totalPrice = Number(body.totalPrice ?? body.total_price ?? existing?.total_price ?? 0);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Jumlah custom price harus bilangan bulat lebih dari 0');
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw new Error('Harga custom harus lebih dari 0');
  const duplicate = db.prepare(`SELECT id FROM medicine_custom_prices
    WHERE medicine_id = ? AND unit_id = ? AND quantity = ? AND id != ?`).get(medicineId, unitId, quantity, existingId || '') as { id?: string } | undefined;
  if (duplicate) throw new Error('Kombinasi jumlah dan satuan custom tidak boleh duplikat');

  const marginPct = Number(body.marginPct ?? body.margin_pct ?? existing?.margin_pct ?? 0);
  if (!Number.isFinite(marginPct) || marginPct < 0) throw new Error('Margin harga custom harus >= 0');
  const bhpAmount = Number(body.bhpAmount ?? body.bhp_amount ?? existing?.bhp_amount ?? 0);
  if (!Number.isFinite(bhpAmount) || bhpAmount < 0) throw new Error('BHP harga custom harus >= 0');

  const applyAll = body.applyAll === true || body.applyAllCustomers === true;
  const hasCustomers = applyAll || Array.isArray(body.customerPrices) || Array.isArray(body.customerIds);
  const existingCustomerInheritance = existingId
    ? new Map<string, boolean>(
      (db.prepare('SELECT customer_id, inherit_parent FROM medicine_custom_price_customers WHERE custom_price_id = ?').all(existingId) as Array<{ customer_id: string; inherit_parent?: number }>)
        .map(row => [row.customer_id, Number(row.inherit_parent) === 1]),
    )
    : new Map<string, boolean>();
  const defaultInheritParent = booleanValue(body.inheritParent ?? body.inherit_parent, true);
  let customerPrices: Array<{ customerId: string; price: number; marginPct: number; bhpAmount: number; inheritParent: boolean }> | undefined;
  if (hasCustomers) {
    if (applyAll) {
      const price = Number(body.customerPrice ?? body.customerTotalPrice ?? body.price ?? 0);
      const marginPct = Number(body.customerMarginPct ?? body.marginPct ?? body.margin_pct ?? 0);
      const bhpAmount = Number(body.customerBhpAmount ?? body.bhpAmount ?? body.bhp_amount ?? 0);
      customerPrices = (db.prepare("SELECT id FROM customers WHERE status = 'Aktif'").all() as { id: string }[])
        .map(customer => ({ customerId: customer.id, price, marginPct, bhpAmount, inheritParent: defaultInheritParent }));
    } else if (Array.isArray(body.customerIds)) {
      const price = Number(body.customerPrice ?? body.customerTotalPrice ?? body.price ?? 0);
      const marginPct = Number(body.customerMarginPct ?? body.marginPct ?? body.margin_pct ?? 0);
      const bhpAmount = Number(body.customerBhpAmount ?? body.bhpAmount ?? body.bhp_amount ?? 0);
      customerPrices = (body.customerIds as unknown[]).map(customerId => ({ customerId: String(customerId), price, marginPct, bhpAmount, inheritParent: defaultInheritParent }));
    } else {
      customerPrices = (body.customerPrices as Record<string, unknown>[]).map(customer => ({
        customerId: String(customer.customerId ?? customer.customer_id ?? ''),
        price: Number(customer.price ?? customer.totalPrice ?? customer.total_price ?? 0),
        marginPct: Number(customer.marginPct ?? customer.margin_pct ?? 0),
        bhpAmount: Number(customer.bhpAmount ?? customer.bhp_amount ?? 0),
        inheritParent: booleanValue(customer.inheritParent ?? customer.inherit_parent, existingCustomerInheritance.get(String(customer.customerId ?? customer.customer_id ?? '')) ?? true),
      }));
    }
    customerPrices = customerPrices.map(customer => customer.inheritParent
      ? { ...customer, price: totalPrice, marginPct, bhpAmount }
      : customer);
    const seen = new Set<string>();
    for (const customer of customerPrices) {
      if (!customer.customerId || seen.has(customer.customerId)) throw new Error('Harga customer custom tidak boleh duplikat');
      if (!Number.isFinite(customer.price) || customer.price <= 0) throw new Error('Harga customer custom harus lebih dari 0');
      if (!Number.isFinite(customer.marginPct) || customer.marginPct < 0) throw new Error('Margin harga customer custom harus >= 0');
      if (!Number.isFinite(customer.bhpAmount) || customer.bhpAmount < 0) throw new Error('BHP harga customer custom harus >= 0');
      if (!db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(customer.customerId)) throw new Error('Customer aktif tidak ditemukan');
      seen.add(customer.customerId);
    }
  }
  return {
    medicineId,
    unitId,
    quantity,
    totalPrice,
    marginPct,
    bhpAmount,
    sortOrder: Number(body.sortOrder ?? existing?.sort_order ?? 0),
    isActive: body.isActive === false || body.is_active === false ? 0 : 1,
    customerPrices,
  };
}

app.get('/api/medicine_custom_prices', (req, res) => {
  try {
    const medicineId = String(req.query.medicine_id ?? '');
    if (medicineId) return res.json({ success: true, data: medicineCustomPrices(db, medicineId) });
    const ids = (db.prepare('SELECT DISTINCT medicine_id FROM medicine_custom_prices').all() as { medicine_id: string }[]).map(row => row.medicine_id);
    res.json({ success: true, data: ids.flatMap(id => medicineCustomPrices(db, id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/medicine_custom_prices', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const id = String(body.id ?? randomUUID());
    const input = customPriceWriteInput(db, body);
    db.transaction(() => {
      db.prepare(`INSERT INTO medicine_custom_prices
        (id, medicine_id, unit_id, quantity, total_price, margin_pct, bhp_amount, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.medicineId, input.unitId, input.quantity, input.totalPrice, input.marginPct, input.bhpAmount, input.sortOrder, input.isActive);
      if (input.customerPrices) {
        const insert = db.prepare('INSERT INTO medicine_custom_price_customers (id, custom_price_id, customer_id, total_price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?)');
        input.customerPrices.forEach(customer => insert.run(randomUUID(), id, customer.customerId, customer.price, customer.marginPct, customer.bhpAmount, customer.inheritParent ? 1 : 0));
      }
    })();
    const created = medicineCustomPrices(db, input.medicineId).find(price => price.id === id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /Item|Satuan|Jumlah|Harga|Customer|Kombinasi/i.test(String(err.message))) return res.status(400).json({ success: false, error: String(err.message) });
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/medicine_custom_prices/:id', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const input = customPriceWriteInput(db, body, req.params.id);
    db.transaction(() => {
      const updated = db.prepare(`UPDATE medicine_custom_prices SET unit_id = ?, quantity = ?, total_price = ?, margin_pct = ?, bhp_amount = ?, sort_order = ?, is_active = ?
        WHERE id = ? AND medicine_id = ?`).run(input.unitId, input.quantity, input.totalPrice, input.marginPct, input.bhpAmount, input.sortOrder, input.isActive, req.params.id, input.medicineId);
      if (!updated.changes) throw new Error('Harga custom tidak ditemukan');
      if (input.customerPrices) {
        db.prepare('DELETE FROM medicine_custom_price_customers WHERE custom_price_id = ?').run(req.params.id);
        const insert = db.prepare('INSERT INTO medicine_custom_price_customers (id, custom_price_id, customer_id, total_price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?)');
        input.customerPrices.forEach(customer => insert.run(randomUUID(), req.params.id, customer.customerId, customer.price, customer.marginPct, customer.bhpAmount, customer.inheritParent ? 1 : 0));
      }
    })();
    const updated = medicineCustomPrices(db, input.medicineId).find(price => price.id === req.params.id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /Item|Satuan|Jumlah|Harga|Customer|Kombinasi|tidak ditemukan/i.test(String(err.message))) return res.status(400).json({ success: false, error: String(err.message) });
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/medicine_custom_prices/:id', (req, res) => {
  try {
    const deleted = db.prepare('DELETE FROM medicine_custom_prices WHERE id = ?').run(req.params.id);
    if (!deleted.changes) return res.status(404).json({ success: false, error: 'Harga custom tidak ditemukan' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------
app.get('/api/doctors', (req, res) => {
  try {
    const rows = (db.prepare('SELECT * FROM doctors').all() as Record<string, unknown>[]).map(r => toTS(r));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/doctors', (req, res) => {
  try {
    const body = { ...req.body, id: req.body.id ?? randomUUID() };
    const row = toSQL(body) as Record<string, unknown>;
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO doctors (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
    const inserted = db.prepare('SELECT * FROM doctors WHERE id = ?').get(row.id as string) as Record<string, unknown>;
    res.json({ success: true, data: toTS(inserted) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/doctors/:id', (req, res) => {
  try {
    const row = toSQL(req.body) as Record<string, unknown>;
    delete row['id'];
    const setCols = Object.keys(row).map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE doctors SET ${setCols} WHERE id = @_id`).run({ ...row, _id: req.params.id });
    const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ success: true, data: toTS(updated) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/doctors/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Cash flows
// ---------------------------------------------------------------------------
app.get('/api/cash_flows', (req, res) => {
  try {
    const rows = (db.prepare('SELECT * FROM cash_flows ORDER BY date DESC').all() as Record<string, unknown>[]).map(r => toTS(r));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/cash_flows', (req, res) => {
  try {
    const body = { ...req.body, id: req.body.id ?? randomUUID() };
    const row = toSQL(body) as Record<string, unknown>;
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO cash_flows (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
    const inserted = db.prepare('SELECT * FROM cash_flows WHERE id = ?').get(row.id as string) as Record<string, unknown>;
    res.json({ success: true, data: toTS(inserted) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/cash_flows/:id', (req, res) => {
  try {
    const row = toSQL(req.body) as Record<string, unknown>;
    delete row['id'];
    const setCols = Object.keys(row).map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE cash_flows SET ${setCols} WHERE id = @_id`).run({ ...row, _id: req.params.id });
    const updated = db.prepare('SELECT * FROM cash_flows WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ success: true, data: toTS(updated) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/cash_flows/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM cash_flows WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Stock history (read-only)
// ---------------------------------------------------------------------------
app.get('/api/stock_history', (req, res) => {
  try {
    const rows = (db.prepare('SELECT * FROM stock_history ORDER BY updated_at DESC, date DESC, id DESC').all() as Record<string, unknown>[]).map(row => {
      const obj = toTS(row);
      // user_name → userName via toTS; rename to user as per StockHistory type
      obj.user = obj.userName;
      delete obj.userName;
      return obj;
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/stock_history', (req, res) => {
  try {
    const body = { ...req.body, id: req.body.id ?? randomUUID() };
    const row = toSQL(body) as Record<string, unknown>;
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO stock_history (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
    const inserted = db.prepare('SELECT * FROM stock_history WHERE id = ?').get(row.id as string) as Record<string, unknown>;
    const obj = toTS(inserted);
    obj.user = obj.userName;
    delete obj.userName;
    res.json({ success: true, data: obj });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Routes: Settings
// ---------------------------------------------------------------------------

app.get('/api/settings', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    // Return empty object when no settings row yet — AppContext treats empty DB as needing seed
    res.json({ success: true, data: row ? toTS(row) : {} });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const data = toSQL(req.body) as Record<string, unknown>;
    data['id'] = 1; // always force id=1
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO settings (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`
    );
    stmt.run(data);
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    res.json({ success: true, data: toTS(row) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Routes: Users
// ---------------------------------------------------------------------------

app.get('/api/users', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
    res.json({ success: true, data: rows.map(r => toTS(r)) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const b = { ...req.body, id: req.body.id ?? randomUUID() };
    if (!b.name?.trim()) return res.status(400).json({ success: false, error: 'Name tidak boleh kosong' });
    if (!b.username?.trim()) return res.status(400).json({ success: false, error: 'Username tidak boleh kosong' });
    if (!b.password?.trim()) return res.status(400).json({ success: false, error: 'Password tidak boleh kosong' });
    if (!['admin', 'kasir'].includes(b.role)) return res.status(400).json({ success: false, error: 'Role harus admin atau kasir' });

    const data = toSQL(b) as Record<string, unknown>;
    const cols = Object.keys(data);
    db.prepare(`INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(data);
    const row = db.prepare('SELECT * FROM users WHERE id = @id').get({ id: data['id'] }) as Record<string, unknown>;
    res.json({ success: true, data: toTS(row) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Username sudah digunakan' });
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const b = req.body;
    if (b.name !== undefined && !b.name?.trim()) return res.status(400).json({ success: false, error: 'Name tidak boleh kosong' });
    if (b.username !== undefined && !b.username?.trim()) return res.status(400).json({ success: false, error: 'Username tidak boleh kosong' });
    if (b.password !== undefined && !b.password?.trim()) return res.status(400).json({ success: false, error: 'Password tidak boleh kosong' });
    if (b.role !== undefined && !['admin', 'kasir'].includes(b.role)) return res.status(400).json({ success: false, error: 'Role harus admin atau kasir' });

    const data = toSQL(b) as Record<string, unknown>;
    delete data['id']; // don't overwrite PK
    const setCols = Object.keys(data).map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE users SET ${setCols} WHERE id = @_id`).run({ ...data, _id: req.params.id });
    const row = db.prepare('SELECT * FROM users WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    res.json({ success: true, data: toTS(row) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Username sudah digunakan' });
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    if (!user) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    if (user['is_super_admin'] === 1) return res.status(400).json({ success: false, error: 'Super admin tidak dapat dihapus' });

    // Guard: cannot delete the last admin
    const adminCount = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get() as { cnt: number }).cnt;
    if (user['role'] === 'admin' && adminCount <= 1) {
      return res.status(400).json({ success: false, error: 'Tidak dapat menghapus admin terakhir' });
    }

    db.prepare('DELETE FROM users WHERE id = @id').run({ id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Routes: Medicines
// ---------------------------------------------------------------------------

app.get('/api/medicines', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM medicines ORDER BY updated_at DESC, id DESC').all() as Record<string, unknown>[];
    res.json({ success: true, data: rows.map(r => medicineResponse(db, r)) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/medicines', (req, res) => {
  try {
    const b = { ...req.body, id: req.body.id ?? randomUUID() };
    if (!b.name?.trim()) return res.status(400).json({ success: false, error: 'Name tidak boleh kosong' });
    if (!b.code?.trim()) return res.status(400).json({ success: false, error: 'Code tidak boleh kosong' });
    if (!b.category?.trim()) return res.status(400).json({ success: false, error: 'Category tidak boleh kosong' });
    if (!b.unit?.trim()) return res.status(400).json({ success: false, error: 'Unit tidak boleh kosong' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expiredDate ?? '')) return res.status(400).json({ success: false, error: 'expired_date harus format YYYY-MM-DD' });
    if (typeof b.price !== 'number' || b.price < 0) return res.status(400).json({ success: false, error: 'Price harus >= 0' });
    if (b.marginPct !== undefined && (!Number.isFinite(Number(b.marginPct)) || Number(b.marginPct) < 0)) return res.status(400).json({ success: false, error: 'Margin harga normal harus >= 0' });

    const { units: rawUnits, customPrices: rawCustomPrices, normalCustomerPrices: rawNormalCustomerPrices, customerPrices: _customerPrices, ...medicineBody } = b;
    const data = toSQL(medicineBody) as Record<string, unknown>;
    const run = db.transaction(() => {
      const cols = Object.keys(data);
      db.prepare(`INSERT INTO medicines (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(data);
      saveMedicineUnits(db, String(data.id), rawUnits, b);
      saveNormalCustomerPrices(db, String(data.id), rawNormalCustomerPrices);
      saveCustomPrices(db, String(data.id), rawCustomPrices);
    });
    run();
    const row = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: data['id'] }) as Record<string, unknown>;
    res.json({ success: true, data: medicineResponse(db, row) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Kode obat sudah digunakan' });
    if (/Satuan|Customer|Harga customer|Kombinasi|Jumlah custom|Custom price/i.test(String(err.message))) return res.status(400).json({ success: false, error: String(err.message) });
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.put('/api/medicines/:id', (req, res) => {
  try {
    const b = req.body;
    if (b.name !== undefined && !b.name?.trim()) return res.status(400).json({ success: false, error: 'Name tidak boleh kosong' });
    if (b.code !== undefined && !b.code?.trim()) return res.status(400).json({ success: false, error: 'Code tidak boleh kosong' });
    if (b.category !== undefined && !b.category?.trim()) return res.status(400).json({ success: false, error: 'Category tidak boleh kosong' });
    if (b.unit !== undefined && !b.unit?.trim()) return res.status(400).json({ success: false, error: 'Unit tidak boleh kosong' });
    if (b.expiredDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(b.expiredDate)) return res.status(400).json({ success: false, error: 'expired_date harus format YYYY-MM-DD' });
    if (b.price !== undefined && (typeof b.price !== 'number' || b.price < 0)) return res.status(400).json({ success: false, error: 'Price harus >= 0' });
    if (b.marginPct !== undefined && (!Number.isFinite(Number(b.marginPct)) || Number(b.marginPct) < 0)) return res.status(400).json({ success: false, error: 'Margin harga normal harus >= 0' });
    if (b.stock !== undefined && (typeof b.stock !== 'number' || b.stock < 0 || isNaN(b.stock))) return res.status(400).json({ success: false, error: 'Stock harus >= 0' });

    const existing = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ success: false, error: 'Obat tidak ditemukan' });
    const { units: rawUnits, customPrices: rawCustomPrices, normalCustomerPrices: rawNormalCustomerPrices, customerPrices: _customerPrices, ...medicineBody } = b;
    const existingCustomCustomerInheritance = new Map<string, boolean>(
      (db.prepare(`SELECT p.custom_price_id, p.customer_id, p.inherit_parent
        FROM medicine_custom_price_customers p
        JOIN medicine_custom_prices cp ON cp.id = p.custom_price_id
        WHERE cp.medicine_id = ?`).all(req.params.id) as Array<{ custom_price_id: string; customer_id: string; inherit_parent?: number }>)
        .map(row => [`${row.custom_price_id}|${row.customer_id}`, Number(row.inherit_parent) === 1]),
    );
    const data = toSQL(medicineBody) as Record<string, unknown>;
    delete data['id'];
    delete data['updated_at'];
    const setCols = Object.keys(data).map(c => `${c} = @${c}`).join(', ');
    const run = db.transaction(() => {
      const updateSql = setCols
        ? `UPDATE medicines SET ${setCols}, updated_at = @updated_at WHERE id = @_id`
        : `UPDATE medicines SET updated_at = @updated_at WHERE id = @_id`;
      db.prepare(updateSql).run({ ...data, _id: req.params.id, updated_at: new Date().toISOString() });
      if (Array.isArray(rawUnits)) {
        const current = toTS(existing);
        saveMedicineUnits(db, req.params.id, rawUnits, { ...current, ...b });
      } else if (Object.prototype.hasOwnProperty.call(b, 'purchasePrice')) {
        normalizeMedicinePurchasePrices(db, req.params.id, Number(b.purchasePrice) || 0);
      }
      saveNormalCustomerPrices(db, req.params.id, rawNormalCustomerPrices);
      saveCustomPrices(db, req.params.id, rawCustomPrices, existingCustomCustomerInheritance);
    });
    run();
    const row = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    res.json({ success: true, data: medicineResponse(db, row!) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Kode obat sudah digunakan' });
    if (/Satuan|Customer|Harga customer|Kombinasi|Jumlah custom|Custom price/i.test(String(err.message))) return res.status(400).json({ success: false, error: String(err.message) });
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.delete('/api/medicines/:id', (req, res) => {
  try {
    const medicine = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    if (!medicine) return res.status(404).json({ success: false, error: 'Obat tidak ditemukan' });

    const inTrxItems = (db.prepare('SELECT COUNT(*) as cnt FROM transaction_items WHERE medicine_id = @id').get({ id: req.params.id }) as { cnt: number }).cnt;
    const inStockHistory = (db.prepare('SELECT COUNT(*) as cnt FROM stock_history WHERE medicine_id = @id').get({ id: req.params.id }) as { cnt: number }).cnt;

    if (inTrxItems > 0 || inStockHistory > 0) {
      // Soft delete — referenced elsewhere
      db.prepare('UPDATE medicines SET is_active = 0, updated_at = @updated_at WHERE id = @id')
        .run({ id: req.params.id, updated_at: new Date().toISOString() });
    } else {
      db.prepare('DELETE FROM medicines WHERE id = @id').run({ id: req.params.id });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

// Helper: fetch a transaction with its items by id
function fetchTransactionWithItems(id: string): Record<string, unknown> | null {
  const rows = db.prepare(`
    SELECT t.*,
      ti.medicine_id AS ti_medicine_id, ti.medicine_code AS ti_medicine_code,
      ti.medicine_name AS ti_medicine_name, ti.unit AS ti_unit,
      ti.price AS ti_price, ti.qty AS ti_qty, ti.subtotal AS ti_subtotal,
      ti.is_ppn AS ti_is_ppn, ti.ppn_rate AS ti_ppn_rate,
      ti.item_type AS ti_item_type, ti.unit_multiplier AS ti_unit_multiplier,
      ti.unit_id AS ti_unit_id,
      ti.purchase_price AS ti_purchase_price, ti.no_batch AS ti_no_batch,
      ti.customer_id AS ti_customer_id, ti.customer_name AS ti_customer_name,
      ti.price_source AS ti_price_source,
       ti.pricing_mode AS ti_pricing_mode, ti.custom_price_id AS ti_custom_price_id,
       ti.custom_quantity AS ti_custom_quantity, ti.custom_unit AS ti_custom_unit,
       ti.custom_total_price AS ti_custom_total_price,
       ti.margin_pct AS ti_margin_pct, ti.bhp_amount AS ti_bhp_amount,
       ti.profit_amount AS ti_profit_amount
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.id = ?
  `).all(id) as Record<string, unknown>[];
  if (!rows.length) return null;
  const headerRow = Object.fromEntries(Object.entries(rows[0]).filter(([k]) => !k.startsWith('ti_')));
  const tx: Record<string, unknown> = { ...toTS(headerRow), items: [] };
  for (const row of rows) {
    if (row.ti_medicine_id) {
      (tx.items as unknown[]).push(toTS({
        medicine_id: row.ti_medicine_id, medicine_code: row.ti_medicine_code,
        medicine_name: row.ti_medicine_name, unit: row.ti_unit,
        price: row.ti_price, qty: row.ti_qty, subtotal: row.ti_subtotal,
        is_ppn: row.ti_is_ppn, ppn_rate: row.ti_ppn_rate,
        item_type: row.ti_item_type, unit_multiplier: row.ti_unit_multiplier,
        unit_id: row.ti_unit_id,
        purchase_price: row.ti_purchase_price, no_batch: row.ti_no_batch,
        customer_id: row.ti_customer_id, customer_name: row.ti_customer_name, price_source: row.ti_price_source,
         pricing_mode: row.ti_pricing_mode, custom_price_id: row.ti_custom_price_id,
         custom_quantity: row.ti_custom_quantity, custom_unit: row.ti_custom_unit,
         custom_total_price: row.ti_custom_total_price,
         margin_pct: row.ti_margin_pct, bhp_amount: row.ti_bhp_amount,
         profit_amount: row.ti_profit_amount,
      }, { stripId: true }));
    }
  }
  return tx;
}

app.get('/api/transactions', (_req, res) => {
  try {
    const rows = db.prepare(`    SELECT t.*,
      ti.medicine_id AS ti_medicine_id, ti.medicine_code AS ti_medicine_code,
      ti.medicine_name AS ti_medicine_name, ti.unit AS ti_unit,
      ti.price AS ti_price, ti.qty AS ti_qty, ti.subtotal AS ti_subtotal,
      ti.is_ppn AS ti_is_ppn, ti.ppn_rate AS ti_ppn_rate,
      ti.item_type AS ti_item_type, ti.unit_multiplier AS ti_unit_multiplier,
      ti.unit_id AS ti_unit_id,
      ti.purchase_price AS ti_purchase_price, ti.no_batch AS ti_no_batch,
      ti.customer_id AS ti_customer_id, ti.customer_name AS ti_customer_name,
      ti.price_source AS ti_price_source,
       ti.pricing_mode AS ti_pricing_mode, ti.custom_price_id AS ti_custom_price_id,
       ti.custom_quantity AS ti_custom_quantity, ti.custom_unit AS ti_custom_unit,
       ti.custom_total_price AS ti_custom_total_price,
       ti.margin_pct AS ti_margin_pct, ti.bhp_amount AS ti_bhp_amount,
       ti.profit_amount AS ti_profit_amount
      FROM transactions t
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      ORDER BY t.date DESC
    `).all() as Record<string, unknown>[];

    const txMap = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const headerRow = Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('ti_')));
      if (!txMap.has(row.id as string)) {
        txMap.set(row.id as string, { ...toTS(headerRow), items: [] });
      }
      if (row.ti_medicine_id) {
        (txMap.get(row.id as string)!.items as unknown[]).push(toTS({
          medicine_id: row.ti_medicine_id, medicine_code: row.ti_medicine_code,
          medicine_name: row.ti_medicine_name, unit: row.ti_unit,
          price: row.ti_price, qty: row.ti_qty, subtotal: row.ti_subtotal,
          is_ppn: row.ti_is_ppn, ppn_rate: row.ti_ppn_rate,
          item_type: row.ti_item_type, unit_multiplier: row.ti_unit_multiplier,
          unit_id: row.ti_unit_id,
          purchase_price: row.ti_purchase_price, no_batch: row.ti_no_batch,
          customer_id: row.ti_customer_id, customer_name: row.ti_customer_name, price_source: row.ti_price_source,
           pricing_mode: row.ti_pricing_mode, custom_price_id: row.ti_custom_price_id,
           custom_quantity: row.ti_custom_quantity, custom_unit: row.ti_custom_unit,
           custom_total_price: row.ti_custom_total_price,
           margin_pct: row.ti_margin_pct, bhp_amount: row.ti_bhp_amount,
           profit_amount: row.ti_profit_amount,
        }, { stripId: true }));
      }
    }
    res.json({ success: true, data: Array.from(txMap.values()) });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const items = (body.items ?? []) as Record<string, unknown>[];

    // Build header row (exclude items[]), ensure id exists
    const headerInput = Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'items'));
    if (!headerInput.id) headerInput.id = randomUUID();
    const customerIds = [...new Set(items.filter(item => item['priceSource'] === 'customer' && item['customerId']).map(item => String(item['customerId'])))];
    if (customerIds.length > 1) throw new Error('Satu transaksi tidak dapat memakai lebih dari satu customer harga khusus');
    const customerPricedItem = items.find(item => item['priceSource'] === 'customer' && item['customerId']);
    if (customerPricedItem) {
      const customer = db.prepare("SELECT id, name, member_no FROM customers WHERE id = ? AND status = 'Aktif'").get(customerPricedItem['customerId']) as { id: string; name: string; member_no: string } | undefined;
      if (!customer) throw new Error('Customer harga khusus tidak aktif atau tidak ditemukan');
      if (headerInput.customerId && headerInput.customerId !== customer.id) throw new Error('Customer transaksi harus mengikuti customer pemilik harga khusus');
      headerInput.customerId = customer.id;
      headerInput.customerName = customer.name;
      headerInput.customerMemberNo = customer.member_no;
    }
    const headerRow = toSQL(headerInput);

    const runCreate = db.transaction((payload: { header: Record<string, unknown>; items: Record<string, unknown>[] }) => {
      // 1. INSERT header
      const hCols = Object.keys(payload.header);
      db.prepare(`INSERT INTO transactions (${hCols.join(', ')}) VALUES (${hCols.map(c => '@' + c).join(', ')})`).run(payload.header);

      // 2. INSERT items + 3. UPDATE stock + 4. INSERT stock_history
      const stockAtStart = new Map<string, number>();
      const requestedStockByMedicine = new Map<string, number>();
      let costAmount = 0;
      let obatCostAmount = 0;
      let nonObatCostAmount = 0;
      let obatTotalAmount = 0;
      let nonObatTotalAmount = 0;
      for (const item of payload.items) {
        const itemRow = toSQL(item) as Record<string, unknown>;
        itemRow['transaction_id'] = payload.header['id'];

        const qty = Number(item['qty'] ?? 0);
        const medicineId = item['medicineId'] as string;

        const med = db.prepare('SELECT stock, code AS medicine_code, name AS medicine_name, item_type, no_batch, price, purchase_price, unit, unit_multiplier, margin_pct, bhp_amount FROM medicines WHERE id = ?').get(medicineId) as Record<string, unknown> | undefined;
        if (!med) throw new Error('Item transaksi tidak ditemukan');
        const unit = findUnit(db, medicineId, item['unitId'] as string | undefined, item['unit'] as string | undefined, Number(item['unitMultiplier'] ?? 0));
        if (!unit) throw new Error('Satuan item transaksi tidak valid');
        const unitMultiplier = Number(unit['multiplier_to_base'] ?? 1);
        const pricingMode = item['pricingMode'] === 'custom'
          ? 'custom'
          : item['pricingMode'] === 'normal'
            ? 'normal'
            : 'legacy';
        const primaryUnit = findUnit(db, medicineId);
        if (item['unitId'] && item['unitMultiplier'] !== undefined && Number(item['unitMultiplier']) !== unitMultiplier) {
          throw new Error('Multiplier satuan transaksi tidak sesuai konfigurasi item');
        }
        if (item['unitId'] && item['unit'] && item['unit'] !== unit['unit']) {
          throw new Error('Nama satuan transaksi tidak sesuai konfigurasi item');
        }
        itemRow['unit_id'] = unit['id'];
        itemRow['unit'] = unit['unit'];
        itemRow['unit_multiplier'] = unitMultiplier;

        const priceSource = item['priceSource'] === 'customer' ? 'customer' : 'normal';
        const customerId = item['customerId'] as string | undefined;
        const customPriceId = item['customPriceId'] as string | undefined;
        const customQuantity = Math.max(1, Number(item['customQuantity'] ?? 1));
        const normalProfile = primaryUnit && String(unit['id']) === String(primaryUnit['id'])
          ? { price: Number(med['price'] ?? 0), marginPct: Number(med['margin_pct'] ?? 0), bhpAmount: Number(med['bhp_amount'] ?? 0) }
          : configuredUnitSellingPrice(db, medicineId, String(unit['id']));
        let expectedPrice: number | undefined = pricingMode === 'custom' ? undefined : normalProfile?.price;
        let expectedMargin: number | undefined = pricingMode === 'custom' ? undefined : normalProfile?.marginPct;
        let expectedBhp: number | undefined = pricingMode === 'custom' ? undefined : normalProfile?.bhpAmount;
        if (pricingMode === 'normal' && !normalProfile) {
          throw new Error('Harga normal untuk satuan ini belum dikonfigurasi');
        }
        if (pricingMode === 'custom') {
          if (!customPriceId) throw new Error('Custom price wajib dipilih');
          const custom = db.prepare(`SELECT id, unit_id, quantity, total_price, margin_pct, bhp_amount FROM medicine_custom_prices WHERE id = ? AND medicine_id = ? AND is_active = 1`).get(customPriceId, medicineId) as Record<string, unknown> | undefined;
          if (!custom || String(custom.unit_id) !== String(unit['id']) || Number(custom.quantity) !== customQuantity) {
            throw new Error('Custom price tidak valid atau sudah berubah');
          }
          const normalCustom = customSellingProfile(custom);
          expectedPrice = normalCustom.price;
          expectedMargin = normalCustom.marginPct;
          expectedBhp = normalCustom.bhpAmount;
          if (priceSource === 'customer') {
            const configured = configuredCustomPrice(db, customPriceId, customerId);
            if (!configured) throw new Error('Harga customer custom tidak tersedia');
            expectedPrice = configured.price;
            expectedMargin = configured.marginPct;
            expectedBhp = configured.bhpAmount;
          }
          itemRow['custom_price_id'] = customPriceId;
          itemRow['custom_quantity'] = customQuantity;
          itemRow['custom_unit'] = unit['unit'];
          itemRow['custom_total_price'] = expectedPrice;
        }
        if (priceSource === 'customer') {
          if (!customerId) throw new Error('Harga customer membutuhkan customer yang dipilih');
          const customer = db.prepare("SELECT id, name FROM customers WHERE id = ? AND status = 'Aktif'").get(customerId) as { id: string; name: string } | undefined;
           const configured = pricingMode === 'custom'
             ? (expectedPrice === undefined ? undefined : { price: expectedPrice, marginPct: expectedMargin ?? 0, bhpAmount: expectedBhp ?? 0 })
             : configuredCustomerPrice(db, medicineId, String(unit['id']), customerId);
           if (!customer || configured === undefined || Number(item['price']) !== Number(configured.price)) {
             throw new Error('Harga customer tidak valid atau sudah berubah');
           }
           expectedMargin = configured.marginPct;
           expectedBhp = configured.bhpAmount;
          if (payload.header['customer_id'] !== customerId) throw new Error('Customer transaksi harus mengikuti customer pemilik harga khusus');
          itemRow['customer_id'] = customerId;
          itemRow['customer_name'] = customer.name;
        } else if (customerId && !db.prepare("SELECT id FROM customers WHERE id = ? AND status = 'Aktif'").get(customerId)) {
          throw new Error('Customer tidak ditemukan');
        }
        itemRow['price_source'] = priceSource;

        const price = Number(item['price']);
        const expectedSubtotal = pricingMode === 'legacy' ? qty * unitMultiplier * price : qty * price;
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitMultiplier) || unitMultiplier <= 0) {
          throw new Error('Rincian harga atau jumlah transaksi tidak valid');
        }
        if (Number(item['subtotal']) !== expectedSubtotal) {
          throw new Error('Subtotal transaksi tidak sesuai harga dan jumlah item');
        }
        if (priceSource === 'normal' && pricingMode !== 'legacy' && expectedPrice !== undefined && Math.abs(price - expectedPrice) > 0.000001) {
          throw new Error('Harga umum item sudah berubah, silakan pilih ulang');
        }
        const submittedMargin = item['marginPct'] === undefined ? (expectedMargin ?? 0) : Number(item['marginPct']);
        if (pricingMode !== 'legacy' && expectedMargin !== undefined && (!Number.isFinite(submittedMargin) || Math.abs(submittedMargin - expectedMargin) > 0.000001)) {
          throw new Error('Margin harga item sudah berubah, silakan pilih ulang');
        }
        const submittedBhp = item['bhpAmount'] === undefined ? (expectedBhp ?? 0) : Number(item['bhpAmount']);
        if (pricingMode !== 'legacy' && expectedBhp !== undefined && (!Number.isFinite(submittedBhp) || submittedBhp < 0 || Math.abs(submittedBhp - expectedBhp) > 0.000001)) {
          throw new Error('BHP harga item sudah berubah, silakan pilih ulang');
        }
        itemRow['price'] = price;
        itemRow['purchase_price'] = Number(unit['purchase_price_per_base'] ?? item['purchasePrice'] ?? 0);
        itemRow['margin_pct'] = pricingMode === 'legacy' ? Number(item['marginPct'] ?? 0) : expectedMargin ?? submittedMargin;
        itemRow['bhp_amount'] = pricingMode === 'legacy' ? Number(item['bhpAmount'] ?? 0) : expectedBhp ?? submittedBhp;
        itemRow['pricing_mode'] = pricingMode;
        const packageCount = pricingMode === 'custom' ? customQuantity : 1;
        const lineCost = pricingMode === 'legacy'
          ? qty * Number(itemRow['purchase_price'] ?? item['purchasePrice'] ?? 0)
          : qty * packageCount * (unitMultiplier * Number(itemRow['purchase_price'] ?? 0) + Number(itemRow['bhp_amount'] ?? 0));
        itemRow['profit_amount'] = Math.round(Number(item['subtotal'] ?? 0) - lineCost);
        costAmount += lineCost;
        if (String(med['item_type'] ?? item['itemType'] ?? 'obat') === 'non_obat') {
          nonObatCostAmount += lineCost;
          nonObatTotalAmount += Number(item['subtotal'] ?? 0);
        } else {
          obatCostAmount += lineCost;
          obatTotalAmount += Number(item['subtotal'] ?? 0);
        }
        if (med && (itemRow['no_batch'] === undefined || itemRow['no_batch'] === null)) {
          // Fallback: snapshot current master batch when frontend didn't send one
          itemRow['no_batch'] = med['no_batch'] ?? null;
        }

        // Use explicit column whitelist — transaction_items schema is fixed
        const TI_COLS = ['transaction_id','medicine_id','medicine_code','medicine_name','unit','unit_id','price','qty','subtotal','is_ppn','ppn_rate','item_type','unit_multiplier','purchase_price','no_batch','customer_id','customer_name','price_source','pricing_mode','custom_price_id','custom_quantity','custom_unit','custom_total_price','margin_pct','bhp_amount','profit_amount'];
        const iCols = TI_COLS.filter(c => itemRow[c] !== undefined && itemRow[c] !== null);
        const iRow = Object.fromEntries(iCols.map(c => [c, itemRow[c]]));
        db.prepare(`INSERT INTO transaction_items (${iCols.join(', ')}) VALUES (${iCols.map(c => '@' + c).join(', ')})`).run(iRow);

        if (med) {
          const baseQty = pricingMode === 'custom' ? qty * customQuantity * unitMultiplier : qty * unitMultiplier;
          const initialStock = stockAtStart.has(medicineId)
            ? stockAtStart.get(medicineId) as number
            : Number(med['stock'] ?? 0);
          stockAtStart.set(medicineId, initialStock);
          const requestedStock = (requestedStockByMedicine.get(medicineId) || 0) + baseQty;
          if (requestedStock > initialStock) throw new Error(`Stok item tidak mencukupi: membutuhkan ${requestedStock} satuan dasar, tersedia ${initialStock}`);
          requestedStockByMedicine.set(medicineId, requestedStock);
          const prevStock = initialStock - (requestedStock - baseQty);
          const newStock = prevStock - baseQty;
          db.prepare('UPDATE medicines SET stock = stock - ?, updated_at = ? WHERE id = ?').run(baseQty, new Date().toISOString(), medicineId);

          // 4. INSERT stock_history type='keluar' (snapshot batch number with the movement)
          db.prepare(`
            INSERT INTO stock_history
              (id, medicine_id, medicine_code, medicine_name, type, amount, prev_stock, new_stock, date, note, user_name, item_type, purchase_price, selling_price, margin_pct, bhp_amount, no_batch, input_unit_id, input_unit, input_qty, input_multiplier)
            VALUES
              (@id, @medicine_id, @medicine_code, @medicine_name, @type, @amount, @prev_stock, @new_stock, @date, @note, @user_name, @item_type, @purchase_price, @selling_price, @margin_pct, @bhp_amount, @no_batch, @input_unit_id, @input_unit, @input_qty, @input_multiplier)
          `).run({
            id: randomUUID(),
            medicine_id: medicineId,
            medicine_code: med['medicine_code'] ?? itemRow['medicine_code'],
            medicine_name: med['medicine_name'] ?? itemRow['medicine_name'],
            type: 'keluar',
            amount: baseQty,
            prev_stock: prevStock,
            new_stock: newStock,
            date: payload.header['date'] ?? new Date().toISOString(),
            note: `Transaksi ${payload.header['trx_no'] ?? ''}`,
            user_name: payload.header['cashier_name'] ?? '',
            item_type: med['item_type'] ?? 'obat',
            purchase_price: itemRow['purchase_price'] ?? 0,
            selling_price: itemRow['price'] ?? 0,
            margin_pct: itemRow['margin_pct'] ?? 0,
            bhp_amount: itemRow['bhp_amount'] ?? 0,
            no_batch: itemRow['no_batch'] ?? null,
            input_unit_id: unit['id'],
            input_unit: unit['unit'],
            input_qty: pricingMode === 'custom' ? qty * customQuantity : qty,
            input_multiplier: unitMultiplier,
          });
        }
      }

      db.prepare(`UPDATE transactions
        SET cost_amount = ?, obat_total_amount = ?, non_obat_total_amount = ?,
            obat_cost_amount = ?, non_obat_cost_amount = ?
        WHERE id = ?`).run(
        Math.round(costAmount), Math.round(obatTotalAmount), Math.round(nonObatTotalAmount),
        Math.round(obatCostAmount), Math.round(nonObatCostAmount), payload.header['id'],
      );

      // 5. UPDATE customer metrics
      const customerId = payload.header['customer_id'];
      const totalAmount = payload.header['total_amount'];
      if (customerId) {
        db.prepare('UPDATE customers SET total_transactions = total_transactions + 1, total_spent = total_spent + ? WHERE id = ?')
          .run(totalAmount, customerId);
      }

      // 6. UPDATE doctor metrics
      const doctorId = payload.header['doctor_id'];
      const isPrescription = payload.header['is_prescription'];
      if (isPrescription && doctorId) {
        db.prepare('UPDATE doctors SET total_prescriptions = total_prescriptions + 1 WHERE id = ?').run(doctorId);
      }
    });

    runCreate({ header: headerRow as Record<string, unknown>, items });

    const created = fetchTransactionWithItems(headerRow['id'] as string);
    res.json({ success: true, data: created });
  } catch (err: any) {
    console.error(err);
    const message = String(err?.message ?? err);
    const clientError = /Harga customer|Customer|Subtotal|Rincian harga|Harga umum|Item transaksi|Satuan|Stok/.test(message);
    res.status(clientError ? 400 : 500).json({ success: false, error: message });
  }
});

app.put('/api/transactions/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT status FROM transactions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
    if (existing['status'] === 'Dibatalkan') {
      return res.status(400).json({ success: false, error: 'Transaksi sudah dibatalkan' });
    }

    const b = req.body as Record<string, unknown>;
    // Accept both snake_case and camelCase from frontend
    const cancelReason = (b['cancel_reason'] ?? b['cancelReason'] ?? '') as string;
    const cancelledBy = (b['cancelled_by'] ?? b['cancelledBy'] ?? '') as string;
    const cancelledAt = new Date().toISOString();

    const runCancel = db.transaction(() => {
      db.prepare(`UPDATE transactions SET status='Dibatalkan', cancel_reason=?, cancelled_by=?, cancelled_at=? WHERE id=?`)
        .run(cancelReason, cancelledBy, cancelledAt, id);

      // Restore stock for each item
      const txItems = db.prepare('SELECT medicine_id, qty, unit_multiplier, pricing_mode, custom_quantity FROM transaction_items WHERE transaction_id = ?')
        .all(id) as { medicine_id: string; qty: number; unit_multiplier: number | null; pricing_mode?: string; custom_quantity?: number | null }[];
      for (const item of txItems) {
        const unitMultiplier = Math.max(1, Number(item.unit_multiplier) || 1);
        const packageQuantity = item.pricing_mode === 'custom' ? Math.max(1, Number(item.custom_quantity) || 1) : 1;
        db.prepare('UPDATE medicines SET stock = stock + ?, updated_at = ? WHERE id = ?')
          .run(item.qty * packageQuantity * unitMultiplier, new Date().toISOString(), item.medicine_id);
      }
    });

    runCancel();

    const updated = fetchTransactionWithItems(id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

app.get('/api/transactions/:id/items', (req, res) => {
  try {
    const rows = (db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
      .all(req.params.id) as Record<string, unknown>[])
      .map(r => toTS(r, { stripId: true }));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err.message) });
  }
});

// ---------------------------------------------------------------------------
// Reset (seed/restore)
// ---------------------------------------------------------------------------
app.post('/api/reset', (req, res) => {
  const { settings, users, medicines, customers, doctors, transactions, stockHistory, cashFlows, medicineCustomerPrices } = req.body as {
    settings: Record<string, unknown>;
    users: Record<string, unknown>[];
    medicines: Record<string, unknown>[];
    customers: Record<string, unknown>[];
    doctors: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    stockHistory: Record<string, unknown>[];
    cashFlows: Record<string, unknown>[];
    medicineCustomerPrices?: Record<string, unknown>[];
  };

  try {
    const runReset = db.transaction(() => {
      // Delete in reverse FK order
      db.prepare('DELETE FROM transaction_items').run();
      db.prepare('DELETE FROM stock_history').run();
      db.prepare('DELETE FROM cash_flows').run();
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM medicine_custom_price_customers').run();
      db.prepare('DELETE FROM medicine_custom_prices').run();
      db.prepare('DELETE FROM medicine_unit_customer_prices').run();
      db.prepare('DELETE FROM medicine_units').run();
      db.prepare('DELETE FROM medicines').run();
      db.prepare('DELETE FROM doctors').run();
      db.prepare('DELETE FROM customers').run();
      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM settings').run();

      // Insert in forward FK order
      // 1. settings — guard against null/empty payload
      if (settings && typeof settings === 'object' && Object.keys(settings).length > 0) {
        const settingsRow = { ...toSQL(settings), id: 1 };
        const sCols = Object.keys(settingsRow);
        db.prepare(`INSERT INTO settings (${sCols.join(', ')}) VALUES (${sCols.map(c => '@' + c).join(', ')})`).run(settingsRow);
      }

      // 2. users
      for (const u of users) {
        const row = toSQL(u);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }

      // 3. medicines
      const pendingUnits: Array<{ id: string; units?: unknown; medicine: Record<string, unknown> }> = [];
      for (const m of medicines) {
        const { units, customPrices, normalCustomerPrices, customerPrices: _customerPrices, ...medicine } = m;
        const row = toSQL(medicine);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO medicines (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
        pendingUnits.push({ id: String(row.id), units, medicine: { ...m, customPrices, normalCustomerPrices } });
      }

      // 4. customers
      for (const c of customers) {
        const row = toSQL(c);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO customers (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }

      for (const pending of pendingUnits) {
        saveMedicineUnits(db, pending.id, pending.units, pending.medicine);
        saveNormalCustomerPrices(db, pending.id, pending.medicine.normalCustomerPrices);
        saveCustomPrices(db, pending.id, pending.medicine.customPrices);
      }
      for (const price of medicineCustomerPrices ?? []) {
        const row = { ...price, id: price.id ?? randomUUID() };
        const unit = findUnit(db, String(price.medicineId), price.unitId as string | undefined, price.unit as string | undefined, Number(price.unitMultiplier ?? 0));
        if (!unit) continue;
        const isPrimary = Number(unit.is_primary) === 1;
        const multiplier = Math.max(1, Number(unit.multiplier_to_base) || 1);
        const sellingPrice = Number(price.price ?? 0);
        const marginPct = Number(price.marginPct ?? price.margin_pct ?? 0);
        const bhpAmount = Number(price.bhpAmount ?? price.bhp_amount ?? 0);
        const requestedInheritance = booleanValue(price.inheritParent ?? price.inherit_parent, false);
        const effective = isPrimary && requestedInheritance
          ? medicineSellingProfile(db.prepare('SELECT price, margin_pct, bhp_amount FROM medicines WHERE id = ?').get(price.medicineId) as Record<string, unknown> | undefined || {})
          : { price: sellingPrice, marginPct, bhpAmount };
        db.prepare(`INSERT OR IGNORE INTO medicine_unit_customer_prices
          (id, medicine_id, medicine_unit_id, customer_id, price_per_base, selling_price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(row.id, price.medicineId, unit.id, price.customerId, effective.price / multiplier, effective.price, effective.marginPct, effective.bhpAmount, isPrimary ? 0 : (requestedInheritance ? 1 : 0));
        if (isPrimary) {
          db.prepare(`INSERT OR REPLACE INTO medicine_customer_prices
            (id, medicine_id, customer_id, price, margin_pct, bhp_amount, inherit_parent) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(row.id, price.medicineId, price.customerId, effective.price, effective.marginPct, effective.bhpAmount, 0);
        }
      }

      // 5. doctors
      for (const d of doctors) {
        const row = toSQL(d);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO doctors (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }

      // 6. transactions (header only) + 7. transaction_items
      for (const tx of transactions) {
        const { items, ...header } = tx as Record<string, unknown> & { items?: Record<string, unknown>[] };
        const headerRow = toSQL(header);
        const hCols = Object.keys(headerRow);
        db.prepare(`INSERT INTO transactions (${hCols.join(', ')}) VALUES (${hCols.map(c => '@' + c).join(', ')})`).run(headerRow);

        for (const item of (items ?? [])) {
          const rawItemRow = { ...toSQL(item), transaction_id: headerRow['id'] };
          const TI_COLS = ['transaction_id','medicine_id','medicine_code','medicine_name','unit','unit_id','price','qty','subtotal','is_ppn','ppn_rate','item_type','unit_multiplier','purchase_price','no_batch','customer_id','customer_name','price_source','pricing_mode','custom_price_id','custom_quantity','custom_unit','custom_total_price','margin_pct','bhp_amount','profit_amount'];
          const iCols = TI_COLS.filter(c => rawItemRow[c] !== undefined && rawItemRow[c] !== null);
          const iRow = Object.fromEntries(iCols.map(c => [c, rawItemRow[c]]));
          db.prepare(`INSERT INTO transaction_items (${iCols.join(', ')}) VALUES (${iCols.map(c => '@' + c).join(', ')})`).run(iRow);
        }
      }

      // 8. stock_history
      for (const sh of stockHistory) {
        const row = toSQL(sh); // user → user_name via FIELD_OVERRIDES_TO_SQL
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO stock_history (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }

      // 9. cash_flows
      for (const cf of cashFlows) {
        const row = toSQL(cf);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO cash_flows (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }
    });

    runReset();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
});

// ---------------------------------------------------------------------------
// Migration page
// ---------------------------------------------------------------------------
app.get('/migrate', (_req, res) => {
  res.send(MIGRATE_HTML);
});

  return { app, db };
}
