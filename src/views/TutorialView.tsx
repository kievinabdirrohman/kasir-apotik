import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  LogIn,
  LayoutDashboard,
  Pill,
  Users,
  Stethoscope,
  PackagePlus,
  ShoppingCart,
  Receipt,
  WalletCards,
  FileSpreadsheet,
  Calculator,
  Package,
  UserCog,
  Settings,
  Search,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ShieldAlert,
  Info,
  ChevronUp,
  ClipboardList,
  Printer,
  Filter,
  Sigma,
  User,
  KeyRound,
  LineChart,
  Workflow,
} from 'lucide-react';

interface TutorialStep {
  title: string;
  desc: string;
}

interface TutorialFilter {
  name: string;
  desc: string;
}

interface TutorialFormula {
  title: string;
  when?: string;
  formula: string;
  example?: string;
  note?: string;
}

interface TutorialSection {
  id: string;
  title: string;
  shortTitle: string;
  group: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  intro: string;
  steps: TutorialStep[];
  filters?: TutorialFilter[];
  formulas?: TutorialFormula[];
  tips?: string[];
  warnings?: string[];
}

const sections: TutorialSection[] = [
  {
    id: 'login',
    title: 'Masuk ke Aplikasi (Login)',
    shortTitle: 'Login',
    group: 'Utama',
    icon: LogIn,
    intro:
      'Semua halaman aplikasi dilindungi sistem autentikasi. Anda harus masuk menggunakan username dan password akun yang terdaftar sebelum dapat mengakses kasir, stok, dan keuangan.',
    steps: [
      {
        title: 'Buka aplikasi',
        desc: 'Jalankan aplikasi di komputer kasir, atau buka alamat situs aplikasi. Halaman masuk dengan banner apotek akan tampil.',
      },
      {
        title: 'Isi username dan password',
        desc: 'Masukkan username pada kolom "Username Login" dan password pada kolom "Password". Gunakan tombol mata (👁) untuk menampilkan atau menyembunyikan password.',
      },
      {
        title: 'Klik "Masuk ke Sistem"',
        desc: 'Sistem akan memverifikasi akun Anda. Jika benar, Anda akan diarahkan ke halaman Dashboard.',
      },
      {
        title: 'Lupa password?',
        desc: 'Klik tautan "Bantuan Akses?" di halaman login, lalu hubungi Administrator Utama untuk reset password atau pembuatan akun baru.',
      },
    ],
    tips: [
      'Akun staf dibuat dan dikelola oleh Administrator Utama — hubungi Administrator jika Anda belum memiliki akun kasir/apoteker.',
      'Setelah login pertama, segera ganti password Anda melalui menu Edit Profil (klik nama Anda di pojok kanan atas header).',
      'Setiap transaksi yang Anda buat akan tercatat atas nama kasir yang sedang login. Selalu logout saat meninggalkan komputer kasir.',
    ],
    warnings: [
      'Jangan membagikan password akun Anda kepada siapa pun, termasuk sesama staf. Setiap aktivitas dilacak per akun.',
    ],
  },
  {
    id: 'profile',
    title: 'Edit Profil & Ganti Password Sendiri',
    shortTitle: 'Edit Profil',
    group: 'Utama',
    icon: User,
    intro:
      'Ubah data diri Anda sendiri (nama, username, nomor WA) dan ganti password akun — tanpa harus meminta bantuan Admin, langsung dari header aplikasi.',
    steps: [
      {
        title: 'Buka jendela Edit Profil',
        desc: 'Di pojok kanan atas header, klik nama Anda (atau area profil bergambar avatar), lalu klik lagi untuk membuka jendela "Edit Profil & Keamanan Password".',
      },
      {
        title: 'Perbarui informasi pengguna',
        desc: 'Ubah Nama Lengkap, Username Login, dan No. Telepon/WA sesuai kebutuhan. Username adalah nama yang Anda pakai saat login.',
      },
      {
        title: 'Ganti password (opsional)',
        desc: 'Isi Password Saat Ini (wajib untuk verifikasi keamanan), Password Baru, lalu Konfirmasi Password Baru. Biarkan kolom password kosong jika tidak ingin mengganti password.',
      },
      {
        title: 'Simpan perubahan',
        desc: 'Klik "Simpan Perubahan". Notifikasi sukses muncul sebelum jendela tertutup otomatis.',
      },
    ],
    tips: [
      'Indikator kekuatan password muncul otomatis saat mengetik password baru — pastikan minimal kuat: 8+ karakter, kombinasi huruf besar, huruf kecil, angka, dan simbol.',
      'Password hanya bisa diubah oleh pemilik akun (harus tahu password saat ini) atau oleh Admin melalui menu Pengguna.',
    ],
    warnings: [
      'Jangan gunakan username yang sudah dipakai akun lain. Jika lupa password, hubungi Administrator Utama untuk reset.',
    ],
  },
  {
    id: 'checklist',
    title: 'Checklist Shift Kasir (Pembukaan & Penutupan)',
    shortTitle: 'Checklist Shift',
    group: 'Utama',
    icon: ClipboardList,
    intro:
      'Rutinitas 5 menit sebelum dan sesudah shift agar operasional kasir selalu siap dan buku kas apotek akurat.',
    steps: [
      {
        title: 'Sebelum buka (pagi) — cek kesiapan',
        desc: 'Login akun kasir → buka Dashboard → pastikan tidak ada banner stok menipis/expired yang kritis → klik lonceng notifikasi → uji cetak struk (Test Printer) bila perlu.',
      },
      {
        title: 'Sebelum buka — cek buku kas',
        desc: 'Buka Finansial → Log Arus Kas → pastikan saldo dan catatan hari sebelumnya sudah benar, dan pengeluaran kemarin sudah dicatat.',
      },
      {
        title: 'Selama shift',
        desc: 'Layani pasien di Penjualan (Kasir) → pastikan setiap transaksi selesai dan struk tercetak → daftarkan pembeli sebagai member bila memungkinkan.',
      },
      {
        title: 'Setelah tutup — cek penjualan',
        desc: 'Buka Riwayat Penjualan → cek total omzet dan jumlah transaksi hari ini → pastikan tidak ada transaksi yang menggantung atau salah input.',
      },
      {
        title: 'Setelah tutup — tutup buku',
        desc: 'Di Finansial, catat pengeluaran operasional hari ini (contoh: listrik, kebersihan, kantong plastik) dan pemasukan di luar penjualan. Cek Laporan Laba/Rugi harian.',
      },
      {
        title: 'Logout',
        desc: 'Keluar dari akun (tombol "Keluar" di pojok kanan atas header) dan pastikan komputer kasir terkunci.',
      },
    ],
    tips: [
      'Biasakan mencocokkan uang tunai di laci kas dengan selisih di Riwayat Penjualan pada akhir shift — segera laporkan bila ada ketidaksesuaian.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard Operasional',
    shortTitle: 'Dashboard',
    group: 'Utama',
    icon: LayoutDashboard,
    intro:
      'Dashboard adalah halaman pertama setelah login. Menampilkan ringkasan penjualan harian, status stok, kadaluwarsa obat, grafik tren, serta aksi cepat operasional.',
    steps: [
      {
        title: 'Baca kartu ringkasan',
        desc: 'Lima kartu di bagian atas: Penjualan Hari Ini (omzet + jumlah transaksi), Jumlah Transaksi, Total Customer, Resep & Dokter, dan Total Item Obat.',
      },
      {
        title: 'Pantau grafik tren',
        desc: 'Dua grafik (Tren Pendapatan & Tren Penjualan) bisa difilter per "Hari Ini", "7 Hari Terakhir", atau "1 Bulan Terakhir" lewat tombol tab di kanan atas kartu.',
      },
      {
        title: 'Cek Status Stok & Kadaluwarsa',
        desc: 'Bagian "Status Stok & Kadaluwarsa Obat" membagi obat berisiko: Stok Menipis, Sudah Expired, Exp < 30 Hari, Exp 1-3 Bulan, dan Exp 3-6 Bulan. Klik salah satu kartu untuk langsung membuka halaman Obat dengan filter terkait.',
      },
      {
        title: 'Periksa notifikasi kadaluwarsa',
        desc: 'Daftar otomatis obat yang masa berlakunya ≤ 180 hari. Gunakan filter status dan kotak pencarian, lalu klik "Kelola" untuk menangani item bersangkutan.',
      },
      {
        title: 'Cek lonceng notifikasi di header',
        desc: 'Ikon lonceng (🔔) di pojok kanan atas header menampilkan notifikasi stok menipis & obat mendekati kadaluwarsa. Klik lonceng untuk melihat daftar item yang membutuhkan perhatian tanpa meninggalkan halaman.',
      },
      {
        title: 'Gunakan Aksi Cepat & Transaksi Terakhir',
        desc: 'Panel "Aksi Cepat Operasional" membawa Anda ke Kasir, Input Stok Masuk, Kelola Obat, atau Laporan. Tabel "Transaksi Terakhir" menampilkan 5 penjualan terbaru — klik "Lihat Semua" untuk buka riwayat lengkap.',
      },
    ],
    filters: [
      { name: 'Grafik (Hari Ini / 7 Hari / 1 Bulan)', desc: 'Mengubah rentang waktu grafik tren pendapatan & penjualan. Ringkasan statistik (total omzet, rata-rata/transaksi, jam/hari puncak) ikut menyesuaikan.' },
      { name: 'Tab status kadaluwarsa', desc: 'Semua (≤ 6 bln), Expired, < 30 Hari, 1-3 Bulan, 3-6 Bulan — memfilter daftar obat berisiko.' },
      { name: 'Pencarian obat / kode / rak', desc: 'Menyaring daftar notifikasi kadaluwarsa berdasarkan nama obat, kode, atau lokasi rak.' },
    ],
    tips: [
      'Jika ada stok menipis atau obat kadaluwarsa, muncul banner kuning "Perhatian Inventaris Apotek" — klik tombolnya untuk memeriksa data obat.',
    ],
  },
  {
    id: 'medicines',
    title: 'Obat & Stok (Katalog Sediaan)',
    shortTitle: 'Obat & Stok',
    group: 'Master Data',
    icon: Pill,
    intro:
      'Kelola seluruh sediaan apotek: obat dan barang non-obat, harga jual, HPP, PPN, margin, lokasi rak, tanggal kadaluwarsa, hingga riwayat mutasi stok.',
    steps: [
      {
        title: 'Tambah item baru',
        desc: 'Klik tombol "Tambah" (biasanya di pojok kanan atas halaman). Isi kode item, nama, tipe (Obat / Non-Obat), kategori, satuan (Strip, Box, Lusin, dst), stok awal, stok minimum, lokasi rak, dan tanggal expired.',
      },
      {
        title: 'Isi harga & PPN dengan benar',
        desc: 'Masukkan HPP (harga beli) dan harga jual. Gunakan bantuan perhitungan otomatis: masukkan margin (%) dan biaya BHP, lalu tentukan tarif PPN (bawaan 11%) dan apakah harga sudah termasuk PPN atau belum (eksklusif). Sistem menghitung DPP dan PPN otomatis.',
      },
      {
        title: 'Simpan item baru',
        desc: 'Klik "Simpan". Stok awal otomatis dicatat sebagai mutasi "Stok awal obat/barang baru" pada riwayat stok.',
      },
      {
        title: 'Cari & filter katalog',
        desc: 'Gunakan kotak pencarian dan kombinasi filter di bawah untuk mempersempit daftar item dengan cepat.',
      },
      {
        title: 'Lihat riwayat mutasi stok',
        desc: 'Klik ikon riwayat pada baris item untuk melihat semua mutasi: masuk, keluar (penjualan), dan penyesuaian beserta catatan, petugas, dan selisih stok.',
      },
      {
        title: 'Edit, hapus, atau pulihkan',
        desc: 'Edit item kapan saja. Item yang sudah memiliki riwayat transaksi tidak dihapus permanen, melainkan diarsipkan (nonaktif) agar laporan keuangan tetap utuh. Gunakan tombol pulihkan (restore) untuk mengaktifkan kembali item yang diarsipkan.',
      },
    ],
    filters: [
      { name: 'Pencarian', desc: 'Cari berdasarkan nama obat, kode item, atau lokasi rak (contoh: "Rak A1").' },
      { name: 'Kategori', desc: '10 kategori: Obat Bebas, Obat Bebas Terbatas, Obat Keras, Jamu & Herbal, Alat Kesehatan, Suplemen & Vitamin, Barang Umum, Perawatan & Kosmetik, Makanan & Minuman, Lainnya.' },
      { name: 'Status Stok', desc: 'Semua / Stok Menipis — stok menipis artinya stok ≤ batas minimum (minStock) item tersebut.' },
      { name: 'Masa Kadaluwarsa', desc: 'Semua / Sudah Expired / ≤ 30 / ≤ 60 / ≤ 90 / ≤ 120 / ≤ 150 / ≤ 180 hari ke depan — membantu memprioritaskan cuci stok (FIFO).' },
      { name: 'Status Aktif', desc: 'Aktif (sedang dijual) / Nonaktif (diarsipkan) / Semua — gunakan filter Nonaktif lalu tombol pulihkan untuk mengaktifkan kembali item.' },
      { name: 'Status PPN', desc: 'Semua / PPN / Non-PPN — memilah item berdasarkan kewajiban PPN 11%.' },
      { name: 'Tipe Item', desc: 'Semua / Obat / Non-Obat — memisahkan sediaan obat dari barang umum.' },
      { name: 'Tampilan Harga', desc: 'Pilihan tampilan harga: termasuk PPN, eksklusif PPN, atau keduanya — hanya mengubah tampilan, tidak mengubah data.' },
    ],
    formulas: [
      {
        title: 'Konversi Harga PPN (Include ↔ Eksklusif)',
        when: 'Saat mengisi harga di form Obat & Stok',
        formula: 'Harga Termasuk PPN = bulatkan( Harga Eksklusif × (1 + PPN% / 100) )',
        example: 'Harga eksklusif Rp 10.000, PPN 11% → Rp 11.100 (harga jual ke pasien).',
      },
      {
        title: 'Harga Eksklusif PPN (DPP)',
        when: 'Saat mengisi harga di form Obat & Stok',
        formula: 'Harga Eksklusif = bulatkan( Harga Termasuk PPN / (1 + PPN% / 100) )',
        example: 'Harga jual Rp 11.100 → DPP = 11.100 / 1,11 = Rp 10.000.',
      },
      {
        title: 'Margin Keuntungan',
        when: 'Saat menentukan harga jual',
        formula: 'Margin (Rp) = Harga Jual − (HPP + BHP)  ·  Margin (%) = Margin (Rp) / (HPP + BHP) × 100',
        example: 'HPP Rp 5.000 + BHP Rp 500, jual Rp 6.600 → margin Rp 1.100 (20%).',
      },
    ],
    tips: [
      'Biarkan pengaturan harga "termasuk PPN" untuk umumnya item — sesuai harga yang dibayar pasien. Pilih "eksklusif PPN" hanya bila harga beli/jual dari supplier memang belum termasuk PPN.',
      'BHP (Bahan Habis Pakai) = biaya tambahan per unit di luar harga beli, misalnya kertas obat, kantong plastik, atau wadah racikan. Isi 0 bila tidak ada biaya tambahan.',
      'Atur "Stok Minimum" realistis per item agar notifikasi stok menipis di Dashboard akurat dan tidak menyesatkan.',
      'Item dengan masa expired dekat ditandai warna-warni (kuning/oranye/merah) di daftar — jadikan panduan prioritas jual (FIFO).',
    ],
    warnings: [
      'Pastikan tanggal kadaluwarsa diisi benar. Obat yang sudah expired wajib ditarik dari rak dan tidak boleh dijual.',
      'Penghapusan item hanya bisa dilakukan oleh Admin. Kasir mendapat peringatan akses dibatasi.',
    ],
  },
  {
    id: 'customers',
    title: 'Customer / Member',
    shortTitle: 'Customer',
    group: 'Master Data',
    icon: Users,
    intro:
      'Kelola data pelanggan dan keanggotaan (member). Nomor member dibuat otomatis dan total belanja serta jumlah transaksi tiap member dihitung otomatis dari penjualan.',
    steps: [
      {
        title: 'Tambah customer baru',
        desc: 'Klik tombol "Tambah Customer / Member". Isi nama, nomor WhatsApp/HP, dan alamat (opsional). Nomor member (MBR-xxx) dan tanggal pendaftaran dibuat otomatis.',
      },
      {
        title: 'Edit data pelanggan',
        desc: 'Klik ikon edit pada baris member untuk mengubah nama, kontak, alamat, atau status (Aktif / Nonaktif).',
      },
      {
        title: 'Lihat riwayat belanja member',
        desc: 'Klik ikon riwayat untuk melihat total belanja, jumlah transaksi, dan riwayat pembelian member tersebut.',
      },
      {
        title: 'Hapus data pelanggan',
        desc: 'Gunakan tombol hapus bila data benar-benar tidak diperlukan. Member yang sudah memiliki transaksi akan diarsipkan (status Nonaktif) agar data historis tetap aman.',
      },
    ],
    filters: [
      { name: 'Pencarian', desc: 'Cari berdasarkan nama, nomor member (MBR-xxx), atau nomor telepon.' },
      { name: 'Status Member', desc: 'Aktif / Nonaktif — member nonaktif tidak bisa dipilih pada transaksi kasir.' },
    ],
    tips: [
      'Daftarkan pembeli sebagai member saat transaksi di kasir (ada tombol daftar cepat di halaman Penjualan) untuk mengumpulkan riwayat dan data loyalitas.',
    ],
  },
  {
    id: 'doctors',
    title: 'Dokter',
    shortTitle: 'Dokter',
    group: 'Master Data',
    icon: Stethoscope,
    intro:
      'Kelola data dokter mitra dan pantau rekap resep per dokter. Data ini dipakai saat transaksi resep di kasir dan untuk laporan rujukan dokter.',
    steps: [
      {
        title: 'Tambah dokter mitra',
        desc: 'Klik tombol "Tambah Dokter". Isi nama dokter, nomor telepon, dan status (Aktif / Nonaktif).',
      },
      {
        title: 'Edit atau nonaktifkan',
        desc: 'Gunakan ikon edit untuk mengubah data. Nonaktifkan dokter yang sudah tidak bekerja sama agar tidak muncul pada pemilihan dokter di kasir.',
      },
      {
        title: 'Pantau rekap resep',
        desc: 'Klik ikon rekap pada baris dokter untuk melihat jumlah resep yang ditangani beserta riwayatnya.',
      },
    ],
    filters: [
      { name: 'Pencarian', desc: 'Cari berdasarkan nama atau nomor telepon dokter.' },
      { name: 'Status', desc: 'Aktif / Nonaktif — hanya dokter berstatus Aktif yang muncul di daftar pilihan resep kasir.' },
    ],
    tips: [
      'Gunakan penulisan nama dokter yang sama persis di setiap transaksi agar rekap resep dan laporan rujukan dokter konsisten.',
    ],
  },
  {
    id: 'stock-in',
    title: 'Stok Masuk & Penyesuaian (Opname)',
    shortTitle: 'Stok Masuk',
    group: 'Transaksi',
    icon: PackagePlus,
    intro:
      'Halaman ini memiliki dua tab: "Stok Masuk" untuk menerima barang dari supplier, dan "Penyesuaian" untuk stok opname (pencocokan stok fisik). Keduanya otomatis tercatat di riwayat mutasi stok.',
    steps: [
      {
        title: 'Tab Stok Masuk — isi data pembelian',
        desc: 'Pilih obat/barang, masukkan jumlah masuk, harga beli (HPP), biaya BHP, margin, dan harga jual. Pilih status PPN (PPN / Non-PPN) sesuai faktur supplier.',
      },
      {
        title: 'Perbarui data master (opsional)',
        desc: 'Centang opsi "perbarui data master" bila harga beli/harga jual baru juga harus mengubah harga di katalog Obat & Stok.',
      },
      {
        title: 'Stok masuk tunggal atau bulk',
        desc: 'Bisa memasukkan satu item, atau menggunakan mode "Bulk Restock" untuk mengisi banyak item sekaligus. Gunakan filter PPN dan kategori untuk menampilkan item yang diinginkan, lalu proses bersamaan.',
      },
      {
        title: 'Tab Penyesuaian — stok opname',
        desc: 'Masukkan stok fisik hasil penghitungan. Sistem menghitung selisih (kurang/lebih) otomatis dan mencatat penyesuaian beserta catatan Anda. Contoh: stok sistem 10 strip, hasil hitung fisik 8 strip → sistem mencatat selisih −2. Tersedia mode "Bulk Opname" per kategori.',
      },
      {
        title: 'Pantau riwayat mutasi',
        desc: 'Di bagian bawah tersedia riwayat mutasi stok masuk dan penyesuaian lengkap dengan tanggal, petugas, dan catatan. Gunakan pencarian & filter untuk menemukan mutasi tertentu.',
      },
    ],
    filters: [
      { name: 'Tab Stok Masuk / Penyesuaian', desc: 'Memilih jenis aktivitas: penerimaan barang dari supplier atau penyesuaian stok opname.' },
      { name: 'Tipe Item (Obat / Non-Obat)', desc: 'Memisahkan proses restock/opname antara sediaan obat dan barang non-obat.' },
      { name: 'Filter PPN (Semua / PPN / Non-PPN)', desc: 'Pada mode bulk, menampilkan hanya item dengan status pajak yang dipilih.' },
      { name: 'Filter Kategori', desc: 'Bulk opname bisa difilter per kategori obat untuk memudahkan penghitungan fisik bertahap.' },
      { name: 'Pencarian', desc: 'Cari item berdasarkan nama atau kode pada daftar restock/opname dan riwayat mutasi.' },
    ],
    formulas: [
      {
        title: 'Harga Pokok Total (Modal)',
        when: 'Saat restock / stok masuk',
        formula: 'Harga Pokok Total = HPP + BHP',
        example: 'HPP Rp 5.000 + BHP Rp 500 → modal Rp 5.500 per unit.',
      },
      {
        title: 'Harga Jual dari Modal + Margin',
        when: 'Saat restock / stok masuk',
        formula: 'Harga Jual = bulatkan( Harga Pokok Total × (1 + Margin% / 100) )',
        example: 'Modal Rp 5.500 × (1 + 20%) → harga jual Rp 6.600.',
      },
      {
        title: 'Margin (%) dihitung mundur',
        when: 'Saat restock / stok masuk',
        formula: 'Margin (%) = (Harga Jual − Harga Pokok Total) / Harga Pokok Total × 100',
        example: 'Jual Rp 6.600, modal Rp 5.500 → margin 20%.',
      },
      {
        title: 'PPN pada Stok Masuk',
        when: 'Saat restock item berstatus PPN',
        formula: 'PPN = bulatkan( (HPP − HPP / 1,11) × jumlah masuk )',
        note: 'Untuk item berstatus PPN (tarif 11%), nilai PPN dihitung dari HPP yang sudah termasuk PPN.',
      },
    ],
    warnings: [
      'Penyesuaian stok memengaruhi perhitungan HPP dan laporan keuangan. Lakukan hanya setelah opname fisik benar-benar selesai dan teliti.',
    ],
  },
  {
    id: 'pos',
    title: 'Penjualan (Kasir / POS)',
    shortTitle: 'Penjualan (POS)',
    group: 'Transaksi',
    icon: ShoppingCart,
    intro:
      'Halaman kasir untuk melayani transaksi penjualan obat dan non-obat, termasuk transaksi resep. Mendukung pencarian, scan barcode, dan pembayaran Tunai / QRIS / Transfer.',
    steps: [
      {
        title: 'Cari atau scan item',
        desc: 'Ketik nama/kode obat pada kotak pencarian, atau arahkan scanner barcode ke barcode obat (input scan otomatis fokus). Filter kategori dan status PPN tersedia di bagian atas katalog.',
      },
      {
        title: 'Tambah item ke keranjang',
        desc: 'Klik item pada daftar produk — item langsung masuk keranjang. Atur jumlah dengan tombol + / − pada baris item.',
      },
      {
        title: 'Pilih customer & dokter',
        desc: 'Pilih customer/member dari daftar, atau daftarkan customer baru cepat langsung dari kasir. Jika pasien membawa resep, pilih dokter mitra (wajib untuk transaksi resep).',
      },
      {
        title: 'Aktifkan mode Resep (bila perlu)',
        desc: 'Centang mode resep, lalu atur markup resep dan biaya jasa racikan. Gunakan nilai bawaan dari Pengaturan, atau centang "Ubah Markup & Biaya Racikan Khusus Transaksi Ini" untuk nilai transaksi ini saja.',
      },
      {
        title: 'Cek perhitungan pajak',
        desc: 'Periksa ringkasan: subtotal, jasa/markup resep, DPP (Dasar Pengenaan Pajak), PPN (bawaan 11%), dan total yang harus dibayar. Pastikan sesuai sebelum pembayaran.',
      },
      {
        title: 'Terima pembayaran',
        desc: 'Pilih metode bayar: Tunai, QRIS, atau Transfer. Untuk tunai, masukkan nominal uang diterima — kembalian dihitung otomatis.',
      },
      {
        title: 'Selesaikan transaksi & cetak struk',
        desc: 'Klik "Bayar" / "Lanjut Bayar". Struk penjualan otomatis muncul. Di komputer kasir, struk dapat dicetak otomatis ke printer thermal (lihat Pengaturan). Jika membuka aplikasi lewat browser, gunakan perintah Cetak.',
      },
    ],
    filters: [
      { name: 'Pencarian produk', desc: 'Cari item berdasarkan nama atau kode; cocok untuk produk yang tidak memiliki barcode.' },
      { name: 'Scan barcode', desc: 'Scanner USB: arahkan ke barcode — item otomatis masuk keranjang dan kolom scan fokus kembali. Jika barcode tidak ditemukan muncul peringatan "not found".' },
      { name: 'Filter kategori', desc: 'Kategori item untuk mempersempit katalog produk yang ditampilkan.' },
      { name: 'Filter PPN (all / ppn / non_ppn)', desc: 'Menampilkan hanya produk sesuai status pajak. Saat keranjang terisi, tipe pajak transaksi terkunci — ganti hanya setelah keranjang dikosongkan.' },
      { name: 'Filter Dokter & Customer', desc: 'Daftar pilihan customer/member dan dokter (hanya dokter status Aktif).' },
    ],
    formulas: [
      {
        title: 'Subtotal Item',
        when: 'Setiap transaksi',
        formula: 'Subtotal = Jumlah × Faktor Satuan × Harga Satuan',
        example: '2 strip × 10 tablet × Rp 1.000 = Rp 20.000. (Lusin dihitung 12 pcs.)',
      },
      {
        title: 'Transaksi Resep (Markup + Racikan)',
        when: 'Saat mode resep aktif',
        formula: 'Total = Subtotal + bulatkan(Subtotal × Markup% / 100) + Biaya Racikan',
        example: 'Subtotal Rp 100.000, markup 20% → Rp 120.000 + jasa racikan Rp 5.000 = Rp 125.000.',
      },
      {
        title: 'PPN — Harga Termasuk PPN (bawaan)',
        when: 'Transaksi PPN (bawaan)',
        formula: 'DPP = bulatkan( Total / (1 + PPN% / 100) )  ·  PPN = Total − DPP',
        example: 'Total Rp 111.000 → DPP Rp 100.000, PPN Rp 11.000. Harga ke pasien tetap Rp 111.000.',
      },
      {
        title: 'PPN — Harga Eksklusif (PPN di atas subtotal)',
        when: 'Transaksi PPN eksklusif',
        formula: 'PPN = bulatkan( Total × PPN% / 100 )  ·  Total Bayar = Total + PPN',
        example: 'Total Rp 100.000 + PPN 11% → PPN Rp 11.000, total bayar Rp 111.000.',
      },
      {
        title: 'Kembalian / Kekurangan',
        when: 'Saat pembayaran Tunai',
        formula: 'Kembalian = Uang Diterima − Total Bayar  (jika lebih)',
        example: 'Total Rp 125.000, bayar Rp 150.000 → kembalian Rp 25.000.',
      },
      {
        title: 'Aturan Perpajakan Transaksi',
        when: 'Sebelum menambah item ke keranjang',
        formula: 'Satu transaksi = SATU jenis pajak',
        note: 'Obat PPN 11% dan Non-PPN TIDAK boleh digabung dalam satu transaksi. Keranjang otomatis mengunci jenis pajak setelah item pertama ditambahkan.',
      },
      {
        title: 'Kalkulator & Rumus Resep (referensi)',
        when: 'Saat menyusun harga resep',
        formula: 'Markup = (Jual − Modal)/Modal × 100 · Gross Margin = (Jual − Modal)/Jual × 100 · Insentif = Penjualan Resep × %Insentif · Profit Bersih = Laba/ Penjualan × 100',
        note: 'Kalkulator ini tersedia sebagai modul panduan persentase farmasi: kontribusi resep, gross margin, markup, jasa pelayanan (embalase/tuscan), persentase racikan, diskon penebusan, pemakaian obat generik, insentif dokter, profit bersih, dan formulasi harga resep pasien.',
      },
    ],
    tips: [
      'Biarkan pengaturan PPN pada nilai bawaan (harga sudah termasuk PPN 11%) untuk transaksi umum — sesuai harga yang dibayar pasien. Ubah hanya jika faktur/supplier menyatakan harga belum termasuk PPN.',
      'Jika stok tidak cukup, item expired, atau barcode tidak ditemukan, kasir menampilkan peringatan — perbaiki dulu sebelum melanjutkan.',
      'Gunakan filter kategori produk cepat di atas katalog untuk mempercepat pencarian item yang sering dibeli.',
      'Untuk resep racikan, masukkan aturan pakai pada kolom "Ket. Resep" (contoh: 3x1 tablet sesudah makan) agar tercetak di struk.',
    ],
    warnings: [
      'Pastikan nominal uang diterima tidak kurang dari total belanja sebelum menekan tombol bayar. Transaksi yang sudah selesai hanya bisa dibatalkan melalui Riwayat Penjualan dengan alasan.',
      'Transaksi resep WAJIB memilih dokter pemberi resep — sistem menolak checkout bila dokter belum dipilih.',
    ],
  },
  {
    id: 'business-process',
    title: 'Alur & Proses Bisnis Transaksi',
    shortTitle: 'Proses Transaksi',
    group: 'Transaksi',
    icon: Workflow,
    intro:
      'Semua transaksi penjualan — obat maupun non-obat — mengalir melalui proses yang sama dan tercatat otomatis: dari barang masuk keranjang, pembayaran, hingga laporan keuangan terbarui.',
    steps: [
      {
        title: '1. Persiapan data master',
        desc: 'Pastikan setiap item sudah punya harga jual, HPP (harga beli), status PPN, dan stok. Customer/member dan dokter mitra didaftarkan lebih dulu agar mudah dipilih saat transaksi.',
      },
      {
        title: '2. Pelanggan memilih barang',
        desc: 'Kasir menambah item lewat pencarian atau scan barcode. Sistem langsung memeriksa: stok cukup? belum kadaluwarsa? Jenis pajaknya sesuai transaksi (PPN atau non-PPN)?',
      },
      {
        title: '3. Sistem menghitung otomatis',
        desc: 'Subtotal dihitung per item (jumlah × harga). Jika transaksi resep, ditambah jasa/markup resep dan biaya racikan. Lalu dihitung DPP dan PPN (bawaan 11%) sesuai jenis transaksi.',
      },
      {
        title: '4. Pembayaran diterima',
        desc: 'Pilih metode Tunai, QRIS, atau Transfer. Untuk tunai, kembalian dihitung otomatis. Transaksi baru selesai jika uang diterima ≥ total belanja.',
      },
      {
        title: '5. Transaksi tercatat & stok berkurang',
        desc: 'Nomor transaksi dibuat otomatis (contoh: TRX-20260214-001, nomor urut harian) dan dicatat atas nama kasir yang sedang login. Stok setiap item langsung berkurang sesuai jumlah terjual.',
      },
      {
        title: '6. Omzet & modal dipisah obat vs non-obat',
        desc: 'Setiap item dicatat terpisah: omzet obat vs non-obat, dan HPP (modal) obat vs non-obat. Pemisahan inilah dasar semua laporan produk, laba/rugi, dan pajak.',
      },
      {
        title: '7. Struk dicetak & data masuk laporan',
        desc: 'Struk langsung muncul (bisa dicetak otomatis). Transaksi tercatat di Riwayat Penjualan, lalu laporan penjualan, produk, keuangan, dan pajak ikut terbarui.',
      },
      {
        title: '8. Pembatalan (bila keliru)',
        desc: 'Pembatalan wajib disertai alasan. Stok semua item otomatis dikembalikan, dan jejak pembatal (siapa, kapan, alasan) tersimpan permanen.',
      },
    ],
    formulas: [
      {
        title: 'Ringkasan Omzet & Laba',
        when: 'Menilai hasil penjualan',
        formula: 'Omzet Total = Omzet Obat + Omzet Non-Obat  ·  Laba Kotor = Omzet Total − (HPP Obat + HPP Non-Obat)',
        example: 'Omzet Rp 500.000 (obat Rp 400.000 + non-obat Rp 100.000), HPP Rp 320.000 → laba kotor Rp 180.000.',
      },
      {
        title: 'Nomor Transaksi Otomatis',
        when: 'Setiap transaksi selesai',
        formula: 'TRX-TANGGAL-NOMOR (contoh: TRX-20260214-001) — nomor urut dihitung otomatis per hari.',
      },
    ],
    tips: [
      'Pastikan HPP terisi di setiap item. Jika kosong, sistem memperkirakan HPP sebesar 75% dari harga jual — laporan laba jadi kurang akurat bila banyak item yang HPP-nya kosong.',
      'Satu keranjang = satu jenis pajak. Jangan mencampur item PPN dan non-PPN dalam satu transaksi.',
    ],
    warnings: [
      'Transaksi yang sudah selesai tidak bisa diubah langsung. Kesalahan diperbaiki lewat pembatalan (dengan alasan), bukan dengan edit.',
    ],
  },
  {
    id: 'transactions',
    title: 'Riwayat Penjualan',
    shortTitle: 'Riwayat Penjualan',
    group: 'Transaksi',
    icon: Receipt,
    intro:
      'Daftar seluruh transaksi kasir dengan pencarian, filter lengkap, cetak ulang struk, detail transaksi, dan audit pembatalan.',
    steps: [
      {
        title: 'Atur rentang tanggal',
        desc: 'Gunakan tombol pilihan cepat (Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini) atau pilih "Kustom" untuk rentang tanggal manual dari–sampai.',
      },
      {
        title: 'Kombinasikan filter',
        desc: 'Gabungkan filter status, metode bayar, kasir, jenis resep, dan status PPN untuk menemukan transaksi spesifik.',
      },
      {
        title: 'Baca ringkasan',
        desc: 'Kartu ringkasan menampilkan total transaksi selesai, transaksi dibatalkan, dan total omzet pada rentang yang sedang difilter.',
      },
      {
        title: 'Buka detail transaksi',
        desc: 'Klik baris transaksi untuk melihat rincian item, harga, DPP/PPN, metode bayar, dan kasir.',
      },
      {
        title: 'Cetak ulang struk',
        desc: 'Gunakan tombol cetak untuk mencetak ulang struk transaksi (ke printer thermal di komputer, atau lewat perintah Cetak di browser).',
      },
      {
        title: 'Batalkan transaksi',
        desc: 'Pilih transaksi lalu klik "Batalkan". Wajib mengisi alasan pembatalan — sistem mencatat pembatal, waktu, dan alasan secara permanen.',
      },
    ],
    filters: [
      { name: 'Pilihan cepat tanggal', desc: 'Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini, atau Kustom (rentang manual).' },
      { name: 'Pencarian', desc: 'Cari berdasarkan nomor transaksi, nama item, atau nama kasir.' },
      { name: 'Status', desc: 'Semua / Selesai / Dibatalkan.' },
      { name: 'Metode Bayar', desc: 'Semua / Tunai / QRIS / Transfer Bank.' },
      { name: 'Kasir', desc: 'Menyaring transaksi per petugas kasir yang login saat itu.' },
      { name: 'Jenis Transaksi', desc: 'Semua / Resep / Non-Resep.' },
      { name: 'Status Pajak', desc: 'Semua (PPN & Non-PPN) / PPN / Non-PPN.' },
    ],
    tips: [
      'Saat transaksi dibatalkan, seluruh item yang terjual OTOMATIS dikembalikan ke stok obat — Anda tidak perlu mencatat stok masuk manual.',
      'Tombol "Reset Semua Filter" mengembalikan seluruh filter ke kondisi awal sekaligus.',
    ],
    warnings: [
      'Pembatalan transaksi tidak menghapus data, melainkan menandai status menjadi "Dibatalkan" dengan jejak audit lengkap. Gunakan hanya untuk transaksi yang benar-benar keliru.',
    ],
  },
  {
    id: 'finances',
    title: 'Finansial & Arus Kas',
    shortTitle: 'Finansial',
    group: 'Finansial & Laporan',
    icon: WalletCards,
    intro:
      'Pantau kesehatan keuangan apotek: neraca (aset & modal), laporan laba/rugi operasional, dan log arus kas harian.',
    steps: [
      {
        title: 'Neraca Keuangan (Balance Sheet)',
        desc: 'Tab pertama menampilkan Aset Apotek (kas dari penjualan + arus kas) dan Ekuitas/Modal (modal awal + suntikan modal). Klik bagian untuk melihat audit rincian sumber datanya.',
      },
      {
        title: 'Laporan Laba / Rugi',
        desc: 'Tab kedua merinci pendapatan operasional (omzet obat, non-obat, jasa resep), beban operasional, dan pendapatan lainnya. Atur periode laporan untuk melihat laba/rugi bersih.',
      },
      {
        title: 'Catat Arus Kas',
        desc: 'Tab ketiga untuk mencatat pemasukan dan pengeluaran kas di luar penjualan (misal: suntikan modal, belanja operasional, pembayaran listrik). Pilih tipe, kategori, nominal, dan keterangan.',
      },
      {
        title: 'Kelola catatan arus kas',
        desc: 'Cari/filter log arus kas, dan hapus catatan yang keliru. Saldo kas di neraca otomatis menyesuaikan.',
      },
    ],
    filters: [
      { name: 'Periode Laporan', desc: 'Atur rentang tanggal untuk laporan Laba/Rugi (misal: Bulan Ini, Tahun Ini, atau kustom).' },
      { name: 'Log Arus Kas', desc: 'Pilihan cepat: Semua, Hari Ini, 7 Hari Terakhir, 30 Hari, Bulan Ini, Tahun Ini, atau Kustom; plus filter tipe (Pemasukan/Pengeluaran).' },
    ],
    formulas: [
      {
        title: 'Saldo Kas (Neraca)',
        when: 'Membaca Neraca',
        formula: 'Saldo Kas = Modal Awal + Penjualan Obat (Selesai) + Pemasukan Arus Kas Lain − Pengeluaran Arus Kas Lain',
        note: 'Hanya transaksi berstatus "Selesai" yang dihitung sebagai penjualan.',
      },
      {
        title: 'Modal Disetor',
        when: 'Membaca Neraca',
        formula: 'Modal Disetor = Modal Awal Standar + Akumulasi Suntikan Modal (via Log Arus Kas)',
      },
      {
        title: 'Laba / Rugi Bersih',
        when: 'Membaca Laporan Laba/Rugi',
        formula: 'Laba/Rugi = Pendapatan Operasional + Pendapatan Lainnya − Beban Operasional',
      },
    ],
    tips: [
      'Cara membaca cepat: jika Neraca seimbang dan Laba/Rugi positif, kondisi keuangan apotek sehat. Angka yang janggal biasanya berasal dari transaksi berstatus belum selesai atau arus kas yang belum dicatat.',
      'Catat pengeluaran operasional secara rutin (harian/mingguan) agar laporan laba/rugi dan neraca selalu akurat.',
      'Suntikan modal dicatat sebagai Pemasukan pada arus kas, dan dialokasikan ke Ekuitas/Modal pada neraca (bukan laba operasional).',
    ],
  },
  {
    id: 'finance-guide',
    title: 'Membaca Laporan Keuangan untuk Pemula',
    shortTitle: 'Baca Keuangan',
    group: 'Finansial & Laporan',
    icon: LineChart,
    intro:
      'Panduan sederhana memahami angka-angka di menu Finansial — tanpa harus menjadi akuntan. Cocok untuk apoteker dan kasir yang bertanggung jawab pada buku kas.',
    steps: [
      {
        title: 'Mulai dari Log Arus Kas',
        desc: 'Ini catatan paling mudah dibaca: uang masuk (Pemasukan) vs uang keluar (Pengeluaran) di luar penjualan. Jika pengeluaran tidak dicatat (contoh: beli kantong plastik), seluruh laporan lain ikut meleset.',
      },
      {
        title: 'Lalu lihat Laporan Laba / Rugi',
        desc: 'Menjawab pertanyaan "apotek untung atau rugi?" — Pendapatan (penjualan + jasa resep + pemasukan lain) dikurangi Beban (pengeluaran operasional). Angka positif berarti untung.',
      },
      {
        title: 'Terakhir cek Neraca',
        desc: 'Menjawab "berapa kas apotek sekarang?" — Saldo Kas = Modal Awal + Penjualan Selesai + Pemasukan Lain − Pengeluaran Lain. Bandingkan dengan uang fisik di laci kas.',
      },
      {
        title: 'Kapan angka terlihat janggal?',
        desc: 'Biasanya karena: (1) ada transaksi berstatus belum selesai atau dibatalkan, (2) arus kas belum dicatat, (3) penyesuaian stok belum dibukukan. Periksa tiga hal ini dulu sebelum mencari masalah lain.',
      },
      {
        title: 'Kapan laporan pajak dipakai',
        desc: 'Rekap Pajak PPN & Non-PPN digunakan untuk pengisian SPT Masa PPN. Biasanya diserahkan ke akuntan/pihak pengelola pajak apotek — pastikan data lengkap per bulan.',
      },
    ],
    tips: [
      'Klik bagian pada Neraca untuk melihat "audit rincian" — sistem menjelaskan dari mana setiap angka berasal.',
      'Laporan Laba/Rugi adalah tolok ukur harian yang paling praktis: cek angka akhirnya setiap sore setelah tutup buku.',
    ],
  },
  {
    id: 'reports',
    title: 'Laporan Operasional',
    shortTitle: 'Laporan Operasional',
    group: 'Finansial & Laporan',
    icon: FileSpreadsheet,
    intro:
      'Laporan lengkap operasional apotek dalam 5 tab: Penjualan, Customer, Dokter, Stok, dan Expired. Semua laporan bisa difilter periode lalu dicetak.',
    steps: [
      {
        title: 'Pilih jenis laporan',
        desc: 'Tab "1. Laporan Penjualan" untuk omzet & transaksi; "2. Laporan Customer" untuk analisis member; "3. Laporan Dokter" untuk rujukan resep; "4. Laporan Stok" untuk sediaan & stok menipis; "5. Laporan Expired" untuk audit kadaluwarsa.',
      },
      {
        title: 'Atur periode',
        desc: 'Gunakan pilihan cepat tanggal (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Tahun Ini) atau pilih "Kustom" untuk rentang manual, lalu terapkan filter.',
      },
      {
        title: 'Lihat ringkasan & detail',
        desc: 'Setiap laporan menampilkan kartu ringkasan dan tabel detail (omzet, jumlah transaksi, item terlaris, pelanggan terbaik, dll).',
      },
      {
        title: 'Cetak / ekspor laporan',
        desc: 'Gunakan tombol cetak pada laporan untuk mencetak atau menyimpan sebagai PDF untuk arsip.',
      },
    ],
    filters: [
      { name: 'Pilihan cepat tanggal', desc: 'Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Tahun Ini, atau Kustom (rentang manual dari–sampai).' },
      { name: 'Laporan Penjualan', desc: 'Ringkasan omzet, jumlah transaksi, rata-rata/transaksi, metode bayar, dan rekap per item/obat.' },
      { name: 'Laporan Customer', desc: 'Member terbaik berdasarkan total belanja & frekuensi; klik member untuk detail riwayat.' },
      { name: 'Laporan Dokter', desc: 'Rekap rujukan resep per dokter; klik dokter untuk detail transaksi resep.' },
      { name: 'Laporan Stok', desc: 'Daftar sediaan beserta sisa stok, batas minimum, dan status stok menipis.' },
      { name: 'Laporan Expired', desc: 'Audit kadaluwarsa: expired, < 30 hari, 1-3 bulan, dst. — dengan filter status dan pencarian.' },
    ],
    formulas: [
      {
        title: 'Omzet & Rata-rata',
        when: 'Membaca Laporan Penjualan',
        formula: 'Omzet = Σ Total Transaksi Selesai  ·  Rata-rata/Trx = Omzet / Jumlah Transaksi',
      },
      {
        title: 'Margin per Item (laporan stok/produk)',
        when: 'Membaca Laporan Stok / Produk',
        formula: 'HPP per Unit = bulatkan(HPP Total / Jumlah)  ·  Margin (Rp) = Subtotal − HPP Total  ·  Margin (%) = Total Margin / Total Omzet × 100',
      },
    ],
    tips: [
      'Gunakan pilihan cepat tanggal untuk laporan rutin harian/mingguan agar cepat dan konsisten.',
    ],
  },
  {
    id: 'report-pajak-ppn',
    title: 'Rekap Pajak PPN & Non-PPN',
    shortTitle: 'Rekap Pajak',
    group: 'Laporan Perpajakan',
    icon: Calculator,
    intro:
      'Rekapitulasi faktur penjualan PPN 11% dan nota Non-PPN, lengkap dengan Dasar Pengenaan Pajak (DPP) dan nilai PPN terutang per item — untuk kebutuhan pelaporan perpajakan.',
    steps: [
      {
        title: 'Pilih periode pajak',
        desc: 'Atur rentang tanggal sesuai masa pajak yang ingin direkap (pilihan cepat atau kustom).',
      },
      {
        title: 'Periksa rekap PPN',
        desc: 'Lihat total transaksi kena PPN (11%) dan non-PPN, ringkasan DPP, PPN terutang, dan rincian faktur per transaksi.',
      },
      {
        title: 'Buka detail faktur',
        desc: 'Klik transaksi untuk melihat rincian DPP dan PPN per item obat/barang.',
      },
      {
        title: 'Ekspor untuk pelaporan',
        desc: 'Cetak/simpan rekap sebagai arsip pendukung pelaporan pajak apotek.',
      },
    ],
    filters: [
      { name: 'Periode', desc: 'Pilihan cepat tanggal (Hari Ini, 7 Hari, Bulan Ini, Tahun Ini) atau rentang kustom.' },
      { name: 'Rincian per transaksi', desc: 'Setiap faktur menampilkan total, DPP, dan PPN terutang — cukup untuk pengisian SPT masa PPN.' },
    ],
    formulas: [
      {
        title: 'DPP & PPN — Transaksi PPN (harga termasuk PPN)',
        when: 'Pengisian SPT Masa PPN',
        formula: 'DPP = bulatkan( Total / (1 + 11% / 100) )  ·  PPN = Total − DPP',
        example: 'Faktur Rp 111.000 → DPP Rp 100.000, PPN Rp 11.000.',
      },
      {
        title: 'DPP & PPN — Transaksi PPN (harga eksklusif)',
        when: 'Pengisian SPT Masa PPN',
        formula: 'DPP = Total  ·  PPN = bulatkan( Total × 11% / 100 )',
        example: 'Faktur Rp 100.000 → DPP Rp 100.000, PPN Rp 11.000, total tagihan Rp 111.000.',
      },
      {
        title: 'Transaksi Non-PPN',
        when: 'Rekap nota Non-PPN',
        formula: 'DPP = Total  ·  PPN = 0',
        note: 'Nota non-PPN tetap direkap terpisah pada laporan ini.',
      },
    ],
    warnings: [
      'Pastikan pengaturan PPN pada tiap item di master Obat & Stok sudah benar (tarif & termasuk/eksklusif), karena rekap pajak dihitung dari data tersebut.',
    ],
  },
  {
    id: 'report-obat',
    title: 'Laporan Produk Obat',
    shortTitle: 'Laporan Obat',
    group: 'Laporan Perpajakan',
    icon: Pill,
    intro:
      'Laporan per item produk obat: volume & omzet penjualan, harga jual, HPP, margin, dan rincian PPN.',
    steps: [
      {
        title: 'Pahami sumber datanya',
        desc: 'Setiap transaksi penjualan otomatis mencatat per item obat: jumlah terjual, harga jual, dan HPP (harga beli). Laporan ini adalah rekap semua penjualan per produk obat pada periode yang dipilih.',
      },
      {
        title: 'Atur periode & filter',
        desc: 'Pilih rentang tanggal (pilihan cepat atau kustom) untuk melihat rekap produk obat pada periode tersebut.',
      },
      {
        title: 'Baca tiap kolom',
        desc: 'Jumlah Terjual (volume dalam satuan/pcs), Omzet (total nilai penjualan), HPP Modal (harga beli × jumlah terjual), Margin/Laba (omzet − HPP), serta DPP & PPN per produk.',
      },
      {
        title: 'Analisis & keputusan stok',
        desc: 'Gunakan untuk menemukan produk terlaris, produk dengan margin kecil, dan barang yang perlu stok ulang. Klik item untuk melihat rincian transaksinya.',
      },
      {
        title: 'Cetak / simpan',
        desc: 'Cetak atau simpan untuk arsip stok dan keperluan pajak.',
      },
    ],
    tips: [
      'Produk dengan margin tipis tapi volume besar tetap layak dijual — pantau kolom margin dan omzet bersamaan, jangan hanya salah satunya.',
      'Bandingkan dengan Laporan Stok: pastikan produk terlaris stoknya aman dan tidak mendekati kadaluwarsa.',
    ],
    filters: [
      { name: 'Periode', desc: 'Pilihan cepat tanggal (Hari Ini, 7 Hari, Bulan Ini, Tahun Ini) atau rentang kustom.' },
      { name: 'Detail per item', desc: 'Klik item untuk melihat rincian transaksi produk tersebut lengkap dengan harga dan PPN.' },
    ],
    formulas: [
      {
        title: 'Perhitungan per produk obat',
        when: 'Membaca Laporan Produk Obat',
        formula: 'HPP Total = Σ (Harga Beli × Jumlah)  ·  Margin (Rp) = Subtotal − HPP Total  ·  Margin (%) = Total Margin / Total Omzet × 100',
        example: 'Obat X terjual 50 pcs @ Rp 6.600 (omzet Rp 330.000), HPP Rp 5.000/pcs (Rp 250.000) → margin Rp 80.000 (24,2%).',
      },
      {
        title: 'DPP & PPN per produk',
        when: 'Membaca Laporan Produk Obat',
        formula: 'DPP = Subtotal / 1,11 (jika harga termasuk PPN)  ·  PPN = Subtotal − DPP',
      },
    ],
  },
  {
    id: 'report-non-obat',
    title: 'Laporan Non-Obat',
    shortTitle: 'Laporan Non-Obat',
    group: 'Laporan Perpajakan',
    icon: Package,
    intro:
      'Laporan per item barang non-obat (alat kesehatan, suplemen, kosmetik, dll): penjualan, HPP, margin, dan rincian PPN.',
    steps: [
      {
        title: 'Pahami sumber datanya',
        desc: 'Barang non-obat adalah semua item bertipe non-obat: alat kesehatan, suplemen & vitamin, perawatan & kosmetik, makanan & minuman, dan barang umum. Setiap penjualannya tercatat otomatis dengan harga jual dan HPP.',
      },
      {
        title: 'Atur periode',
        desc: 'Pilih rentang tanggal sesuai periode yang diinginkan (pilihan cepat atau kustom).',
      },
      {
        title: 'Baca tiap kolom',
        desc: 'Jumlah Terjual, Omzet, HPP Modal, Margin/Laba per item, serta DPP & PPN — sama seperti laporan produk obat.',
      },
      {
        title: 'Analisis & keputusan stok',
        desc: 'Pantau kontribusi barang non-obat terhadap omzet dan laba apotek. Klik item untuk melihat rincian transaksinya.',
      },
      {
        title: 'Cetak / simpan',
        desc: 'Cetak atau simpan untuk arsip stok dan keperluan pajak.',
      },
    ],
    tips: [
      'Barang non-obat sering punya margin lebih tinggi dari obat — jadikan laporan ini acuan untuk promosi dan pengadaan barang.',
    ],
    filters: [
      { name: 'Periode', desc: 'Pilihan cepat tanggal (Hari Ini, 7 Hari, Bulan Ini, Tahun Ini) atau rentang kustom.' },
      { name: 'Detail per item', desc: 'Klik item untuk melihat rincian transaksi barang non-obat tersebut.' },
    ],
    formulas: [
      {
        title: 'Perhitungan per produk non-obat',
        when: 'Membaca Laporan Non-Obat',
        formula: 'Margin (Rp) = Subtotal − HPP Total  ·  Margin (%) = Total Margin / Total Omzet × 100',
      },
      {
        title: 'DPP & PPN per produk',
        when: 'Membaca Laporan Non-Obat',
        formula: 'DPP = Subtotal / 1,11 (jika harga termasuk PPN)  ·  PPN = Subtotal − DPP',
      },
    ],
  },
  {
    id: 'users',
    title: 'Manajemen Pengguna & Otorisasi',
    shortTitle: 'Pengguna',
    group: 'Sistem',
    icon: UserCog,
    adminOnly: true,
    intro:
      'Kelola akun staf, hak akses (Kasir vs Admin), serta status aktifasi pengguna. Menu ini khusus untuk Admin.',
    steps: [
      {
        title: 'Tambah user baru',
        desc: 'Klik "Tambah User Baru". Isi nama lengkap, username login, peran (Staff Kasir / Admin Operasional), status akun, nomor WhatsApp, dan password kuat (min. 8 karakter).',
      },
      {
        title: 'Periksa kekuatan password',
        desc: 'Sistem menampilkan indikator kekuatan password secara langsung — gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol.',
      },
      {
        title: 'Edit atau nonaktifkan user',
        desc: 'Klik ikon edit untuk mengubah data atau mengganti password. Set status "Nonaktif" untuk menonaktifkan akun tanpa menghapusnya.',
      },
      {
        title: 'Hapus user',
        desc: 'Gunakan tombol hapus bila akun tidak diperlukan. Akun Anda sendiri dan akun Super Admin tidak dapat dihapus.',
      },
    ],
    filters: [
      { name: 'Pencarian', desc: 'Cari user berdasarkan nama atau username.' },
      { name: 'Paginasi', desc: 'Daftar user dibagi 10 per halaman dengan kontrol sebelumnya/selanjutnya.' },
    ],
    tips: [
      'Aktifkan akun kasir sesuai shift kerja; nonaktifkan bila staf keluar agar tidak ada akses yang tidak digunakan.',
      'Akun Super Admin hanya terlihat dan dikelola oleh Super Admin — keamanan tertinggi aplikasi.',
    ],
    warnings: [
      'Hak akses menentukan menu yang bisa dibuka. Kasir tidak dapat membuka menu Pengguna dan Pengaturan Apotek.',
    ],
  },
  {
    id: 'settings',
    title: 'Pengaturan Apotek',
    shortTitle: 'Pengaturan',
    group: 'Sistem',
    icon: Settings,
    adminOnly: true,
    intro:
      'Atur identitas resmi apotek, format struk kasir, nilai bawaan (stok minimum, markup resep, jasa racikan), dan printer thermal. Menu ini khusus untuk Admin.',
    steps: [
      {
        title: 'Isi Profil & Legalitas Apotek',
        desc: 'Nama resmi apotek, nomor telepon/hotline, alamat lengkap, Apoteker Penanggung Jawab (APA), No. SIA, dan No. SIPA. Data ini tercetak pada struk dan dokumen laporan.',
      },
      {
        title: 'Atur teks struk',
        desc: 'Isi header (salam pembuka) dan footer (pesan penutup) yang ingin dicetak pada struk kasir.',
      },
      {
        title: 'Atur nilai bawaan',
        desc: 'Batas minimum stok bawaan (untuk notifikasi stok menipis), markup resep bawaan (%), dan biaya jasa racikan (Rp) yang dipakai di transaksi resep.',
      },
      {
        title: 'Atur printer thermal',
        desc: 'Pilih lebar kertas 58mm atau 80mm, pilih printer dari daftar (atau biarkan printer bawaan sistem), dan aktifkan "Cetak struk otomatis" bila diinginkan. Gunakan tombol "Test Printer" untuk memastikan printer berfungsi.',
      },
      {
        title: 'Simpan pengaturan',
        desc: 'Klik "Simpan Seluruh Pengaturan". Perubahan langsung berlaku untuk transaksi dan struk berikutnya.',
      },
    ],
    filters: [
      { name: 'Daftar printer', desc: 'Tombol muat ulang (⟳) untuk menyegarkan daftar printer yang terpasang di komputer.' },
    ],
    formulas: [
      {
        title: 'Markup Resep Bawaan',
        when: 'Saat mengatur nilai bawaan transaksi resep',
        formula: 'Total Resep = Subtotal + bulatkan(Subtotal × Markup% / 100) + Biaya Racikan',
        example: 'Subtotal Rp 100.000, markup 20%, racikan Rp 5.000 → total Rp 125.000.',
      },
      {
        title: 'Nilai bawaan yang dipakai kasir',
        when: 'Saat transaksi resep di kasir',
        formula: 'Kasir memakai nilai bawaan ini kecuali "Ubah Markup & Biaya Racikan Khusus Transaksi Ini" dicentang di halaman Penjualan.',
      },
    ],
    tips: [
      'Fitur printer thermal (cetak otomatis, uji cetak, pilihan kertas) hanya tersedia di aplikasi komputer. Jika membuka aplikasi lewat browser, struk dicetak lewat perintah Cetak.',
      'Header/footer struk akan muncul di bagian atas/bawah setiap struk kasir — buat singkat dan informatif.',
    ],
  },
  {
    id: 'faq',
    title: 'Tips Umum & Pertanyaan Sering Diajukan',
    shortTitle: 'Tips & FAQ',
    group: 'Lainnya',
    icon: BookOpen,
    intro:
      'Kumpulan tips dan jawaban atas pertanyaan umum penggunaan aplikasi.',
    steps: [
      {
        title: 'Alur kerja harian yang disarankan',
        desc: '1) Login dengan akun kasir Anda → 2) Buka Dashboard untuk cek stok menipis/expired → 3) Layani penjualan di Kasir (POS) → 4) Pastikan struk tercetak → 5) Di akhir hari, cek Riwayat Penjualan dan catat Arus Kas operasional di Finansial.',
      },
      {
        title: 'Ganti password / profil sendiri',
        desc: 'Klik nama Anda di pojok kanan atas (header) → "Edit Profil" untuk mengubah nama, nomor WA, atau password akun Anda sendiri.',
      },
      {
        title: 'Menu berlabel "Admin"',
        desc: 'Menu Pengguna dan Pengaturan Apotek hanya bisa dibuka oleh akun berperan Admin. Staff kasir yang mencoba membukanya akan mendapat peringatan akses dibatasi.',
      },
      {
        title: 'Dimana data disimpan?',
        desc: 'Seluruh data (obat, transaksi, pengguna, pengaturan) tersimpan aman di dalam aplikasi ini. Buat salinan cadangan (backup) berkala untuk keamanan data.',
      },
      {
        title: 'Data sampel awal',
        desc: 'Saat pertama kali dipakai dan belum ada data, aplikasi otomatis mengisi data sampel awal (pengguna, obat, dan pengaturan bawaan) agar langsung bisa dicoba.',
      },
      {
        title: 'Struk tidak muncul / tidak mencetak',
        desc: 'Di komputer: pastikan printer thermal terpasang, pilih lebar kertas yang benar, dan uji dengan "Test Printer" di Pengaturan. Di browser: gunakan perintah Cetak (Ctrl+P).',
      },
      {
        title: 'Memahami istilah PPN',
        desc: 'DPP = Dasar Pengenaan Pajak (nilai bersih sebelum PPN). PPN 11% dihitung dari DPP. Harga "termasuk PPN" berarti nilai yang tampil sudah berisi PPN; "eksklusif" berarti PPN ditambahkan di atasnya.',
      },
      {
        title: 'Apa arti BHP dan satuan Lusin?',
        desc: 'BHP (Bahan Habis Pakai) = biaya tambahan per unit di luar harga beli, contohnya kertas obat, kantong plastik, atau wadah racikan. Satuan Lusin dihitung sebagai 12 pcs (contoh: 1 lusin tablet = 12 tablet) pada stok dan harga jual.',
      },
    ],
  },
];

const TutorialView: React.FC = () => {
  const { currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(sections[0].id);
  const [showTop, setShowTop] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const [navPos, setNavPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isWide, setIsWide] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  // Padding konten <main> sesuai breakpoint (p-4 / sm:p-6 / lg:p-8)
  const getPad = () => (window.innerWidth >= 1024 ? 32 : window.innerWidth >= 640 ? 24 : 16);

  // Menu dikunci (fixed) hanya jika posisi alaminya sudah mulai keluar dari layar,
  // lalu kembali ke alur normal saat scroll balik ke atas.
  const computeIsFixed = () => {
    if (window.innerWidth < 768) return false;
    const container = document.querySelector('main');
    if (!container || !columnRef.current) return false;
    const mr = container.getBoundingClientRect();
    const colTop = columnRef.current.getBoundingClientRect().top;
    return colTop <= mr.top + getPad() + 0.5;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.shortTitle.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      s.intro.toLowerCase().includes(q) ||
      s.steps.some(step => (step.title + ' ' + step.desc).toLowerCase().includes(q)) ||
      (s.filters || []).some(f => (f.name + ' ' + f.desc).toLowerCase().includes(q)) ||
      (s.formulas || []).some(f => (f.title + ' ' + f.formula + ' ' + (f.example || '')).toLowerCase().includes(q))
    );
  }, [search]);

  // Track which section is in view — memantau kontainer gulir yang sebenarnya:
  // <main> bila ia yang menggulir, atau window bila halaman yang menggulir.
  useEffect(() => {
    const container = document.querySelector('main');

    // Pilih kontainer gulir yang benar-benar menggulir (bukan menebak)
    const getScroller = (): Element =>
      container && container.scrollHeight > container.clientHeight + 1
        ? container
        : document.scrollingElement || document.documentElement;

    const onScroll = () => {
      const scroller = getScroller();
      const scrollTop = scroller.scrollTop || 0;
      const containerTop = container ? container.getBoundingClientRect().top : 0;
      const offsetLine = 16; // garis pantau dekat tepi atas area konten

      // Posisi bagian dihitung langsung dari koordinat layar (valid di kedua
      // jenis kontainer gulir) — bagian dengan judul di atas garis pantau menang.
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(`tutorial-${s.id}`);
        if (el && el.getBoundingClientRect().top - containerTop <= offsetLine) {
          current = s.id;
        }
      }

      // Tandai bagian terakhir hanya bila kontainer gulir yang sebenarnya
      // benar-benar berada di dasar halaman.
      const atBottom =
        scroller.scrollHeight - scrollTop - scroller.clientHeight < 4;
      if (atBottom) current = sections[sections.length - 1].id;

      setActiveId(prev => (prev === current ? prev : current));
      setShowTop(scrollTop > 600);
      setIsFixed(computeIsFixed());
    };

    container?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      container?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Jaga agar item aktif selalu terlihat di dalam menu indeks (sidebar kecil)
  useEffect(() => {
    const activeBtn = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    activeBtn?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  // Saat mencari, lompat ke bagian pertama yang cocok bila bagian aktif tidak ikut terfilter
  useEffect(() => {
    if (!search.trim() || filtered.length === 0) return;
    const first = filtered[0];
    if (first && first.id !== activeId) {
      setActiveId(first.id);
      const el = document.getElementById(`tutorial-${first.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Ukur posisi kolom indeks untuk menempatkan menu sebagai position: fixed.
  // Posisi dihitung dari kotak <main> yang tidak bergeser saat konten digulir,
  // sehingga menu tetap terlihat sampai bagian terbawah halaman.
  useLayoutEffect(() => {
    const measure = () => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return;
      const mr = mainEl.getBoundingClientRect();
      const pad = getPad();
      const colEl = columnRef.current;
      const width = colEl ? colEl.getBoundingClientRect().width : 0;
      setIsWide(window.innerWidth >= 768);
      setNavPos({ top: mr.top + pad, left: mr.left + pad, width });
      setIsFixed(computeIsFixed());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`tutorial-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  const scrollToTop = () => {
    const container = document.querySelector('main');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl">
                <BookOpen className="w-6 h-6 text-emerald-300" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Panduan Penggunaan Aplikasi</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tutorial lengkap untuk Apoteker & Staf Apotek Az Zainiyah — mulai dari login, dashboard,
              master data, kasir, laporan, hingga pengaturan apotek.
            </p>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs shrink-0">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              {sections.length} Bagian Tutorial
            </div>
            <div className="text-slate-300 mt-0.5">Dashboard → Pengaturan</div>
          </div>
        </div>
      </div>

      {/* Quick Start Strip */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 text-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 self-start">
          <ZapIcon />
        </div>
        <div>
          <p className="font-extrabold text-emerald-900">Alur Kerja Harian Singkat</p>
          <p className="text-emerald-800 mt-1 leading-relaxed">
            Login → Cek peringatan stok di <strong>Dashboard</strong> → Layani pasien di{' '}
            <strong>Penjualan (Kasir)</strong> → Cetak struk → Di akhir shift, tutup buku di{' '}
            <strong>Riwayat Penjualan</strong> & catat <strong>Arus Kas</strong>.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari tutorial: filter, PPN, DPP, margin, markup resep, kembalian..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 shadow-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Index / Navigation — baru jadi fixed setelah scroll melewati posisi alaminya */}
        <div ref={columnRef} className="md:col-span-3 xl:col-span-2">
          <nav
            ref={navRef}
            style={navPos && isWide && isFixed ? { position: 'fixed', top: navPos.top, left: navPos.left, width: navPos.width } : undefined}
            className="bg-white rounded-2xl border border-slate-100 shadow-lg p-3 space-y-1 z-10 max-h-[calc(100vh-7rem)] overflow-y-auto"
          >
            {filtered.map(s => {
              const Icon = s.icon;
              const isActive = activeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate flex-1">{s.shortTitle}</span>
                  {s.adminOnly && (
                    <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded font-extrabold shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      Admin
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada tutorial yang cocok dengan "{search}".
              </div>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-9 xl:col-span-10 space-y-6">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 text-center space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">Hasil tidak ditemukan</p>
              <p className="text-xs text-slate-400">Coba kata kunci lain, misalnya "filter", "PPN", "margin", atau "printer".</p>
            </div>
          )}

          {filtered.map((s, idx) => {
            const Icon = s.icon;
            const isAdminOnly = s.adminOnly && !isAdmin;
            return (
              <section
                key={s.id}
                id={`tutorial-${s.id}`}
                className={`bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-24 ${isAdminOnly ? 'opacity-90' : ''}`}
              >
                {/* Section Header */}
                <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl shrink-0">
                    <Icon className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-white text-base">{s.title}</h3>
                      {s.adminOnly && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wide">
                          Khusus Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menu: {s.group} · Bagian {idx + 1} dari {sections.length}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  {/* Intro */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{s.intro}</p>

                  {/* Steps */}
                  <ol className="space-y-4">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[11px] flex items-center justify-center border border-emerald-200">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">{step.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  {/* Filters */}
                  {s.filters && s.filters.length > 0 && (
                    <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2.5">
                      <p className="font-extrabold text-sky-800 text-xs flex items-center gap-1.5">
                        <Filter className="w-4 h-4" /> Filter & Pencarian
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {s.filters.map((f, i) => (
                          <div key={i} className="p-3 rounded-xl bg-white/70 border border-sky-100">
                            <p className="font-bold text-slate-900 text-[11px]">{f.name}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{f.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formulas */}
                  {s.formulas && s.formulas.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-900 space-y-2.5">
                      <p className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5">
                        <Sigma className="w-4 h-4" /> Rumus & Perhitungan
                      </p>
                      <div className="space-y-2.5">
                        {s.formulas.map((f, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-white text-[11px] flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                {f.title}
                              </p>
                              {f.when && (
                                <span className="text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  {f.when}
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-indigo-200 mt-1.5 leading-relaxed">{f.formula}</p>
                            {f.example && (
                              <p className="text-[11px] text-emerald-300 mt-1.5 leading-relaxed">
                                Contoh: {f.example}
                              </p>
                            )}
                            {f.note && (
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                Catatan: {f.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tips */}
                  {s.tips && s.tips.length > 0 && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                      <p className="font-extrabold text-emerald-800 text-xs flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4" /> Tips
                      </p>
                      <ul className="space-y-1.5">
                        {s.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-emerald-900 leading-relaxed flex gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {s.warnings && s.warnings.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                      <p className="font-extrabold text-amber-800 text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Perhatian
                      </p>
                      <ul className="space-y-1.5">
                        {s.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-900 leading-relaxed flex gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Admin-only note for non-admin viewers */}
                  {isAdminOnly && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Menu ini khusus Admin. Akun kasir tidak dapat membuka halaman ini di aplikasi —
                        panduan tetap ditampilkan untuk pengetahuan umum.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {/* Footer note */}
          <div className="bg-slate-900 rounded-3xl p-5 text-center text-slate-300 text-xs space-y-1.5 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-300">
              <Printer className="w-4 h-4" />
              Siap melayani!
            </div>
            <p className="text-slate-400 leading-relaxed max-w-xl mx-auto">
              Butuh bantuan lebih lanjut? Hubungi Administrator Utama Apotek Az Zainiyah
              untuk reset password, pembuatan akun, atau pertanyaan seputar pengaturan sistem.
            </p>
          </div>
        </div>
      </div>

      {/* Scroll to top */}
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-2xl bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
          title="Kembali ke atas"
        >
          <ChevronUp className="w-4 h-4" />
          Atas
        </button>
      )}
    </div>
  );
};

const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export default TutorialView;
