# Requirements Document

## Introduction

Aplikasi kasir apotek **Apotek Az Zainiyah** saat ini menyimpan seluruh data operasional (obat, transaksi, pelanggan, dokter, pengguna, stok, arus kas, dan pengaturan) di `localStorage` browser. Pendekatan ini memiliki keterbatasan fundamental: kapasitas penyimpanan terbatas (~5–10 MB), data hilang saat browser di-clear, tidak mendukung query relasional, tidak ada integritas referensial, dan tidak scalable untuk volume transaksi apotek nyata.

Fitur ini mentransformasi arsitektur persistensi data dari `localStorage` ke **SQLite** melalui sebuah **Express HTTP API server** yang berjalan secara lokal di mesin yang sama (`localhost`). Frontend React tetap tidak berubah secara tampilan dan UX — hanya lapisan data (AppContext) yang diganti dari `localStorage` ke panggilan API asinkron.

Skema SQLite sudah tersedia di `/sqlite/schema.sql` dengan 9 tabel: `settings`, `users`, `medicines`, `customers`, `doctors`, `transactions`, `transaction_items`, `stock_history`, dan `cash_flows`. Express sudah ada sebagai dependency di `package.json`.

**Strategi arsitektur:**
- Backend: Node.js + Express + `better-sqlite3` (synchronous SQLite driver)
- API: RESTful JSON API, berjalan di `http://localhost:3001`
- Frontend: React memanggil API via `fetch()` — state React tetap sebagai in-memory cache
- Data migration: Script one-time untuk memindahkan data `localStorage` yang ada ke SQLite
- Session: `currentUser` tetap di `sessionStorage` (bukan di SQLite) karena bersifat ephemeral

---

## Glossary

- **API_Server**: Node.js/Express HTTP server yang berjalan di `localhost:3001`, mengelola semua operasi baca/tulis ke SQLite
- **SQLite_DB**: File database SQLite (`apotek.db`) yang menjadi sumber kebenaran (single source of truth) untuk semua data persisten
- **AppContext**: React Context (`AppContext.tsx`) yang menjadi lapisan state management di frontend
- **API_Client**: Modul TypeScript di frontend (`src/services/api.ts`) yang mengabstraksi semua panggilan `fetch()` ke API_Server
- **Migration_Script**: Script one-time yang membaca data dari `localStorage` dan menulis ke SQLite_DB melalui API_Server
- **Session**: Data `currentUser` yang disimpan sementara di `sessionStorage` browser selama sesi login aktif
- **Mapper**: Fungsi TypeScript yang mengonversi antara format camelCase (TypeScript) dan snake_case (SQLite)
- **TransactionItems**: Baris detail item obat pada tiap transaksi, disimpan di tabel `transaction_items` secara terpisah dari tabel `transactions`
- **SoftDelete**: Penghapusan logis dengan menandai `is_active = 0` pada obat yang memiliki riwayat transaksi atau stok

---

## Requirements

### Requirement 1: Express API Server untuk Operasi SQLite

**User Story:** Sebagai tim pengembang, saya ingin sebuah API server lokal yang mengelola semua akses ke SQLite, sehingga frontend React dapat melakukan operasi CRUD tanpa bergantung pada localStorage.

#### Acceptance Criteria

1. THE API_Server SHALL menyediakan endpoint REST pada `http://localhost:3001` untuk setiap entitas berikut dengan HTTP method yang ditentukan:
   - `settings`: `GET /api/settings`, `PUT /api/settings`
   - `users`: `GET`, `POST`, `PUT /:id`, `DELETE /:id`
   - `medicines`: `GET`, `POST`, `PUT /:id`, `DELETE /:id`
   - `customers`: `GET`, `POST`, `PUT /:id`, `DELETE /:id`
   - `doctors`: `GET`, `POST`, `PUT /:id`, `DELETE /:id`
   - `transactions`: `GET`, `POST`, `PUT /:id/cancel`
   - `transaction_items`: `GET /api/transactions/:id/items`
   - `stock_history`: `GET /api/stock_history`
   - `cash_flows`: `GET`, `POST`, `PUT /:id`, `DELETE /:id`
