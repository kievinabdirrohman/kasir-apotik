export type UserRole = 'admin' | 'kasir';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  isSuperAdmin?: boolean;
  status: 'aktif' | 'nonaktif';
  phone?: string;
  createdAt: string;
}

export type MedicineCategory =
  | 'Obat Bebas'
  | 'Obat Bebas Terbatas'
  | 'Obat Keras'
  | 'Jamu & Herbal'
  | 'Alat Kesehatan'
  | 'Suplemen & Vitamin'
  | 'Barang Umum'
  | 'Perawatan & Kosmetik'
  | 'Makanan & Minuman'
  | 'Lainnya';

export interface MedicineUnit {
  id: string;
  medicineId: string;
  unit: string;
  multiplierToBase: number;
  sortOrder: number;
  /** Legacy field kept for old databases; new selling prices do not use it. */
  pricePerBase?: number;
  purchasePricePerBase?: number;
  isPrimary?: boolean;
  /** Total selling price for one package of this stock unit. */
  sellingPrice?: number;
  /** Markup percentage over HPP + BHP for this unit. */
  marginPct?: number;
  /** BHP per package of this stock unit. */
  bhpAmount?: number;
  customerPrices?: MedicineCustomPriceCustomer[];
}

export interface MedicineCustomPriceCustomer {
  id?: string;
  customPriceId?: string;
  customerId: string;
  price: number;
  marginPct?: number;
  /** BHP for this customer-specific package profile. */
  bhpAmount?: number;
  /** When true, price, margin, and BHP follow the parent profile live. */
  inheritParent?: boolean;
}

export interface MedicineCustomPrice {
  id?: string;
  medicineId?: string;
  unitId: string;
  unitName?: string;
  quantity: number;
  totalPrice: number;
  sortOrder: number;
  isActive?: boolean;
  customerPrices?: MedicineCustomPriceCustomer[];
  marginPct?: number;
  /** BHP per selected stock package before custom quantity is applied. */
  bhpAmount?: number;
}

export interface Medicine {
  id: string;
  code: string;
  name: string;
  category: MedicineCategory;
  price: number;
  purchasePrice?: number;
  stock: number;
  minStock: number;
  unit: string; // e.g. Strip, Tablet, Botol, Tube, Box, Pcs, Lusin
  unitMultiplier?: number; // Multiplier multiplier per unit (e.g. 12 for Lusin)
  units?: MedicineUnit[];
  customPrices?: MedicineCustomPrice[];
  /** Form/API transport for customer prices on the primary (normal) package. */
  normalCustomerPrices?: MedicineCustomPriceCustomer[];
  expiredDate: string; // YYYY-MM-DD
  noBatch?: string; // Nomor batch produksi (opsional)
  isActive: boolean;
  location?: string; // Rak 1A, Lemari Es, dll
  itemType?: 'obat' | 'non_obat'; // Tipe Item: Obat vs Non-Obat
  marginPct?: number; // Persentase Margin (%)
  bhpAmount?: number; // Bahan Habis Pakai / Biaya Ops Tambahan
  // PPN & Pricing Structure
  ppnRate?: number; // e.g. 11 for 11% PPN
  isPpnIncluded?: boolean; // true if price already includes PPN
  purchasePriceNonPpn?: number; // HPP Modal DPP (tanpa PPN)
  purchasePriceIncPpn?: number; // HPP Modal + PPN
  priceNonPpn?: number; // Harga Jual DPP (tanpa PPN)
  priceIncPpn?: number; // Harga Jual + PPN (termasuk PPN)
  updatedAt?: string;
}

export interface StockHistory {
  id: string;
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  type: 'masuk' | 'keluar' | 'penyesuaian';
  amount: number;
  prevStock: number;
  newStock: number;
  date: string;
  note: string;
  user: string;
  itemType?: 'obat' | 'non_obat';
  // Optional tax & pricing snapshot for stock movements
  taxType?: 'PPN' | 'NON_PPN';
  purchasePrice?: number;
  sellingPrice?: number;
  ppnAmount?: number;
  marginPct?: number;
  bhpAmount?: number;
  noBatch?: string; // Nomor batch (snapshot saat mutasi stok, opsional)
  inputUnitId?: string;
  inputUnit?: string;
  inputQty?: number;
  inputMultiplier?: number;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  memberNo: string; // MBR-001
  name: string;
  phone: string;
  address?: string;
  status: 'Aktif' | 'Nonaktif';
  totalSpent: number;
  totalTransactions: number;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  phone: string;
  status: 'Aktif' | 'Nonaktif';
  totalPrescriptions: number;
  createdAt: string;
}

