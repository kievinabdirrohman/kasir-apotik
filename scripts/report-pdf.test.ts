import assert from 'node:assert/strict';
import type { CashFlow, Customer, Doctor, Medicine, PharmacySettings, StockHistory, Transaction, TransactionItem, User } from '../src/types.js';
import {
  applyAuditBookDateRange,
  buildAuditExportModel,
  buildAuditPdfDefinition,
  createDefaultAuditBookDateRange,
  createDefaultAuditFilterState,
  isValidAuditBookDateRange,
  loadAuditFilterState,
  resolveAuditBookDateRange,
  sanitizeAuditFileName,
  updateAuditFilterState,
} from '../src/utils/reportExport.js';

const settings = {
  name: 'Apotek Audit',
  address: 'Jl. Audit No. 1',
  phone: '021-123456',
  receiptHeader: '',
  receiptFooter: '',
  defaultMinStock: 5,
  autoPrintReceipt: false,
  siaNumber: 'SIA-001',
  sipaNumber: 'SIPA-001',
  apotekerName: 'Apoteker Audit',
  initialCapital: 50000000,
} as PharmacySettings;

const user = { name: 'Auditor', username: 'auditor', role: 'admin' } as Pick<User, 'name' | 'username' | 'role'>;
const customer = { id: 'cust-1', memberNo: 'MBR-001', name: 'Customer Snapshot', phone: '08123', status: 'Aktif', totalSpent: 0, totalTransactions: 0, createdAt: '2026-01-01' } as Customer;
const doctor = { id: 'doctor-1', name: 'Dr. Audit', phone: '08124', status: 'Aktif', totalPrescriptions: 0, createdAt: '2026-01-01' } as Doctor;
const medicine = {
  id: 'med-1',
  code: 'MED-001',
  name: 'Obat Audit',
  category: 'Obat Bebas',
  price: 5000,
  purchasePrice: 400,
  stock: 100,
  minStock: 5,
  unit: 'Pcs',
  unitMultiplier: 1,
  units: [
    { id: 'unit-pcs', medicineId: 'med-1', unit: 'Pcs', multiplierToBase: 1, sortOrder: 0, isPrimary: true, purchasePricePerBase: 400 },
    { id: 'unit-box', medicineId: 'med-1', unit: 'Box', multiplierToBase: 10, sortOrder: 1, purchasePricePerBase: 400 },
  ],
  expiredDate: '2027-01-01',
  noBatch: 'BATCH-001',
  isActive: true,
  location: 'Rak A1',
} as Medicine;

const customItem: TransactionItem = {
  medicineId: 'med-1',
  medicineCode: 'MED-001',
  medicineName: 'Obat Audit',
  unit: 'Box',
  unitId: 'unit-box',
  price: 8800,
  qty: 1,
  subtotal: 8800,
  isPpn: true,
  ppnRate: 11,
  itemType: 'obat',
  unitMultiplier: 10,
  purchasePrice: 400,
  noBatch: 'BATCH-001',
  customerId: 'cust-1',
  customerName: 'Customer Snapshot',
  priceSource: 'customer',
  pricingMode: 'custom',
  customPriceId: 'custom-box-2',
  customQuantity: 2,
  customUnit: 'Box',
  customTotalPrice: 8800,
  marginPct: 10,
  bhpAmount: 0,
  profitAmount: 800,
};

const baseTransaction: Transaction = {
  id: 'trx-1',
  trxNo: 'TRX-20260828-001',
  date: '2026-08-28 10:00:00',
  customerId: customer.id,
  customerName: customer.name,
  customerMemberNo: customer.memberNo,
  doctorId: doctor.id,
  doctorName: doctor.name,
  cashierName: user.name,
  cashierUsername: user.username,
  items: [customItem],
  totalAmount: 8800,
  paymentMethod: 'Tunai',
  paymentAmount: 10000,
  changeAmount: 1200,
  status: 'Selesai',
  isPrescription: true,
  taxType: 'PPN',
  ppnRate: 11,
  dppAmount: 7928,
  ppnAmount: 872,
};

