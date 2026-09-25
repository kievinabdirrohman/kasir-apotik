import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type {
  CashFlow,
  Customer,
  Doctor,
  Medicine,
  PharmacySettings,
  StockHistory,
  Transaction,
  TransactionItem,
  User,
} from '../types';
import {
  formatDate,
  formatDateTime,
  formatRupiah,
  formatTransactionCustomer,
  getDaysUntilExpired,
  getItemIsPpn,
  getWIBDateString,
  isPpnTransaction,
} from './formatters';
import {
  getPrimaryUnit,
  medicineBaseUnitName,
  transactionItemBaseQuantity,
  transactionItemCost,
  transactionItemDisplayLabel,
  transactionItemPackageLabel,
  transactionItemPriceTypeLabel,
  transactionItemSalePrice,
} from './unitConversion';

export type ReportTab =
  | 'penjualan'
  | 'customer'
  | 'dokter'
  | 'stok'
  | 'expired'
  | 'pajak_ppn'
  | 'produk_obat'
  | 'produk_non_obat';

export type FinanceTab = 'neraca' | 'laporan' | 'aruskas';

export type AuditDatePreset = '1_day' | 'yesterday' | '7_days' | '30_days' | 'this_month' | 'custom';

export interface AuditBookDateRange {
  preset: AuditDatePreset;
  startDate: string;
  endDate: string;
}

export interface ReportsFilterSnapshot {
  activeTab: ReportTab;
  salesPreset: string;
  startDate: string;
  endDate: string;
  methodFilter: string;
  prescriptionFilter: string;
  cashierFilter: string;
  doctorFilter: string;
  customerFilter: string;
  categoryFilter: string;
  taxReportFilter: string;
  searchPenjualan: string;
  searchCustomer: string;
  searchDokter: string;
  searchStok: string;
  searchExpired: string;
}

export interface FinanceFilterSnapshot {
  activeTab: FinanceTab;
  reportPeriod: string;
  customStartDate: string;
  customEndDate: string;
  cashFlowSearch: string;
  cashFlowTypeFilter: string;
  cashFlowDatePreset: string;
  cashFlowStartDate: string;
  cashFlowEndDate: string;
}

export interface TransactionsFilterSnapshot {
  datePreset: string;
  startDate: string;
  endDate: string;
  statusFilter: string;
  methodFilter: string;
  prescriptionFilter: string;
  cashierFilter: string;
  taxFilter: string;
  searchTerm: string;
}

export interface AuditFilterState {
  reports: ReportsFilterSnapshot;
  finances: FinanceFilterSnapshot;
  transactions: TransactionsFilterSnapshot;
}

export type AuditExportScope = 'reports' | 'finances' | 'transactions' | 'audit-book';

export interface AuditExportInput {
  scope: AuditExportScope;
  auditBookDateRange?: AuditBookDateRange;
  reportTab?: ReportTab;
  financeTab?: FinanceTab;
  settings: PharmacySettings;
  currentUser: Pick<User, 'name' | 'username' | 'role'>;
  transactions: Transaction[];
  customers: Customer[];
  doctors: Doctor[];
  medicines: Medicine[];
  stockHistory: StockHistory[];
  cashFlows: CashFlow[];
  filters: AuditFilterState;
  generatedAt?: Date;
}

export interface AuditExportTable {
  title: string;
  headers: string[];
  rows: string[][];
  widths?: Array<string | number>;
  compact?: boolean;
}

export interface AuditExportSection {
  id: string;
  title: string;
  description: string;
  summary: Array<[string, string]>;
  tables: AuditExportTable[];
}

export interface AuditExportModel {
  scope: AuditExportScope;
  title: string;
  subtitle: string;
  periodLabel: string;
  filterLabel: string;
  generatedAtLabel: string;
  fileName: string;
  pharmacy: PharmacySettings;
  currentUser: Pick<User, 'name' | 'username' | 'role'>;
  sections: AuditExportSection[];
  logoDataUrl?: string;
}

const FILTER_STORAGE_KEY = 'apotek.audit-report-filters.v1';

function firstDayOfMonth(today: string): string {
  return `${today.slice(0, 8)}01`;
}

export function createDefaultAuditFilterState(today = getWIBDateString()): AuditFilterState {
  return {
    reports: {
      activeTab: 'penjualan',
      salesPreset: '1_day',
      startDate: today,
      endDate: today,
      methodFilter: 'all',
      prescriptionFilter: 'all',
      cashierFilter: 'all',
      doctorFilter: 'all',
      customerFilter: 'all',
      categoryFilter: 'all',
      taxReportFilter: 'all',
      searchPenjualan: '',
      searchCustomer: '',
      searchDokter: '',
      searchStok: '',
      searchExpired: '',
    },
    finances: {
      activeTab: 'neraca',
      reportPeriod: 'bulan_ini',
      customStartDate: firstDayOfMonth(today),
      customEndDate: today,
      cashFlowSearch: '',
      cashFlowTypeFilter: 'Semua',
      cashFlowDatePreset: 'semua',
      cashFlowStartDate: today,
      cashFlowEndDate: today,
    },
    transactions: {
      datePreset: '1_day',
      startDate: today,
      endDate: today,
      statusFilter: 'all',
      methodFilter: 'all',
      prescriptionFilter: 'all',
      cashierFilter: 'all',
      taxFilter: 'all',
      searchTerm: '',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function loadAuditFilterState(): AuditFilterState {
  const defaults = createDefaultAuditFilterState();
  if (typeof sessionStorage === 'undefined') return defaults;

  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) || 'null');
    if (!isRecord(parsed)) return defaults;
    return {
      reports: { ...defaults.reports, ...(isRecord(parsed.reports) ? parsed.reports : {}) } as ReportsFilterSnapshot,
      finances: { ...defaults.finances, ...(isRecord(parsed.finances) ? parsed.finances : {}) } as FinanceFilterSnapshot,
      transactions: { ...defaults.transactions, ...(isRecord(parsed.transactions) ? parsed.transactions : {}) } as TransactionsFilterSnapshot,
    };
  } catch {
    return defaults;
  }
}

export function saveAuditFilterState(state: AuditFilterState): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or quota errors should not block report rendering/export.
  }
}

export function updateAuditFilterState(patch: Partial<AuditFilterState>): AuditFilterState {
  const current = loadAuditFilterState();
  const next: AuditFilterState = {
    reports: { ...current.reports, ...(patch.reports || {}) },
    finances: { ...current.finances, ...(patch.finances || {}) },
    transactions: { ...current.transactions, ...(patch.transactions || {}) },
  };
  saveAuditFilterState(next);
  return next;
}

export function applyAuditBookDateRange(filters: AuditFilterState, range: AuditBookDateRange): AuditFilterState {
  if (!isValidAuditBookDateRange(range)) return filters;
  return {
    reports: { ...filters.reports, salesPreset: 'custom', startDate: range.startDate, endDate: range.endDate },
    finances: {
      ...filters.finances,
      reportPeriod: 'kustom',
      customStartDate: range.startDate,
      customEndDate: range.endDate,
      cashFlowDatePreset: 'custom',
      cashFlowStartDate: range.startDate,
      cashFlowEndDate: range.endDate,
    },
    transactions: { ...filters.transactions, datePreset: 'custom', startDate: range.startDate, endDate: range.endDate },
  };
}

function cleanText(value: unknown, fallback = '-'): string {
  const text = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[·•]/g, ' - ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function lower(value: unknown): string {
  return cleanText(value, '').toLowerCase();
}

function money(value: unknown): string {
  return cleanText(formatRupiah(Number(value) || 0));
}

function dateLabel(value: string | undefined): string {
  return cleanText(formatDate(value || ''));
}

function dateTimeLabel(value: string | undefined): string {
  return cleanText(formatDateTime(value || ''));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => cleanText(value, '')).filter(Boolean)));
}

function inDateRange(value: string | undefined, start: string, end: string): boolean {
  const date = (value || '').slice(0, 10);
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function auditBookScoped<T extends { date?: string }>(rows: T[], input: AuditExportInput): T[] {
  const range = input.scope === 'audit-book' ? input.auditBookDateRange : undefined;
  return range && isValidAuditBookDateRange(range)
    ? rows.filter(row => inDateRange(row.date, range.startDate, range.endDate))
    : rows;
}

function completedTransactionsForScope(input: AuditExportInput): Transaction[] {
  return auditBookScoped(input.transactions, input).filter(transaction => transaction.status === 'Selesai');
}

function dateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return dateString(date);
}

export function createDefaultAuditBookDateRange(today = getWIBDateString()): AuditBookDateRange {
  return { preset: '1_day', startDate: today, endDate: today };
}