2. WHEN API_Server dinyalakan, THE API_Server SHALL menginisialisasi SQLite_DB dengan menjalankan semua DDL dari `sqlite/schema.sql` jika tabel belum ada (idempotent initialization)
3. WHEN API_Server menerima request dengan body JSON, THE API_Server SHALL mem-parse body tersebut menggunakan JSON body parser middleware
4. THE API_Server SHALL mengembalikan semua respons dalam format `{ success: boolean, data?: any, error?: string }`
5. IF terjadi database error pada saat query, THEN THE API_Server SHALL mengembalikan HTTP status `500` dengan field `error` yang berisi string non-kosong yang mendeskripsikan error tersebut
6. IF request melanggar constraint database (seperti UNIQUE atau FOREIGN KEY), THEN THE API_Server SHALL mengembalikan HTTP status `400` dengan field `error` yang berisi string non-kosong yang menjelaskan constraint yang dilanggar
7. WHEN API_Server membuka koneksi ke SQLite_DB, THE API_Server SHALL mengeksekusi `PRAGMA foreign_keys = ON` sehingga foreign key constraints diberlakukan pada koneksi tersebut
8. WHERE fitur CORS dibutuhkan untuk komunikasi frontend-backend lokal, THE API_Server SHALL mengizinkan request dari `http://localhost:3000`
9. IF API_Server gagal menginisialisasi skema SQLite pada saat startup, THEN THE API_Server SHALL mencetak error ke stderr dan keluar dengan kode proses non-zero

---

### Requirement 2: API Endpoints untuk Setiap Entitas Data

**User Story:** Sebagai frontend React, saya ingin endpoint yang lengkap untuk setiap entitas, sehingga semua operasi CRUD yang sebelumnya dilakukan di AppContext via localStorage dapat dilakukan via HTTP.

#### Acceptance Criteria

1. THE API_Server SHALL menyediakan `GET /api/medicines` yang mengembalikan seluruh daftar obat dari tabel `medicines`
2. THE API_Server SHALL menyediakan `POST /api/medicines` yang menyimpan satu obat baru ke tabel `medicines`
3. THE API_Server SHALL menyediakan `PUT /api/medicines/:id` yang memperbarui data obat berdasarkan `id`
4. THE API_Server SHALL menyediakan `DELETE /api/medicines/:id` yang melakukan SoftDelete (`is_active = 0`) jika obat memiliki relasi di `transaction_items` atau `stock_history`, dan hard delete jika tidak ada relasi; IF operasi hard delete gagal, THEN THE API_Server SHALL mengembalikan HTTP `500` dan membiarkan data obat tidak berubah
5. THE API_Server SHALL menyediakan endpoint untuk entitas lain dengan aturan delete per entitas berikut:
   - `customers`, `doctors`, `cash_flows`: hard delete langsung
   - `users`: business-rule guard — THE API_Server SHALL mengembalikan HTTP `400` jika user yang akan dihapus adalah super admin atau admin terakhir yang tersisa
   - `stock_history`: tidak tersedia endpoint DELETE (append-only)
6. THE API_Server SHALL menyediakan `GET /api/transactions` yang mengembalikan semua transaksi beserta array `items` (dari join dengan tabel `transaction_items`)
7. THE API_Server SHALL menyediakan `POST /api/transactions` yang menyimpan header transaksi ke tabel `transactions` dan setiap item ke tabel `transaction_items` dalam satu database transaction atomik; IF salah satu operasi gagal, THE API_Server SHALL melakukan ROLLBACK sehingga tidak ada perubahan parsial tersimpan
8. WHEN `POST /api/transactions` berhasil, THE API_Server SHALL juga mengurangi kolom `stock` di tabel `medicines` untuk setiap item dalam transaksi, dan menyisipkan satu record `stock_history` untuk setiap item dengan `type = 'keluar'`, semua dalam database transaction yang sama
9. WHEN `PUT /api/transactions/:id/cancel` dipanggil, THE API_Server SHALL mengembalikan stok setiap item transaksi ke tabel `medicines` dalam satu database transaction; IF transaksi sudah berstatus `'Dibatalkan'`, THEN THE API_Server SHALL mengembalikan HTTP `400` tanpa memodifikasi data apapun
10. THE API_Server SHALL menyediakan `GET /api/settings` yang mengembalikan baris tunggal dari tabel `settings` (id = 1)
11. THE API_Server SHALL menyediakan `PUT /api/settings` yang melakukan upsert pada baris settings (id = 1)

---

### Requirement 3: Mapper Konversi camelCase ↔ snake_case

**User Story:** Sebagai developer, saya ingin fungsi mapper yang konsisten antara format TypeScript (camelCase) dan SQLite (snake_case), sehingga frontend dan backend tidak perlu saling mengetahui format internal masing-masing.

#### Acceptance Criteria

