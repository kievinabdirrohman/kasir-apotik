import {
  Medicine,
  Customer,
  Doctor,
  User,
  Transaction,
  StockHistory,
  PharmacySettings,
} from '../types';

export const initialSettings: PharmacySettings = {
  name: 'Apotek Az Zainiyah',
  address: 'Jl. Air Mata Ebhu, Desa Tambegan, Kecamatan Arosbaya',
  phone: '081333493489',
  siaNumber: '',
  sipaNumber: '',
  apotekerName: '',
  receiptHeader: '',
  receiptFooter: '',
  defaultMinStock: 10,
  autoPrintReceipt: true,
  defaultPrescriptionMarkup: 20,
  defaultRacikanFee: 0,
  initialCapital: 100000000,
  defaultPpnRate: 11,
  defaultTaxType: 'PPN',
  defaultPpnIncluded: true,
  printerName: '',
  paperWidth: '58mm',
};

export const initialUsers: User[] = [
  {
    id: 'usr-superadmin',
    name: 'Ahmad Faisal (Admin Utama)',
    username: 'superadmin',
    password: 'SuperAdmin#2026!',
    role: 'admin',
    isSuperAdmin: true,
    status: 'aktif',
    phone: '081211112222',
    createdAt: '2026-01-01',
  },
  {
    id: 'usr-1',
    name: 'Rina Kusuma (Admin Operasional)',
    username: 'admin1',
    password: 'Admin#2026!',
    role: 'admin',
    isSuperAdmin: false,
    status: 'aktif',
    phone: '081299998888',
    createdAt: '2026-01-10',
  },
  {
    id: 'usr-2',
    name: 'Siti Sarah (Kasir Utama)',
    username: 'kasir1',
    password: 'Kasir#2026!',
    role: 'kasir',
    isSuperAdmin: false,
    status: 'aktif',
    phone: '081333334444',
    createdAt: '2026-02-15',
  },
  {
    id: 'usr-3',
    name: 'Budi Santoso (Kasir Shift 2)',
    username: 'kasir2',
    password: 'Kasir#2026!',
    role: 'kasir',
    isSuperAdmin: false,
    status: 'aktif',
    phone: '081555556666',
    createdAt: '2026-03-01',
  },
];

export const initialMedicines: Medicine[] = [];

export const initialCustomers: Customer[] = [];

export const initialDoctors: Doctor[] = [];

export const initialStockHistory: StockHistory[] = [];

export const initialTransactions: Transaction[] = [];