export function resolveAuditBookDateRange(
  preset: AuditDatePreset,
  today = getWIBDateString(),
  customStartDate = today,
  customEndDate = today,
): AuditBookDateRange {
  if (preset === 'custom') return { preset, startDate: customStartDate || today, endDate: customEndDate || today };
  if (preset === 'yesterday') {
    const yesterday = shiftDate(today, -1);
    return { preset, startDate: yesterday, endDate: yesterday };
  }
  if (preset === '7_days') return { preset, startDate: shiftDate(today, -6), endDate: today };
  if (preset === '30_days') return { preset, startDate: shiftDate(today, -29), endDate: today };
  if (preset === 'this_month') return { preset, startDate: firstDayOfMonth(today), endDate: today };
  return { preset: '1_day', startDate: today, endDate: today };
}

export function isValidAuditBookDateRange(range: AuditBookDateRange): boolean {
  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return isValidDate(range.startDate)
    && isValidDate(range.endDate)
    && range.startDate <= range.endDate;
}

function financePeriodRange(filter: FinanceFilterSnapshot): [string, string] | null {
  if (filter.reportPeriod === 'semua') return null;
  if (filter.reportPeriod === 'kustom') return [filter.customStartDate, filter.customEndDate];

  const today = new Date();
  const todayValue = dateString(today);
  if (filter.reportPeriod === 'hari_ini') return [todayValue, todayValue];
  if (filter.reportPeriod === 'kemarin') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const value = dateString(yesterday);
    return [value, value];
  }
  if (filter.reportPeriod === 'bulan_ini') return [dateString(new Date(today.getFullYear(), today.getMonth(), 1)), todayValue];
  if (filter.reportPeriod === 'bulan_lalu') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return [dateString(first), dateString(last)];
  }
  if (filter.reportPeriod === 'tahun_ini') return [`${today.getFullYear()}-01-01`, todayValue];
  return null;
}

function reportTransactions(transactions: Transaction[], filter: ReportsFilterSnapshot): Transaction[] {
  return transactions.filter(transaction => {
    if (transaction.status !== 'Selesai') return false;
    if (!inDateRange(transaction.date, filter.startDate, filter.endDate)) return false;
    if (filter.methodFilter !== 'all' && transaction.paymentMethod !== filter.methodFilter) return false;
    if (filter.prescriptionFilter === 'resep' && !transaction.isPrescription) return false;
    if (filter.prescriptionFilter === 'non-resep' && transaction.isPrescription) return false;
    if (filter.cashierFilter !== 'all' && lower(transaction.cashierName) !== lower(filter.cashierFilter)) return false;
    if (filter.doctorFilter !== 'all' && transaction.doctorName !== filter.doctorFilter) return false;
    if (filter.customerFilter === 'member' && !transaction.customerMemberNo) return false;
    if (filter.customerFilter === 'umum' && transaction.customerMemberNo) return false;
    if (filter.taxReportFilter !== 'all') {
      const ppn = isPpnTransaction(transaction);
      if (filter.taxReportFilter === 'PPN' && !ppn) return false;
      if (filter.taxReportFilter === 'NON_PPN' && ppn) return false;
    }
    const query = lower(filter.searchPenjualan);
    if (query) {
      const matches = [transaction.trxNo, transaction.customerName, transaction.doctorName, transaction.cashierName]
        .some(value => lower(value).includes(query));
      const itemMatches = transaction.items.some(item => lower(item.medicineName).includes(query) || lower(item.medicineCode).includes(query));
      if (!matches && !itemMatches) return false;
    }
    return true;
  });
}

function financeTransactions(transactions: Transaction[], filter: FinanceFilterSnapshot): Transaction[] {
  const range = financePeriodRange(filter);
  return transactions.filter(transaction => transaction.status === 'Selesai' && (!range || inDateRange(transaction.date, range[0], range[1])));
}

function financeCashFlows(cashFlows: CashFlow[], filter: FinanceFilterSnapshot): CashFlow[] {
  return cashFlows.filter(cashFlow => {
    if (filter.cashFlowTypeFilter !== 'Semua' && cashFlow.type !== filter.cashFlowTypeFilter) return false;
    const query = lower(filter.cashFlowSearch);
    if (query && !lower(cashFlow.note).includes(query) && !lower(cashFlow.category).includes(query)) return false;
    if (filter.cashFlowDatePreset !== 'semua' && !inDateRange(cashFlow.date, filter.cashFlowStartDate, filter.cashFlowEndDate)) return false;
    return true;
  });
}

function historyTransactions(transactions: Transaction[], filter: TransactionsFilterSnapshot): Transaction[] {
  return transactions.filter(transaction => {
    if (filter.statusFilter !== 'all' && transaction.status !== filter.statusFilter) return false;
    if (!inDateRange(transaction.date, filter.startDate, filter.endDate)) return false;
    if (filter.methodFilter !== 'all' && transaction.paymentMethod !== filter.methodFilter) return false;
    if (filter.prescriptionFilter === 'resep' && !transaction.isPrescription) return false;
    if (filter.prescriptionFilter === 'non-resep' && transaction.isPrescription) return false;
    if (filter.cashierFilter !== 'all' && lower(transaction.cashierName) !== lower(filter.cashierFilter)) return false;
    if (filter.taxFilter !== 'all') {
      const ppn = isPpnTransaction(transaction);
      if (filter.taxFilter === 'PPN' && !ppn) return false;
      if (filter.taxFilter === 'NON_PPN' && ppn) return false;
    }
    const query = lower(filter.searchTerm);
    if (!query) return true;
    return [transaction.trxNo, transaction.customerName, transaction.doctorName, transaction.cashierName]
      .some(value => lower(value).includes(query)) || transaction.items.some(item => lower(item.medicineName).includes(query) || lower(item.medicineCode).includes(query));
  });
}

function medicineForItem(item: TransactionItem, medicines: Medicine[]): Medicine | undefined {
  return medicines.find(medicine => medicine.id === item.medicineId || medicine.name === item.medicineName);
}

function itemMatchesType(item: TransactionItem, medicine: Medicine | undefined, itemType: 'obat' | 'non_obat'): boolean {
  return (item.itemType || medicine?.itemType || 'obat') === itemType;
}

function itemMatchesCategory(item: TransactionItem, medicine: Medicine | undefined, categoryFilter: string): boolean {
  return categoryFilter === 'all' || !medicine || medicine.category === categoryFilter;
}

function itemMatchesTax(item: TransactionItem, transaction: Transaction, medicine: Medicine | undefined, taxFilter: string): boolean {
  if (taxFilter === 'all') return true;
  const ppn = getItemIsPpn(item, transaction, medicine);
  return taxFilter === 'PPN' ? ppn : !ppn;
}

function itemPriceType(item: TransactionItem, medicines: Medicine[]): string {
  return cleanText(transactionItemPriceTypeLabel(item, medicineForItem(item, medicines)));
}

function itemPpnLabel(item: TransactionItem, transaction: Transaction, medicine?: Medicine): string {
  if (!getItemIsPpn(item, transaction, medicine)) return 'Non-PPN';
  const rate = item.ppnRate || transaction.ppnRate || 11;
  const dpp = Math.round(item.subtotal / (1 + rate / 100));
  return `PPN ${rate}%: ${money(item.subtotal - dpp)}`;
}

function itemRows(transactions: Transaction[], medicines: Medicine[], predicate?: (item: TransactionItem, medicine?: Medicine) => boolean): string[][] {
  return transactions.flatMap(transaction => transaction.items
    .map(item => ({ item, medicine: medicineForItem(item, medicines) }))
    .filter(({ item, medicine }) => !predicate || predicate(item, medicine))
    .map(({ item, medicine }) => {
      const cost = transactionItemCost(item, medicine);
      return [
        cleanText(transaction.trxNo),
        dateTimeLabel(transaction.date),
        formatTransactionCustomer(transaction),
        `${cleanText(item.medicineCode)} / ${cleanText(item.medicineName)}`,
        transactionItemDisplayLabel(item),
        `${transactionItemBaseQuantity(item)} ${medicineBaseUnitName(medicine)}`,
        itemPriceType(item, medicines),
        money(transactionItemSalePrice(item)),
        money(cost),
        money(item.subtotal - cost),
        itemPpnLabel(item, transaction, medicine),
        money(item.subtotal),
        cleanText(item.noBatch),
      ];
    }));
}

function transactionRows(transactions: Transaction[], medicines: Medicine[]): string[][] {
  return transactions.map(transaction => [
    cleanText(transaction.trxNo),
    dateTimeLabel(transaction.date),
    formatTransactionCustomer(transaction),
    unique(transaction.items.map(item => itemPriceType(item, medicines))).join(', '),
    cleanText(transaction.doctorName),
    cleanText(transaction.cashierName),
    `${cleanText(transaction.paymentMethod)} | Bayar ${money(transaction.paymentAmount)} | Kembali ${money(transaction.changeAmount)}`,
    isPpnTransaction(transaction) ? `PPN ${transaction.ppnRate || 11}%` : 'Non-PPN',
    money(transaction.totalAmount),
    cleanText(transaction.status),
  ]);
}