const transactions = Array.from({ length: 21 }, (_, index) => ({
  ...baseTransaction,
  id: `trx-${index + 1}`,
  trxNo: `TRX-20260828-${String(index + 1).padStart(3, '0')}`,
}));
const stockHistory: StockHistory[] = [];
const cashFlows: CashFlow[] = [];
const filters = createDefaultAuditFilterState('2026-08-28');

const input = {
  settings,
  currentUser: user,
  transactions,
  customers: [customer],
  doctors: [doctor],
  medicines: [medicine],
  stockHistory,
  cashFlows,
  filters,
  generatedAt: new Date('2026-08-28T03:00:00.000Z'),
};

const today = '2026-08-28';
assert.deepEqual(createDefaultAuditBookDateRange(today), { preset: '1_day', startDate: today, endDate: today });
assert.deepEqual(resolveAuditBookDateRange('yesterday', today), { preset: 'yesterday', startDate: '2026-08-27', endDate: '2026-08-27' });
assert.deepEqual(resolveAuditBookDateRange('7_days', today), { preset: '7_days', startDate: '2026-08-22', endDate: today });
assert.deepEqual(resolveAuditBookDateRange('30_days', today), { preset: '30_days', startDate: '2026-07-30', endDate: today });
assert.deepEqual(resolveAuditBookDateRange('this_month', today), { preset: 'this_month', startDate: '2026-08-01', endDate: today });
assert.equal(isValidAuditBookDateRange({ preset: 'custom', startDate: '2026-02-30', endDate: today }), false);
assert.equal(isValidAuditBookDateRange({ preset: 'custom', startDate: '2026-08-29', endDate: today }), false);
const appliedRange = applyAuditBookDateRange(filters, { preset: 'custom', startDate: '2026-08-01', endDate: today });
assert.deepEqual([appliedRange.reports.startDate, appliedRange.reports.endDate], ['2026-08-01', today]);
assert.deepEqual([appliedRange.finances.customStartDate, appliedRange.finances.customEndDate], ['2026-08-01', today]);
assert.deepEqual([appliedRange.transactions.startDate, appliedRange.transactions.endDate], ['2026-08-01', today]);
assert.equal(appliedRange.reports.methodFilter, filters.reports.methodFilter);

const reportTabs = ['penjualan', 'customer', 'dokter', 'stok', 'expired', 'pajak_ppn', 'produk_obat', 'produk_non_obat'] as const;
const expectedTitles = ['Laporan Penjualan', 'Laporan Customer', 'Laporan Dokter', 'Laporan Stok', 'Laporan Expired dan Pre-Expired', 'Laporan Pajak PPN dan Non-PPN', 'Laporan Produk Obat', 'Laporan Produk Non-Obat'];
reportTabs.forEach((reportTab, index) => {
  const model = buildAuditExportModel({ ...input, scope: 'reports', reportTab });
  assert.equal(model.sections[0].title, expectedTitles[index]);
});

const salesModel = buildAuditExportModel({ ...input, scope: 'reports', reportTab: 'penjualan' });
assert.equal(salesModel.sections[0].tables[0].rows.length, 21);
const salesText = JSON.stringify(salesModel);
assert.match(salesText, /Customer Snapshot/);
assert.match(salesText, /Harga Customer - 2 Box - Stok dasar: 20 Pcs/);
assert.equal(salesText.includes('Multiple'), false);

const financeTabs = ['neraca', 'laporan', 'aruskas'] as const;
const financeTitles = ['Neraca Keuangan', 'Laporan Laba \/ Rugi', 'Log Arus Kas'];
financeTabs.forEach((financeTab, index) => {
  const model = buildAuditExportModel({ ...input, scope: 'finances', financeTab });
  assert.equal(model.sections[0].title, financeTitles[index]);
});

