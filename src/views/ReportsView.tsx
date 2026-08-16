import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDate, formatDateTime, getDaysUntilExpired, getExpiredStatus, getWIBDateString, isPpnTransaction, getItemIsPpn, formatStockDisplay } from '../utils/formatters';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Users,
  Stethoscope,
  Pill,
  Clock,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Calculator,
  SlidersHorizontal,
  RotateCcw,
  Search,
  CheckCircle2,
  Eye,
  X,
  ShoppingBag,
  UserCheck,
  CreditCard,
  ChevronRight,
  Package,
  Download,
} from 'lucide-react';

const PaginationControls = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void, totalItems: number, itemsPerPage: number }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl text-xs">
      <span className="text-slate-500 font-medium">
        Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} entri
      </span>
      <div className="flex items-center gap-1.5">
        <button 
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs"
        >
          Sebelumnya
        </button>
        <span className="px-2 py-1 font-bold text-slate-700 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px]">
          {currentPage} / {totalPages}
        </span>
        <button 
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
};

export type ReportTabType = 'penjualan' | 'customer' | 'dokter' | 'stok' | 'expired' | 'pajak_ppn' | 'produk_obat' | 'produk_non_obat';

interface ReportsViewProps {
  initialTab?: ReportTabType;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ initialTab = 'penjualan' }) => {
  const {
    transactions,
    customers,
    doctors,
    medicines,
    stockHistory,
    setActiveTab,
    setLastTransaction,
    setIsReceiptModalOpen,
  } = useApp();

  const todayStr = getWIBDateString();

  const [activeReportTab, setActiveReportTab] = useState<ReportTabType>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveReportTab(initialTab);
    }
  }, [initialTab]);

  const [taxReportFilter, setTaxReportFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');

  // Penjualan Filter Date & Controls (Default: Hari ini / 1_day)
  const [salesPreset, setSalesPreset] = useState<string>('1_day');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Advance Filter Controls for Reports
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>('all');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAdvanceFilters, setShowAdvanceFilters] = useState<boolean>(false);
  const [salesSubView, setSalesSubView] = useState<'trx' | 'items'>('trx');

  // Search & Filter State for Operational Report Tabs
  const [searchPenjualan, setSearchPenjualan] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<any | null>(null);
  const [searchDokter, setSearchDokter] = useState('');
  const [selectedDoctorDetail, setSelectedDoctorDetail] = useState<any | null>(null);
  const [searchStok, setSearchStok] = useState('');
  const [searchExpired, setSearchExpired] = useState('');
  const [selectedTrxDetail, setSelectedTrxDetail] = useState<any | null>(null);
  const [selectedMedicineDetail, setSelectedMedicineDetail] = useState<any | null>(null);
  const [selectedExpiredDetail, setSelectedExpiredDetail] = useState<any | null>(null);

  // Pagination States
  const [penjualanPage, setPenjualanPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [dokterPage, setDokterPage] = useState(1);
  const [stokPage, setStokPage] = useState(1);
  const [expiredPage, setExpiredPage] = useState(1);
  const [pajakPpnPage, setPajakPpnPage] = useState(1);
  const [reportObatPage, setReportObatPage] = useState(1);
  const [reportNonObatPage, setReportNonObatPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Pagination for Detail Modals
  const [modalCustomerPage, setModalCustomerPage] = useState(1);
  const [modalDoctorPage, setModalDoctorPage] = useState(1);
  const [modalMedicineTrxPage, setModalMedicineTrxPage] = useState(1);
  const [modalMedicineHistoryPage, setModalMedicineHistoryPage] = useState(1);
  const [modalTrxItemsPage, setModalTrxItemsPage] = useState(1);
  const MODAL_ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setModalCustomerPage(1);
  }, [selectedCustomerDetail]);

  useEffect(() => {
    setModalDoctorPage(1);
  }, [selectedDoctorDetail]);

  useEffect(() => {
    setModalMedicineTrxPage(1);
    setModalMedicineHistoryPage(1);
  }, [selectedMedicineDetail]);

  useEffect(() => {
    setModalTrxItemsPage(1);
  }, [selectedTrxDetail]);

  useEffect(() => {
    setPenjualanPage(1);
  }, [searchPenjualan, startDate, endDate, methodFilter, prescriptionFilter, cashierFilter, doctorFilter, customerFilter, salesSubView]);

  useEffect(() => {
    setCustomerPage(1);
  }, [searchCustomer, startDate, endDate]);

  useEffect(() => {
    setDokterPage(1);
  }, [searchDokter, startDate, endDate]);

  useEffect(() => {
    setStokPage(1);
  }, [searchStok, categoryFilter]);

  useEffect(() => {
    setExpiredPage(1);
  }, [searchExpired, categoryFilter]);

  useEffect(() => {
    setPajakPpnPage(1);
  }, [taxReportFilter, startDate, endDate, searchPenjualan]);

  useEffect(() => {
    setReportObatPage(1);
  }, [startDate, endDate, taxReportFilter, categoryFilter, searchPenjualan]);

  useEffect(() => {
    setReportNonObatPage(1);
  }, [startDate, endDate, taxReportFilter, categoryFilter, searchPenjualan]);

  // Preset Date Selection Handler for Reports
  const handleSalesPresetChange = (preset: string) => {
    setSalesPreset(preset);
    if (preset === 'custom') {
      if (!startDate) setStartDate(todayStr);
      if (!endDate) setEndDate(todayStr);
      return;
    }

    const parts = todayStr.split('-').map(Number);
    const now = new Date(parts[0], parts[1] - 1, parts[2]);

    if (preset === '1_day') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 1);
      const s = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7_days') {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 6);
      const s = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === '30_days') {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 29);
      const s = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const s = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'this_year') {
      const s = `${parts[0]}-01-01`;
      setStartDate(s);
      setEndDate(todayStr);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setSalesPreset('custom');
    if (endDate && val > endDate) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setSalesPreset('custom');
    if (startDate && val < startDate) {
      setStartDate(val);
    }
  };

  const handleResetFilters = () => {
    setSalesPreset('1_day');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setMethodFilter('all');
    setPrescriptionFilter('all');
    setCashierFilter('all');
    setDoctorFilter('all');
    setCustomerFilter('all');
    setCategoryFilter('all');
    setTaxReportFilter('all');
    setSearchPenjualan('');
  };



  // Options for Dropdowns
  const cashierOptions = Array.from(new Set(transactions.map(t => t.cashierName).filter(Boolean)));
  const doctorOptions = Array.from(new Set(doctors.map(d => d.name).filter(Boolean)));
  const categoryOptions = Array.from(new Set(medicines.map(m => m.category).filter(Boolean)));

  // Filter Sales Transactions based on period, advance filters, and search query
  const filteredSalesTransactions = transactions.filter(t => {
    if (t.status !== 'Selesai') return false;
    const tDate = t.date ? t.date.slice(0, 10) : '';

    // Date Range Check
    if (startDate && tDate < startDate) return false;
    if (endDate && tDate > endDate) return false;

    // Payment Method Match
    if (methodFilter !== 'all' && t.paymentMethod !== methodFilter) return false;

    // Prescription Match
    if (prescriptionFilter === 'resep' && !t.isPrescription) return false;
    if (prescriptionFilter === 'non-resep' && t.isPrescription) return false;

    // Cashier Match
    if (cashierFilter !== 'all' && t.cashierName.toLowerCase() !== cashierFilter.toLowerCase()) return false;

    // Doctor Match
    if (doctorFilter !== 'all' && t.doctorName !== doctorFilter) return false;

    // Customer Match
    if (customerFilter === 'member' && !t.customerMemberNo) return false;
    if (customerFilter === 'umum' && t.customerMemberNo) return false;

    // Tax Filter (PPN vs NON_PPN)
    if (taxReportFilter !== 'all') {
      const isPpn = isPpnTransaction(t);
      if (taxReportFilter === 'PPN' && !isPpn) return false;
      if (taxReportFilter === 'NON_PPN' && isPpn) return false;
    }

    // Search Penjualan Query Match
    if (searchPenjualan.trim()) {
      const q = searchPenjualan.toLowerCase();
      const matchesNo = t.trxNo.toLowerCase().includes(q);
      const matchesCust = (t.customerName || '').toLowerCase().includes(q);
      const matchesDoc = (t.doctorName || '').toLowerCase().includes(q);
      const matchesCashier = (t.cashierName || '').toLowerCase().includes(q);
      const matchesItems = t.items.some(
        i => i.medicineName.toLowerCase().includes(q) || (i.medicineCode || '').toLowerCase().includes(q)
      );
      if (!matchesNo && !matchesCust && !matchesDoc && !matchesCashier && !matchesItems) return false;
    }

    return true;
  });

  const activeFiltersCount =
    (methodFilter !== 'all' ? 1 : 0) +
    (prescriptionFilter !== 'all' ? 1 : 0) +
    (cashierFilter !== 'all' ? 1 : 0) +
    (doctorFilter !== 'all' ? 1 : 0) +
    (customerFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (taxReportFilter !== 'all' ? 1 : 0) +
    (salesPreset !== '1_day' ? 1 : 0) +
    (searchPenjualan ? 1 : 0);

  const totalSalesAmount = filteredSalesTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalItemsSold = filteredSalesTransactions.reduce(
    (sum, t) => sum + t.items.reduce((iSum, item) => iSum + item.qty, 0),
    0
  );
  const totalCommission = filteredSalesTransactions.reduce(
    (sum, t) => sum + (t.commissionAmount || 0),
    0
  );
  const avgOrderValue =
    filteredSalesTransactions.length > 0
      ? Math.round(totalSalesAmount / filteredSalesTransactions.length)
      : 0;

  // Prescription Percentage Statistics
  const prescriptionTrxs = filteredSalesTransactions.filter(t => t.isPrescription);
  const prescriptionTrxCount = prescriptionTrxs.length;
  const totalTrxCount = filteredSalesTransactions.length;
  const prescriptionTrxPct = totalTrxCount > 0 ? Math.round((prescriptionTrxCount / totalTrxCount) * 100) : 0;
  const prescriptionOmset = prescriptionTrxs.reduce((sum, t) => sum + t.totalAmount, 0);
  const prescriptionOmsetPct = totalSalesAmount > 0 ? Math.round((prescriptionOmset / totalSalesAmount) * 100) : 0;

  // Tax Metrics Breakdown for Sales
  const salesPpnTrxs = filteredSalesTransactions.filter(isPpnTransaction);
  const salesNonPpnTrxs = filteredSalesTransactions.filter(t => !isPpnTransaction(t));
  const salesDppAmount = salesPpnTrxs.reduce((sum, t) => {
    const rate = t.ppnRate || 11;
    return sum + (t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100)));
  }, 0);
  const salesPpnAmount = salesPpnTrxs.reduce((sum, t) => {
    const rate = t.ppnRate || 11;
    const dpp = t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100));
    return sum + (t.ppnAmount ?? (t.totalAmount - dpp));
  }, 0);
  const salesNonPpnOmset = salesNonPpnTrxs.reduce((sum, t) => sum + t.totalAmount, 0);

  // Product sales breakdown aggregation (with category filter applied if selected)
  const productSalesMap = new Map<
    string,
    { code: string; name: string; unit: string; totalQty: number; totalRevenue: number; transactionCount: number }
  >();

  filteredSalesTransactions.forEach(t => {
    t.items.forEach(item => {
      // Find matching medicine to check category
      const matchedMed = medicines.find(
        m => m.id === item.medicineId || m.code === item.medicineCode || m.name === item.medicineName
      );

      if (categoryFilter !== 'all' && matchedMed && matchedMed.category !== categoryFilter) {
        return;
      }

      const key = item.medicineId || item.medicineCode || item.medicineName;
      const existing = productSalesMap.get(key) || {
        code: item.medicineCode || '-',
        name: item.medicineName,
        unit: item.unit,
        totalQty: 0,
        totalRevenue: 0,
        transactionCount: 0,
      };
      existing.totalQty += item.qty;
      existing.totalRevenue += item.subtotal;
      existing.transactionCount += 1;
      productSalesMap.set(key, existing);
    });
  });

  const productSalesList = Array.from(productSalesMap.values()).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  const filteredProductSalesList = productSalesList.filter(p => {
    if (!searchPenjualan.trim()) return true;
    const q = searchPenjualan.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    );
  });

  // Expired categories
  const expiredItems = medicines.filter(m => getDaysUntilExpired(m.expiredDate) < 0 && m.isActive);
  const exp30Items = medicines.filter(m => {
    const d = getDaysUntilExpired(m.expiredDate);
    return d >= 0 && d <= 30 && m.isActive;
  });
  const exp60Items = medicines.filter(m => {
    const d = getDaysUntilExpired(m.expiredDate);
    return d > 30 && d <= 60 && m.isActive;
  });
  const exp90Items = medicines.filter(m => {
    const d = getDaysUntilExpired(m.expiredDate);
    return d > 60 && d <= 90 && m.isActive;
  });

  // Helper to get real completed transactions for a customer
  const getCustomerTransactions = (cust?: { id?: string; memberNo?: string; name: string }) => {
    if (!cust) return [];
    return transactions.filter(t => {
      if (t.status !== 'Selesai') return false;
      if (cust.id && t.customerId === cust.id) return true;
      if (cust.memberNo && t.customerMemberNo === cust.memberNo) return true;
      if (cust.name && t.customerName && t.customerName.toLowerCase() === cust.name.toLowerCase()) return true;
      return false;
    });
  };

  // Filtered Customer Report List
  const filteredReportCustomers = customers
    .filter(c => {
      if (searchCustomer.trim()) {
        const q = searchCustomer.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.memberNo.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const spentA = getCustomerTransactions(a).reduce((s, t) => s + t.totalAmount, 0);
      const spentB = getCustomerTransactions(b).reduce((s, t) => s + t.totalAmount, 0);
      if (spentB !== spentA) return spentB - spentA;
      return a.name.localeCompare(b.name);
    });

  // Aggregates for Customer Report
  const totalCustomerCount = filteredReportCustomers.length;
  const totalCustomerSpentSum = filteredReportCustomers.reduce((sum, c) => {
    const custTrxs = getCustomerTransactions(c);
    return sum + custTrxs.reduce((s, t) => s + t.totalAmount, 0);
  }, 0);
  const totalCustomerTrxSum = filteredReportCustomers.reduce((sum, c) => {
    const custTrxs = getCustomerTransactions(c);
    return sum + custTrxs.length;
  }, 0);
  const avgCustomerSpent = totalCustomerCount > 0 ? Math.round(totalCustomerSpentSum / totalCustomerCount) : 0;

  // Helper to get real completed transactions for a doctor
  const getDoctorTransactions = (doc?: { id?: string; name: string }) => {
    if (!doc) return [];
    return transactions.filter(t => {
      if (t.status !== 'Selesai') return false;
      if (doc.id && t.doctorId === doc.id) return true;
      if (doc.name && t.doctorName && t.doctorName.toLowerCase() === doc.name.toLowerCase()) return true;
      return false;
    });
  };

  // Filtered Dokter Report List
  const filteredReportDoctors = doctors
    .filter(d => {
      if (!searchDokter.trim()) return true;
      const q = searchDokter.toLowerCase();
      return d.name.toLowerCase().includes(q) || (d.phone || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const trxsA = getDoctorTransactions(a);
      const trxsB = getDoctorTransactions(b);
      if (trxsB.length !== trxsA.length) return trxsB.length - trxsA.length;
      const spentA = trxsA.reduce((s, t) => s + t.totalAmount, 0);
      const spentB = trxsB.reduce((s, t) => s + t.totalAmount, 0);
      return spentB - spentA;
    });

  // Aggregates for Dokter Report
  const totalDoctorCount = filteredReportDoctors.length;
  const totalDoctorTrxSum = filteredReportDoctors.reduce((sum, d) => {
    const docTrxs = getDoctorTransactions(d);
    return sum + docTrxs.length;
  }, 0);
  const totalDoctorSpentSum = filteredReportDoctors.reduce((sum, d) => {
    const docTrxs = getDoctorTransactions(d);
    return sum + docTrxs.reduce((s, t) => s + t.totalAmount, 0);
  }, 0);
  const avgDoctorTrx = totalDoctorCount > 0 ? (totalDoctorTrxSum / totalDoctorCount).toFixed(1) : '0';

  // Filtered Stok Report List
  const filteredReportMedicines = medicines.filter(m => {
    if (!searchStok.trim()) return true;
    const q = searchStok.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q)
    );
  });

  // Filtered Expired Report List
  const allExpiredItemsList = [...expiredItems, ...exp30Items, ...exp60Items, ...exp90Items].filter(m => {
    if (!searchExpired.trim()) return true;
    const q = searchExpired.toLowerCase();
    const statusLabel = getExpiredStatus(m.expiredDate).label.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      statusLabel.includes(q)
    );
  });

  const paginatedSalesTransactions = filteredSalesTransactions.slice((penjualanPage - 1) * ITEMS_PER_PAGE, penjualanPage * ITEMS_PER_PAGE);
  const paginatedProductSalesList = filteredProductSalesList.slice((penjualanPage - 1) * ITEMS_PER_PAGE, penjualanPage * ITEMS_PER_PAGE);
  const paginatedReportCustomers = filteredReportCustomers.slice((customerPage - 1) * ITEMS_PER_PAGE, customerPage * ITEMS_PER_PAGE);
  const paginatedReportDoctors = filteredReportDoctors.slice((dokterPage - 1) * ITEMS_PER_PAGE, dokterPage * ITEMS_PER_PAGE);
  const paginatedReportMedicines = filteredReportMedicines.slice((stokPage - 1) * ITEMS_PER_PAGE, stokPage * ITEMS_PER_PAGE);
  const paginatedExpiredItemsList = allExpiredItemsList.slice((expiredPage - 1) * ITEMS_PER_PAGE, expiredPage * ITEMS_PER_PAGE);

  const isTaxMode = ['pajak_ppn', 'produk_obat', 'produk_non_obat'].includes(activeReportTab);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isTaxMode ? 'Laporan Perpajakan Apotek' : 'Laporan Operasional Apotek'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isTaxMode
              ? 'Rekapitulasi Faktur Penjualan PPN 11% & Nota Non-PPN, Dasar Pengenaan Pajak (DPP), dan rincian PPN per item.'
              : 'Rekapitulasi penjualan, analisis pelanggan, rujukan dokter, status stok, dan audit kadaluwarsa.'}
          </p>
        </div>
      </div>

      {/* Main Report Category Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-5 text-xs font-bold overflow-x-auto scrollbar-none">
        {isTaxMode ? (
          <>
            <button
              onClick={() => {
                setActiveReportTab('pajak_ppn');
                setActiveTab('report-pajak-ppn');
              }}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors font-bold ${
                activeReportTab === 'pajak_ppn'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calculator className="w-4 h-4 text-blue-600" />
              1. Rekap Pajak PPN & Non-PPN
            </button>

            <button
              onClick={() => {
                setActiveReportTab('produk_obat');
                setActiveTab('report-obat');
              }}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'produk_obat'
                  ? 'border-emerald-600 text-emerald-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Pill className="w-4 h-4 text-emerald-600" />
              2. Laporan Produk Obat
            </button>

            <button
              onClick={() => {
                setActiveReportTab('produk_non_obat');
                setActiveTab('report-non-obat');
              }}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'produk_non_obat'
                  ? 'border-indigo-600 text-indigo-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-4 h-4 text-indigo-600" />
              3. Laporan Non-Obat
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveReportTab('penjualan')}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'penjualan'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              1. Laporan Penjualan
            </button>

            <button
              onClick={() => setActiveReportTab('customer')}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'customer'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              2. Laporan Customer
            </button>

            <button
              onClick={() => setActiveReportTab('dokter')}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'dokter'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              3. Laporan Dokter
            </button>

            <button
              onClick={() => setActiveReportTab('stok')}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'stok'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              4. Laporan Stok
            </button>

            <button
              onClick={() => setActiveReportTab('expired')}
              className={`pb-3 flex items-center gap-1.5 border-b-2 shrink-0 transition-colors ${
                activeReportTab === 'expired'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              5. Laporan Expired
            </button>
          </>
        )}
      </div>

      {/* REPORT CONTENT 1: PENJUALAN */}
      {activeReportTab === 'penjualan' && (
        <div className="space-y-4">
          {/* Controls Bar & Advance Filter Panel */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5 text-xs">
            {/* ROW 1: Preset Date Selector & Main Date Range Picker */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Presets */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-slate-100/90 p-1 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 px-2 shrink-0 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Rentang Laporan:
                </span>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('1_day')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === '1_day' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hari Ini (1 Hari)
                </button>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('yesterday')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === 'yesterday' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('7_days')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === '7_days' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('30_days')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === '30_days' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('this_month')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === 'this_month' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleSalesPresetChange('custom')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    salesPreset === 'custom' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kustom
                </button>
              </div>

              {/* Date Input Pickers */}
              {salesPreset === 'custom' && (
                <div className="flex items-center gap-2 shrink-0 transition-all duration-300">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold">Dari:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
                    />
                  </div>
                  <span className="text-slate-400 font-bold text-xs">s/d</span>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold">Sampai:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => handleEndDateChange(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ROW 2: Filter Toolbar & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
                {/* Search Penjualan input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari Trx, Pasien, Kasir, Dokter, Obat..."
                    value={searchPenjualan}
                    onChange={e => setSearchPenjualan(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700 text-xs focus:ring-2 focus:ring-emerald-500 outline-none w-full"
                  />
                </div>

                {/* Method filter */}
                <select
                  value={methodFilter}
                  onChange={e => setMethodFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none text-xs"
                >
                  <option value="all">Semua Metode Pembayaran</option>
                  <option value="Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer</option>
                </select>

                {/* Prescription filter */}
                <select
                  value={prescriptionFilter}
                  onChange={e => setPrescriptionFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none text-xs"
                >
                  <option value="all">Semua Jenis Resep</option>
                  <option value="resep">Resep Dokter</option>
                  <option value="non-resep">Non-Resep (Bebas)</option>
                </select>

                {/* Tax Category Filter */}
                <select
                  value={taxReportFilter}
                  onChange={e => setTaxReportFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/80 font-bold text-blue-900 focus:outline-none text-xs"
                >
                  <option value="all">Semua Pajak (PPN & Non-PPN)</option>
                  <option value="PPN">Faktur PPN (11%)</option>
                  <option value="NON_PPN">Nota Non-PPN</option>
                </select>

                {/* Toggle Advance Filters button */}
                <button
                  type="button"
                  onClick={() => setShowAdvanceFilters(!showAdvanceFilters)}
                  className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition-all text-xs ${
                    showAdvanceFilters || activeFiltersCount > 0
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Filter Advance Laporan</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Reset Filter"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>

            {/* EXPANDABLE ADVANCE FILTERS PANEL FOR REPORTS */}
            {showAdvanceFilters && (
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn mt-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                    Parameter Filter Lanjutan Laporan
                  </span>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-[11px] text-slate-500 hover:text-rose-600 underline font-semibold"
                  >
                    Reset Semua
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Kasir */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Petugas Kasir
                    </label>
                    <select
                      value={cashierFilter}
                      onChange={e => setCashierFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                    >
                      <option key="all" value="all">Semua Kasir</option>
                      {cashierOptions.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dokter Rujukan */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Dokter Rujukan
                    </label>
                    <select
                      value={doctorFilter}
                      onChange={e => setDoctorFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                    >
                      <option key="all" value="all">Semua Dokter</option>
                      {doctorOptions.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipe Customer */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Tipe Pasien / Pelanggan
                    </label>
                    <select
                      value={customerFilter}
                      onChange={e => setCustomerFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                    >
                      <option value="all">Semua Pasien</option>
                      <option value="member">Pelanggan Member</option>
                      <option value="umum">Pasien Umum (Non-Member)</option>
                    </select>
                  </div>

                  {/* Kategori Obat */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Kategori Produk Obat
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none text-xs"
                    >
                      <option key="all" value="all">Semua Kategori Obat</option>
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Jenis Perpajakan */}
                  <div>
                    <label className="block text-[10px] font-bold text-blue-800 mb-1">
                      Kategori Perpajakan (PPN)
                    </label>
                    <select
                      value={taxReportFilter}
                      onChange={e => setTaxReportFilter(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 font-bold text-blue-900 focus:outline-none text-xs"
                    >
                      <option value="all">Semua (PPN & Non-PPN)</option>
                      <option value="PPN">Khusus Faktur PPN 11%</option>
                      <option value="NON_PPN">Khusus Nota Non-PPN</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metric Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Total Omset Penjualan</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700">{formatRupiah(totalSalesAmount)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Total Transaksi</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{filteredSalesTransactions.length} Trx</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium flex items-center justify-between">
                <span>Persentase Resep</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {prescriptionTrxPct}% Resep
                </span>
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-700">{prescriptionTrxCount} Resep</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                {prescriptionTrxPct}% dari total {totalTrxCount} transaksi
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-xs text-slate-500 block font-medium">Omset Resep Dokter</span>
              <span className="text-xl sm:text-2xl font-black text-purple-700">{formatRupiah(prescriptionOmset)}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                Kontribusi {prescriptionOmsetPct}% dari total omset
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs col-span-2 lg:col-span-1">
              <span className="text-xs text-slate-500 block font-medium">Unit Obat Terjual</span>
              <span className="text-xl sm:text-2xl font-black text-blue-700">{totalItemsSold} Item</span>
            </div>
          </div>

          {/* Tax Category Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-blue-900 block uppercase tracking-wider">Faktur PPN (DPP Bersih)</span>
                <span className="text-sm font-black text-blue-950">{formatRupiah(salesDppAmount)}</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded-full">{salesPpnTrxs.length} Faktur PPN</span>
            </div>

            <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-l border-blue-200/80 pt-2 sm:pt-0 sm:pl-3">
              <div>
                <span className="text-[10px] font-extrabold text-amber-900 block uppercase tracking-wider">PPN Terutang Output (11%)</span>
                <span className="text-sm font-black text-amber-700">{formatRupiah(salesPpnAmount)}</span>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">Pajak Output</span>
            </div>

            <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-l border-blue-200/80 pt-2 sm:pt-0 sm:pl-3">
              <div>
                <span className="text-[10px] font-extrabold text-slate-700 block uppercase tracking-wider">Omset Penjualan Non-PPN</span>
                <span className="text-sm font-black text-slate-900">{formatRupiah(salesNonPpnOmset)}</span>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-800 font-extrabold px-2 py-0.5 rounded-full">{salesNonPpnTrxs.length} Nota Non-PPN</span>
            </div>
          </div>

          {/* Sub-view Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
            <button
              onClick={() => setSalesSubView('trx')}
              className={`px-3.5 py-1.5 rounded-xl transition-colors ${
                salesSubView === 'trx'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Daftar Transaksi ({filteredSalesTransactions.length})
            </button>
            <button
              onClick={() => setSalesSubView('items')}
              className={`px-3.5 py-1.5 rounded-xl transition-colors ${
                salesSubView === 'items'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Rincian Obat Terjual ({productSalesList.length} Jenis)
            </button>
          </div>

          {/* SUBVIEW 1: Daftar Transaksi */}
          {salesSubView === 'trx' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              {/* Mobile & Tablet Card List */}
              <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
                {paginatedSalesTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                    Tidak ada data transaksi penjualan pada periode ini.
                  </div>
                ) : (
                  paginatedSalesTransactions.map(t => {
                    const isPpn = isPpnTransaction(t);
                    return (
                      <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs">{t.trxNo}</span>
                            {t.isPrescription ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-extrabold">
                                Resep ({t.prescriptionMarkupRate ?? 20}%)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                                Non-Resep
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                              isPpn ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isPpn ? 'PPN 11%' : 'Non-PPN'}
                            </span>
                          </div>
                          <span className="font-extrabold text-emerald-700 text-sm">{formatRupiah(t.totalAmount)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                          <span>Waktu: {formatDateTime(t.date)}</span>
                          <span className="text-right">Metode: <strong className="text-slate-800">{t.paymentMethod}</strong></span>
                          <span>Customer: <strong className="text-slate-800">{t.customerName || 'Umum'}</strong></span>
                          <span className="text-right">Dokter: <strong className="text-indigo-700">{t.doctorName || '-'}</strong></span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                          <button
                            onClick={() => setSelectedTrxDetail(t)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-lg flex items-center gap-1 text-[11px] transition-colors border border-blue-200"
                          >
                            <Eye className="w-3 h-3" /> Detail
                          </button>
                          <button
                            onClick={() => {
                              setLastTransaction(t);
                              setIsReceiptModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 text-[11px] transition-colors"
                          >
                            <Printer className="w-3 h-3" /> Struk
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">No TRX</th>
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Jenis & Persentase Resep</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Dokter</th>
                      <th className="py-3 px-4">Metode</th>
                      <th className="py-3 px-4 text-center">Status Perpajakan</th>
                      <th className="py-3 px-4 text-right">Total Omset</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSalesTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Tidak ada data transaksi penjualan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedSalesTransactions.map(t => {
                        const isPpn = isPpnTransaction(t);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{t.trxNo}</td>
                            <td className="py-2.5 px-4 text-slate-500">{formatDateTime(t.date)}</td>
                            <td className="py-2.5 px-4">
                              {t.isPrescription ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-extrabold">
                                  <Stethoscope className="w-3 h-3 text-indigo-600" />
                                  Resep (Markup {t.prescriptionMarkupRate ?? 20}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">
                                  Non-Resep (Bebas)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{t.customerName || 'Umum'}</td>
                            <td className="py-2.5 px-4 text-indigo-700 font-semibold">{t.doctorName || '-'}</td>
                            <td className="py-2.5 px-4 text-slate-600">{t.paymentMethod}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                isPpn
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {isPpn ? 'PPN 11%' : 'Non-PPN'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{formatRupiah(t.totalAmount)}</td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setSelectedTrxDetail(t)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg transition-colors border border-blue-200 font-bold text-xs"
                                  title="Detail Transaksi"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setLastTransaction(t);
                                    setIsReceiptModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-bold text-xs"
                                  title="Cetak Struk"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredSalesTransactions.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs text-slate-900">
                        <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider">Total Omset Penjualan Terfilter:</td>
                        <td className="py-3 px-4 text-right text-emerald-800 font-black text-sm">{formatRupiah(totalSalesAmount)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <PaginationControls
                currentPage={penjualanPage}
                totalPages={Math.ceil(filteredSalesTransactions.length / ITEMS_PER_PAGE)}
                onPageChange={setPenjualanPage}
                totalItems={filteredSalesTransactions.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}

          {/* SUBVIEW 2: Rincian Obat Terjual */}
          {salesSubView === 'items' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              {/* Mobile & Tablet Card List */}
              <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
                {paginatedProductSalesList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                    Tidak ada item obat yang sesuai dengan pencarian / periode ini.
                  </div>
                ) : (
                  paginatedProductSalesList.map((p, idx) => {
                    const share = totalSalesAmount > 0 ? ((p.totalRevenue / totalSalesAmount) * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                        <div className="flex items-start justify-between border-b border-slate-100 pb-1.5">
                          <div>
                            <span className="font-mono text-slate-400 text-[10px] block">{p.code}</span>
                            <h5 className="font-bold text-slate-900">{p.name}</h5>
                          </div>
                          <span className="font-extrabold text-emerald-700 text-sm">{formatRupiah(p.totalRevenue)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Terjual:</span>
                            <strong className="text-blue-700">{p.totalQty} {p.unit}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Frekuensi:</span>
                            <strong className="text-slate-800">{p.transactionCount}x</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Kontribusi:</span>
                            <strong className="text-slate-800">{share}%</strong>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              const med = medicines.find(m => m.code === p.code || m.name === p.name);
                              if (med) setSelectedMedicineDetail(med);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg flex items-center gap-1 text-[11px] border border-emerald-200"
                          >
                            <Eye className="w-3 h-3" /> Detail Stok & Transaksi
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Kode / Nama Obat</th>
                      <th className="py-3 px-4">Kemasan</th>
                      <th className="py-3 px-4 text-center">Total Qty Terjual</th>
                      <th className="py-3 px-4 text-center">Frekuensi Transaksi</th>
                      <th className="py-3 px-4 text-right">Total Omset (Rp)</th>
                      <th className="py-3 px-4 text-right">Kontribusi Omset</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedProductSalesList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Tidak ada item obat yang sesuai dengan pencarian / periode ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedProductSalesList.map((p, idx) => {
                        const share = totalSalesAmount > 0 ? ((p.totalRevenue / totalSalesAmount) * 100).toFixed(1) : '0';
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4">
                              <span className="font-mono text-slate-400 block text-[10px]">{p.code}</span>
                              <span className="font-bold text-slate-900">{p.name}</span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{p.unit}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-blue-700">
                              {p.totalQty} {p.unit}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-700 font-semibold">
                              {p.transactionCount} x
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-emerald-700">
                              {formatRupiah(p.totalRevenue)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-600">
                              {share}%
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() => {
                                  const med = medicines.find(m => m.code === p.code || m.name === p.name);
                                  if (med) setSelectedMedicineDetail(med);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg inline-flex items-center gap-1 text-xs border border-emerald-200"
                              >
                                <Eye className="w-3.5 h-3.5" /> Detail
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={penjualanPage}
                totalPages={Math.ceil(filteredProductSalesList.length / ITEMS_PER_PAGE)}
                onPageChange={setPenjualanPage}
                totalItems={filteredProductSalesList.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
      )}

      {/* REPORT CONTENT 2: CUSTOMER */}
      {activeReportTab === 'customer' && (
        <div className="space-y-4">
          {/* Summary KPI Cards for Customer Report */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" /> Member Terdaftar
              </span>
              <div className="text-xl font-extrabold text-slate-900">{totalCustomerCount} Orang</div>
              <span className="text-[10px] text-slate-400 block">Sesuai Filter / Pencarian</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" /> Total Frekuensi Trx
              </span>
              <div className="text-xl font-extrabold text-slate-900">{totalCustomerTrxSum} x Transaksi</div>
              <span className="text-[10px] text-slate-400 block">Akumulasi Pembelian</span>
            </div>

            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-100 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-200" /> SUM Total Pembelian
              </span>
              <div className="text-xl font-black text-white">{formatRupiah(totalCustomerSpentSum)}</div>
              <span className="text-[10px] text-emerald-100 block">Total Omset Member</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> Rata-Rata Belanja
              </span>
              <div className="text-xl font-extrabold text-slate-900">{formatRupiah(avgCustomerSpent)}</div>
              <span className="text-[10px] text-slate-400 block">Per Customer Member</span>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari Nama, No Member, No HP Customer..."
                value={searchCustomer}
                onChange={e => setSearchCustomer(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {searchCustomer && (
                <button
                  onClick={() => setSearchCustomer('')}
                  className="px-3 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-xs transition-colors"
                >
                  Reset Cari
                </button>
              )}
            </div>
          </div>

          {/* Customer List Table & Cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {/* Mobile & Tablet Card List */}
            <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
              {paginatedReportCustomers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                  Tidak ada data customer yang sesuai dengan filter / pencarian.
                </div>
              ) : (
                paginatedReportCustomers.map(cust => {
                  const custTrxs = getCustomerTransactions(cust);
                  const realSpent = custTrxs.reduce((s, t) => s + t.totalAmount, 0);
                  const realTrxCount = custTrxs.length;

                  return (
                    <div key={cust.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div>
                          <span className="font-mono font-bold text-emerald-700 text-[11px] block">{cust.memberNo}</span>
                          <h5 className="font-bold text-slate-900 text-sm">{cust.name}</h5>
                          <span className="text-[11px] text-slate-500 block">No HP: {cust.phone}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Pembelian</span>
                          <span className="font-extrabold text-emerald-700 text-base">{formatRupiah(realSpent)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                          {realTrxCount}x Transaksi
                        </span>

                        <button
                          onClick={() => setSelectedCustomerDetail(cust)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg flex items-center gap-1.5 text-xs transition-colors border border-emerald-200"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail Transaksi
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">No Member</th>
                    <th className="py-3 px-4">Nama Customer</th>
                    <th className="py-3 px-4">No HP</th>
                    <th className="py-3 px-4 text-center">Total Frekuensi Transaksi</th>
                    <th className="py-3 px-4 text-right">Sum Total Pembelian (Rp)</th>
                    <th className="py-3 px-4 text-center">Aksi / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReportCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada data customer yang sesuai dengan filter / pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedReportCustomers.map(cust => {
                      const custTrxs = getCustomerTransactions(cust);
                      const realSpent = custTrxs.reduce((s, t) => s + t.totalAmount, 0);
                      const realTrxCount = custTrxs.length;

                      return (
                        <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700">{cust.memberNo}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{cust.name}</span>
                            {cust.address && <span className="text-[10px] text-slate-400 block">{cust.address}</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{cust.phone}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                              {realTrxCount} x Transaksi
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                            {formatRupiah(realSpent)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedCustomerDetail(cust)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl inline-flex items-center gap-1.5 text-xs transition-colors border border-emerald-200"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail Transaksi
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={customerPage}
              totalPages={Math.ceil(filteredReportCustomers.length / ITEMS_PER_PAGE)}
              onPageChange={setCustomerPage}
              totalItems={filteredReportCustomers.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DETAIL TRANSAKSI PER CUSTOMER */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
            {/* Header Modal */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      {selectedCustomerDetail.memberNo}
                    </span>
                    <h3 className="font-extrabold text-lg text-white">{selectedCustomerDetail.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    No. HP: {selectedCustomerDetail.phone} • Status Member: {selectedCustomerDetail.status || 'Aktif'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCustomerDetail(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              {/* Highlight Cards for Selected Customer */}
              {(() => {
                const custTrxs = getCustomerTransactions(selectedCustomerDetail);
                const realSpent = custTrxs.reduce((s, t) => s + t.totalAmount, 0);
                const realTrxCount = custTrxs.length;
                const avgSpent = realTrxCount > 0 ? Math.round(realSpent / realTrxCount) : 0;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-slate-400 text-xs font-bold uppercase block">Total Frekuensi Pembelian</span>
                      <span className="text-xl font-extrabold text-slate-900 mt-1 block">{realTrxCount} x Transaksi</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                      <span className="text-emerald-700 text-xs font-bold uppercase block">SUM Total Pembelian Member</span>
                      <span className="text-xl font-black text-emerald-700 mt-1 block">{formatRupiah(realSpent)}</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-slate-400 text-xs font-bold uppercase block">Rata-Rata Nilai Belanja</span>
                      <span className="text-xl font-extrabold text-slate-900 mt-1 block">{formatRupiah(avgSpent)}</span>
                    </div>
                  </div>
                );
              })()}              {/* Detail Table of Customer Transactions */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Rincian Riwayat Transaksi Penjualan Customer
                  </h4>
                  <span className="text-xs font-bold text-slate-500">
                    {getCustomerTransactions(selectedCustomerDetail).length} Transaksi Tercatat
                  </span>
                </div>
                {(() => {
                  const custTrxs = getCustomerTransactions(selectedCustomerDetail);
                  const paginatedCustTrxs = custTrxs.slice((modalCustomerPage - 1) * MODAL_ITEMS_PER_PAGE, modalCustomerPage * MODAL_ITEMS_PER_PAGE);
                  
                  if (custTrxs.length === 0) {
                    return (
                      <div className="p-8 text-center space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-slate-500 text-xs font-semibold">
                          Belum ada rincian transaksi kasir terbaru yang tersimpan untuk customer ini.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Total Pembelian: <strong>Rp 0</strong> (0x transaksi).
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-3">No. Transaksi</th>
                              <th className="py-2.5 px-3">Tanggal & Waktu</th>
                              <th className="py-2.5 px-3">Metode & Petugas</th>
                              <th className="py-2.5 px-3">Rincian Obat / Barang</th>
                              <th className="py-2.5 px-3 text-right">Total (Rp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedCustTrxs.map(t => (
                              <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 align-top font-mono font-bold text-emerald-700">
                              {t.trxNo}
                              {t.isPrescription && (
                                <span className="block mt-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded w-fit border border-indigo-200">
                                  Resep Dokter
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top text-slate-600 font-medium whitespace-nowrap">
                              {formatDateTime(t.date)}
                            </td>
                            <td className="py-3 px-3 align-top space-y-1">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {t.paymentMethod}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                Kasir: <strong>{t.cashierName}</strong>
                              </div>
                              {t.doctorName && (
                                <div className="text-[10px] text-indigo-600 font-medium">
                                  Dokter: {t.doctorName}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="space-y-1">
                                {t.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                    <span className="font-semibold text-slate-800">{item.medicineName}</span>
                                    <span className="font-mono text-slate-600 text-[10px]">
                                      {item.qty} {item.unit} x {formatRupiah(item.price)} = <strong>{formatRupiah(item.subtotal)}</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top text-right font-extrabold text-emerald-700 text-sm whitespace-nowrap">
                              {formatRupiah(t.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={modalCustomerPage}
                    totalPages={Math.ceil(custTrxs.length / MODAL_ITEMS_PER_PAGE)}
                    onPageChange={setModalCustomerPage}
                    totalItems={custTrxs.length}
                    itemsPerPage={MODAL_ITEMS_PER_PAGE}
                  />
                  </div>
                );
              })()}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCustomerDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* MODAL / DRAWER DETAIL TRANSAKSI PER DOKTER */}
      {selectedDoctorDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
            {/* Header Modal */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30 font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-lg text-white">{selectedDoctorDetail.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedDoctorDetail.status === 'Aktif'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {selectedDoctorDetail.status || 'Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    No. HP: {selectedDoctorDetail.phone || '-'} • Dokter Mitra Resep
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDoctorDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Highlight Cards for Selected Doctor */}
              {(() => {
                const docTrxs = getDoctorTransactions(selectedDoctorDetail);
                const realSpent = docTrxs.reduce((s, t) => s + t.totalAmount, 0);
                const realTrxCount = docTrxs.length;
                const avgSpent = realTrxCount > 0 ? Math.round(realSpent / realTrxCount) : 0;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Total Resep Rujukan</div>
                      <div className="text-xl font-extrabold text-slate-800 mt-1">
                        {realTrxCount} <span className="text-xs font-semibold text-slate-500">Resep</span>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Total Nilai Resep</div>
                      <div className="text-xl font-extrabold text-emerald-700 mt-1">
                        {formatRupiah(realSpent)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Rata-Rata Nilai per Resep</div>
                      <div className="text-xl font-extrabold text-indigo-700 mt-1">
                        {formatRupiah(avgSpent)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Transactions History Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    Riwayat Transaksi Resep Rujukan
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {getDoctorTransactions(selectedDoctorDetail).length} Transaksi Tercatat
                  </span>
                </div>
                {(() => {
                  const docTrxs = getDoctorTransactions(selectedDoctorDetail);
                  const paginatedDocTrxs = docTrxs.slice((modalDoctorPage - 1) * MODAL_ITEMS_PER_PAGE, modalDoctorPage * MODAL_ITEMS_PER_PAGE);

                  if (docTrxs.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                        <p className="font-semibold text-slate-600">
                          Belum ada rincian transaksi kasir terbaru yang tersimpan untuk dokter ini.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Total Resep Historis: <strong>{selectedDoctorDetail.totalPrescriptions || 0}x resep</strong>.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-3">No. Transaksi</th>
                              <th className="py-3 px-3">Tanggal Waktu</th>
                              <th className="py-3 px-3">Pasien / Customer</th>
                              <th className="py-3 px-3">Kasir & Pembayaran</th>
                              <th className="py-3 px-3">Item Obat & Rincian</th>
                              <th className="py-3 px-3 text-right">Total Transaksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedDocTrxs.map(t => (
                              <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 align-top font-bold text-slate-900 whitespace-nowrap">
                              <div>{t.trxNo}</div>
                              {t.isPrescription && (
                                <span className="block mt-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded w-fit border border-indigo-200">
                                  Resep Dokter
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top text-slate-600 font-medium whitespace-nowrap">
                              {formatDateTime(t.date)}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="font-semibold text-slate-800">
                                {t.customerName || (t.customerId ? 'Member' : 'Pelanggan Umum')}
                              </div>
                              {t.customerMemberNo && (
                                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                                  {t.customerMemberNo}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top space-y-1">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {t.paymentMethod}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                Kasir: <strong>{t.cashierName}</strong>
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="space-y-1">
                                {t.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                    <span className="font-semibold text-slate-800">{item.medicineName}</span>
                                    <span className="font-mono text-slate-600 text-[10px]">
                                      {item.qty} {item.unit} x {formatRupiah(item.price)} = <strong>{formatRupiah(item.subtotal)}</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top text-right font-extrabold text-emerald-700 text-sm whitespace-nowrap">
                              {formatRupiah(t.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={modalDoctorPage}
                    totalPages={Math.ceil(docTrxs.length / MODAL_ITEMS_PER_PAGE)}
                    onPageChange={setModalDoctorPage}
                    totalItems={docTrxs.length}
                    itemsPerPage={MODAL_ITEMS_PER_PAGE}
                  />
                  </div>
                );
              })()}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedDoctorDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* REPORT CONTENT 3: DOKTER */}
      {activeReportTab === 'dokter' && (
        <div className="space-y-4">
          {/* Summary KPI Cards for Doctors */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Total Dokter Mitra</p>
                <h4 className="text-lg font-extrabold text-slate-900">{totalDoctorCount}</h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Total Resep Rujukan</p>
                <h4 className="text-lg font-extrabold text-slate-900">{totalDoctorTrxSum} <span className="text-xs font-normal text-slate-500">Resep</span></h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Total Nilai Resep</p>
                <h4 className="text-lg font-extrabold text-emerald-700">{formatRupiah(totalDoctorSpentSum)}</h4>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Rata-Rata Resep/Dokter</p>
                <h4 className="text-lg font-extrabold text-slate-900">{avgDoctorTrx} <span className="text-xs font-normal text-slate-500">Resep</span></h4>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <h3 className="font-bold text-slate-800 shrink-0">Laporan Rujukan Resep Dokter Mitra</h3>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari Nama Dokter, No HP..."
                  value={searchDokter}
                  onChange={e => setSearchDokter(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {/* Mobile & Tablet Card List */}
            <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
              {paginatedReportDoctors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                  Tidak ada data dokter yang sesuai dengan pencarian.
                </div>
              ) : (
                paginatedReportDoctors.map(doc => {
                  const docTrxs = getDoctorTransactions(doc);
                  const realSpent = docTrxs.reduce((s, t) => s + t.totalAmount, 0);
                  const realTrxCount = docTrxs.length || doc.totalPrescriptions;

                  return (
                    <div key={doc.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div>
                          <h5 className="font-bold text-slate-900">{doc.name}</h5>
                          <span className="text-[11px] text-slate-500">HP: {doc.phone || '-'}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {doc.status || 'Aktif'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Resep:</span>
                          <strong className="text-slate-800">{realTrxCount} Resep</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Nilai Resep:</span>
                          <strong className="text-emerald-700">{formatRupiah(realSpent)}</strong>
                        </div>
                      </div>
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => setSelectedDoctorDetail(doc)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-200"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail Transaksi
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Nama Dokter & Kontak</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Total Resep Rujukan</th>
                    <th className="py-3 px-4">Total Nilai Resep</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReportDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Tidak ada data dokter yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedReportDoctors.map(doc => {
                      const docTrxs = getDoctorTransactions(doc);
                      const realSpent = docTrxs.reduce((s, t) => s + t.totalAmount, 0);
                      const realTrxCount = docTrxs.length || doc.totalPrescriptions;

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">{doc.name}</div>
                            <div className="text-[11px] text-slate-500">HP: {doc.phone || '-'}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                doc.status === 'Aktif'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {doc.status || 'Aktif'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">{realTrxCount} Resep</td>
                          <td className="py-2.5 px-4 font-extrabold text-emerald-700">{formatRupiah(realSpent)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedDoctorDetail(doc)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors border border-indigo-200"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail Transaksi
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={dokterPage}
              totalPages={Math.ceil(filteredReportDoctors.length / ITEMS_PER_PAGE)}
              onPageChange={setDokterPage}
              totalItems={filteredReportDoctors.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      )}

      {/* REPORT CONTENT 4: STOK */}
      {activeReportTab === 'stok' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <h3 className="font-bold text-slate-800 shrink-0">Laporan Sediaan Obat & Peringatan Stok Menipis</h3>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari Kode, Nama Obat, Kategori, Lokasi..."
                  value={searchStok}
                  onChange={e => setSearchStok(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {/* Mobile & Tablet Card List */}
            <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
              {paginatedReportMedicines.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                  Tidak ada data stok obat yang sesuai dengan pencarian.
                </div>
              ) : (
                paginatedReportMedicines.map(m => {
                  const isLow = m.stock <= m.minStock;
                  return (
                    <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-1.5">
                        <div>
                          <span className="font-mono text-slate-400 text-[10px] block">{m.code}</span>
                          <h5 className="font-bold text-slate-900">{m.name}</h5>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLow ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLow ? 'STOK MENIPIS' : 'AMAN'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Kategori: <strong>{m.category}</strong></span>
                        <span className="font-bold text-slate-900">Stok: {formatStockDisplay(m.stock, m.unit, m.unitMultiplier)} (Min: {m.minStock})</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="font-extrabold text-emerald-700">Harga: {formatRupiah(m.price)}</span>
                        <button
                          onClick={() => setSelectedMedicineDetail(m)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg flex items-center gap-1 text-[11px] border border-emerald-200"
                        >
                          <Eye className="w-3 h-3" /> Detail & Riwayat
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Kode / Nama Obat</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Stok Fisik</th>
                    <th className="py-3 px-4">Batas Min</th>
                    <th className="py-3 px-4">Status Stok</th>
                    <th className="py-3 px-4 text-right">Harga Jual</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReportMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada data stok obat yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedReportMedicines.map(m => {
                      const isLow = m.stock <= m.minStock;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-slate-400 block text-[10px]">{m.code}</span>
                            <span className="font-bold text-slate-900">{m.name}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{m.category}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                            {formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{m.minStock} {m.unit}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isLow ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isLow ? 'STOK MENIPIS' : 'AMAN'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{formatRupiah(m.price)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedMedicineDetail(m)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg inline-flex items-center gap-1 text-xs border border-emerald-200"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={stokPage}
              totalPages={Math.ceil(filteredReportMedicines.length / ITEMS_PER_PAGE)}
              onPageChange={setStokPage}
              totalItems={filteredReportMedicines.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      )}

      {/* REPORT CONTENT 5: EXPIRED */}
      {activeReportTab === 'expired' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <h3 className="font-bold text-slate-800 shrink-0">Laporan Audit Kadaluwarsa (Expired & Pre-Expired 30/60/90 Hari)</h3>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari Kode, Nama Obat, Status Expired..."
                  value={searchExpired}
                  onChange={e => setSearchExpired(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="font-bold text-rose-800 block">1. Sudah Expired</span>
              <span className="text-2xl font-black text-rose-900">{expiredItems.length} Item</span>
            </div>
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl">
              <span className="font-bold text-red-800 block">2. Exp &lt; 30 Hari</span>
              <span className="text-2xl font-black text-red-900">{exp30Items.length} Item</span>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="font-bold text-amber-800 block">3. Exp 30-60 Hari</span>
              <span className="text-2xl font-black text-amber-900">{exp60Items.length} Item</span>
            </div>
            <div className="p-3.5 bg-yellow-50 border border-yellow-200 rounded-xl">
              <span className="font-bold text-yellow-800 block">4. Exp 60-90 Hari</span>
              <span className="text-2xl font-black text-yellow-900">{exp90Items.length} Item</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {/* Mobile & Tablet Card List */}
            <div className="lg:hidden p-3 space-y-2.5 bg-slate-50/50">
              {paginatedExpiredItemsList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                  Tidak ada data expired yang sesuai dengan pencarian.
                </div>
              ) : (
                paginatedExpiredItemsList.map(m => {
                  const statusInfo = getExpiredStatus(m.expiredDate);
                  return (
                    <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-1.5">
                        <div>
                          <span className="font-mono text-slate-400 text-[10px] block">{m.code}</span>
                          <h5 className="font-bold text-slate-900">{m.name}</h5>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusInfo.badgeColor}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>Exp: <strong>{formatDate(m.expiredDate)}</strong></span>
                        <span>Stok: <strong>{formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}</strong></span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="font-extrabold text-slate-800">Nilai: {formatRupiah(m.stock * m.price)}</span>
                        <button
                          onClick={() => setSelectedExpiredDetail(m)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-lg flex items-center gap-1 text-[11px] border border-rose-200"
                        >
                          <Eye className="w-3 h-3" /> Audit Detail
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Kode / Nama Obat</th>
                    <th className="py-3 px-4">Tanggal Expired</th>
                    <th className="py-3 px-4">Status & Sisa Hari</th>
                    <th className="py-3 px-4">Stok Saat Ini</th>
                    <th className="py-3 px-4 text-right">Nilai Sediaan (Rp)</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpiredItemsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada data expired yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpiredItemsList.map(m => {
                      const statusInfo = getExpiredStatus(m.expiredDate);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-slate-400 block text-[10px]">{m.code}</span>
                            <span className="font-bold text-slate-900">{m.name}</span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{formatDate(m.expiredDate)}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusInfo.badgeColor}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}</td>
                          <td className="py-2.5 px-4 text-right font-extrabold text-slate-800">{formatRupiah(m.stock * m.price)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedExpiredDetail(m)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold rounded-lg inline-flex items-center gap-1 text-xs border border-rose-200"
                            >
                              <Eye className="w-3.5 h-3.5" /> Audit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={expiredPage}
              totalPages={Math.ceil(allExpiredItemsList.length / ITEMS_PER_PAGE)}
              onPageChange={setExpiredPage}
              totalItems={allExpiredItemsList.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      )}

      {/* REPORT CONTENT: PRODUK OBAT (PPN & NON-PPN) */}
      {activeReportTab === 'produk_obat' && (() => {
        const obatCategories = ['Obat Bebas', 'Obat Bebas Terbatas', 'Obat Keras', 'Jamu & Herbal', 'Alat Kesehatan', 'Suplemen & Vitamin'];

        const basePeriodTrxs = transactions.filter(t => {
          if (t.status !== 'Selesai') return false;
          const tDate = t.date ? t.date.slice(0, 10) : '';
          if (startDate && tDate < startDate) return false;
          if (endDate && tDate > endDate) return false;
          return true;
        });

        const obatItemsList: Array<{
          trxId: string;
          trxNo: string;
          date: string;
          customerName: string;
          cashierName: string;
          paymentMethod: string;
          medicineId: string;
          code: string;
          name: string;
          category: string;
          unit: string;
          qty: number;
          price: number;
          subtotal: number;
          costPrice: number;
          costSubtotal: number;
          isPpn: boolean;
          ppnRate: number;
          dpp: number;
          ppnVal: number;
          margin: number;
        }> = [];

        basePeriodTrxs.forEach(t => {
          const trxIsPpn = isPpnTransaction(t);
          t.items.forEach(item => {
            const medInfo = medicines.find(m => m.id === item.medicineId || m.name === item.medicineName);
            const cat = medInfo?.category || 'Obat Bebas';
            const isObatItem = item.itemType === 'obat' || obatCategories.includes(cat) || (item.itemType !== 'non_obat' && !['Barang Umum', 'Perawatan & Kosmetik', 'Makanan & Minuman', 'Lainnya'].includes(cat));

            if (!isObatItem) return;

            const isPpn = getItemIsPpn(item, t, medInfo);
            const rate = item.ppnRate || t.ppnRate || 11;
            const subtotal = item.subtotal || (item.price * item.qty);
            const dpp = isPpn ? Math.round(subtotal / (1 + rate / 100)) : subtotal;
            const ppnVal = isPpn ? (subtotal - dpp) : 0;
            const masterMult = medInfo?.unit === 'Lusin' ? 12 : (medInfo?.unitMultiplier || 1);
            const itemMult = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || masterMult);
            const rawPurchasePrice = item.purchasePrice ?? (medInfo?.purchasePrice || Math.round(item.price * 0.75));

            const costPerPcs = masterMult > 1 ? rawPurchasePrice / masterMult : rawPurchasePrice;
            const qtyPcs = item.qty * itemMult;
            const costSubtotal = Math.round(costPerPcs * qtyPcs);
            const hppPerUnit = item.qty > 0 ? Math.round(costSubtotal / item.qty) : costPerPcs;
            const margin = subtotal - costSubtotal;

            obatItemsList.push({
              trxId: t.id,
              trxNo: t.trxNo,
              date: t.date,
              customerName: t.customerName || 'Customer Umum',
              cashierName: t.cashierName,
              paymentMethod: t.paymentMethod,
              medicineId: item.medicineId,
              code: item.medicineCode || medInfo?.code || '-',
              name: item.medicineName,
              category: cat,
              unit: item.unit,
              qty: item.qty,
              price: item.price,
              subtotal,
              costPrice: hppPerUnit,
              costSubtotal,
              isPpn,
              ppnRate: rate,
              dpp,
              ppnVal,
              margin,
            });
          });
        });

        const filteredObatItems = obatItemsList.filter(i => {
          if (taxReportFilter === 'PPN' && !i.isPpn) return false;
          if (taxReportFilter === 'NON_PPN' && i.isPpn) return false;
          if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
          if (searchPenjualan.trim()) {
            const q = searchPenjualan.toLowerCase();
            const matchesName = i.name.toLowerCase().includes(q);
            const matchesCode = i.code.toLowerCase().includes(q);
            const matchesTrx = i.trxNo.toLowerCase().includes(q);
            const matchesCust = i.customerName.toLowerCase().includes(q);
            if (!matchesName && !matchesCode && !matchesTrx && !matchesCust) return false;
          }
          return true;
        });

        const totalGross = filteredObatItems.reduce((sum, i) => sum + i.subtotal, 0);
        const totalDpp = filteredObatItems.reduce((sum, i) => sum + i.dpp, 0);
        const totalPpn = filteredObatItems.reduce((sum, i) => sum + i.ppnVal, 0);
        const totalHpp = filteredObatItems.reduce((sum, i) => sum + i.costSubtotal, 0);
        const totalMargin = totalGross - totalHpp;
        const totalQtySold = filteredObatItems.reduce((sum, i) => sum + i.qty, 0);
        const marginPct = totalGross > 0 ? ((totalMargin / totalGross) * 100).toFixed(1) : '0';

        const ppnItems = obatItemsList.filter(i => i.isPpn);
        const nonPpnItems = obatItemsList.filter(i => !i.isPpn);

        const ppnGross = ppnItems.reduce((sum, i) => sum + i.subtotal, 0);
        const ppnDpp = ppnItems.reduce((sum, i) => sum + i.dpp, 0);
        const ppnValSum = ppnItems.reduce((sum, i) => sum + i.ppnVal, 0);
        const ppnQty = ppnItems.reduce((sum, i) => sum + i.qty, 0);

        const nonPpnGross = nonPpnItems.reduce((sum, i) => sum + i.subtotal, 0);
        const nonPpnQty = nonPpnItems.reduce((sum, i) => sum + i.qty, 0);

        const paginatedObatItems = filteredObatItems.slice((reportObatPage - 1) * ITEMS_PER_PAGE, reportObatPage * ITEMS_PER_PAGE);

        return (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5 text-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                  {[
                    { id: '1_day', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: '7_days', label: '7 Hari' },
                    { id: '30_days', label: '30 Hari' },
                    { id: 'this_month', label: 'Bulan Ini' },
                    { id: 'this_year', label: 'Tahun Ini' },
                    { id: 'custom', label: 'Kustom' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSalesPresetChange(p.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shrink-0 ${
                        salesPreset === p.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {salesPreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => handleStartDateChange(e.target.value)}
                        className="bg-transparent font-medium text-slate-700 outline-none"
                      />
                      <span className="text-slate-400 font-bold">s/d</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="bg-transparent font-medium text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub filters row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <select
                  value={taxReportFilter}
                  onChange={e => setTaxReportFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="all">Semua Status PPN (11% & Non-PPN)</option>
                  <option value="PPN">Hanya Obat PPN (11%)</option>
                  <option value="NON_PPN">Hanya Obat Non-PPN (Bebas PPN)</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
                >
                  <option key="all" value="all">Semua Kategori Obat</option>
                  {obatCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari obat, kode, no TRX, customer..."
                    value={searchPenjualan}
                    onChange={e => setSearchPenjualan(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-1 transition-colors text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Omset Obat</span>
                <span className="text-lg font-black text-slate-900 block mt-0.5">{formatRupiah(totalGross)}</span>
                <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">{totalQtySold} item terjual</span>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DPP (Nilai Bersih)</span>
                <span className="text-lg font-black text-emerald-700 block mt-0.5">{formatRupiah(totalDpp)}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Dasar Pengenaan Pajak</span>
              </div>

              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">PPN 11% Terutang</span>
                <span className="text-lg font-black text-blue-900 block mt-0.5">{formatRupiah(totalPpn)}</span>
                <span className="text-[10px] text-blue-700 font-bold block mt-0.5">Pajak Obat Terkumpul</span>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Total HPP Modal</span>
                <span className="text-lg font-black text-amber-900 block mt-0.5">{formatRupiah(totalHpp)}</span>
                <span className="text-[10px] text-amber-700 font-medium block mt-0.5">Modal Pembelian Obat</span>
              </div>

              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Margin Laba</span>
                <span className="text-lg font-black text-emerald-950 block mt-0.5">{formatRupiah(totalMargin)}</span>
                <span className="text-[10px] text-emerald-700 font-extrabold block mt-0.5">Profit {marginPct}%</span>
              </div>

              <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Pajak Record</span>
                <span className="text-sm font-extrabold text-blue-300 block mt-0.5">{ppnItems.length} PPN • {nonPpnItems.length} Non-PPN</span>
                <span className="text-[10px] text-slate-300 font-mono block mt-0.5">Total {filteredObatItems.length} Transaksi Item</span>
              </div>
            </div>

            {/* PPN vs Non-PPN Comparison Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-2xl shadow-xs flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-extrabold text-[10px] rounded uppercase border border-blue-400/30">
                    Penjualan Obat PPN (11%)
                  </span>
                  <div className="text-xl font-black mt-2">{formatRupiah(ppnGross)}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    DPP: <strong>{formatRupiah(ppnDpp)}</strong> • PPN 11%: <strong className="text-blue-300">{formatRupiah(ppnValSum)}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-blue-300">{ppnQty}</span>
                  <span className="text-[10px] text-slate-300 block">Unit Terjual</span>
                </div>
              </div>

              <div className="p-4 bg-slate-800 text-white rounded-2xl shadow-xs flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 font-extrabold text-[10px] rounded uppercase border border-slate-600">
                    Penjualan Obat Non-PPN (Bebas PPN)
                  </span>
                  <div className="text-xl font-black mt-2">{formatRupiah(nonPpnGross)}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Tanpa PPN (Faktur Non-PKP / Non-PPN)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-300">{nonPpnQty}</span>
                  <span className="text-[10px] text-slate-300 block">Unit Terjual</span>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  Rincian Penjualan Produk Obat ({filteredObatItems.length} Item)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Menampilkan data periode {startDate} s/d {endDate}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">No TRX & Waktu</th>
                      <th className="py-3 px-3">Kode & Nama Obat</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3 text-center">Status Tax</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3 text-right">Harga Satuan</th>
                      <th className="py-3 px-3 text-right">DPP (Rp)</th>
                      <th className="py-3 px-3 text-right">PPN 11% (Rp)</th>
                      <th className="py-3 px-3 text-right">Subtotal Omset</th>
                      <th className="py-3 px-3 text-right">HPP Modal</th>
                      <th className="py-3 px-3 text-right">Margin</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedObatItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                          Tidak ada transaksi penjualan produk obat ditemukan untuk kriteria filter ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedObatItems.map((item, idx) => (
                        <tr key={`${item.trxId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{item.trxNo}</span>
                            <span className="text-[10px] text-slate-500">{formatDateTime(item.date)}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-slate-400 text-[10px] block">{item.code}</span>
                            <span className="font-bold text-slate-900">{item.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              item.isPpn ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {item.isPpn ? 'PPN 11%' : 'NON-PPN'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">{formatRupiah(item.price)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-800">{formatRupiah(item.dpp)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">{formatRupiah(item.ppnVal)}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{formatRupiah(item.subtotal)}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-500">{formatRupiah(item.costSubtotal)}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">{formatRupiah(item.margin)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => {
                                const fullTrx = transactions.find(t => t.id === item.trxId || t.trxNo === item.trxNo);
                                if (fullTrx) setSelectedTrxDetail(fullTrx);
                              }}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg transition-colors border border-emerald-200 font-bold text-xs inline-flex items-center justify-center gap-1"
                              title="Lihat Detail Transaksi"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredObatItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                        <td colSpan={4} className="py-3 px-3 uppercase text-right">TOTAL RECORD TERFILTER ({filteredObatItems.length} ITEM):</td>
                        <td className="py-3 px-3 text-center text-blue-900 font-extrabold">{totalQtySold}</td>
                        <td className="py-3 px-3 text-right text-slate-400">-</td>
                        <td className="py-3 px-3 text-right text-emerald-800">{formatRupiah(totalDpp)}</td>
                        <td className="py-3 px-3 text-right text-amber-800">{formatRupiah(totalPpn)}</td>
                        <td className="py-3 px-3 text-right text-slate-950 font-black">{formatRupiah(totalGross)}</td>
                        <td className="py-3 px-3 text-right text-amber-900">{formatRupiah(totalHpp)}</td>
                        <td className="py-3 px-3 text-right text-emerald-700">{formatRupiah(totalMargin)}</td>
                        <td className="py-3 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <PaginationControls
                currentPage={reportObatPage}
                totalPages={Math.ceil(filteredObatItems.length / ITEMS_PER_PAGE)}
                onPageChange={setReportObatPage}
                totalItems={filteredObatItems.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </div>
        );
      })()}

      {/* REPORT CONTENT: PRODUK NON-OBAT (PPN & NON-PPN) */}
      {activeReportTab === 'produk_non_obat' && (() => {
        const nonObatCategories = ['Barang Umum', 'Perawatan & Kosmetik', 'Makanan & Minuman', 'Lainnya'];

        const basePeriodTrxs = transactions.filter(t => {
          if (t.status !== 'Selesai') return false;
          const tDate = t.date ? t.date.slice(0, 10) : '';
          if (startDate && tDate < startDate) return false;
          if (endDate && tDate > endDate) return false;
          return true;
        });

        const nonObatItemsList: Array<{
          trxId: string;
          trxNo: string;
          date: string;
          customerName: string;
          cashierName: string;
          paymentMethod: string;
          medicineId: string;
          code: string;
          name: string;
          category: string;
          unit: string;
          qty: number;
          price: number;
          subtotal: number;
          costPrice: number;
          costSubtotal: number;
          isPpn: boolean;
          ppnRate: number;
          dpp: number;
          ppnVal: number;
          margin: number;
        }> = [];

        basePeriodTrxs.forEach(t => {
          const trxIsPpn = isPpnTransaction(t);
          t.items.forEach(item => {
            const medInfo = medicines.find(m => m.id === item.medicineId || m.name === item.medicineName);
            const cat = medInfo?.category || 'Barang Umum';
            const isNonObatItem = item.itemType === 'non_obat' || nonObatCategories.includes(cat);

            if (!isNonObatItem) return;

            const isPpn = getItemIsPpn(item, t, medInfo);
            const rate = item.ppnRate || t.ppnRate || 11;
            const subtotal = item.subtotal || (item.price * item.qty);
            const dpp = isPpn ? Math.round(subtotal / (1 + rate / 100)) : subtotal;
            const ppnVal = isPpn ? (subtotal - dpp) : 0;
            const masterMult = medInfo?.unit === 'Lusin' ? 12 : (medInfo?.unitMultiplier || 1);
            const itemMult = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || masterMult);
            const rawPurchasePrice = item.purchasePrice ?? (medInfo?.purchasePrice || Math.round(item.price * 0.75));

            const costPerPcs = masterMult > 1 ? rawPurchasePrice / masterMult : rawPurchasePrice;
            const qtyPcs = item.qty * itemMult;
            const costSubtotal = Math.round(costPerPcs * qtyPcs);
            const hppPerUnit = item.qty > 0 ? Math.round(costSubtotal / item.qty) : costPerPcs;
            const margin = subtotal - costSubtotal;

            nonObatItemsList.push({
              trxId: t.id,
              trxNo: t.trxNo,
              date: t.date,
              customerName: t.customerName || 'Customer Umum',
              cashierName: t.cashierName,
              paymentMethod: t.paymentMethod,
              medicineId: item.medicineId,
              code: item.medicineCode || medInfo?.code || '-',
              name: item.medicineName,
              category: cat,
              unit: item.unit,
              qty: item.qty,
              price: item.price,
              subtotal,
              costPrice: hppPerUnit,
              costSubtotal,
              isPpn,
              ppnRate: rate,
              dpp,
              ppnVal,
              margin,
            });
          });
        });

        const filteredNonObatItems = nonObatItemsList.filter(i => {
          if (taxReportFilter === 'PPN' && !i.isPpn) return false;
          if (taxReportFilter === 'NON_PPN' && i.isPpn) return false;
          if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
          if (searchPenjualan.trim()) {
            const q = searchPenjualan.toLowerCase();
            const matchesName = i.name.toLowerCase().includes(q);
            const matchesCode = i.code.toLowerCase().includes(q);
            const matchesTrx = i.trxNo.toLowerCase().includes(q);
            const matchesCust = i.customerName.toLowerCase().includes(q);
            if (!matchesName && !matchesCode && !matchesTrx && !matchesCust) return false;
          }
          return true;
        });

        const totalGross = filteredNonObatItems.reduce((sum, i) => sum + i.subtotal, 0);
        const totalDpp = filteredNonObatItems.reduce((sum, i) => sum + i.dpp, 0);
        const totalPpn = filteredNonObatItems.reduce((sum, i) => sum + i.ppnVal, 0);
        const totalHpp = filteredNonObatItems.reduce((sum, i) => sum + i.costSubtotal, 0);
        const totalMargin = totalGross - totalHpp;
        const totalQtySold = filteredNonObatItems.reduce((sum, i) => sum + i.qty, 0);
        const marginPct = totalGross > 0 ? ((totalMargin / totalGross) * 100).toFixed(1) : '0';

        const ppnItems = nonObatItemsList.filter(i => i.isPpn);
        const nonPpnItems = nonObatItemsList.filter(i => !i.isPpn);

        const ppnGross = ppnItems.reduce((sum, i) => sum + i.subtotal, 0);
        const ppnDpp = ppnItems.reduce((sum, i) => sum + i.dpp, 0);
        const ppnValSum = ppnItems.reduce((sum, i) => sum + i.ppnVal, 0);
        const ppnQty = ppnItems.reduce((sum, i) => sum + i.qty, 0);

        const nonPpnGross = nonPpnItems.reduce((sum, i) => sum + i.subtotal, 0);
        const nonPpnQty = nonPpnItems.reduce((sum, i) => sum + i.qty, 0);

        const paginatedNonObatItems = filteredNonObatItems.slice((reportNonObatPage - 1) * ITEMS_PER_PAGE, reportNonObatPage * ITEMS_PER_PAGE);

        return (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5 text-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                  {[
                    { id: '1_day', label: 'Hari Ini' },
                    { id: 'yesterday', label: 'Kemarin' },
                    { id: '7_days', label: '7 Hari' },
                    { id: '30_days', label: '30 Hari' },
                    { id: 'this_month', label: 'Bulan Ini' },
                    { id: 'this_year', label: 'Tahun Ini' },
                    { id: 'custom', label: 'Kustom' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSalesPresetChange(p.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shrink-0 ${
                        salesPreset === p.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {salesPreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => handleStartDateChange(e.target.value)}
                        className="bg-transparent font-medium text-slate-700 outline-none"
                      />
                      <span className="text-slate-400 font-bold">s/d</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="bg-transparent font-medium text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub filters row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <select
                  value={taxReportFilter}
                  onChange={e => setTaxReportFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="all">Semua Status PPN (11% & Non-PPN)</option>
                  <option value="PPN">Hanya Non-Obat PPN (11%)</option>
                  <option value="NON_PPN">Hanya Non-Obat Non-PPN (Bebas PPN)</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:border-indigo-500"
                >
                  <option key="all" value="all">Semua Kategori Non-Obat</option>
                  {nonObatCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari produk non-obat, kode, no TRX, customer..."
                    value={searchPenjualan}
                    onChange={e => setSearchPenjualan(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-1 transition-colors text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Omset Non-Obat</span>
                <span className="text-lg font-black text-slate-900 block mt-0.5">{formatRupiah(totalGross)}</span>
                <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">{totalQtySold} item terjual</span>
              </div>

              <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DPP (Nilai Bersih)</span>
                <span className="text-lg font-black text-indigo-700 block mt-0.5">{formatRupiah(totalDpp)}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Dasar Pengenaan Pajak</span>
              </div>

              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">PPN 11% Terutang</span>
                <span className="text-lg font-black text-blue-900 block mt-0.5">{formatRupiah(totalPpn)}</span>
                <span className="text-[10px] text-blue-700 font-bold block mt-0.5">Pajak Non-Obat Terkumpul</span>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Total HPP Modal</span>
                <span className="text-lg font-black text-amber-900 block mt-0.5">{formatRupiah(totalHpp)}</span>
                <span className="text-[10px] text-amber-700 font-medium block mt-0.5">Modal Pembelian Non-Obat</span>
              </div>

              <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Total Margin Laba</span>
                <span className="text-lg font-black text-indigo-950 block mt-0.5">{formatRupiah(totalMargin)}</span>
                <span className="text-[10px] text-indigo-700 font-extrabold block mt-0.5">Profit {marginPct}%</span>
              </div>

              <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Pajak Record</span>
                <span className="text-sm font-extrabold text-indigo-300 block mt-0.5">{ppnItems.length} PPN • {nonPpnItems.length} Non-PPN</span>
                <span className="text-[10px] text-slate-300 font-mono block mt-0.5">Total {filteredNonObatItems.length} Transaksi Item</span>
              </div>
            </div>

            {/* PPN vs Non-PPN Comparison Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-xs flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-extrabold text-[10px] rounded uppercase border border-indigo-400/30">
                    Penjualan Non-Obat PPN (11%)
                  </span>
                  <div className="text-xl font-black mt-2">{formatRupiah(ppnGross)}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    DPP: <strong>{formatRupiah(ppnDpp)}</strong> • PPN 11%: <strong className="text-indigo-300">{formatRupiah(ppnValSum)}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-300">{ppnQty}</span>
                  <span className="text-[10px] text-slate-300 block">Unit Terjual</span>
                </div>
              </div>

              <div className="p-4 bg-slate-800 text-white rounded-2xl shadow-xs flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 font-extrabold text-[10px] rounded uppercase border border-slate-600">
                    Penjualan Non-Obat Non-PPN (Bebas PPN)
                  </span>
                  <div className="text-xl font-black mt-2">{formatRupiah(nonPpnGross)}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Tanpa PPN (Faktur Non-PKP / Non-PPN)
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-300">{nonPpnQty}</span>
                  <span className="text-[10px] text-slate-300 block">Unit Terjual</span>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  Rincian Penjualan Produk Non-Obat ({filteredNonObatItems.length} Item)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Menampilkan data periode {startDate} s/d {endDate}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">No TRX & Waktu</th>
                      <th className="py-3 px-3">Kode & Nama Produk</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3 text-center">Status Tax</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3 text-right">Harga Satuan</th>
                      <th className="py-3 px-3 text-right">DPP (Rp)</th>
                      <th className="py-3 px-3 text-right">PPN 11% (Rp)</th>
                      <th className="py-3 px-3 text-right">Subtotal Omset</th>
                      <th className="py-3 px-3 text-right">HPP Modal</th>
                      <th className="py-3 px-3 text-right">Margin</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedNonObatItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                          Tidak ada transaksi penjualan produk non-obat ditemukan untuk kriteria filter ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedNonObatItems.map((item, idx) => (
                        <tr key={`${item.trxId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{item.trxNo}</span>
                            <span className="text-[10px] text-slate-500">{formatDateTime(item.date)}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-slate-400 text-[10px] block">{item.code}</span>
                            <span className="font-bold text-slate-900">{item.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              item.isPpn ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {item.isPpn ? 'PPN 11%' : 'NON-PPN'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">{formatRupiah(item.price)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-indigo-800">{formatRupiah(item.dpp)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">{formatRupiah(item.ppnVal)}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{formatRupiah(item.subtotal)}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-500">{formatRupiah(item.costSubtotal)}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-indigo-700">{formatRupiah(item.margin)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => {
                                const fullTrx = transactions.find(t => t.id === item.trxId || t.trxNo === item.trxNo);
                                if (fullTrx) setSelectedTrxDetail(fullTrx);
                              }}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg transition-colors border border-indigo-200 font-bold text-xs inline-flex items-center justify-center gap-1"
                              title="Lihat Detail Transaksi"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredNonObatItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                        <td colSpan={4} className="py-3 px-3 uppercase text-right">TOTAL RECORD TERFILTER ({filteredNonObatItems.length} ITEM):</td>
                        <td className="py-3 px-3 text-center text-blue-900 font-extrabold">{totalQtySold}</td>
                        <td className="py-3 px-3 text-right text-slate-400">-</td>
                        <td className="py-3 px-3 text-right text-indigo-800">{formatRupiah(totalDpp)}</td>
                        <td className="py-3 px-3 text-right text-amber-800">{formatRupiah(totalPpn)}</td>
                        <td className="py-3 px-3 text-right text-slate-950 font-black">{formatRupiah(totalGross)}</td>
                        <td className="py-3 px-3 text-right text-amber-900">{formatRupiah(totalHpp)}</td>
                        <td className="py-3 px-3 text-right text-indigo-700">{formatRupiah(totalMargin)}</td>
                        <td className="py-3 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <PaginationControls
                currentPage={reportNonObatPage}
                totalPages={Math.ceil(filteredNonObatItems.length / ITEMS_PER_PAGE)}
                onPageChange={setReportNonObatPage}
                totalItems={filteredNonObatItems.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </div>
        );
      })()}
      {/* REPORT CONTENT 6: PAJAK PPN & NON-PPN */}
      {activeReportTab === 'pajak_ppn' && (() => {
        // Base completed transactions in date range
        const basePeriodTransactions = transactions.filter(t => {
          if (t.status !== 'Selesai') return false;
          const tDate = t.date ? t.date.slice(0, 10) : '';
          if (startDate && tDate < startDate) return false;
          if (endDate && tDate > endDate) return false;
          return true;
        });

        // Period-wide overall PPN and Non-PPN metrics for KPI Summary Cards
        const ppnList = basePeriodTransactions.filter(isPpnTransaction);
        const nonPpnList = basePeriodTransactions.filter(t => !isPpnTransaction(t));

        const totalPpnBruto = ppnList.reduce((sum, t) => sum + t.totalAmount, 0);
        const totalDpp = ppnList.reduce((sum, t) => {
          const rate = t.ppnRate || 11;
          return sum + (t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100)));
        }, 0);
        const totalPpnOutput = ppnList.reduce((sum, t) => {
          const rate = t.ppnRate || 11;
          const dpp = t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100));
          return sum + (t.ppnAmount ?? (t.totalAmount - dpp));
        }, 0);
        const totalNonPpnOmset = nonPpnList.reduce((sum, t) => sum + t.totalAmount, 0);

        // Filter tax transactions for displayed table based on tax filter and search query
        const taxTransactions = basePeriodTransactions.filter(t => {
          const isPpn = isPpnTransaction(t);
          if (taxReportFilter === 'PPN' && !isPpn) return false;
          if (taxReportFilter === 'NON_PPN' && isPpn) return false;

          if (searchPenjualan.trim()) {
            const q = searchPenjualan.toLowerCase();
            const matchesNo = t.trxNo.toLowerCase().includes(q);
            const matchesCust = (t.customerName || '').toLowerCase().includes(q);
            const matchesCashier = (t.cashierName || '').toLowerCase().includes(q);
            if (!matchesNo && !matchesCust && !matchesCashier) return false;
          }

          return true;
        });

        // Calculate table footer sums for displayed rows
        const tableTotalDpp = taxTransactions.reduce((sum, t) => {
          const isPpn = isPpnTransaction(t);
          if (!isPpn) return sum + t.totalAmount;
          const rate = t.ppnRate || 11;
          return sum + (t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100)));
        }, 0);

        const tableTotalPpn = taxTransactions.reduce((sum, t) => {
          const isPpn = isPpnTransaction(t);
          if (!isPpn) return sum;
          const rate = t.ppnRate || 11;
          const dpp = t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100));
          return sum + (t.ppnAmount ?? (t.totalAmount - dpp));
        }, 0);

        const tableTotalBruto = taxTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
        const paginatedTaxTransactions = taxTransactions.slice((pajakPpnPage - 1) * ITEMS_PER_PAGE, pajakPpnPage * ITEMS_PER_PAGE);

        return (
          <div className="space-y-4">
            {/* Controls Bar & Filter Panel */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5 text-xs">
              {/* ROW 1: Preset Date Selector & Main Date Range Picker */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-slate-100/90 p-1 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 px-2 shrink-0 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Periode Pajak:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('1_day')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === '1_day' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('yesterday')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === 'yesterday' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('7_days')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === '7_days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('30_days')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === '30_days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    30 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('this_month')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === 'this_month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bulan Ini (Masa Pajak)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalesPresetChange('custom')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      salesPreset === 'custom' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kustom
                  </button>
                </div>

                {/* Date Input Pickers */}
                {salesPreset === 'custom' && (
                  <div className="flex items-center gap-2 shrink-0 transition-all duration-300">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold">Dari:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => handleStartDateChange(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                    <span className="text-slate-400 font-bold text-xs">s/d</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold">Sampai:</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ROW 2: Tax Type Filter & Export / Print Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <span className="font-bold text-slate-700">Filter Jenis Transaksi:</span>
                  <select
                    value={taxReportFilter}
                    onChange={e => setTaxReportFilter(e.target.value as any)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 focus:outline-none"
                  >
                    <option value="all">Semua Transaksi (PPN + Non-PPN)</option>
                    <option value="PPN">Khusus Laporan Faktur PPN (11%)</option>
                    <option value="NON_PPN">Khusus Laporan Nota Non-PPN</option>
                  </select>

                  <div className="relative shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari No. TRX / Pembeli..."
                      value={searchPenjualan}
                      onChange={e => setSearchPenjualan(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
                    />
                    {searchPenjualan && (
                      <button
                        onClick={() => setSearchPenjualan('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                </div>
              </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wide">Faktur PPN (Bruto)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">{ppnList.length} Trx</span>
                </div>
                <div className="text-xl font-black text-blue-950">{formatRupiah(totalPpnBruto)}</div>
                <p className="text-[10px] text-slate-500 mt-1">Total seluruh faktur bertanda PPN 11%</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide">DPP (Dasar Pajak)</span>
                  <Calculator className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-emerald-950">{formatRupiah(totalDpp)}</div>
                <p className="text-[10px] text-slate-500 mt-1">Nilai bersih penjualan sebelum PPN</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wide">PPN Terutang (Output)</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">11%</span>
                </div>
                <div className="text-xl font-black text-amber-950">{formatRupiah(totalPpnOutput)}</div>
                <p className="text-[10px] text-slate-500 mt-1">Pajak Pertambahan Nilai wajib disetor</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/50 to-white shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">Penjualan Non-PPN</span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full font-bold">{nonPpnList.length} Trx</span>
                </div>
                <div className="text-xl font-black text-slate-900">{formatRupiah(totalNonPpnOmset)}</div>
                <p className="text-[10px] text-slate-500 mt-1">Omset tanpa pengenaan PPN</p>
              </div>
            </div>

            {/* Tax Detail Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  {taxReportFilter === 'PPN'
                    ? `Laporan Faktur Penjualan PPN 11% (${taxTransactions.length} Dokumen)`
                    : taxReportFilter === 'NON_PPN'
                    ? `Laporan Nota Penjualan Non-PPN (${taxTransactions.length} Dokumen)`
                    : `Rincian Seluruh Faktur PPN & Nota Non-PPN (${taxTransactions.length} Dokumen)`}
                </span>
                <span className="text-[11px] text-slate-500">
                  Masa Pajak: <strong>{startDate}</strong> s/d <strong>{endDate}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">No. Dokumen / Trx</th>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Customer / Pembeli</th>
                      <th className="py-3 px-4 text-center">Status Perpajakan</th>
                      <th className="py-3 px-4 text-right">DPP (Rp)</th>
                      <th className="py-3 px-4 text-right">PPN 11% (Rp)</th>
                      <th className="py-3 px-4 text-right">Total Faktur (Rp)</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTaxTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Tidak ada data transaksi perpajakan dalam periode terpilih.
                        </td>
                      </tr>
                    ) : (
                      paginatedTaxTransactions.map(t => {
                        const isPpn = isPpnTransaction(t);
                        const rate = t.ppnRate || 11;
                        const dpp = isPpn ? (t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100))) : t.totalAmount;
                        const ppn = isPpn ? (t.ppnAmount ?? (t.totalAmount - dpp)) : 0;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.trxNo}</td>
                            <td className="py-3 px-4 text-slate-600">{formatDateTime(t.date)}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{t.customerName || 'Customer Umum'}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                isPpn
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {isPpn ? 'FAKTUR PPN (11%)' : 'NOTA NON-PPN'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-800">{formatRupiah(dpp)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-amber-700">{formatRupiah(ppn)}</td>
                            <td className="py-3 px-4 text-right font-black text-emerald-800">{formatRupiah(t.totalAmount)}</td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setSelectedTrxDetail(t)}
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg transition-colors border border-blue-200 font-bold text-xs"
                                  title="Detail Faktur Pajak"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setLastTransaction(t);
                                    setIsReceiptModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-bold text-xs"
                                  title="Cetak Struk"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {taxTransactions.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs text-slate-900">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">Total Rekapitulasi Tabel:</td>
                        <td className="py-3 px-4 text-right text-emerald-900 font-extrabold">{formatRupiah(tableTotalDpp)}</td>
                        <td className="py-3 px-4 text-right text-amber-800 font-extrabold">{formatRupiah(tableTotalPpn)}</td>
                        <td className="py-3 px-4 text-right text-emerald-950 font-black">{formatRupiah(tableTotalBruto)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <PaginationControls
                currentPage={pajakPpnPage}
                totalPages={Math.ceil(taxTransactions.length / ITEMS_PER_PAGE)}
                onPageChange={setPajakPpnPage}
                totalItems={taxTransactions.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </div>
        );
      })()}

      {/* MODAL DETAIL TRANSAKSI (SINGLE TRX) */}
      {selectedTrxDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/30 font-bold">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 font-bold text-xs bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                        {selectedTrxDetail.trxNo}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        isPpnTransaction(selectedTrxDetail)
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-700 text-slate-200'
                      }`}>
                        {isPpnTransaction(selectedTrxDetail) ? 'FAKTUR PPN 11%' : 'NOTA NON-PPN'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Waktu: {formatDateTime(selectedTrxDetail.date)} • Kasir: {selectedTrxDetail.cashierName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setLastTransaction(selectedTrxDetail);
                      setIsReceiptModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Struk
                  </button>
                  <button
                    onClick={() => setSelectedTrxDetail(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
                {/* Summary Financial Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Faktur</span>
                    <span className="text-base font-black text-emerald-700">{formatRupiah(selectedTrxDetail.totalAmount)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">DPP (Dasar Pajak)</span>
                    <span className="text-base font-bold text-slate-800">
                      {formatRupiah(
                        isPpnTransaction(selectedTrxDetail)
                          ? (selectedTrxDetail.dppAmount ?? Math.round(selectedTrxDetail.totalAmount / (1 + (selectedTrxDetail.ppnRate || 11) / 100)))
                          : selectedTrxDetail.totalAmount
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase">PPN 11%</span>
                    <span className="text-base font-extrabold text-amber-700">
                      {formatRupiah(
                        isPpnTransaction(selectedTrxDetail)
                          ? (selectedTrxDetail.ppnAmount ?? (selectedTrxDetail.totalAmount - Math.round(selectedTrxDetail.totalAmount / (1 + (selectedTrxDetail.ppnRate || 11) / 100))))
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Metode & Bayar</span>
                    <span className="text-xs font-bold text-slate-900 block">{selectedTrxDetail.paymentMethod}</span>
                    <span className="text-[10px] text-slate-500">
                      Bayar: {formatRupiah(selectedTrxDetail.paymentAmount ?? selectedTrxDetail.amountPaid ?? selectedTrxDetail.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Info Details Grid */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold block uppercase">Customer / Pembeli</span>
                    <span className="font-bold text-slate-900">{selectedTrxDetail.customerName || 'Customer Umum'}</span>
                    {selectedTrxDetail.customerMemberNo && (
                      <span className="block text-[10px] text-emerald-700 font-mono">No. Member: {selectedTrxDetail.customerMemberNo}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold block uppercase">Dokter & Jenis Resep</span>
                    <span className="font-bold text-indigo-700">{selectedTrxDetail.doctorName || '-'}</span>
                    <span className="block text-[10px] text-slate-500">
                      {selectedTrxDetail.isPrescription ? `Resep (Markup ${selectedTrxDetail.prescriptionMarkupRate ?? 20}%)` : 'Non-Resep'}
                    </span>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between items-center">
                    <span>Rincian Barang / Obat Terjual ({selectedTrxDetail.items?.length || 0} Item)</span>
                    <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {isPpnTransaction(selectedTrxDetail)
                        ? `Total PPN Terutang: ${formatRupiah(
                            selectedTrxDetail.ppnAmount ??
                              (selectedTrxDetail.totalAmount -
                                Math.round(
                                  selectedTrxDetail.totalAmount / (1 + (selectedTrxDetail.ppnRate || 11) / 100)
                                ))
                          )}`
                        : 'Bebas PPN (Non-PPN)'}
                    </span>
                  </div>
                  {(() => {
                    const trxItems = selectedTrxDetail.items || [];
                    const paginatedTrxItems = trxItems.slice((modalTrxItemsPage - 1) * MODAL_ITEMS_PER_PAGE, modalTrxItemsPage * MODAL_ITEMS_PER_PAGE);

                    return (
                      <div className="flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                <th className="py-2.5 px-3">Kode & Nama Obat</th>
                                <th className="py-2.5 px-3 text-center">Status & Nominal PPN</th>
                                <th className="py-2.5 px-3 text-center">Harga Satuan</th>
                                <th className="py-2.5 px-3 text-center">Qty</th>
                                <th className="py-2.5 px-3 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedTrxItems.map((item: any, idx: number) => {
                                const medInfo = medicines.find(m => m.id === item.medicineId || m.name === item.medicineName);
                                const itemIsPpn = getItemIsPpn(item, selectedTrxDetail, medInfo);
                                const itemDpp = Math.round(item.subtotal / (1 + (item.ppnRate || 11) / 100));
                                const itemPpnVal = itemIsPpn ? item.subtotal - itemDpp : 0;

                                return (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-2 px-3">
                                      <span className="font-mono text-slate-400 text-[10px] block">{item.medicineCode || item.code || '-'}</span>
                                      <span className="font-bold text-slate-900">{item.medicineName || item.name}</span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      {itemIsPpn ? (
                                        <div>
                                          <span className="text-[9px] font-extrabold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 inline-block">
                                            PPN 11%
                                          </span>
                                          <span className="block text-[10px] font-extrabold text-blue-700 mt-0.5">
                                            PPN: {formatRupiah(itemPpnVal)}
                                          </span>
                                        </div>
                                      ) : (
                                        <div>
                                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                                            Non-PPN
                                          </span>
                                          <span className="block text-[10px] font-medium text-slate-400 mt-0.5">
                                            Rp 0
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center font-medium text-slate-700">{formatRupiah(item.price)}</td>
                                    <td className="py-2 px-3 text-center font-bold text-slate-900">{item.qty} {item.unit || 'pcs'}</td>
                                    <td className="py-2 px-3 text-right font-extrabold text-emerald-700">{formatRupiah(item.subtotal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls
                          currentPage={modalTrxItemsPage}
                          totalPages={Math.ceil(trxItems.length / MODAL_ITEMS_PER_PAGE)}
                          onPageChange={setModalTrxItemsPage}
                          totalItems={trxItems.length}
                          itemsPerPage={MODAL_ITEMS_PER_PAGE}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedTrxDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL RINCIAN OBAT & RIWAYAT STOK */}
      {selectedMedicineDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30 font-bold">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        {selectedMedicineDetail.code}
                      </span>
                      <h3 className="font-extrabold text-lg text-white">{selectedMedicineDetail.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kategori: {selectedMedicineDetail.category} • Stok Fisik: <strong className="text-emerald-300">{formatStockDisplay(selectedMedicineDetail.stock, selectedMedicineDetail.unit, selectedMedicineDetail.unitMultiplier)}</strong> (Batas Min: {selectedMedicineDetail.minStock})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMedicineDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
                {/* Price & Valuation Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Harga Beli HPP</span>
                    <span className="text-base font-extrabold text-slate-800">{formatRupiah(selectedMedicineDetail.purchasePrice || selectedMedicineDetail.price * 0.8)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Harga Jual POS</span>
                    <span className="text-base font-black text-emerald-700">{formatRupiah(selectedMedicineDetail.price)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Nilai Total Stok</span>
                    <span className="text-base font-extrabold text-blue-700">{formatRupiah(selectedMedicineDetail.stock * selectedMedicineDetail.price)}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Status Sediaan</span>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedMedicineDetail.stock <= selectedMedicineDetail.minStock ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedMedicineDetail.stock <= selectedMedicineDetail.minStock ? 'STOK MENIPIS' : 'STOK AMAN'}
                    </span>
                  </div>
                </div>

                {/* Section: Riwayat Transaksi Penjualan Obat Ini */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      Riwayat Penjualan POS Obat Ini
                    </span>
                  </div>
                  {(() => {
                    const medTrxs = transactions.filter(t => t.status === 'Selesai' && t.items.some(i => i.medicineId === selectedMedicineDetail.id || i.medicineName === selectedMedicineDetail.name));
                    const paginatedMedTrxs = medTrxs.slice((modalMedicineTrxPage - 1) * MODAL_ITEMS_PER_PAGE, modalMedicineTrxPage * MODAL_ITEMS_PER_PAGE);

                    if (medTrxs.length === 0) {
                      return <div className="p-6 text-center text-slate-400 text-xs font-medium">Belum ada riwayat transaksi penjualan tercatat untuk obat ini.</div>;
                    }
                    return (
                      <div className="flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                <th className="py-2.5 px-3">No TRX</th>
                                <th className="py-2.5 px-3">Tanggal Waktu</th>
                                <th className="py-2.5 px-3">Customer</th>
                                <th className="py-2.5 px-3 text-center">Qty Terjual</th>
                                <th className="py-2.5 px-3 text-right">Subtotal Omset</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedMedTrxs.map(t => {
                                const item = t.items.find(i => i.medicineId === selectedMedicineDetail.id || i.medicineName === selectedMedicineDetail.name);
                                return (
                                  <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{t.trxNo}</td>
                                    <td className="py-2 px-3 text-slate-600">{formatDateTime(t.date)}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{t.customerName || 'Umum'}</td>
                                    <td className="py-2 px-3 text-center font-bold text-blue-700">{item?.qty || 0} {selectedMedicineDetail.unit}</td>
                                    <td className="py-2 px-3 text-right font-extrabold text-emerald-700">{formatRupiah(item?.subtotal || 0)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls
                          currentPage={modalMedicineTrxPage}
                          totalPages={Math.ceil(medTrxs.length / MODAL_ITEMS_PER_PAGE)}
                          onPageChange={setModalMedicineTrxPage}
                          totalItems={medTrxs.length}
                          itemsPerPage={MODAL_ITEMS_PER_PAGE}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Section: Riwayat Mutasi Stok (Stock History) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Riwayat Mutasi & Opnam Stok
                    </span>
                  </div>
                  {(() => {
                    const medHistory = (stockHistory || []).filter((h: any) => h.medicineId === selectedMedicineDetail.id || h.medicineName === selectedMedicineDetail.name);
                    const paginatedMedHistory = medHistory.slice((modalMedicineHistoryPage - 1) * MODAL_ITEMS_PER_PAGE, modalMedicineHistoryPage * MODAL_ITEMS_PER_PAGE);

                    if (medHistory.length === 0) {
                      return <div className="p-6 text-center text-slate-400 text-xs font-medium">Belum ada catatan mutasi stok tersimpan.</div>;
                    }
                    return (
                      <div className="flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                <th className="py-2.5 px-3">Tanggal Waktu</th>
                                <th className="py-2.5 px-3">Jenis Mutasi</th>
                                <th className="py-2.5 px-3 text-center">Perubahan Qty</th>
                                <th className="py-2.5 px-3 text-center">Sisa Stok</th>
                                <th className="py-2.5 px-3">Petugas & Catatan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedMedHistory.map((h: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 text-slate-600 font-medium">{formatDateTime(h.date)}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      h.type === 'RESTOCK' || h.type === 'MASUK' ? 'bg-emerald-100 text-emerald-800' :
                                      h.type === 'PENJUALAN' || h.type === 'KELUAR' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {h.type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold">{h.changeQty > 0 ? `+${h.changeQty}` : h.changeQty}</td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">{h.finalStock ?? '-'}</td>
                                  <td className="py-2 px-3 text-slate-600 text-[11px]">
                                    <strong>{h.user || 'Sistem'}</strong>: {h.notes || h.reason || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <PaginationControls
                          currentPage={modalMedicineHistoryPage}
                          totalPages={Math.ceil(medHistory.length / MODAL_ITEMS_PER_PAGE)}
                          onPageChange={setModalMedicineHistoryPage}
                          totalItems={medHistory.length}
                          itemsPerPage={MODAL_ITEMS_PER_PAGE}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedMedicineDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUDIT KADALUWARSA / EXPIRED */}
      {selectedExpiredDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/30 font-bold">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-rose-400 font-bold text-xs bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                        {selectedExpiredDetail.code}
                      </span>
                      <h3 className="font-extrabold text-lg text-white">{selectedExpiredDetail.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tgl Expired: <strong>{formatDate(selectedExpiredDetail.expiredDate)}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedExpiredDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
                {/* Status & Valuation Box */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Status Sisa Hari</span>
                    {(() => {
                      const statusInfo = getExpiredStatus(selectedExpiredDetail.expiredDate);
                      return (
                        <span className={`inline-block mt-1 px-2.5 py-1 rounded text-xs font-extrabold border ${statusInfo.badgeColor}`}>
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Stok Tersedia</span>
                    <span className="text-xl font-black text-slate-900 block mt-0.5">{formatStockDisplay(selectedExpiredDetail.stock, selectedExpiredDetail.unit, selectedExpiredDetail.unitMultiplier)}</span>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-rose-700 block uppercase">Nilai Kerugian / Sediaan</span>
                    <span className="text-xl font-black text-rose-800 block mt-0.5">{formatRupiah(selectedExpiredDetail.stock * selectedExpiredDetail.price)}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
                  <strong className="block font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Rekomendasi Tindakan Farmasi:
                  </strong>
                  <p className="text-[11px] text-amber-800">
                    {getDaysUntilExpired(selectedExpiredDetail.expiredDate) <= 0
                      ? 'Item sudah Kadaluwarsa. Segera karantina fisik obat dan buat berita acara retur / pemusnahan obat.'
                      : 'Sediaan mendekati expired. Prioritaskan aturan FEFO (First Expired First Out) atau diskusikan retur dengan supplier PBF.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedExpiredDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors"
                >
                  Tutup Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