function productRows(transactions: Transaction[], medicines: Medicine[], itemType?: 'obat' | 'non_obat', categoryFilter = 'all'): string[][] {
  const groups = new Map<string, {
    code: string;
    name: string;
    packageLabel: string;
    displayLabel: string;
    baseQuantity: number;
    baseUnit: string;
    quantity: number;
    sales: number;
    hpp: number;
    customers: string[];
    priceTypes: string[];
  }>();

  transactions.forEach(transaction => transaction.items.forEach(item => {
    const medicine = medicineForItem(item, medicines);
    const currentType = item.itemType || medicine?.itemType || 'obat';
    if (itemType && currentType !== itemType) return;
    if (!itemMatchesCategory(item, medicine, categoryFilter)) return;
    const key = `${item.medicineId}|${transactionItemPackageLabel(item)}|${transactionItemSalePrice(item)}`;
    const current = groups.get(key) || {
      code: item.medicineCode,
      name: item.medicineName,
      packageLabel: transactionItemPackageLabel(item),
      displayLabel: transactionItemDisplayLabel(item),
      baseQuantity: 0,
      baseUnit: medicineBaseUnitName(medicine),
      quantity: 0,
      sales: 0,
      hpp: 0,
      customers: [],
      priceTypes: [],
    };
    current.quantity += item.qty;
    current.displayLabel = transactionItemDisplayLabel({ ...item, qty: current.quantity });
    current.baseQuantity += transactionItemBaseQuantity(item);
    current.sales += item.subtotal;
    current.hpp += transactionItemCost(item, medicine);
    current.customers = unique([...current.customers, formatTransactionCustomer(transaction)]);
    current.priceTypes = unique([...current.priceTypes, itemPriceType(item, medicines)]);
    groups.set(key, current);
  }));

  return [...groups.values()]
    .sort((a, b) => b.sales - a.sales)
    .map(group => [
      `${cleanText(group.code)} / ${cleanText(group.name)}`,
      group.packageLabel,
      group.displayLabel,
      `${group.baseQuantity} ${group.baseUnit}`,
      group.customers.join(', '),
      group.priceTypes.join(', '),
      money(group.sales),
      money(group.hpp),
      money(group.sales - group.hpp),
      group.sales > 0 ? `${((group.sales - group.hpp) / group.sales * 100).toFixed(1)}%` : '0.0%',
    ]);
}

function reportCustomerRows(customers: Customer[], transactions: Transaction[], medicines: Medicine[]): string[][] {
  return customers.map(customer => {
    const customerTransactions = transactions.filter(transaction => (
      (customer.id && transaction.customerId === customer.id) ||
      (customer.memberNo && transaction.customerMemberNo === customer.memberNo) ||
      (customer.name && lower(transaction.customerName) === lower(customer.name))
    ));
    return [
      cleanText(customer.memberNo),
      cleanText(customer.name),
      cleanText(customer.phone),
      cleanText(customer.status),
      String(customerTransactions.length),
      money(customerTransactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0)),
      unique(customerTransactions.flatMap(transaction => transaction.items.map(item => itemPriceType(item, medicines)))).join(', '),
    ];
  });
}

function reportDoctorRows(doctors: Doctor[], transactions: Transaction[], medicines: Medicine[]): string[][] {
  return doctors.map(doctor => {
    const doctorTransactions = transactions.filter(transaction => (
      (doctor.id && transaction.doctorId === doctor.id) ||
      (doctor.name && lower(transaction.doctorName) === lower(doctor.name))
    ));
    return [
      cleanText(doctor.name),
      cleanText(doctor.phone),
      cleanText(doctor.status),
      String(doctorTransactions.length),
      money(doctorTransactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0)),
      unique(doctorTransactions.flatMap(transaction => transaction.items.map(item => itemPriceType(item, medicines)))).join(', '),
    ];
  });
}

function medicineCustomerLabels(medicine: Medicine, transactions: Transaction[], medicines: Medicine[]): string[] {
  return unique(transactions
    .filter(transaction => transaction.items.some(item => item.medicineId === medicine.id || item.medicineName === medicine.name))
    .map(formatTransactionCustomer));
}

function medicinePriceLabels(medicine: Medicine, transactions: Transaction[], medicines: Medicine[]): string[] {
  return unique(transactions.flatMap(transaction => transaction.items
    .filter(item => item.medicineId === medicine.id || item.medicineName === medicine.name)
    .map(item => itemPriceType(item, medicines))));
}

function medicineCostPerBase(medicine: Medicine): number {
  const primary = getPrimaryUnit(medicine);
  return primary?.purchasePricePerBase ?? ((medicine.purchasePrice || 0) / Math.max(1, medicine.unitMultiplier || 1));
}

function medicineSalesTotal(transaction: Transaction, medicines: Medicine[], itemType: 'obat' | 'non_obat', categoryFilter = 'all'): number {
  return transaction.items
    .filter(item => {
      const medicine = medicineForItem(item, medicines);
      return itemMatchesType(item, medicine, itemType) && itemMatchesCategory(item, medicine, categoryFilter);
    })
    .reduce((sum, item) => sum + item.subtotal, 0);
}

function medicineCostTotal(transaction: Transaction, medicines: Medicine[], itemType: 'obat' | 'non_obat', categoryFilter = 'all'): number {
  return transaction.items
    .filter(item => {
      const medicine = medicineForItem(item, medicines);
      return itemMatchesType(item, medicine, itemType) && itemMatchesCategory(item, medicine, categoryFilter);
    })
    .reduce((sum, item) => sum + transactionItemCost(item, medicineForItem(item, medicines)), 0);
}

function section(id: string, title: string, description: string, summary: Array<[string, string]>, tables: AuditExportTable[]): AuditExportSection {
  return { id, title, description, summary, tables };
}

function buildSalesSection(input: AuditExportInput): AuditExportSection {
  const transactions = reportTransactions(input.transactions, input.filters.reports);
  const sales = transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0);
  const ppn = transactions.filter(isPpnTransaction).reduce((sum, transaction) => sum + (transaction.ppnAmount || 0), 0);
  return section(
    'laporan-penjualan',
    'Laporan Penjualan',
    'Daftar transaksi penjualan selesai beserta rincian item, harga, PPN, HPP, laba, customer snapshot, dan jenis harga.',
    [
      ['Jumlah transaksi', String(transactions.length)],
      ['Total omzet', money(sales)],
      ['Total PPN', money(ppn)],
      ['Total stok dasar terjual', String(transactions.flatMap(transaction => transaction.items).reduce((sum, item) => sum + transactionItemBaseQuantity(item), 0))],
    ],
    [
      {
        title: 'Daftar transaksi',
        headers: ['No. Transaksi', 'Tanggal', 'Customer', 'Jenis Harga', 'Dokter', 'Kasir', 'Pembayaran', 'Pajak', 'Total', 'Status'],
        rows: transactionRows(transactions, input.medicines),
        widths: [70, 60, 88, 100, 62, 58, 115, 48, 62, 48],
      },
      {
        title: 'Lampiran rincian item terjual',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(transactions, input.medicines),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
      {
        title: 'Rekap produk terjual',
        headers: ['Kode / Produk', 'Paket', 'Qty Terjual', 'Stok Dasar', 'Customer', 'Jenis Harga', 'Omzet', 'HPP', 'Laba', 'Margin'],
        rows: productRows(transactions, input.medicines),
        widths: [110, 55, 60, 55, 105, 105, 60, 60, 60, 45],
        compact: true,
      },
    ],
  );
}

function buildCustomerSection(input: AuditExportInput): AuditExportSection {
  const transactions = reportTransactions(input.transactions, input.filters.reports);
  const search = lower(input.filters.reports.searchCustomer);
  const customers = input.customers.filter(customer => !search || [customer.name, customer.memberNo, customer.phone].some(value => lower(value).includes(search)));
  return section(
    'laporan-customer',
    'Laporan Customer',
    'Rekap customer/member dan seluruh transaksi yang terhubung berdasarkan snapshot customer pada transaksi.',
    [
      ['Customer terdaftar', String(customers.length)],
      ['Transaksi terfilter', String(transactions.length)],
      ['Total pembelian', money(transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0))],
    ],
    [
      {
        title: 'Rekap customer/member',
        headers: ['No. Member', 'Nama', 'Telepon', 'Status', 'Transaksi', 'Total Belanja', 'Jenis Harga'],
        rows: reportCustomerRows(customers, transactions, input.medicines),
        widths: [65, 110, 75, 52, 48, 70, 155],
      },
      {
        title: 'Lampiran transaksi customer',
        headers: ['No. Transaksi', 'Tanggal', 'Customer Snapshot', 'Jenis Harga', 'Dokter', 'Kasir', 'Pembayaran', 'Pajak', 'Total', 'Status'],
        rows: transactionRows(transactions.filter(transaction => transaction.customerId || transaction.customerName || transaction.customerMemberNo), input.medicines),
        widths: [70, 60, 105, 100, 62, 58, 115, 48, 62, 48],
      },
      {
        title: 'Lampiran item customer',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(transactions.filter(transaction => transaction.customerId || transaction.customerName || transaction.customerMemberNo), input.medicines),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
    ],
  );
}