1. WHEN menulis ke SQLite_DB, THE Mapper SHALL mengonversi setiap field camelCase dari TypeScript ke snake_case yang sesuai (contoh: `medicineId` → `medicine_id`, `isPrescription` → `is_prescription`)
2. WHEN membaca dari SQLite_DB, THE Mapper SHALL mengonversi setiap field snake_case ke camelCase yang sesuai (contoh: `is_active` → `isActive`, `trx_no` → `trxNo`)
3. WHEN membaca dari SQLite_DB, THE Mapper SHALL mengonversi nilai boolean SQLite (`INTEGER 0/1`) ke boolean TypeScript (`false/true`) untuk keenam kolom boolean berikut: `is_active`, `is_prescription`, `is_ppn_included`, `is_super_admin`, `is_ppn` (pada tabel `transaction_items`), dan `auto_print_receipt`
4. WHEN menulis ke SQLite_DB, THE Mapper SHALL mengonversi nilai boolean TypeScript (`true/false`) ke integer SQLite (`1/0`) untuk keenam kolom boolean yang sama: `is_active`, `is_prescription`, `is_ppn_included`, `is_super_admin`, `is_ppn`, dan `auto_print_receipt`
5. WHEN transaction data dibaca dari SQLite_DB, THE Mapper SHALL menyertakan array `items` yang dibangun dari rows tabel `transaction_items` yang berelasi, dan SHALL mengecualikan field `transaction_items.id` (AUTOINCREMENT) dari objek `TransactionItem` yang dikembalikan ke frontend
6. FOR ALL objek TypeScript yang di-serialize ke SQLite kemudian di-deserialize kembali, THE Mapper SHALL menghasilkan nilai yang identik untuk semua non-optional field yang didefinisikan di `src/types.ts`; optional fields boleh round-trip sebagai `undefined` atau nilai default-nya
7. THE Mapper SHALL memetakan field `StockHistory.user` (TypeScript) ke kolom `stock_history.user_name` (SQLite) secara eksplisit, karena mapping ini asimetris dan tidak mengikuti konvensi camelCase-to-snake_case biasa

---

### Requirement 4: API Client Layer di Frontend

**User Story:** Sebagai developer frontend, saya ingin sebuah modul `api.ts` yang mengabstraksi semua panggilan HTTP, sehingga AppContext tidak perlu mengetahui detail implementasi HTTP dan dapat diganti dengan mudah jika diperlukan.

#### Acceptance Criteria

1. THE API_Client SHALL mengekspor fungsi async berikut dengan signature dan return type yang eksplisit sesuai `src/types.ts`:
   - `getMedicines(): Promise<Medicine[]>`
   - `addMedicine(m: Omit<Medicine, 'id'>): Promise<Medicine>`
   - `updateMedicine(id: string, m: Partial<Medicine>): Promise<Medicine>`
   - `deleteMedicine(id: string): Promise<void>`
   - `getCustomers(): Promise<Customer[]>`
   - `addCustomer(c: Omit<Customer, 'id'>): Promise<Customer>`
   - `updateCustomer(id: string, c: Partial<Customer>): Promise<Customer>`
   - `deleteCustomer(id: string): Promise<void>`
   - `getDoctors(): Promise<Doctor[]>`
   - `addDoctor(d: Omit<Doctor, 'id'>): Promise<Doctor>`
   - `updateDoctor(id: string, d: Partial<Doctor>): Promise<Doctor>`
   - `deleteDoctor(id: string): Promise<void>`
   - `getUsers(): Promise<User[]>`
   - `addUser(u: Omit<User, 'id'>): Promise<User>`
   - `updateUser(id: string, u: Partial<User>): Promise<User>`
   - `deleteUser(id: string): Promise<void>`
   - `getTransactions(): Promise<Transaction[]>`
   - `createTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction>`
   - `cancelTransaction(id: string, payload: { cancel_reason: string; cancelled_by: string }): Promise<Transaction>`
   - `getStockHistory(): Promise<StockHistory[]>`
   - `getCashFlows(): Promise<CashFlow[]>`
   - `addCashFlow(cf: Omit<CashFlow, 'id'>): Promise<CashFlow>`
   - `updateCashFlow(id: string, cf: Partial<CashFlow>): Promise<CashFlow>`
   - `deleteCashFlow(id: string): Promise<void>`
   - `getSettings(): Promise<PharmacySettings>`
   - `updateSettings(s: Partial<PharmacySettings>): Promise<PharmacySettings>`
