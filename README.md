# Sistem Kasir Apotek Az Zainiyah

Aplikasi kasir & operasional apotek. Satu codebase untuk **dua mode**:

| Mode | Cara menjalankan | Database |
| ---- | ---------------- | -------- |
| **Web** | `npm run dev` (frontend) + `npm run dev:server` (API, port 3001) | `./apotek.db` |
| **Desktop (Electron / Windows .exe)** | `npm run electron:dev` (dev) atau `npm run electron:dist` (produksi) | `%APPDATA%/apotek-azzainiyah/apotek.db` |

Keduanya memakai API + SQLite yang sama (`src/server/app.ts`), jadi tidak ada
fork code — perubahan di satu mode otomatis berlaku di mode lain.

---

## 1. Mode Web (cara lama — tetap berfungsi penuh)

```bash
npm install
npm run dev:all        # Vite (3000) + API server (3001) sekaligus
```

Atau manual:

```bash
npm run dev            # terminal 1: frontend di http://localhost:3000
npm run dev:server     # terminal 2: API + SQLite di http://localhost:3001
```

```bash
npm run lint           # typecheck seluruh proyek
npm run build          # build frontend ke dist/
npx tsx server.test.ts # tes properti (P4–P7, P10)
```

## 2. Mode Desktop (Electron → Windows .exe)

### Menjalankan saat pengembangan

```bash
npm run electron:dev
```

Menjalankan Vite dev server + kompilasi main process + membuka jendela Electron.

### Membangun installer Windows

```bash
npm run electron:dist
```

Hasilnya di folder `release/`:

- `Apotek Az Zainiyah-Setup-1.0.0.exe` — installer NSIS (tidak butuh admin)
- `win-unpacked/ApotekAzZainiyah.exe` — versi portable (bisa di-copy langsung)

Detail teknis:

- Main process (`electron/main.ts`) menjalankan API Express + SQLite **di dalam
  proses** dan memuat build frontend (`dist/`) lewat `file://`.
- `better-sqlite3` v13 memakai prebuild N-API yang kompatibel dengan Node **dan**
  Electron, sehingga `npmRebuild: false` — tidak perlu Python/MSVC saat build.
- `sqlite/schema.sql` ikut dibundel lewat `extraResources`.

## 3. Printer Thermal & Cetak Otomatis

Di menu **Pengaturan → Printer Thermal & Cetak Otomatis** (khusus admin):

- **Lebar kertas** — pilih `58mm` atau `80mm` sesuai printer thermal.
- **Pilih printer** — daftar printer Windows (kosongkan = printer default sistem).
- **Auto Print** — struk langsung dicetak otomatis setelah transaksi POS selesai.
- **Test Printer** — mencetak struk uji untuk memastikan konfigurasi benar.

Pengaturan ini disimpan di tabel `settings` database, jadi bertahan antar-version.

Pada mode web, fitur printer menampilkan catatan bahwa fungsinya hanya tersedia
di aplikasi desktop (struk web tetap dicetak lewat dialog browser).

## 4. Upgrade Aman (tidak merusak SQLite)

Database **tidak pernah disimpan di folder aplikasi**, melainkan di
`%APPDATA%/apotek-azzainiyah/apotek.db`. Mengganti installer versi baru tidak
menyentuh file ini.

Skema dimigrasikan **secara aditif** saat aplikasi dinyalakan
(`applyMigrations` di `src/server/app.ts`):

- `CREATE TABLE IF NOT EXISTS` (tanpa `DROP`) — tabel lama tetap utuh.
- Migrasi versi dicatat di `PRAGMA user_version`.
- Perubahan ke depan cukup menambah entri di array `MIGRATIONS` (mis. kolom baru
  lewat `ALTER TABLE ... ADD COLUMN`), lalu naikkan `SCHEMA_VERSION`.

Cara melakukan rilis versi berikutnya:

1. Naikkan `version` di `package.json` (mis. `1.0.0` → `1.1.0`).
2. Bila skema berubah: tambah migration baru di `src/server/app.ts` + perbarui
   `sqlite/schema.sql` untuk database baru.
3. `npm run electron:dist` → installer baru. Data lama otomatis di-upgrade
   saat user membuka aplikasi, tanpa kehilangan satu pun baris.
