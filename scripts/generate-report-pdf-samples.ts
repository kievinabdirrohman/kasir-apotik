import fs from 'node:fs/promises';
import path from 'node:path';
import pdfMake from 'pdfmake';
import { buildAuditExportModel, buildAuditPdfDefinition, createDefaultAuditFilterState } from '../src/utils/reportExport.js';
import { initialSettings } from '../src/data/initialData.js';
import type { CashFlow, Customer, Doctor, Medicine, StockHistory, Transaction, TransactionItem, User } from '../src/types.js';

const root = process.cwd();
const outputDir = path.join(root, 'output', 'pdf');
const fontDir = path.join(root, 'node_modules', 'pdfmake', 'fonts', 'Roboto');

pdfMake.addFonts({
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
});
pdfMake.setLocalAccessPolicy(filePath => filePath.startsWith(root));
pdfMake.setUrlAccessPolicy(() => false);

const medicine: Medicine = {
  id: 'sample-medicine', code: 'AUD-001', name: 'Obat Audit', category: 'Obat Bebas', price: 5000, purchasePrice: 400,
  stock: 120, minStock: 10, unit: 'Pcs', unitMultiplier: 1, expiredDate: '2027-01-01', noBatch: 'BATCH-AUDIT', isActive: true, location: 'Rak A1',
  units: [
    { id: 'sample-pcs', medicineId: 'sample-medicine', unit: 'Pcs', multiplierToBase: 1, sortOrder: 0, isPrimary: true, purchasePricePerBase: 400 },
    { id: 'sample-box', medicineId: 'sample-medicine', unit: 'Box', multiplierToBase: 10, sortOrder: 1, purchasePricePerBase: 400 },
  ],
};
const item: TransactionItem = {
  medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, unit: 'Box', unitId: 'sample-box', price: 8800, qty: 1,
  subtotal: 8800, isPpn: true, ppnRate: 11, itemType: 'obat', unitMultiplier: 10, purchasePrice: 400, noBatch: medicine.noBatch,
  customerId: 'sample-customer', customerName: 'Customer Audit', priceSource: 'customer', pricingMode: 'custom', customPriceId: 'sample-custom', customQuantity: 2,
  customUnit: 'Box', customTotalPrice: 8800, marginPct: 10, bhpAmount: 0, profitAmount: 800,
};
const transactionTemplate: Transaction = {
  id: 'sample-transaction', trxNo: 'TRX-20260828-001', date: '2026-08-28 10:00:00', customerId: 'sample-customer', customerName: 'Customer Audit', customerMemberNo: 'MBR-AUDIT',
  doctorId: 'sample-doctor', doctorName: 'Dr. Audit', cashierName: 'Auditor', cashierUsername: 'auditor', items: [item], totalAmount: 8800, paymentMethod: 'Tunai', paymentAmount: 10000,
  changeAmount: 1200, status: 'Selesai', isPrescription: true, taxType: 'PPN', ppnRate: 11, dppAmount: 7928, ppnAmount: 872,
};
const transactions = Array.from({ length: 35 }, (_, index) => ({ ...transactionTemplate, id: `sample-transaction-${index + 1}`, trxNo: `TRX-20260828-${String(index + 1).padStart(3, '0')}` }));
const stockHistory: StockHistory[] = [{ id: 'stock-audit', medicineId: medicine.id, medicineCode: medicine.code, medicineName: medicine.name, type: 'masuk', amount: 120, prevStock: 0, newStock: 120, date: '2026-08-28 09:00:00', note: 'Stok awal audit', user: 'Auditor', taxType: 'PPN', purchasePrice: 400, sellingPrice: 5000, bhpAmount: 0, noBatch: medicine.noBatch, inputUnitId: 'sample-box', inputUnit: 'Box', inputQty: 12, inputMultiplier: 10 }];
const cashFlows: CashFlow[] = [{ id: 'cash-audit', date: '2026-08-28 12:00:00', type: 'Pengeluaran', category: 'Operasional', amount: 150000, note: 'Contoh biaya audit', recordedBy: 'Auditor' }];
const customer: Customer = { id: 'sample-customer', memberNo: 'MBR-AUDIT', name: 'Customer Audit', phone: '08123456789', status: 'Aktif', totalSpent: 8800, totalTransactions: 1, createdAt: '2026-01-01' };
const doctor: Doctor = { id: 'sample-doctor', name: 'Dr. Audit', phone: '08123456780', status: 'Aktif', totalPrescriptions: 1, createdAt: '2026-01-01' };
const user = { name: 'Auditor', username: 'auditor', role: 'admin' } as Pick<User, 'name' | 'username' | 'role'>;
const filters = createDefaultAuditFilterState('2026-08-28');
filters.finances.reportPeriod = 'semua';

const input = {
  settings: initialSettings,
  currentUser: user,
  transactions,
  customers: [customer],
  doctors: [doctor],
  medicines: [medicine],
  stockHistory,
  cashFlows,
  filters,
  auditBookDateRange: { preset: 'custom' as const, startDate: '2026-08-01', endDate: '2026-08-28' },
  generatedAt: new Date('2026-08-28T03:00:00.000Z'),
};
const logoPath = path.join(root, 'src', 'assets', 'logo.png');
const logoDataUrl = `data:image/png;base64,${(await fs.readFile(logoPath)).toString('base64')}`;

await fs.mkdir(outputDir, { recursive: true });
for (const [scope, reportTab, financeTab, fileName] of [
  ['reports', 'penjualan', undefined, 'Sample-Laporan-Penjualan-2026-08-28.pdf'],
  ['finances', undefined, 'laporan', 'Sample-Laporan-Laba-Rugi-2026-08-28.pdf'],
  ['transactions', undefined, undefined, 'Sample-Riwayat-Penjualan-2026-08-28.pdf'],
  ['audit-book', undefined, undefined, 'Sample-Buku-Audit-Apotek-2026-08-28.pdf'],
] as const) {
  const model = buildAuditExportModel({ ...input, scope, reportTab, financeTab });
  model.logoDataUrl = logoDataUrl;
  await pdfMake.createPdf(buildAuditPdfDefinition(model)).write(path.join(outputDir, fileName));
}

console.log(`Generated sample PDFs in ${outputDir}`);