export interface TransactionItem {
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  unit: string;
  unitId?: string;
  price: number;
  qty: number;
  subtotal: number;
  isPpn?: boolean;
  ppnRate?: number;
  itemType?: 'obat' | 'non_obat';
  unitMultiplier?: number; // Stock multiplier for the selected unit
  purchasePrice?: number; // HPP per base item snapshot
  noBatch?: string; // Nomor batch (snapshot saat transaksi, opsional)
  customerId?: string; // ID customer yang harganya dipakai
  customerName?: string; // Nama customer (snapshot)
  priceSource?: 'normal' | 'customer'; // Sumber harga saat checkout
  pricingMode?: 'normal' | 'custom' | 'legacy';
  customPriceId?: string;
  customQuantity?: number;
  customUnit?: string;
  customTotalPrice?: number;
  /** Markup profile selected at checkout. */
  marginPct?: number;
  /** BHP per selected package snapshot. */
  bhpAmount?: number;
  /** Actual line profit snapshot. */
  profitAmount?: number;
}

export interface Transaction {
  id: string;
  trxNo: string; // TRX-YYYYMMDD-001
  date: string; // ISO String or YYYY-MM-DD HH:mm:ss
  customerId?: string;
  customerName?: string;
  customerMemberNo?: string;
  doctorId?: string;
  doctorName?: string;
  prescriptionMarkupRate?: number;
  prescriptionMarkupAmount?: number;
  prescriptionRacikanFee?: number;
  costAmount?: number; // Total HPP / Modal
  obatTotalAmount?: number; // Omset Obat
  nonObatTotalAmount?: number; // Omset Non-Obat
  obatCostAmount?: number; // HPP Obat
  nonObatCostAmount?: number; // HPP Non-Obat
  cashierName: string;
  cashierUsername: string;
  items: TransactionItem[];
  totalAmount: number;
  paymentMethod: 'Tunai' | 'QRIS' | 'Transfer';
  paymentAmount: number;
  changeAmount: number;
  status: 'Selesai' | 'Dibatalkan';
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  isPrescription: boolean;
  prescriptionFormulaMode?: string;
  prescriptionFormulaNote?: string;
  prescriptionNote?: string;
  // PPN & Tax Handling
  taxType?: 'PPN' | 'NON_PPN';
  ppnRate?: number; // e.g. 11 (%)
  dppAmount?: number; // Dasar Pengenaan Pajak (Nilai Bersih tanpa PPN)
  ppnAmount?: number; // Nilai PPN Terutang
  isPpnIncluded?: boolean; // true = harga termasuk PPN, false = PPN ditambahkan di atas subtotal
}

export interface PharmacySettings {
  name: string;
  address: string;
  phone: string;
  receiptHeader: string;
  receiptFooter: string;
  defaultMinStock: number;
  autoPrintReceipt: boolean;
  siaNumber?: string; // Surat Izin Apotek
  sipaNumber?: string; // Surat Izin Praktik Apoteker
  apotekerName?: string;
  defaultPrescriptionMarkup?: number; // Markup untuk resep
  defaultRacikanFee?: number; // Biaya jasa racikan
  initialCapital?: number; // Modal Awal / Disetor
  // PPN Settings
  defaultPpnRate?: number; // Default 11%
  defaultTaxType?: 'PPN' | 'NON_PPN';
  defaultPpnIncluded?: boolean;
  // Printer thermal (desktop / Electron)
  printerName?: string; // Windows device name printer ('' = printer default sistem)
  paperWidth?: '58mm' | '80mm'; // Lebar kertas thermal
  marginTopMm?: number;
  marginRightMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  printerFontSize?: number;
  printerLineHeight?: number;
  printerLabelWidthPct?: number;
  printerColumnGapMm?: number;
  printerAmountAlignment?: 'left' | 'right';
}

export type CashFlowType = 'Pemasukan' | 'Pengeluaran';

export interface CashFlow {
  id: string;
  date: string;
  type: CashFlowType;
  category: string;
  amount: number;
  note: string;
  recordedBy: string;
}

export interface MedicineCustomerPrice {
  id: string;
  medicineId: string;
  customerId: string;
  unitId?: string;
  unitName?: string;
  price: number;
  marginPct?: number;
  bhpAmount?: number;
  /** When true, price, margin, and BHP follow the main normal profile live. */
  inheritParent?: boolean;
}

export type ActiveTab =
  | 'dashboard'
  | 'medicines'
  | 'customers'
  | 'doctors'
  | 'stock-in'
  | 'pos'
  | 'transactions'
  | 'reports'
  | 'report-pajak-ppn'
  | 'report-obat'
  | 'report-non-obat'
  | 'users'
  | 'settings'
  | 'finances'
  | 'tutorial';