function buildDoctorSection(input: AuditExportInput): AuditExportSection {
  const transactions = reportTransactions(input.transactions, input.filters.reports).filter(transaction => transaction.isPrescription);
  const search = lower(input.filters.reports.searchDokter);
  const doctors = input.doctors.filter(doctor => !search || [doctor.name, doctor.phone].some(value => lower(value).includes(search)));
  return section(
    'laporan-dokter',
    'Laporan Dokter',
    'Rekap rujukan resep dokter dengan transaksi, customer snapshot, jenis harga, dan rincian item resep.',
    [
      ['Dokter terdaftar', String(doctors.length)],
      ['Transaksi resep', String(transactions.length)],
      ['Total omzet resep', money(transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0))],
    ],
    [
      {
        title: 'Rekap dokter mitra',
        headers: ['Dokter', 'Telepon', 'Status', 'Transaksi Resep', 'Total Omzet', 'Jenis Harga'],
        rows: reportDoctorRows(doctors, transactions, input.medicines),
        widths: [145, 80, 60, 75, 80, 210],
      },
      {
        title: 'Lampiran transaksi resep',
        headers: ['No. Transaksi', 'Tanggal', 'Customer', 'Jenis Harga', 'Dokter', 'Kasir', 'Pembayaran', 'Pajak', 'Total', 'Status'],
        rows: transactionRows(transactions, input.medicines),
        widths: [70, 60, 88, 100, 70, 58, 115, 48, 62, 48],
      },
      {
        title: 'Lampiran item resep',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(transactions, input.medicines),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
    ],
  );
}

function buildStockSection(input: AuditExportInput): AuditExportSection {
  const completed = completedTransactionsForScope(input);
  const search = lower(input.filters.reports.searchStok);
  const categoryFilter = input.filters.reports.categoryFilter;
  const medicines = input.medicines.filter(medicine => (!search || [medicine.code, medicine.name, medicine.category, medicine.location].some(value => lower(value).includes(search))) && (categoryFilter === 'all' || medicine.category === categoryFilter));
  const stockValue = medicines.reduce((sum, medicine) => sum + Math.round((medicine.stock || 0) * medicineCostPerBase(medicine)), 0);
  const stockHistory = auditBookScoped(input.stockHistory, input).filter(history => medicines.some(medicine => medicine.id === history.medicineId));
  return section(
    'laporan-stok',
    'Laporan Stok',
    'Posisi stok aktif, batch, lokasi, HPP, status minimum, serta seluruh riwayat mutasi stok.',
    [
      ['Item stok', String(medicines.length)],
      ['Valuasi stok', money(stockValue)],
      ['Riwayat mutasi', String(stockHistory.length)],
    ],
    [
      {
        title: 'Posisi stok dan valuasi',
        headers: ['Kode / Nama', 'Kategori', 'Stok', 'Min. Stok', 'HPP / Unit Dasar', 'Valuasi', 'Batch', 'Lokasi', 'Customer Historis', 'Jenis Harga'],
        rows: medicines.map(medicine => [
          `${cleanText(medicine.code)} / ${cleanText(medicine.name)}`,
          cleanText(medicine.category),
          `${medicine.stock || 0} ${cleanText(medicine.unit)}`,
          String(medicine.minStock || 0),
          money(medicineCostPerBase(medicine)),
          money(Math.round((medicine.stock || 0) * medicineCostPerBase(medicine))),
          cleanText(medicine.noBatch),
          cleanText(medicine.location),
          medicineCustomerLabels(medicine, completed, input.medicines).join(', '),
          medicinePriceLabels(medicine, completed, input.medicines).join(', '),
        ]),
        widths: [125, 75, 55, 50, 65, 65, 50, 60, 115, 115],
        compact: true,
      },
      {
        title: 'Lampiran riwayat mutasi stok',
        headers: ['Tanggal', 'Kode / Nama', 'Tipe', 'Qty Mutasi', 'Stok Sebelum', 'Stok Sesudah', 'Unit Input', 'Pajak', 'HPP', 'Harga Jual', 'BHP', 'Batch', 'Keterangan', 'Petugas'],
        rows: stockHistory.map(history => [
          dateTimeLabel(history.date),
          `${cleanText(history.medicineCode)} / ${cleanText(history.medicineName)}`,
          cleanText(history.type),
          String(history.amount || 0),
          String(history.prevStock || 0),
          String(history.newStock || 0),
          history.inputQty ? `${history.inputQty} ${cleanText(history.inputUnit)}` : '-',
          cleanText(history.taxType),
          money(history.purchasePrice),
          money(history.sellingPrice),
          money(history.bhpAmount),
          cleanText(history.noBatch),
          cleanText(history.note),
          cleanText(history.user),
        ]),
        widths: [62, 115, 52, 48, 52, 52, 60, 45, 55, 55, 50, 45, 130, 65],
        compact: true,
      },
    ],
  );
}

function buildExpiredSection(input: AuditExportInput): AuditExportSection {
  const search = lower(input.filters.reports.searchExpired);
  const categoryFilter = input.filters.reports.categoryFilter;
  const items = input.medicines.filter(medicine => {
    const days = getDaysUntilExpired(medicine.expiredDate);
    if (!medicine.isActive || days > 90) return false;
    if (categoryFilter !== 'all' && medicine.category !== categoryFilter) return false;
    const status = days < 0 ? 'expired' : `pre-expired ${days} hari`;
    return !search || [medicine.code, medicine.name, medicine.category, status].some(value => lower(value).includes(search));
  });
  const completed = completedTransactionsForScope(input);
  const itemIds = new Set(items.map(item => item.id));
  const relatedTransactions = completed.filter(transaction => transaction.items.some(item => itemIds.has(item.medicineId)));
  const relatedStockHistory = auditBookScoped(input.stockHistory, input).filter(history => itemIds.has(history.medicineId));
  return section(
    'laporan-expired',
    'Laporan Expired dan Pre-Expired',
    'Audit kadaluwarsa sampai 90 hari ke depan dengan stok, batch, lokasi, customer historis, dan jenis harga terkait.',
    [
      ['Item diaudit', String(items.length)],
      ['Sudah expired', String(items.filter(item => getDaysUntilExpired(item.expiredDate) < 0).length)],
      ['Akan expired <= 30 hari', String(items.filter(item => getDaysUntilExpired(item.expiredDate) >= 0 && getDaysUntilExpired(item.expiredDate) <= 30).length)],
    ],
    [{
      title: 'Daftar expired dan pre-expired',
      headers: ['Kode / Nama', 'Kategori', 'Tanggal Expired', 'Status', 'Sisa Stok', 'Batch', 'Lokasi', 'Customer Historis', 'Jenis Harga'],
      rows: items.map(medicine => [
        `${cleanText(medicine.code)} / ${cleanText(medicine.name)}`,
        cleanText(medicine.category),
        dateLabel(medicine.expiredDate),
        cleanText(getDaysUntilExpired(medicine.expiredDate) < 0 ? 'EXPIRED' : `PRE-EXPIRED (${getDaysUntilExpired(medicine.expiredDate)} hari)`),
        `${medicine.stock || 0} ${cleanText(medicine.unit)}`,
        cleanText(medicine.noBatch),
        cleanText(medicine.location),
        medicineCustomerLabels(medicine, completed, input.medicines).join(', '),
        medicinePriceLabels(medicine, completed, input.medicines).join(', '),
      ]),
      widths: [130, 75, 70, 90, 60, 50, 60, 135, 135],
      compact: true,
    },
    {
      title: 'Riwayat transaksi dan mutasi terkait',
      headers: ['Sumber', 'Tanggal', 'Referensi', 'Customer', 'Jenis Harga', 'Qty / Mutasi', 'HPP', 'Harga Jual', 'Batch', 'Keterangan'],
      rows: [
        ...relatedTransactions.flatMap(transaction => transaction.items.filter(item => itemIds.has(item.medicineId)).map(item => [
          'Penjualan', dateTimeLabel(transaction.date), cleanText(transaction.trxNo), formatTransactionCustomer(transaction), itemPriceType(item, input.medicines), transactionItemDisplayLabel(item), money(transactionItemCost(item, medicineForItem(item, input.medicines))), money(transactionItemSalePrice(item)), cleanText(item.noBatch), `${cleanText(item.medicineCode)} / ${cleanText(item.medicineName)}`,
        ])),
        ...relatedStockHistory.map(history => [
          'Mutasi stok', dateTimeLabel(history.date), cleanText(history.id), '-', '-', `${history.amount || 0} ${cleanText(history.inputUnit || medicineBaseUnitName(input.medicines.find(medicine => medicine.id === history.medicineId)))}`, money(history.purchasePrice), money(history.sellingPrice), cleanText(history.noBatch), cleanText(history.note),
        ]),
      ],
      widths: [50, 65, 68, 90, 85, 60, 55, 55, 45, 180],
      compact: true,
    }],
  );
}

