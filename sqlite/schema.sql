-- ============================================================
-- SQLITE 3 DATABASE SCHEMA (DDL)
-- Sistem Informasi Apotek Az Zainiyah
-- Model Data & Tipe Data Teroptimasi untuk SQLite
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA encoding = 'UTF-8';

-- ------------------------------------------------------------
-- 1. TABLE: settings (Pengaturan Profil & Sistem Apotek)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  receipt_header TEXT,
  receipt_footer TEXT,
  sia_number TEXT,
  sipa_number TEXT,
  apoteker_name TEXT,
  default_min_stock INTEGER NOT NULL DEFAULT 10,
  auto_print_receipt INTEGER NOT NULL DEFAULT 1,
  default_prescription_markup REAL NOT NULL DEFAULT 20.0,
  default_racikan_fee REAL NOT NULL DEFAULT 0.0,
  initial_capital REAL NOT NULL DEFAULT 100000000.0,
  default_ppn_rate REAL NOT NULL DEFAULT 11.0,
  default_tax_type TEXT NOT NULL DEFAULT 'PPN',
  default_ppn_included INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. TABLE: users (Pengguna System: Admin & Kasir)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'kasir')),
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  phone TEXT,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 3. TABLE: medicines (Katalog Master Obat & Sediaan)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS medicines;
CREATE TABLE medicines (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  purchase_price REAL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  unit TEXT NOT NULL,
  unit_multiplier INTEGER DEFAULT 1,
  expired_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  item_type TEXT DEFAULT 'obat' CHECK (item_type IN ('obat', 'non_obat')),
  margin_pct REAL DEFAULT 0,
  bhp_amount REAL DEFAULT 0,
  ppn_rate REAL DEFAULT 11,
  is_ppn_included INTEGER DEFAULT 1,
  purchase_price_non_ppn REAL DEFAULT 0,
  purchase_price_inc_ppn REAL DEFAULT 0,
  price_non_ppn REAL DEFAULT 0,
  price_inc_ppn REAL DEFAULT 0
);

-- ------------------------------------------------------------
-- 4. TABLE: customers (Data Pelanggan / Pasien Member)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  member_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  total_spent REAL NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 5. TABLE: doctors (Data Dokter Mitra / Penulis Resep)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS doctors;
CREATE TABLE doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  total_prescriptions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 6. TABLE: transactions (Header Transaksi Penjualan)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  trx_no TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_member_no TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  prescription_markup_rate REAL DEFAULT 0,
  prescription_markup_amount REAL DEFAULT 0,
  prescription_racikan_fee REAL DEFAULT 0,
  cost_amount REAL DEFAULT 0,
  obat_total_amount REAL DEFAULT 0,
  non_obat_total_amount REAL DEFAULT 0,
  obat_cost_amount REAL DEFAULT 0,
  non_obat_cost_amount REAL DEFAULT 0,
  cashier_name TEXT NOT NULL,
  cashier_username TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Tunai', 'QRIS', 'Transfer')),
  payment_amount REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Selesai' CHECK (status IN ('Selesai', 'Dibatalkan')),
  cancel_reason TEXT,
  cancelled_by TEXT,
  cancelled_at TEXT,
  is_prescription INTEGER NOT NULL DEFAULT 0,
  prescription_formula_mode TEXT,
  prescription_formula_note TEXT,
  prescription_note TEXT,
  tax_type TEXT DEFAULT 'PPN',
  ppn_rate REAL DEFAULT 11,
  dpp_amount REAL DEFAULT 0,
  ppn_amount REAL DEFAULT 0,
  is_ppn_included INTEGER DEFAULT 1,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 7. TABLE: transaction_items (Rincian Item Obat per Transaksi)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS transaction_items;
CREATE TABLE transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  medicine_code TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price REAL NOT NULL,
  qty INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  is_ppn INTEGER DEFAULT 1,
  ppn_rate REAL DEFAULT 11,
  item_type TEXT DEFAULT 'obat' CHECK (item_type IN ('obat', 'non_obat')),
  unit_multiplier INTEGER DEFAULT 1,
  purchase_price REAL DEFAULT 0,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------
-- 8. TABLE: stock_history (Log Mutasi Stok Masuk, Keluar, & Penyesuaian)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS stock_history;
CREATE TABLE stock_history (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL,
  medicine_code TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('masuk', 'keluar', 'penyesuaian')),
  amount INTEGER NOT NULL,
  prev_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  user_name TEXT NOT NULL,
  item_type TEXT DEFAULT 'obat' CHECK (item_type IN ('obat', 'non_obat')),
  tax_type TEXT DEFAULT 'PPN',
  purchase_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0,
  ppn_amount REAL DEFAULT 0,
  margin_pct REAL DEFAULT 0,
  bhp_amount REAL DEFAULT 0,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 9. TABLE: cash_flows (Arus Kas Masuk & Keluar Non-Penjualan)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS cash_flows;
CREATE TABLE cash_flows (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Pemasukan', 'Pengeluaran')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  recorded_by TEXT NOT NULL
);

-- ------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_medicines_code ON medicines(code);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_expired ON medicines(expired_date);
CREATE INDEX IF NOT EXISTS idx_transactions_trx_no ON transactions(trx_no);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_tax_type ON transactions(tax_type);
CREATE INDEX IF NOT EXISTS idx_transaction_items_trx ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_med ON stock_history(medicine_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_date ON cash_flows(date);