2. THE API_Client SHALL menggunakan `BASE_URL = 'http://localhost:3001'` sebagai default; WHEN `VITE_API_URL` terdefinisi dan merupakan string non-kosong, THE API_Client SHALL menggunakan nilai `VITE_API_URL` sebagai `BASE_URL`
3. IF API_Server tidak dapat dijangkau (network error), THEN THE API_Client SHALL melempar `Error` dengan pesan yang menyebutkan URL server yang tidak dapat dijangkau
4. IF API_Server mengembalikan HTTP status >= 400 DAN respons JSON mengandung field `error` bertipe string, THEN THE API_Client SHALL melempar `Error` dengan pesan dari field `error` tersebut; IF HTTP status >= 400 DAN respons tidak mengandung field `error` yang valid (parse gagal, field tidak ada, atau bukan string), THEN THE API_Client SHALL melempar `Error` generik dengan pesan `"HTTP {statusCode}"`
5. THE API_Client SHALL menyediakan fungsi `initializeApp(): Promise<{ medicines: Medicine[], customers: Customer[], doctors: Doctor[], users: User[], transactions: Transaction[], stockHistory: StockHistory[], cashFlows: CashFlow[], settings: PharmacySettings }>` yang mengambil semua 8 dataset secara paralel menggunakan `Promise.all`; IF salah satu dari 8 fetch gagal, THEN `initializeApp()` SHALL reject dengan error pertama yang terjadi dan tidak mengembalikan data parsial

---

### Requirement 5: Migrasi AppContext dari localStorage ke API Calls

**User Story:** Sebagai aplikasi, saya ingin AppContext menggunakan API_Client untuk semua operasi data persisten, sehingga data tersimpan di SQLite dan tidak hilang saat browser di-refresh atau di-clear.

#### Acceptance Criteria

1. WHEN AppProvider di-mount, THE AppContext SHALL memanggil `initializeApp()` dari API_Client dan mengisi semua 8 koleksi state (medicines, customers, doctors, users, transactions, stockHistory, cashFlows, settings) secara atomik hanya setelah semua 8 fetch berhasil
2. WHILE AppContext sedang mengambil data awal dari API_Server, THE AppContext SHALL menampilkan indikator loading sehingga UI tidak merender data kosong
3. THE AppContext SHALL menghapus semua `useEffect` yang melakukan `localStorage.setItem` karena persistensi sepenuhnya dikelola oleh API_Server
4. WHEN fungsi `addMedicine` dipanggil, THE AppContext SHALL memanggil `POST /api/medicines` lalu memperbarui state lokal menggunakan objek yang dikembalikan server sehingga `id` dan field yang dikomputasi server bersifat autoritatif
5. WHEN fungsi `createTransaction` dipanggil, THE AppContext SHALL memanggil `POST /api/transactions` yang atomik, lalu memperbarui state `transactions`, `medicines` (stok berkurang), dan `stockHistory` berdasarkan data yang dikembalikan dari respons server — bukan dihitung ulang di sisi client
6. WHEN fungsi `cancelTransaction` dipanggil, THE AppContext SHALL memanggil `PUT /api/transactions/:id/cancel`, lalu memperbarui state `transactions` dan restorasi stok `medicines` berdasarkan data yang dikembalikan dari respons server
7. THE AppContext SHALL tidak pernah melakukan optimistic update — state hanya diperbarui setelah API call berhasil dan respons diterima; IF panggilan API gagal, THEN THE AppContext SHALL tidak mengubah state lokal manapun dari 8 koleksi
8. THE AppContext SHALL mempertahankan field `currentUser` di `sessionStorage` (bukan di SQLite) karena sifatnya ephemeral per sesi browser
9. WHEN fungsi `resetToDefaultData` dipanggil, THE AppContext SHALL memanggil endpoint `POST /api/reset` dengan payload seed data lengkap dari `src/data/initialData.ts`

---

### Requirement 6: Atomisitas Operasi Transaksi dan Stok

**User Story:** Sebagai apotek, saya ingin operasi pembuatan dan pembatalan transaksi bersifat atomik, sehingga tidak ada kondisi di mana transaksi tersimpan tetapi stok tidak berkurang (atau sebaliknya).

#### Acceptance Criteria