function buildTaxSection(input: AuditExportInput): AuditExportSection {
  const transactions = reportTransactions(input.transactions, input.filters.reports);
  const dpp = transactions.reduce((sum, transaction) => sum + (isPpnTransaction(transaction)
    ? transaction.dppAmount ?? Math.round(transaction.totalAmount / (1 + (transaction.ppnRate || 11) / 100))
    : transaction.totalAmount), 0);
  const ppn = transactions.reduce((sum, transaction) => sum + (isPpnTransaction(transaction) ? transaction.ppnAmount || 0 : 0), 0);
  return section(
    'laporan-pajak',
    'Laporan Pajak PPN dan Non-PPN',
    'Rekap faktur PPN dan nota Non-PPN dengan DPP, PPN, customer, jenis harga, pembayaran, dan rincian pajak per item.',
    [
      ['Dokumen pajak', String(transactions.length)],
      ['DPP', money(dpp)],
      ['PPN output', money(ppn)],
      ['Total faktur/nota', money(transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0))],
    ],
    [
      {
        title: 'Rekap dokumen pajak',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Jenis Harga', 'Status Pajak', 'DPP', 'PPN', 'Total', 'Pembayaran', 'Kasir'],
        rows: transactions.map(transaction => [
          cleanText(transaction.trxNo),
          dateTimeLabel(transaction.date),
          formatTransactionCustomer(transaction),
          unique(transaction.items.map(item => itemPriceType(item, input.medicines))).join(', '),
          isPpnTransaction(transaction) ? `PPN ${transaction.ppnRate || 11}%` : 'Non-PPN',
          money(isPpnTransaction(transaction) ? transaction.dppAmount ?? Math.round(transaction.totalAmount / (1 + (transaction.ppnRate || 11) / 100)) : transaction.totalAmount),
          money(isPpnTransaction(transaction) ? transaction.ppnAmount : 0),
          money(transaction.totalAmount),
          `${cleanText(transaction.paymentMethod)} | Bayar ${money(transaction.paymentAmount)} | Kembali ${money(transaction.changeAmount)}`,
          cleanText(transaction.cashierName),
        ]),
        widths: [50, 60, 90, 95, 62, 60, 55, 60, 135, 60],
      },
      {
        title: 'Rincian PPN per item',
        headers: ['No. Trx', 'Kode / Produk', 'Satuan & Qty', 'Customer', 'Jenis Harga', 'DPP Item', 'PPN Item', 'Subtotal', 'Batch'],
        rows: transactions.flatMap(transaction => transaction.items.map(item => {
          const medicine = medicineForItem(item, input.medicines);
          const itemPpn = getItemIsPpn(item, transaction, medicine);
          const rate = item.ppnRate || transaction.ppnRate || 11;
          const itemDpp = itemPpn ? Math.round(item.subtotal / (1 + rate / 100)) : item.subtotal;
          return [
            cleanText(transaction.trxNo),
            `${cleanText(item.medicineCode)} / ${cleanText(item.medicineName)}`,
            transactionItemDisplayLabel(item),
            formatTransactionCustomer(transaction),
            itemPriceType(item, input.medicines),
            money(itemDpp),
            money(itemPpn ? item.subtotal - itemDpp : 0),
            money(item.subtotal),
            cleanText(item.noBatch),
          ];
        })),
        widths: [55, 135, 75, 110, 115, 60, 60, 60, 50],
        compact: true,
      },
    ],
  );
}

