# SQLite 3 Database & Schema — Apotek Az Zainiyah

Folder ini berisi berkas skema dan data awal database **SQLite 3** untuk Sistem Informasi Kasir & Manajemen Apotek Az Zainiyah.

---

## 📁 Struktur Berkas

1. **`schema.sql`**  
   - Berisi definisi tabel DDL (*Data Definition Language*), tipe data teroptimasi, indeks query, serta *foreign key constraints*.
2. **`database.sql`**  
   - Dump SQL lengkap berisi kombinasi DDL (Skema) + DML (*Data Manipulation Language*) seed data awal untuk **Apotek Az Zainiyah** (User superadmin/admin/kasir, profil apotek, tabel transaksi, stok, pelanggan, dokter, dan arus kas).

---

## 🛠️ Cara Impor ke Database SQLite

### 1. Menggunakan Command Line (Terminal / Bash)
```bash
# Membuat database SQLite baru dari file database.sql
sqlite3 apotek_az_zainiyah.db < sqlite/database.sql
```

### 2. Menggunakan GUI Client (DB Browser for SQLite / DBeaver)
1. Buka aplikasi **DB Browser for SQLite** atau **DBeaver**.
2. Buat database baru (*New Database*) dengan nama `apotek_az_zainiyah.db`.
3. Pilih menu **File** -> **Import** -> **Database from SQL file...**
4. Pilih file `sqlite/database.sql` lalu jalankan (*Execute*).

### 3. Menggunakan Node.js / TypeScript (`better-sqlite3` / `sqlite3` / `Drizzle ORM`)
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('apotek_az_zainiyah.db');
const sqlScript = fs.readFileSync('./sqlite/database.sql', 'utf8');
db.exec(sqlScript);

console.log('Database SQLite Apotek Az Zainiyah berhasil diinisialisasi!');
```

---

## 📋 Ringkasan Tabel Database

| Nama Tabel | Fungsi Utama | Primary Key |
| :--- | :--- | :--- |
| `settings` | Profil resmi Apotek Az Zainiyah, alamat, hotline, & konfigurasi PPN | `id` (INTEGER, val=1) |
| `users` | Akun autentikasi Admin & Kasir | `id` (TEXT) |
| `medicines` | Master sediaan & katalog obat (dengan harga DPP, PPN 11%, stok) | `id` (TEXT) |
| `customers` | Master data pelanggan & pasien member | `id` (TEXT) |
| `doctors` | Master data dokter resep | `id` (TEXT) |
| `transactions` | Header transaksi penjualan kasir | `id` (TEXT) |
| `transaction_items` | Rincian sediaan obat per transaksi | `id` (AUTOINCREMENT) |
| `stock_history` | Log mutasi stok masuk, keluar, & penyesuaian | `id` (TEXT) |
| `cash_flows` | Arus kas operasional non-penjualan | `id` (TEXT) |