1. WHEN `POST /api/transactions` dipanggil, THE API_Server SHALL mengeksekusi penyimpanan header transaksi, penyimpanan semua `transaction_items`, pengurangan stok setiap obat di tabel `medicines`, penyisipan `stock_history` bertipe `'keluar'` per item, serta increment `total_transactions` dan `total_spent` pada `customers` (dan increment `total_prescriptions` pada `doctors` jika transaksi mengandung resep) dalam satu SQLite database transaction
2. IF salah satu operasi dalam database transaction `POST /api/transactions` gagal, THEN THE API_Server SHALL melakukan ROLLBACK sehingga tidak ada record transaksi, transaction_items, perubahan stok, maupun perubahan metrik pelanggan/dokter yang tersimpan di SQLite_DB
3. WHEN `PUT /api/transactions/:id/cancel` dipanggil, THE API_Server SHALL mengeksekusi pembaruan status transaksi dan pengembalian stok setiap obat dalam satu SQLite database transaction
4. IF salah satu operasi dalam database transaction pembatalan gagal karena error database atau runtime, THEN THE API_Server SHALL melakukan ROLLBACK dan mengembalikan HTTP status `500`
5. IF request pembatalan melanggar aturan bisnis (seperti transaksi sudah berstatus `'Dibatalkan'`), THEN THE API_Server SHALL mengembalikan HTTP `400` tanpa melakukan rollback karena tidak ada data yang ditulis
6. Operasi pembatalan bersifat sinkron dan tidak dapat diselingi oleh operasi write lain — perilaku ini dijamin oleh penggunaan synchronous transaction API `better-sqlite3`

---

### Requirement 7: Script Migrasi Data dari localStorage ke SQLite

**User Story:** Sebagai pengguna yang sudah memiliki data di localStorage, saya ingin data historis saya dipindahkan ke SQLite secara otomatis, sehingga saya tidak kehilangan data transaksi dan inventori yang sudah ada.

#### Acceptance Criteria

1. THE Migration_Script SHALL membaca data dari semua localStorage keys yang relevan: `apotek_medicines`, `apotek_users`, `apotek_transactions`, `apotek_customers`, `apotek_doctors`, `apotek_stock_history`, `apotek_cash_flows`, `apotek_settings`
2. WHEN Migration_Script dijalankan dan SQLite_DB sudah memiliki data, THE Migration_Script SHALL menampilkan konfirmasi kepada pengguna sebelum melanjutkan; IF pengguna mengkonfirmasi → lanjutkan migrasi; IF pengguna menolak atau tidak memberikan input dalam 30 detik → abort dengan exit code `0` dan mencetak `"Migration aborted"` ke stdout
3. THE Migration_Script SHALL menggunakan Mapper yang sama yang digunakan API_Server untuk mengonversi format data sebelum menyimpan ke SQLite_DB
4. WHEN transaksi dimigrasikan, THE Migration_Script SHALL menyimpan `transaction_items` ke tabel terpisah dengan `transaction_id` yang benar (karena di localStorage items tersimpan sebagai array di dalam objek transaksi)
5. IF sebuah medicine yang direferensikan oleh transaksi atau stock_history tidak ada di tabel `medicines`, THEN THE Migration_Script SHALL melewati item tersebut dan menulis baris ke stderr dalam format: `WARN: skipped {entity} {id} — referenced medicine {medicineId} not found`
6. THE Migration_Script SHALL mencetak laporan akhir ke stdout dalam bentuk tabel dengan kolom: `table | migrated | skipped`
7. WHEN Migration_Script selesai dengan sukses, THE Migration_Script SHALL menyimpan flag `apotek_migrated_to_sqlite = "true"` di localStorage sehingga script tidak dijalankan dua kali secara tidak sengaja
8. IF sebuah localStorage key tidak ada, bernilai `null`, atau mengandung JSON yang tidak valid, THEN THE Migration_Script SHALL memperlakukan dataset entitas tersebut sebagai kosong (0 record) dan melanjutkan tanpa error

---

### Requirement 8: Keamanan dan Validasi di API Server

**User Story:** Sebagai sistem, saya ingin API Server melakukan validasi input dasar, sehingga data yang tidak valid tidak tersimpan ke SQLite dan integritas database terjaga.

#### Acceptance Criteria