function buildProductSection(input: AuditExportInput, itemType: 'obat' | 'non_obat'): AuditExportSection {
  const transactions = reportTransactions(input.transactions, { ...input.filters.reports, taxReportFilter: 'all' });
  const categoryFilter = input.filters.reports.categoryFilter;
  const filtered = transactions.map(transaction => ({
    ...transaction,
    items: transaction.items.filter(item => {
      const medicine = medicineForItem(item, input.medicines);
      return itemMatchesType(item, medicine, itemType)
        && itemMatchesCategory(item, medicine, categoryFilter)
      && itemMatchesTax(item, transaction, medicine, input.filters.reports.taxReportFilter);
    }),
  })).filter(transaction => transaction.items.length > 0);
  const search = lower(input.filters.reports.searchPenjualan);
  const searched = filtered.map(transaction => ({
    ...transaction,
    items: transaction.items.filter(item => !search || [item.medicineCode, item.medicineName, item.unit, item.customUnit, transactionItemPackageLabel(item)].some(value => lower(value).includes(search))),
  })).filter(transaction => transaction.items.length > 0);
  const rows = productRows(searched, input.medicines, itemType, categoryFilter);
  const sales = searched.reduce((sum, transaction) => sum + medicineSalesTotal(transaction, input.medicines, itemType, categoryFilter), 0);
  const hpp = searched.reduce((sum, transaction) => sum + medicineCostTotal(transaction, input.medicines, itemType, categoryFilter), 0);
  return section(
    `laporan-produk-${itemType}`,
    itemType === 'obat' ? 'Laporan Produk Obat' : 'Laporan Produk Non-Obat',
    `Rekap ${itemType === 'obat' ? 'obat' : 'non-obat'} terjual dengan qty kemasan, stok dasar, omzet, HPP, laba, PPN, customer, dan jenis harga.`,
    [
      ['Transaksi terkait', String(filtered.length)],
      ['Omzet', money(sales)],
      ['HPP', money(hpp)],
      ['Laba kotor', money(sales - hpp)],
    ],
    [
      {
        title: 'Rekap produk',
        headers: ['Kode / Produk', 'Paket', 'Qty Terjual', 'Stok Dasar', 'Customer', 'Jenis Harga', 'Omzet', 'HPP', 'Laba', 'Margin'],
        rows,
        widths: [110, 55, 60, 55, 105, 105, 60, 60, 60, 45],
        compact: true,
      },
      {
        title: 'Lampiran transaksi dan item',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(searched, input.medicines, (item, medicine) => itemMatchesType(item, medicine, itemType) && itemMatchesCategory(item, medicine, categoryFilter)),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
    ],
  );
}

function buildBalanceSection(input: AuditExportInput): AuditExportSection {
  const completed = completedTransactionsForScope(input);
  const cashFlows = auditBookScoped(input.cashFlows, input);
  const salesObat = completed.reduce((sum, transaction) => sum + medicineSalesTotal(transaction, input.medicines, 'obat'), 0);
  const salesNonObat = completed.reduce((sum, transaction) => sum + medicineSalesTotal(transaction, input.medicines, 'non_obat'), 0);
  const hppObat = completed.reduce((sum, transaction) => sum + medicineCostTotal(transaction, input.medicines, 'obat'), 0);
  const expenses = cashFlows.filter(cashFlow => cashFlow.type === 'Pengeluaran').reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const otherIncome = cashFlows.filter(cashFlow => cashFlow.type === 'Pemasukan').reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const initialCapital = input.settings.initialCapital ?? 50000000;
  const additionalCapital = input.cashFlows
    .filter(cashFlow => cashFlow.type === 'Pemasukan' && (cashFlow.category === 'Suntikan Modal' || lower(cashFlow.note).includes('modal') || lower(cashFlow.note).includes('suntikan')))
    .reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const paidInCapital = initialCapital + additionalCapital;
  const cash = Math.max(0, initialCapital + salesObat + otherIncome - expenses);
  const inventory = input.medicines.filter(medicine => (medicine.itemType || 'obat') === 'obat')
    .reduce((sum, medicine) => sum + Math.round((medicine.stock || 0) * medicineCostPerBase(medicine)), 0);
  const assets = cash + inventory;
  const retained = assets - paidInCapital;
  return section(
    'neraca',
    'Neraca Keuangan',
    'Posisi aset, kas, persediaan obat, modal, dan laba ditahan berdasarkan data operasional saat export.',
    [
      ['Kas dan setara kas', money(cash)],
      ['Persediaan obat', money(inventory)],
      ['Total aset', money(assets)],
      ['Modal disetor', money(paidInCapital)],
      ['Laba ditahan/berjalan', money(retained)],
    ],
    [
      {
        title: 'Ringkasan neraca',
        headers: ['Kelompok', 'Akun', 'Nilai', 'Dasar Perhitungan'],
        rows: [
          ['Aset Lancar', 'Kas dan Setara Kas', money(cash), 'Modal awal + penjualan obat + pemasukan - pengeluaran'],
          ['Aset Lancar', 'Persediaan Obat', money(inventory), 'Stok fisik obat x HPP per unit dasar'],
          ['Aset', 'Total Aset', money(assets), 'Kas + persediaan obat'],
          ['Ekuitas', 'Modal Disetor', money(paidInCapital), 'Modal awal + suntikan modal yang tercatat'],
          ['Ekuitas', 'Laba Ditahan/Berjalan', money(retained), 'Total aset - modal disetor'],
          ['Ekuitas', 'Total Ekuitas', money(assets), 'Modal disetor + laba ditahan'],
        ],
        widths: [80, 125, 90, 335],
      },
      {
        title: 'Sumber kas dari penjualan obat POS',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Jenis Harga', 'Penjualan Obat'],
        rows: completed.filter(transaction => medicineSalesTotal(transaction, input.medicines, 'obat') > 0).map(transaction => [
          cleanText(transaction.trxNo), dateTimeLabel(transaction.date), formatTransactionCustomer(transaction),
          unique(transaction.items.map(item => itemPriceType(item, input.medicines))).join(', '),
          money(medicineSalesTotal(transaction, input.medicines, 'obat')),
        ]),
        widths: [65, 70, 145, 210, 90],
      },
      {
        title: 'Sumber kas dari log arus kas',
        headers: ['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah', 'Petugas'],
        rows: cashFlows.map(cashFlow => [dateTimeLabel(cashFlow.date), cleanText(cashFlow.type), cleanText(cashFlow.category), cleanText(cashFlow.note), money(cashFlow.amount), cleanText(cashFlow.recordedBy)]),
        widths: [70, 65, 85, 300, 75, 70],
      },
      {
        title: 'Rincian persediaan obat',
        headers: ['Kode / Nama', 'Stok', 'HPP / Unit Dasar', 'Nilai Persediaan', 'Batch', 'Lokasi'],
        rows: input.medicines.filter(medicine => (medicine.itemType || 'obat') === 'obat').map(medicine => [
          `${cleanText(medicine.code)} / ${cleanText(medicine.name)}`,
          `${medicine.stock || 0} ${cleanText(medicine.unit)}`,
          money(medicineCostPerBase(medicine)),
          money(Math.round((medicine.stock || 0) * medicineCostPerBase(medicine))),
          cleanText(medicine.noBatch),
          cleanText(medicine.location),
        ]),
        widths: [200, 80, 95, 100, 60, 95],
      },
    ],
  );
}

function buildIncomeSection(input: AuditExportInput): AuditExportSection {
  const transactions = financeTransactions(input.transactions, input.filters.finances);
  const cashFlows = financeCashFlows(input.cashFlows, input.filters.finances);
  const sales = transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0);
  const hpp = transactions.reduce((sum, transaction) => sum + transaction.items.reduce((itemSum, item) => itemSum + transactionItemCost(item, medicineForItem(item, input.medicines)), 0), 0);
  const expenses = cashFlows.filter(cashFlow => cashFlow.type === 'Pengeluaran').reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const otherIncome = cashFlows.filter(cashFlow => cashFlow.type === 'Pemasukan' && cashFlow.category !== 'Suntikan Modal' && !lower(cashFlow.note).includes('modal') && !lower(cashFlow.note).includes('suntikan')).reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const gross = sales - hpp;
  const net = gross - expenses + otherIncome;
  return section(
    'laba-rugi',
    'Laporan Laba / Rugi',
    'Ringkasan pendapatan, HPP, laba kotor, beban operasional, pemasukan lain, rasio, dan lampiran transaksi lengkap.',
    [
      ['Penjualan', money(sales)],
      ['HPP', money(hpp)],
      ['Laba kotor', money(gross)],
      ['Beban operasional', money(expenses)],
      ['Laba bersih', money(net)],
      ['Gross margin', sales > 0 ? `${(gross / sales * 100).toFixed(1)}%` : '0.0%'],
    ],
    [
      {
        title: 'Ringkasan laba/rugi',
        headers: ['Komponen', 'Nilai', 'Keterangan'],
        rows: [
          ['Penjualan', money(sales), 'Pendapatan transaksi POS selesai'],
          ['HPP', money(hpp), 'Modal item terjual'],
          ['Laba Kotor', money(gross), 'Penjualan - HPP'],
          ['Beban Operasional', money(expenses), 'Pengeluaran arus kas'],
          ['Pemasukan Lain', money(otherIncome), 'Pemasukan non-penjualan'],
          ['Laba Bersih', money(net), 'Laba kotor - beban + pemasukan lain'],
        ],
        widths: [150, 100, 380],
      },
      {
        title: 'Lampiran transaksi penjualan',
        headers: ['No. Transaksi', 'Tanggal', 'Customer', 'Jenis Harga', 'Dokter', 'Kasir', 'Pembayaran', 'Pajak', 'Total', 'Status'],
        rows: transactionRows(transactions, input.medicines),
        widths: [70, 60, 88, 100, 62, 58, 115, 48, 62, 48],
      },
      {
        title: 'Lampiran item dan profit',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(transactions, input.medicines),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
      {
        title: 'Beban dan pemasukan lain',
        headers: ['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Nilai', 'Petugas'],
        rows: cashFlows.filter(cashFlow => cashFlow.type === 'Pengeluaran' || (cashFlow.category !== 'Suntikan Modal' && !lower(cashFlow.note).includes('modal') && !lower(cashFlow.note).includes('suntikan'))).map(cashFlow => [dateTimeLabel(cashFlow.date), cleanText(cashFlow.type), cleanText(cashFlow.category), cleanText(cashFlow.note), money(cashFlow.amount), cleanText(cashFlow.recordedBy)]),
        widths: [70, 65, 85, 300, 75, 70],
      },
    ],
  );
}

function buildCashFlowSection(input: AuditExportInput): AuditExportSection {
  const cashFlows = financeCashFlows(input.cashFlows, input.filters.finances);
  const income = cashFlows.filter(cashFlow => cashFlow.type === 'Pemasukan').reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  const expense = cashFlows.filter(cashFlow => cashFlow.type === 'Pengeluaran').reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
  return section(
    'arus-kas',
    'Log Arus Kas',
    'Seluruh pemasukan dan pengeluaran yang sesuai filter tipe, tanggal, kategori, dan pencarian.',
    [
      ['Jumlah catatan', String(cashFlows.length)],
      ['Total pemasukan', money(income)],
      ['Total pengeluaran', money(expense)],
      ['Arus kas bersih', money(income - expense)],
    ],
    [{
      title: 'Rincian arus kas',
      headers: ['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah', 'Petugas'],
      rows: cashFlows.map(cashFlow => [dateTimeLabel(cashFlow.date), cleanText(cashFlow.type), cleanText(cashFlow.category), cleanText(cashFlow.note), money(cashFlow.amount), cleanText(cashFlow.recordedBy)]),
      widths: [75, 70, 100, 330, 85, 85],
    }],
  );
}

function buildTransactionsSection(input: AuditExportInput): AuditExportSection {
  const transactions = historyTransactions(input.transactions, input.filters.transactions);
  const cancelled = transactions.filter(transaction => transaction.status === 'Dibatalkan');
  return section(
    'riwayat-penjualan',
    'Riwayat Penjualan',
    'Riwayat transaksi kasir lengkap dengan customer snapshot, jenis harga, pembayaran, PPN, item, HPP, laba, dan audit pembatalan.',
    [
      ['Jumlah transaksi', String(transactions.length)],
      ['Transaksi selesai', String(transactions.filter(transaction => transaction.status === 'Selesai').length)],
      ['Transaksi dibatalkan', String(cancelled.length)],
      ['Total nominal', money(transactions.reduce((sum, transaction) => sum + transaction.totalAmount, 0))],
    ],
    [
      {
        title: 'Daftar riwayat transaksi',
        headers: ['No. Transaksi', 'Tanggal', 'Customer', 'Jenis Harga', 'Dokter', 'Kasir', 'Pembayaran', 'Pajak', 'Total', 'Status'],
        rows: transactionRows(transactions, input.medicines),
        widths: [70, 60, 88, 100, 62, 58, 115, 48, 62, 48],
      },
      {
        title: 'Lampiran seluruh item transaksi',
        headers: ['No. Trx', 'Tanggal', 'Customer', 'Kode / Produk', 'Satuan & Qty', 'Stok Dasar', 'Jenis Harga', 'Harga Jual', 'HPP', 'Laba', 'PPN', 'Subtotal', 'Batch'],
        rows: itemRows(transactions, input.medicines),
        widths: [48, 55, 78, 90, 54, 50, 82, 50, 48, 48, 52, 52, 38],
        compact: true,
      },
      {
        title: 'Audit pembatalan transaksi',
        headers: ['No. Transaksi', 'Tanggal Batal', 'Customer', 'Total', 'Alasan', 'Dibatalkan Oleh', 'Waktu Batal'],
        rows: cancelled.map(transaction => [cleanText(transaction.trxNo), dateTimeLabel(transaction.date), formatTransactionCustomer(transaction), money(transaction.totalAmount), cleanText(transaction.cancelReason), cleanText(transaction.cancelledBy), dateTimeLabel(transaction.cancelledAt)]),
        widths: [70, 70, 120, 70, 250, 100, 85],
      },
    ],
  );
}

function buildSections(input: AuditExportInput): AuditExportSection[] {
  const reportSections: Record<ReportTab, AuditExportSection> = {
    penjualan: buildSalesSection(input),
    customer: buildCustomerSection(input),
    dokter: buildDoctorSection(input),
    stok: buildStockSection(input),
    expired: buildExpiredSection(input),
    pajak_ppn: buildTaxSection(input),
    produk_obat: buildProductSection(input, 'obat'),
    produk_non_obat: buildProductSection(input, 'non_obat'),
  };
  const financeSections: Record<FinanceTab, AuditExportSection> = {
    neraca: buildBalanceSection(input),
    laporan: buildIncomeSection(input),
    aruskas: buildCashFlowSection(input),
  };

  if (input.scope === 'reports') return [reportSections[input.reportTab || input.filters.reports.activeTab]];
  if (input.scope === 'finances') return [financeSections[input.financeTab || input.filters.finances.activeTab]];
  if (input.scope === 'transactions') return [buildTransactionsSection(input)];
  return [
    reportSections.penjualan,
    reportSections.customer,
    reportSections.dokter,
    reportSections.stok,
    reportSections.expired,
    reportSections.pajak_ppn,
    reportSections.produk_obat,
    reportSections.produk_non_obat,
    financeSections.neraca,
    financeSections.laporan,
    financeSections.aruskas,
    buildTransactionsSection(input),
  ];
}

function currentPeriodLabel(scope: AuditExportScope, filters: AuditFilterState, auditBookDateRange?: AuditBookDateRange): string {
  if (scope === 'reports') return `${dateLabel(filters.reports.startDate)} - ${dateLabel(filters.reports.endDate)}`;
  if (scope === 'finances') {
    const range = financePeriodRange(filters.finances);
    return range ? `${dateLabel(range[0])} - ${dateLabel(range[1])}` : 'Semua periode';
  }
  if (scope === 'transactions') return `${dateLabel(filters.transactions.startDate)} - ${dateLabel(filters.transactions.endDate)}`;
  if (auditBookDateRange && isValidAuditBookDateRange(auditBookDateRange)) return `${dateLabel(auditBookDateRange.startDate)} - ${dateLabel(auditBookDateRange.endDate)}`;
  return 'Filter terakhir tiap halaman laporan';
}

function filterDescription(scope: AuditExportScope, filters: AuditFilterState, auditBookDateRange?: AuditBookDateRange): string {
  if (scope === 'reports') {
    const filter = filters.reports;
    return [`Periode ${currentPeriodLabel(scope, filters)}`, filter.methodFilter !== 'all' ? `Metode ${filter.methodFilter}` : '', filter.taxReportFilter !== 'all' ? `Pajak ${filter.taxReportFilter}` : '', filter.searchPenjualan ? `Cari ${filter.searchPenjualan}` : ''].filter(Boolean).join(' | ') || 'Filter default';
  }
  if (scope === 'finances') {
    const filter = filters.finances;
    return [`Periode ${currentPeriodLabel(scope, filters)}`, filter.cashFlowTypeFilter !== 'Semua' ? `Tipe ${filter.cashFlowTypeFilter}` : '', filter.cashFlowSearch ? `Cari ${filter.cashFlowSearch}` : ''].filter(Boolean).join(' | ') || 'Filter default';
  }
  if (scope === 'transactions') {
    const filter = filters.transactions;
    return [`Periode ${currentPeriodLabel(scope, filters)}`, filter.statusFilter !== 'all' ? `Status ${filter.statusFilter}` : '', filter.taxFilter !== 'all' ? `Pajak ${filter.taxFilter}` : '', filter.searchTerm ? `Cari ${filter.searchTerm}` : ''].filter(Boolean).join(' | ') || 'Filter default';
  }
  if (auditBookDateRange && isValidAuditBookDateRange(auditBookDateRange)) {
    return `Rentang global ${dateLabel(auditBookDateRange.startDate)} - ${dateLabel(auditBookDateRange.endDate)} | Filter non-tanggal terakhir tiap halaman`;
  }
  return 'Setiap bagian memakai snapshot filter terakhir dari halaman masing-masing.';
}

function scopeTitle(input: AuditExportInput, sections: AuditExportSection[]): string {
  if (input.scope === 'audit-book') return 'Buku Audit Gabungan';
  return sections[0]?.title || 'Laporan Audit';
}

export function sanitizeAuditFileName(value: string): string {
  return cleanText(value, 'laporan-audit')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'laporan-audit';
}

const PDF_PT_PER_CM = 72 / 2.54;
export const AUDIT_PDF_MARGIN_PT = Number((0.5 * PDF_PT_PER_CM).toFixed(2));
const PORTRAIT_PAGE_WIDTH_PT = 21 * PDF_PT_PER_CM;
const PORTRAIT_PAGE_HEIGHT_PT = 29.7 * PDF_PT_PER_CM;
const DETAIL_PAGE_HEIGHT_PT = PORTRAIT_PAGE_WIDTH_PT;
const MIN_DETAIL_PAGE_WIDTH_PT = PORTRAIT_PAGE_HEIGHT_PT;

function auditPageMargins(): [number, number, number, number] {
  return [AUDIT_PDF_MARGIN_PT, AUDIT_PDF_MARGIN_PT, AUDIT_PDF_MARGIN_PT, AUDIT_PDF_MARGIN_PT];
}

function tableWidth(table: AuditExportTable): number {
  const columnCount = table.widths?.length || table.headers.length;
  const numericWidth = (table.widths || []).reduce<number>((sum, width) => sum + (typeof width === 'number' ? width : 0), 0);
  const contentWidth = numericWidth || columnCount * 64;
  const tablePadding = columnCount * 8;
  const tableBorders = (columnCount + 1) * 0.3;
  return contentWidth + tablePadding + tableBorders;
}

function detailPageSize(section: AuditExportSection): { width: number; height: number } {
  const widestTable = Math.max(...section.tables.map(tableWidth), MIN_DETAIL_PAGE_WIDTH_PT - (AUDIT_PDF_MARGIN_PT * 2));
  return {
    width: Math.ceil(Math.max(MIN_DETAIL_PAGE_WIDTH_PT, widestTable + (AUDIT_PDF_MARGIN_PT * 2))),
    height: DETAIL_PAGE_HEIGHT_PT,
  };
}

function generatedAtLabel(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function buildAuditExportModel(input: AuditExportInput): AuditExportModel {
  const filters = input.scope === 'audit-book' && input.auditBookDateRange
    ? applyAuditBookDateRange(input.filters, input.auditBookDateRange)
    : input.filters;
  const modelInput = filters === input.filters ? input : { ...input, filters };
  const sections = buildSections(modelInput);
  const generatedAt = input.generatedAt || new Date();
  const title = scopeTitle(input, sections);
  const datePart = generatedAt.toISOString().slice(0, 10);
  return {
    scope: input.scope,
    title,
    subtitle: input.scope === 'audit-book' ? 'Dokumen gabungan untuk kebutuhan audit operasional, perpajakan, dan keuangan' : sections[0]?.description || 'Dokumen laporan audit',
    periodLabel: currentPeriodLabel(input.scope, filters, input.auditBookDateRange),
    filterLabel: filterDescription(input.scope, filters, input.auditBookDateRange),
    generatedAtLabel: generatedAtLabel(generatedAt),
    fileName: sanitizeAuditFileName(`${title}-${datePart}.pdf`),
    pharmacy: input.settings,
    currentUser: input.currentUser,
    sections,
  };
}

function tableNode(table: AuditExportTable): any {
  const header = table.headers.map(value => ({ text: cleanText(value), style: 'tableHeader' }));
  const body = table.rows.length > 0
    ? table.rows.map(row => table.headers.map((_, index) => ({ text: cleanText(row[index]), style: table.compact ? 'compactCell' : 'tableCell' })))
    : [[{ text: 'Tidak ada data', colSpan: table.headers.length, style: 'emptyCell' }, ...table.headers.slice(1).map(() => ({ text: '' }))]];
  return {
    stack: [
      { text: table.title, style: 'tableTitle' },
      {
        table: {
          headerRows: 1,
          dontBreakRows: false,
          keepWithHeaderRows: 1,
          widths: table.widths || table.headers.map(() => '*'),
          body: [header, ...body],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#0f172a' : rowIndex % 2 === 0 ? '#f8fafc' : null,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#e2e8f0',
          hLineWidth: (lineIndex: number) => lineIndex === 0 ? 0.8 : 0.35,
          vLineWidth: () => 0.3,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

function summaryNode(summary: Array<[string, string]>): any {
  return {
    table: {
      widths: ['*', 145, '*', 145],
      body: summary.reduce<any[][]>((rows, [label, value], index) => {
        if (index % 2 === 0) rows.push([{ text: cleanText(label), style: 'summaryLabel' }, { text: cleanText(value), style: 'summaryValue' }, '', '']);
        else {
          const row = rows[rows.length - 1];
          row[2] = { text: cleanText(label), style: 'summaryLabel' };
          row[3] = { text: cleanText(value), style: 'summaryValue' };
        }
        return rows;
      }, []),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 12],
  };
}

function coverNode(model: AuditExportModel): any {
  const cover: any[] = [];
  if (model.logoDataUrl) cover.push({ image: 'pharmacyLogo', width: 82, alignment: 'center', margin: [0, 10, 0, 16] });
  cover.push({ text: cleanText(model.pharmacy.name, 'Apotek'), style: 'coverPharmacy' });
  cover.push({ text: cleanText(model.pharmacy.address), style: 'coverMeta' });
  cover.push({ text: `Telp: ${cleanText(model.pharmacy.phone)}`, style: 'coverMeta' });
  if (model.pharmacy.siaNumber) cover.push({ text: `SIA: ${cleanText(model.pharmacy.siaNumber)}`, style: 'coverMeta' });
  if (model.pharmacy.sipaNumber) cover.push({ text: `SIPA: ${cleanText(model.pharmacy.sipaNumber)}`, style: 'coverMeta' });
  if (model.pharmacy.apotekerName) cover.push({ text: `Apoteker: ${cleanText(model.pharmacy.apotekerName)}`, style: 'coverMeta' });
  cover.push({ text: model.title, style: 'coverTitle', margin: [0, 48, 0, 8] });
  cover.push({ text: cleanText(model.subtitle), style: 'coverSubtitle' });
  cover.push({
    table: {
      widths: [145, '*'],
      body: [
        ['Periode laporan', model.periodLabel],
        ['Filter', model.filterLabel],
        ['Waktu export', model.generatedAtLabel],
        ['Dibuat oleh', `${cleanText(model.currentUser.name)} (${cleanText(model.currentUser.role)})`],
        ['Sumber data', 'Snapshot data aplikasi saat export'],
      ].map(([label, value]) => [{ text: label, style: 'coverLabel' }, { text: cleanText(value), style: 'coverValue' }]),
    },
    layout: {
      fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff',
      hLineColor: () => '#cbd5e1',
      vLineColor: () => '#cbd5e1',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 7,
      paddingBottom: () => 7,
    },
    margin: [0, 26, 0, 0],
  });
  cover.push({ text: 'Dokumen ini dibuat untuk audit internal. Nilai dan rincian mengikuti filter yang tercantum serta tidak mengubah data aplikasi.', style: 'auditNote', margin: [0, 26, 0, 0] });
  return { stack: cover };
}

function sectionNode(reportSection: AuditExportSection): any {
  return {
    section: {
      stack: [
        { text: reportSection.title, style: 'sectionTitle', id: `audit-${reportSection.id}` },
        { text: cleanText(reportSection.description), style: 'sectionDescription' },
        summaryNode(reportSection.summary),
        ...reportSection.tables.map(tableNode),
      ],
    },
    pageSize: detailPageSize(reportSection),
    pageOrientation: 'landscape',
    pageMargins: auditPageMargins(),
    header: 'inherit',
    footer: 'inherit',
  };
}

export function buildAuditPdfDefinition(model: AuditExportModel): TDocumentDefinitions {
  const content: any[] = [coverNode(model)];
  if (model.scope === 'audit-book') {
    content.push({
      stack: [
        { text: 'Daftar Isi', style: 'sectionTitle' },
        { text: 'Bagian laporan dalam buku audit gabungan', style: 'sectionDescription' },
        {
          table: {
            widths: [35, '*'],
            body: [
              [{ text: 'No.', style: 'tableHeader' }, { text: 'Bagian', style: 'tableHeader' }],
              ...model.sections.map((reportSection, index) => [String(index + 1), cleanText(reportSection.title)]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: 'Setiap bagian memakai filter non-tanggal terakhir dari halaman masing-masing. Rentang tanggal popup diterapkan ke seluruh bagian; pagination pada layar tidak membatasi lampiran PDF.', style: 'auditNote', margin: [0, 18, 0, 0] },
      ],
      pageBreak: 'before',
    });
  }
  model.sections.forEach(reportSection => content.push(sectionNode(reportSection)));

  const definition: TDocumentDefinitions = {
    content,
    info: {
      title: model.title,
      author: cleanText(model.currentUser.name, 'Sistem'),
      subject: cleanText(model.subtitle),
      keywords: 'audit, apotek, laporan, finansial, perpajakan',
    },
    pageSize: { width: PORTRAIT_PAGE_WIDTH_PT, height: PORTRAIT_PAGE_HEIGHT_PT },
    pageOrientation: 'portrait',
    pageMargins: auditPageMargins(),
    compress: true,
    defaultStyle: { font: 'Roboto', fontSize: 7.4, color: '#1e293b' },
    styles: {
      coverPharmacy: { fontSize: 20, bold: true, color: '#0f172a', alignment: 'center' },
      coverMeta: { fontSize: 9, color: '#475569', alignment: 'center', margin: [0, 1, 0, 0] },
      coverTitle: { fontSize: 22, bold: true, color: '#047857', alignment: 'center' },
      coverSubtitle: { fontSize: 10, color: '#475569', alignment: 'center', margin: [0, 0, 0, 12] },
      coverLabel: { fontSize: 8, bold: true, color: '#475569' },
      coverValue: { fontSize: 8, color: '#0f172a' },
      auditNote: { fontSize: 8, color: '#64748b', italics: true, lineHeight: 1.3 },
      sectionTitle: { fontSize: 17, bold: true, color: '#047857', margin: [0, 0, 0, 5] },
      sectionDescription: { fontSize: 8.5, color: '#64748b', margin: [0, 0, 0, 14] },
      summaryLabel: { fontSize: 8, bold: true, color: '#64748b', fillColor: '#f1f5f9', margin: [5, 4, 5, 4] },
      summaryValue: { fontSize: 8, bold: true, color: '#0f172a', margin: [5, 4, 5, 4] },
      tableTitle: { fontSize: 9, bold: true, color: '#0f172a', margin: [0, 0, 0, 5] },
      tableHeader: { fontSize: 6.5, bold: true, color: '#ffffff', alignment: 'left' },
      tableCell: { fontSize: 6.8, color: '#1e293b' },
      compactCell: { fontSize: 6.1, color: '#1e293b' },
      emptyCell: { fontSize: 7, color: '#64748b', italics: true, alignment: 'center' },
    },
    header: (pageNumber: number) => pageNumber === 1 ? null : {
      columns: [
        { text: cleanText(model.pharmacy.name, 'Apotek'), bold: true, color: '#047857', fontSize: 8 },
        { text: model.title, alignment: 'right', color: '#64748b', fontSize: 7.5 },
      ],
      margin: [AUDIT_PDF_MARGIN_PT, 2, AUDIT_PDF_MARGIN_PT, 0],
    },
    footer: (pageNumber: number, pageCount: number) => ({
      columns: [
        { text: `${cleanText(model.pharmacy.name, 'Apotek')} - ${cleanText(model.currentUser.name)}`, color: '#64748b', fontSize: 7 },
        { text: `Halaman ${pageNumber} dari ${pageCount}`, alignment: 'right', color: '#64748b', fontSize: 7 },
      ],
      margin: [AUDIT_PDF_MARGIN_PT, 0, AUDIT_PDF_MARGIN_PT, 0],
    }),
  };
  if (model.logoDataUrl) definition.images = { pharmacyLogo: model.logoDataUrl };
  return definition;
}
