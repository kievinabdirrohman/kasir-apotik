import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import Database from 'better-sqlite3';
import { toSQL, toTS } from '../mapper.js';


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
const SCHEMA_VERSION = 1;
const MIGRATIONS: { sql: string }[] = [
  // v1: thermal printer settings for the desktop (Electron) auto-print feature
  { sql: `ALTER TABLE settings ADD COLUMN printer_name TEXT DEFAULT ''` },
  { sql: `ALTER TABLE settings ADD COLUMN paper_width TEXT DEFAULT '58mm'` },
];

function applyMigrations(db: Database.Database): void {
  const tableColumns = (table: string): string[] =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
  let version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    const stmt = MIGRATIONS[i].sql;
    const addCol = stmt.match(/ADD COLUMN\s+(\w+)/i)?.[1];
    // Guard ADD COLUMN by existence check (re-read so chained adds on one
    // table are detected correctly); future non-ADD migrations run once via user_version.
    if (!addCol || !tableColumns('settings').includes(addCol)) {
      db.exec(stmt);
      console.log(`[migrate] applied migration ${i + 1}: ${stmt}`);
    }
    version = i + 1;
  }
  db.pragma(`user_version = ${Math.max(version, SCHEMA_VERSION)}`);
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
    db.prepare(`INSERT INTO customers (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
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
    const rows = (db.prepare('SELECT * FROM stock_history ORDER BY date DESC').all() as Record<string, unknown>[]).map(row => {
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
    const rows = db.prepare('SELECT * FROM medicines').all() as Record<string, unknown>[];
    res.json({ success: true, data: rows.map(r => toTS(r)) });
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

    const data = toSQL(b) as Record<string, unknown>;
    const cols = Object.keys(data);
    db.prepare(`INSERT INTO medicines (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(data);
    const row = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: data['id'] }) as Record<string, unknown>;
    res.json({ success: true, data: toTS(row) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Kode obat sudah digunakan' });
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

    const data = toSQL(b) as Record<string, unknown>;
    delete data['id'];
    const setCols = Object.keys(data).map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE medicines SET ${setCols} WHERE id = @_id`).run({ ...data, _id: req.params.id });
    const row = db.prepare('SELECT * FROM medicines WHERE id = @id').get({ id: req.params.id }) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ success: false, error: 'Obat tidak ditemukan' });
    res.json({ success: true, data: toTS(row) });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ success: false, error: 'Kode obat sudah digunakan' });
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
      db.prepare('UPDATE medicines SET is_active = 0 WHERE id = @id').run({ id: req.params.id });
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
      ti.purchase_price AS ti_purchase_price
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
        purchase_price: row.ti_purchase_price,
      }, { stripId: true }));
    }
  }
  return tx;
}

app.get('/api/transactions', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.*,
        ti.medicine_id AS ti_medicine_id, ti.medicine_code AS ti_medicine_code,
        ti.medicine_name AS ti_medicine_name, ti.unit AS ti_unit,
        ti.price AS ti_price, ti.qty AS ti_qty, ti.subtotal AS ti_subtotal,
        ti.is_ppn AS ti_is_ppn, ti.ppn_rate AS ti_ppn_rate,
        ti.item_type AS ti_item_type, ti.unit_multiplier AS ti_unit_multiplier,
        ti.purchase_price AS ti_purchase_price
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
          purchase_price: row.ti_purchase_price,
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
    const headerRow = toSQL(headerInput);

    const runCreate = db.transaction((payload: { header: Record<string, unknown>; items: Record<string, unknown>[] }) => {
      // 1. INSERT header
      const hCols = Object.keys(payload.header);
      db.prepare(`INSERT INTO transactions (${hCols.join(', ')}) VALUES (${hCols.map(c => '@' + c).join(', ')})`).run(payload.header);

      // 2. INSERT items + 3. UPDATE stock + 4. INSERT stock_history
      for (const item of payload.items) {
        const itemRow = toSQL(item) as Record<string, unknown>;
        itemRow['transaction_id'] = payload.header['id'];
        // Use explicit column whitelist — transaction_items schema is fixed
        const TI_COLS = ['transaction_id','medicine_id','medicine_code','medicine_name','unit','price','qty','subtotal','is_ppn','ppn_rate','item_type','unit_multiplier','purchase_price'];
        const iCols = TI_COLS.filter(c => itemRow[c] !== undefined && itemRow[c] !== null);
        const iRow = Object.fromEntries(iCols.map(c => [c, itemRow[c]]));
        db.prepare(`INSERT INTO transaction_items (${iCols.join(', ')}) VALUES (${iCols.map(c => '@' + c).join(', ')})`).run(iRow);

        const qty = (item['qty'] as number) ?? 0;
        const unitMultiplier = (item['unitMultiplier'] as number) ?? 1;
        const medicineId = item['medicineId'] as string;

        // 3. Deduct stock
        const med = db.prepare('SELECT stock, code AS medicine_code, name AS medicine_name, item_type FROM medicines WHERE id = ?').get(medicineId) as Record<string, unknown> | undefined;
        if (med) {
          const prevStock = med['stock'] as number;
          const newStock = prevStock - qty * unitMultiplier;
          db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ?').run(qty * unitMultiplier, medicineId);

          // 4. INSERT stock_history type='keluar'
          db.prepare(`
            INSERT INTO stock_history
              (id, medicine_id, medicine_code, medicine_name, type, amount, prev_stock, new_stock, date, note, user_name, item_type, purchase_price, selling_price)
            VALUES
              (@id, @medicine_id, @medicine_code, @medicine_name, @type, @amount, @prev_stock, @new_stock, @date, @note, @user_name, @item_type, @purchase_price, @selling_price)
          `).run({
            id: randomUUID(),
            medicine_id: medicineId,
            medicine_code: med['medicine_code'] ?? itemRow['medicine_code'],
            medicine_name: med['medicine_name'] ?? itemRow['medicine_name'],
            type: 'keluar',
            amount: qty * unitMultiplier,
            prev_stock: prevStock,
            new_stock: newStock,
            date: payload.header['date'] ?? new Date().toISOString(),
            note: `Transaksi ${payload.header['trx_no'] ?? ''}`,
            user_name: payload.header['cashier_name'] ?? '',
            item_type: med['item_type'] ?? 'obat',
            purchase_price: itemRow['purchase_price'] ?? 0,
            selling_price: itemRow['price'] ?? 0,
          });
        }
      }

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
    res.status(500).json({ success: false, error: String(err.message) });
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
      const txItems = db.prepare('SELECT medicine_id, qty, unit_multiplier FROM transaction_items WHERE transaction_id = ?')
        .all(id) as { medicine_id: string; qty: number; unit_multiplier: number | null }[];
      for (const item of txItems) {
        const unitMultiplier = item.unit_multiplier ?? 1;
        db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ?').run(item.qty * unitMultiplier, item.medicine_id);
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
  const { settings, users, medicines, customers, doctors, transactions, stockHistory, cashFlows } = req.body as {
    settings: Record<string, unknown>;
    users: Record<string, unknown>[];
    medicines: Record<string, unknown>[];
    customers: Record<string, unknown>[];
    doctors: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    stockHistory: Record<string, unknown>[];
    cashFlows: Record<string, unknown>[];
  };

  try {
    const runReset = db.transaction(() => {
      // Delete in reverse FK order
      db.prepare('DELETE FROM transaction_items').run();
      db.prepare('DELETE FROM stock_history').run();
      db.prepare('DELETE FROM cash_flows').run();
      db.prepare('DELETE FROM transactions').run();
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
      for (const m of medicines) {
        const row = toSQL(m);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO medicines (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
      }

      // 4. customers
      for (const c of customers) {
        const row = toSQL(c);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO customers (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`).run(row);
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
          const TI_COLS = ['transaction_id','medicine_id','medicine_code','medicine_name','unit','price','qty','subtotal','is_ppn','ppn_rate','item_type','unit_multiplier','purchase_price'];
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