1. WHEN `POST /api/users` menerima data user baru, THE API_Server SHALL memvalidasi bahwa field `name`, `username`, `password` tidak kosong, dan `role` memiliki nilai `'admin'` atau `'kasir'`; IF validasi gagal, THEN THE API_Server SHALL mengembalikan HTTP `400` sebelum menyimpan ke SQLite_DB
2. WHEN `POST /api/medicines` menerima data obat baru, THE API_Server SHALL memvalidasi bahwa field `name`, `code`, `category`, `unit` tidak kosong atau null; `expired_date` adalah string tanggal berformat `YYYY-MM-DD` yang valid; dan `price` adalah angka >= 0; IF validasi gagal, THEN THE API_Server SHALL mengembalikan HTTP `400`
3. IF `POST /api/users` menerima `username` yang sudah ada di tabel `users`, THEN THE API_Server SHALL mengembalikan HTTP `400` dengan pesan yang mengindikasikan bahwa username sudah digunakan
4. IF `POST /api/medicines` menerima `code` yang sudah ada di tabel `medicines`, THEN THE API_Server SHALL mengembalikan HTTP `400` dengan pesan yang mengindikasikan bahwa kode obat sudah digunakan
5. THE API_Server SHALL bind ke `127.0.0.1` (bukan `0.0.0.0`) sehingga tidak dapat dijangkau dari network interface eksternal
6. WHEN password user disimpan, THE API_Server SHALL menyimpan password sebagaimana adanya (plaintext) sesuai dengan implementasi autentikasi existing — password hashing dapat ditambahkan sebagai enhancement terpisah

---

### Requirement 9: Konfigurasi Development dan Build

**User Story:** Sebagai developer, saya ingin dapat menjalankan backend dan frontend secara bersamaan dengan satu perintah, sehingga development workflow tidak lebih rumit dari sebelumnya.

#### Acceptance Criteria

1. THE API_Server SHALL dapat dijalankan dengan perintah `node server.js` atau `tsx server.ts` dari root direktori project
2. THE API_Server SHALL berjalan di port yang dikonfigurasi via environment variable `PORT`, dengan default `3001`
3. WHERE file `.env` tersedia di root project, THE API_Server SHALL membaca konfigurasi `PORT` dan `DB_PATH` (path ke file SQLite) dari file tersebut
4. THE API_Client di frontend SHALL menggunakan `http://localhost:3001` sebagai `BASE_URL` default; IF `VITE_API_URL` terdefinisi dan merupakan string non-kosong, THEN THE API_Client SHALL menggunakan nilai `VITE_API_URL`
5. THE API_Server SHALL menyimpan file SQLite_DB di path yang dikonfigurasi via `DB_PATH`, dengan default `./apotek.db` di root direktori project
6. WHEN API_Server berhasil start, THE API_Server SHALL mencetak ke konsol: port yang digunakan, path database, dan jumlah tabel yang dibuat vs yang sudah ada sebelumnya
7. THE project SHALL menyediakan script `package.json` (contoh: `"dev:all"`) yang menjalankan API_Server dan Vite dev server secara konkuren dengan satu perintah
8. IF `DB_PATH` menunjuk ke direktori yang tidak ada, THEN THE API_Server SHALL mencetak error ke log dan keluar dengan kode proses non-zero, bukan crash secara silent

---

### Requirement 10: Kompatibilitas Mundur dan Penanganan Error Koneksi

**User Story:** Sebagai pengguna, saya ingin aplikasi memberikan pesan yang jelas jika server tidak berjalan, sehingga saya tahu tindakan apa yang harus diambil alih-alih melihat halaman kosong atau error yang tidak jelas.

#### Acceptance Criteria

1. WHEN AppContext gagal menghubungi API_Server pada saat inisialisasi, THE AppContext SHALL menampilkan pesan error yang menyebutkan URL server yang tidak dapat dijangkau beserta instruksi untuk menjalankan server, alih-alih halaman kosong
2. IF AppContext berhasil terkoneksi ke API_Server tetapi `medicines.length === 0 AND users.length === 0` (database baru dan kosong), THEN THE AppContext SHALL memuat data seed awal dari `src/data/initialData.ts` ke SQLite_DB via API dan menggunakannya sebagai data awal
3. IF penulisan seed data ke API saat inisialisasi gagal, THEN THE AppContext SHALL menampilkan pesan error koneksi yang sama seperti pada C1, dan tidak merender aplikasi dengan data kosong
4. WHEN operasi write (add, update, delete) gagal karena API_Server tidak dapat dijangkau, THE AppContext SHALL menampilkan notifikasi error kepada pengguna tanpa memodifikasi satupun dari 8 koleksi state React
5. THE AppContext SHALL tidak lagi mengandalkan `localStorage` sebagai fallback setelah migrasi selesai; localStorage key `apotek_migrated_to_sqlite` diset ke `"true"` hanya setelah Migration_Script selesai dengan sukses; AppContext membaca key ini saat init untuk melewati penulisan seed data jika sudah ada