const auditBook = buildAuditExportModel({ ...input, scope: 'audit-book' });
assert.deepEqual(auditBook.sections.map(section => section.title), [
  ...expectedTitles,
  ...financeTitles,
  'Riwayat Penjualan',
]);
assert.equal(JSON.stringify(buildAuditPdfDefinition(auditBook)).includes('Tidak ada data'), true);

const outsideRangeTransaction = { ...baseTransaction, id: 'trx-old', trxNo: 'TRX-20260820-001', date: '2026-08-20 10:00:00' };
const recentStockHistory: StockHistory = { id: 'stock-new', medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, type: 'masuk', amount: 10, prevStock: 90, newStock: 100, date: '2026-08-28 09:00:00', note: 'Dalam rentang', user: 'Auditor' };
const outsideStockHistory: StockHistory = { ...recentStockHistory, id: 'stock-old', date: '2026-08-20 09:00:00', note: 'Di luar rentang' };
const globalBook = buildAuditExportModel({
  ...input,
  scope: 'audit-book',
  transactions: [...transactions, outsideRangeTransaction],
  stockHistory: [recentStockHistory, outsideStockHistory],
  cashFlows: [{ id: 'old-cash', date: '2026-08-20 12:00:00', type: 'Pengeluaran', category: 'Operasional', amount: 1000, note: 'Di luar rentang', recordedBy: 'Auditor' }],
  auditBookDateRange: { preset: 'custom', startDate: today, endDate: today },
});
const globalSales = globalBook.sections.find(section => section.title === 'Laporan Penjualan');
const globalStock = globalBook.sections.find(section => section.title === 'Laporan Stok');
const globalCashFlow = globalBook.sections.find(section => section.title === 'Log Arus Kas');
assert.equal(globalSales?.tables[0].rows.length, 21);
assert.equal(globalStock?.tables[1].rows.length, 1);
assert.equal(globalCashFlow?.tables[0].rows.length, 0);
assert.equal(globalBook.periodLabel, '28 Agu 2026 - 28 Agu 2026');

const dynamicDefinition = buildAuditPdfDefinition(globalBook);
const dynamicContent = dynamicDefinition.content as any[];
assert.notEqual(dynamicDefinition.pageSize, 'A4');
assert.deepEqual(dynamicDefinition.pageMargins, [14.17, 14.17, 14.17, 14.17]);
assert.equal(dynamicContent[2].section !== undefined, true);
assert.deepEqual(dynamicContent[2].pageMargins, [14.17, 14.17, 14.17, 14.17]);
const stockSectionNode = dynamicContent.find(node => node.section?.stack?.[0]?.id === 'audit-laporan-stok');
assert.equal(stockSectionNode.pageSize.width > 842, true);
assert.equal(stockSectionNode.pageSize.height < stockSectionNode.pageSize.width, true);

const empty = buildAuditExportModel({
  ...input,
  scope: 'reports',
  reportTab: 'penjualan',
  transactions: [],
  customers: [],
  doctors: [],
  medicines: [],
});
assert.equal(empty.sections[0].tables[0].rows.length, 0);
assert.equal(JSON.stringify(buildAuditPdfDefinition(empty)).includes('Tidak ada data'), true);

assert.equal(sanitizeAuditFileName('Laporan:/Audit* 2026?.pdf'), 'Laporan-Audit-2026-.pdf');

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});
updateAuditFilterState({ transactions: { ...filters.transactions, searchTerm: 'TRX-20260828-001' } });
assert.equal(loadAuditFilterState().transactions.searchTerm, 'TRX-20260828-001');
const storedHistory = buildAuditExportModel({ ...input, scope: 'transactions', filters: loadAuditFilterState() });
assert.equal(storedHistory.sections[0].tables[0].rows.length, 1);
Reflect.deleteProperty(globalThis, 'sessionStorage');

console.log('Report PDF export builder test passed.');
