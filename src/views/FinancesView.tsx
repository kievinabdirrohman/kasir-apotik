import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDateTime, formatDate, getWIBDateString, formatStockDisplay } from '../utils/formatters';
import {
  WalletCards,
  TrendingUp,
  TrendingDown,
  FileText,
  Plus,
  Trash2,
  Calendar,
  X,
  List,
  Search,
  Filter,
  Scale,
  Building2,
  Coins,
  Printer,
  Eye,
  BarChart3,
  ChevronRight,
  PieChart,
  Info,
  Percent,
  Receipt,
  Tag,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown
} from 'lucide-react';
import { CashFlowType } from '../types';

export const FinancesView: React.FC = () => {
  const {
    medicines,
    doctors,
    transactions,
    cashFlows,
    addCashFlow,
    deleteCashFlow,
    settings,
    updateSettings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'neraca' | 'laporan' | 'aruskas'>('neraca');
  const [deletingCashFlowId, setDeletingCashFlowId] = useState<string | null>(null);
  
  // Balance Sheet Detail Modal State
  const [selectedBalanceDetail, setSelectedBalanceDetail] = useState<'kas' | 'persediaan' | 'modal' | 'laba' | null>(null);
  const [isEditingInitialCapital, setIsEditingInitialCapital] = useState(false);
  const [initialCapitalInput, setInitialCapitalInput] = useState(String(settings.initialCapital ?? 50000000));
  
  // Date filter for reports
  const [reportPeriod, setReportPeriod] = useState<'semua' | 'hari_ini' | 'kemarin' | 'bulan_ini' | 'bulan_lalu' | 'tahun_ini' | 'kustom'>('bulan_ini');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Laba Rugi Detail Modal & Print Modal State
  const [selectedIncomeDetail, setSelectedIncomeDetail] = useState<'penjualan' | 'hpp' | 'beban' | 'pemasukan_lain' | 'laba_bersih' | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [expandedTrxId, setExpandedTrxId] = useState<string | null>(null);

  // Arus Kas form & filters
  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [cashFlowType, setCashFlowType] = useState<CashFlowType>('Pengeluaran');
  const [cashFlowCategory, setCashFlowCategory] = useState('Operasional');
  const [cashFlowAmount, setCashFlowAmount] = useState('');
  const [cashFlowNote, setCashFlowNote] = useState('');
  
  const [cashFlowSearch, setCashFlowSearch] = useState('');
  const [cashFlowTypeFilter, setCashFlowTypeFilter] = useState<'Semua' | CashFlowType>('Semua');
  const [cashFlowDatePreset, setCashFlowDatePreset] = useState<'semua' | 'hari_ini' | '7_hari' | '30_hari' | 'bulan_ini' | 'kustom'>('semua');
  const [cashFlowStartDate, setCashFlowStartDate] = useState<string>(() => getWIBDateString());
  const [cashFlowEndDate, setCashFlowEndDate] = useState<string>(() => getWIBDateString());

  const handleCashFlowPresetChange = (preset: 'semua' | 'hari_ini' | '7_hari' | '30_hari' | 'bulan_ini' | 'kustom') => {
    setCashFlowDatePreset(preset);
    const todayStr = getWIBDateString();

    if (preset === 'hari_ini') {
      setCashFlowStartDate(todayStr);
      setCashFlowEndDate(todayStr);
    } else if (preset === '7_hari') {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 6);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      setCashFlowStartDate(pastStr);
      setCashFlowEndDate(todayStr);
    } else if (preset === '30_hari') {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 29);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      setCashFlowStartDate(pastStr);
      setCashFlowEndDate(todayStr);
    } else if (preset === 'bulan_ini') {
      const today = new Date();
      const firstDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      setCashFlowStartDate(firstDayStr);
      setCashFlowEndDate(todayStr);
    }
  };

  // Helper functions for dual-track split calculation (Obat vs Non-Obat)
  const getTrxObatTotal = (t: any) => {
    if (t.obatTotalAmount !== undefined) return t.obatTotalAmount;
    return t.items
      .filter((i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        return (i.itemType || med?.itemType || 'obat') !== 'non_obat';
      })
      .reduce((sum: number, i: any) => sum + i.subtotal, 0);
  };

  const getTrxNonObatTotal = (t: any) => {
    if (t.nonObatTotalAmount !== undefined) return t.nonObatTotalAmount;
    return t.items
      .filter((i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        return (i.itemType || med?.itemType) === 'non_obat';
      })
      .reduce((sum: number, i: any) => sum + i.subtotal, 0);
  };

  const getTrxObatCost = (t: any) => {
    if (t.obatCostAmount !== undefined) return t.obatCostAmount;
    return t.items
      .filter((i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        return (i.itemType || med?.itemType || 'obat') !== 'non_obat';
      })
      .reduce((sum: number, i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
        const itemMult = i.unit === 'Lusin' ? 12 : (i.unitMultiplier || masterMult);
        const purPrice = i.purchasePrice ?? med?.purchasePrice ?? Math.round(i.price * 0.7);
        const costPerPcs = masterMult > 1 ? purPrice / masterMult : purPrice;
        const qtyPcs = i.qty * itemMult;
        return sum + Math.round(costPerPcs * qtyPcs);
      }, 0);
  };

  const getTrxNonObatCost = (t: any) => {
    if (t.nonObatCostAmount !== undefined) return t.nonObatCostAmount;
    return t.items
      .filter((i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        return (i.itemType || med?.itemType) === 'non_obat';
      })
      .reduce((sum: number, i: any) => {
        const med = medicines.find(m => m.id === i.medicineId);
        const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
        const itemMult = i.unit === 'Lusin' ? 12 : (i.unitMultiplier || masterMult);
        const purPrice = i.purchasePrice ?? med?.purchasePrice ?? Math.round(i.price * 0.7);
        const costPerPcs = masterMult > 1 ? purPrice / masterMult : purPrice;
        const qtyPcs = i.qty * itemMult;
        return sum + Math.round(costPerPcs * qtyPcs);
      }, 0);
  };

  // --- BALANCE SHEET (NERACA KEUANGAN) COMPUTATION ---
  const balanceSheetData = useMemo(() => {
    // 4. Ekuitas / Modal
    const baseInitialModal = settings.initialCapital ?? 50000000;
    const additionalCapital = cashFlows
      .filter(cf => cf.type === 'Pemasukan' && (cf.category === 'Suntikan Modal' || cf.note.toLowerCase().includes('modal') || cf.note.toLowerCase().includes('suntikan')))
      .reduce((sum, cf) => sum + cf.amount, 0);

    const modalDisetor = baseInitialModal + additionalCapital;

    const completedTransactions = transactions.filter(t => t.status === 'Selesai');

    const totalSalesObat = completedTransactions.reduce((sum, t) => sum + getTrxObatTotal(t), 0);
    const totalSalesNonObat = completedTransactions.reduce((sum, t) => sum + getTrxNonObatTotal(t), 0);
    const totalSalesCombined = totalSalesObat + totalSalesNonObat;

    const totalHPPObat = completedTransactions.reduce((sum, t) => sum + getTrxObatCost(t), 0);
    const totalHPPNonObat = completedTransactions.reduce((sum, t) => sum + getTrxNonObatCost(t), 0);
    const totalHPPCombined = totalHPPObat + totalHPPNonObat;

    // EXCLUDE Non-Obat sales & inventory from main Balance Sheet (Requirement 5)
    const totalSalesNeraca = totalSalesObat;

    const totalExpenses = cashFlows
      .filter(cf => cf.type === 'Pengeluaran')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const totalPemasukanLain = cashFlows
      .filter(cf => cf.type === 'Pemasukan')
      .reduce((sum, cf) => sum + cf.amount, 0);

    // 2. Persediaan Obat (Valuasi Stok Obat Saja)
    const totalValuasiStok = medicines
      .filter(m => (m.itemType || 'obat') === 'obat')
      .reduce((sum, m) => {
        const mult = m.unit === 'Lusin' ? 12 : (m.unitMultiplier || 1);
        const costPerPcs = mult > 1 ? m.purchasePrice / mult : m.purchasePrice;
        return sum + Math.round(m.stock * costPerPcs);
      }, 0);

    const totalValuasiStokNonObat = medicines
      .filter(m => m.itemType === 'non_obat')
      .reduce((sum, m) => {
        const mult = m.unit === 'Lusin' ? 12 : (m.unitMultiplier || 1);
        const costPerPcs = mult > 1 ? m.purchasePrice / mult : m.purchasePrice;
        return sum + Math.round(m.stock * costPerPcs);
      }, 0);

    // 1. Kas & Setara Kas murni dari Penjualan Obat + Pemasukan - Pengeluaran
    const saldoKas = Math.max(0, totalSalesNeraca + totalPemasukanLain - totalExpenses);
    const totalAsetLancar = saldoKas + totalValuasiStok;
    const totalAset = totalAsetLancar;

    // Laba Ditahan / Berjalan otomatis menyesuaikan dengan persamaan neraca: Total Aset - Modal Disetor
    const labaDitahan = totalAset - modalDisetor;
    const totalEkuitas = modalDisetor + labaDitahan;

    const isBalanced = Math.abs(totalAset - totalEkuitas) < 1;

    return {
      saldoKas,
      totalValuasiStok,
      totalValuasiStokNonObat,
      totalSalesObat,
      totalSalesNonObat,
      totalSalesCombined,
      totalHPPObat,
      totalHPPNonObat,
      totalHPPCombined,
      totalAsetLancar,
      totalAset,
      modalDisetor,
      labaDitahan,
      totalEkuitas,
      isBalanced
    };
  }, [transactions, cashFlows, medicines, doctors, settings]);

  // --- REPORT COMPUTATION ---
  const reportData = useMemo(() => {
    const today = new Date();
    const todayStr = getWIBDateString();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const isDateInPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      if (reportPeriod === 'semua') return true;
      if (reportPeriod === 'hari_ini') return dateStr.startsWith(todayStr);
      if (reportPeriod === 'kemarin') return dateStr.startsWith(yesterdayStr);
      if (reportPeriod === 'bulan_ini') {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (reportPeriod === 'bulan_lalu') {
        const d = new Date(dateStr);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      if (reportPeriod === 'tahun_ini') {
        const d = new Date(dateStr);
        return d.getFullYear() === currentYear;
      }
      if (reportPeriod === 'kustom') {
        const dStr = dateStr.substring(0, 10);
        if (customStartDate && dStr < customStartDate) return false;
        if (customEndDate && dStr > customEndDate) return false;
        return true;
      }
      return true;
    };

    // Filter transactions
    const filteredTransactions = transactions.filter(trx => {
      if (trx.status !== 'Selesai') return false;
      return isDateInPeriod(trx.date);
    });

    // Filter cash flows
    const filteredCashFlows = cashFlows.filter(cf => {
      return isDateInPeriod(cf.date);
    });

    // Calculate Pendapatan (Penjualan)
    const totalPenjualanObat = filteredTransactions.reduce((sum, trx) => {
      if (trx.obatTotalAmount !== undefined) return sum + trx.obatTotalAmount;
      const obatVal = trx.items
        .filter((i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          return (i.itemType || med?.itemType || 'obat') !== 'non_obat';
        })
        .reduce((s: number, i: any) => s + i.subtotal, 0);
      return sum + obatVal;
    }, 0);

    const totalPenjualanNonObat = filteredTransactions.reduce((sum, trx) => {
      if (trx.nonObatTotalAmount !== undefined) return sum + trx.nonObatTotalAmount;
      const nonObatVal = trx.items
        .filter((i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          return (i.itemType || med?.itemType) === 'non_obat';
        })
        .reduce((s: number, i: any) => s + i.subtotal, 0);
      return sum + nonObatVal;
    }, 0);

    const totalPenjualan = totalPenjualanObat + totalPenjualanNonObat;
    
    // Calculate HPP
    const totalHPPObat = filteredTransactions.reduce((sum, trx) => {
      if (trx.obatCostAmount !== undefined && trx.obatCostAmount > 0) return sum + trx.obatCostAmount;
      const obatCost = trx.items
        .filter((i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          return (i.itemType || med?.itemType || 'obat') !== 'non_obat';
        })
        .reduce((s: number, i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
          const itemMult = i.unit === 'Lusin' ? 12 : (i.unitMultiplier || masterMult);
          const purPrice = i.purchasePrice ?? med?.purchasePrice ?? Math.round(i.price * 0.7);
          const costPerPcs = masterMult > 1 ? purPrice / masterMult : purPrice;
          const qtyPcs = i.qty * itemMult;
          return s + Math.round(costPerPcs * qtyPcs);
        }, 0);
      return sum + obatCost;
    }, 0);

    const totalHPPNonObat = filteredTransactions.reduce((sum, trx) => {
      if (trx.nonObatCostAmount !== undefined && trx.nonObatCostAmount > 0) return sum + trx.nonObatCostAmount;
      const nonObatCost = trx.items
        .filter((i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          return (i.itemType || med?.itemType) === 'non_obat';
        })
        .reduce((s: number, i: any) => {
          const med = medicines.find(m => m.id === i.medicineId);
          const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
          const itemMult = i.unit === 'Lusin' ? 12 : (i.unitMultiplier || masterMult);
          const purPrice = i.purchasePrice ?? med?.purchasePrice ?? Math.round(i.price * 0.7);
          const costPerPcs = masterMult > 1 ? purPrice / masterMult : purPrice;
          const qtyPcs = i.qty * itemMult;
          return s + Math.round(costPerPcs * qtyPcs);
        }, 0);
      return sum + nonObatCost;
    }, 0);

    const totalHPP = totalHPPObat + totalHPPNonObat;

    const labaKotorObat = totalPenjualanObat - totalHPPObat;
    const labaKotorNonObat = totalPenjualanNonObat - totalHPPNonObat;
    const labaKotor = totalPenjualan - totalHPP;

    // Filter Expenses (Pengeluaran Operasional)
    const expensesList = filteredCashFlows.filter(cf => cf.type === 'Pengeluaran');
    const totalBebanOperasional = expensesList.reduce((sum, cf) => sum + cf.amount, 0);

    // Group expenses by category
    const expensesByCategory: { [cat: string]: number } = {};
    expensesList.forEach(cf => {
      const cat = cf.category || 'Operasional';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + cf.amount;
    });

    // Filter Other Income (Pemasukan Non-POS, strictly excluding Suntikan Modal)
    const otherIncomeList = filteredCashFlows.filter(cf => {
      if (cf.type !== 'Pemasukan') return false;
      const isModalCategory = cf.category === 'Suntikan Modal';
      const isModalNote = cf.note.toLowerCase().includes('modal') || cf.note.toLowerCase().includes('suntikan');
      return !isModalCategory && !isModalNote;
    });

    const pemasukanLainnya = otherIncomeList.reduce((sum, cf) => sum + cf.amount, 0);

    // Group other income by category
    const otherIncomeByCategory: { [cat: string]: number } = {};
    otherIncomeList.forEach(cf => {
      const cat = cf.category || 'Pemasukan Lain';
      otherIncomeByCategory[cat] = (otherIncomeByCategory[cat] || 0) + cf.amount;
    });

    // Suntikan Modal in period for informative badge
    const suntikanModalInPeriod = filteredCashFlows
      .filter(cf => cf.type === 'Pemasukan' && (cf.category === 'Suntikan Modal' || cf.note.toLowerCase().includes('modal') || cf.note.toLowerCase().includes('suntikan')))
      .reduce((sum, cf) => sum + cf.amount, 0);

    const labaBersih = labaKotor - totalBebanOperasional + pemasukanLainnya;

    // Financial Ratios
    const grossMarginPct = totalPenjualan > 0 ? (labaKotor / totalPenjualan) * 100 : 0;
    const netMarginPct = totalPenjualan > 0 ? (labaBersih / totalPenjualan) * 100 : 0;
    const hppRatioPct = totalPenjualan > 0 ? (totalHPP / totalPenjualan) * 100 : 0;
    const opexRatioPct = totalPenjualan > 0 ? (totalBebanOperasional / totalPenjualan) * 100 : 0;

    // Medicine Profitability (Top medicines sold in period)
    const medProfitMap: { [medId: string]: { id: string; name: string; qty: number; sales: number; hpp: number; profit: number } } = {};
    filteredTransactions.forEach(trx => {
      trx.items.forEach(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        const name = item.medicineName || med?.name || 'Obat';
        const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
        const itemMult = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || masterMult);
        const costPrice = item.purchasePrice ?? med?.purchasePrice ?? Math.round(item.price * 0.7);
        const costPerPcs = masterMult > 1 ? costPrice / masterMult : costPrice;
        const qtyPcs = item.qty * itemMult;
        const itemSales = item.subtotal;
        const itemHPP = Math.round(costPerPcs * qtyPcs);
        const itemProfit = itemSales - itemHPP;

        if (!medProfitMap[item.medicineId]) {
          medProfitMap[item.medicineId] = { id: item.medicineId, name, qty: 0, sales: 0, hpp: 0, profit: 0 };
        }
        medProfitMap[item.medicineId].qty += item.qty;
        medProfitMap[item.medicineId].sales += itemSales;
        medProfitMap[item.medicineId].hpp += itemHPP;
        medProfitMap[item.medicineId].profit += itemProfit;
      });
    });

    const medicineProfits = Object.values(medProfitMap).sort((a, b) => b.profit - a.profit);

    return {
      filteredTransactions,
      filteredCashFlows,
      expensesList,
      expensesByCategory,
      otherIncomeList,
      otherIncomeByCategory,
      suntikanModalInPeriod,
      medicineProfits,
      totalPenjualan,
      totalPenjualanObat,
      totalPenjualanNonObat,
      totalHPP,
      totalHPPObat,
      totalHPPNonObat,
      labaKotor,
      labaKotorObat,
      labaKotorNonObat,
      pengeluaranLainnya: totalBebanOperasional,
      totalBebanOperasional,
      pemasukanLainnya,
      labaBersih,
      grossMarginPct,
      netMarginPct,
      hppRatioPct,
      opexRatioPct
    };
  }, [transactions, cashFlows, medicines, reportPeriod, customStartDate, customEndDate]);

  // --- CASH FLOW COMPUTATION ---
  const filteredArusKas = useMemo(() => {
    return cashFlows
      .filter(cf => cashFlowTypeFilter === 'Semua' || cf.type === cashFlowTypeFilter)
      .filter(cf => 
        cf.note.toLowerCase().includes(cashFlowSearch.toLowerCase()) || 
        cf.category.toLowerCase().includes(cashFlowSearch.toLowerCase())
      )
      .filter(cf => {
        if (cashFlowDatePreset === 'semua') return true;
        const cfDateStr = cf.date.substring(0, 10);
        if (cashFlowStartDate && cfDateStr < cashFlowStartDate) return false;
        if (cashFlowEndDate && cfDateStr > cashFlowEndDate) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cashFlows, cashFlowSearch, cashFlowTypeFilter, cashFlowDatePreset, cashFlowStartDate, cashFlowEndDate]);

  const cashFlowSummary = useMemo(() => {
    const totalPemasukan = filteredArusKas
      .filter(cf => cf.type === 'Pemasukan')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const totalPengeluaran = filteredArusKas
      .filter(cf => cf.type === 'Pengeluaran')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const netCashFlow = totalPemasukan - totalPengeluaran;
    return { totalPemasukan, totalPengeluaran, netCashFlow };
  }, [filteredArusKas]);

  const handleSaveCashFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashFlowAmount || Number(cashFlowAmount) <= 0) return;
    if (!cashFlowNote.trim()) return;

    addCashFlow({
      type: cashFlowType,
      category: cashFlowCategory,
      amount: Number(cashFlowAmount),
      note: cashFlowNote
    });

    setIsCashFlowModalOpen(false);
    setCashFlowAmount('');
    setCashFlowNote('');
    setCashFlowCategory('Operasional');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <WalletCards className="w-8 h-8 text-emerald-600" />
            Finansial & Neraca Keuangan
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Pantau posisi aset, kewajiban, modal, laporan laba rugi, dan arus kas apotek secara komprehensif.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('neraca')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'neraca'
              ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Scale className="w-4 h-4" />
          Neraca Keuangan (Balance Sheet)
        </button>
        <button
          onClick={() => setActiveTab('laporan')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'laporan'
              ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Laporan Laba / Rugi
        </button>
        <button
          onClick={() => setActiveTab('aruskas')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'aruskas'
              ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <List className="w-4 h-4" />
          Log Arus Kas
        </button>
      </div>

      {/* --- CONTENT 1: NERACA KEUANGAN (BALANCE SHEET) --- */}
      {activeTab === 'neraca' && (
        <div className="space-y-6 animate-fade-in">
          {/* Status Indicator Bar */}
          <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Status Balance Sheet & Audited Data</span>
                <span className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  {balanceSheetData.isBalanced ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      ✓ Seimbang Sempurna (Aset = Liabilitas + Ekuitas). Klik baris di bawah untuk melihat rincian & sumber data.
                    </span>
                  ) : (
                    <span className="text-amber-600">Perlu Penyesuaian</span>
                  )}
                </span>
              </div>
            </div>
            <div className="text-xs text-emerald-700 font-semibold bg-emerald-100/80 px-3 py-1 rounded-full">
              Real-time Terhubung POS & Inventaris
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: ASET (ASSETS) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
                <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  1. Aset Apotek (Assets)
                </h2>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                  Aset Lancar
                </span>
              </div>

              <div className="p-5 space-y-4 flex-1">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Aset Lancar</h3>
                  <div 
                    onClick={() => setSelectedBalanceDetail('kas')}
                    className="flex justify-between items-center py-3 px-3 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-emerald-50/60 cursor-pointer transition-all group"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-emerald-700 flex items-center gap-1.5">
                        Kas & Setara Kas
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">Rincian & Sumber</span>
                      </span>
                      <span className="text-xs text-slate-500">Saldo kas riil apotek dari operasional & POS</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">{formatRupiah(balanceSheetData.saldoKas)}</span>
                      <span className="text-[11px] text-emerald-600 font-semibold group-hover:underline">Lihat Detail ➔</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSelectedBalanceDetail('persediaan')}
                    className="flex justify-between items-center py-3 px-3 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-emerald-50/60 cursor-pointer transition-all group mt-2"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-emerald-700 flex items-center gap-1.5">
                        Persediaan Obat (Inventory)
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">Rincian & Sumber</span>
                      </span>
                      <span className="text-xs text-slate-500">Nilai aset modal stok obat di etalase/gudang</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">{formatRupiah(balanceSheetData.totalValuasiStok)}</span>
                      <span className="text-[11px] text-emerald-600 font-semibold group-hover:underline">Lihat Detail ➔</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-emerald-800 text-white flex justify-between items-center">
                <span className="font-extrabold text-lg">TOTAL ASET</span>
                <span className="font-extrabold text-xl text-emerald-300">
                  {formatRupiah(balanceSheetData.totalAset)}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: EKUITAS & MODAL */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  2. Ekuitas & Modal
                </h2>
                <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">
                  Modal Disetor + Laba Ditahan
                </span>
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Ekuitas */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ekuitas / Modal Apotek</h3>
                  <div 
                    onClick={() => setSelectedBalanceDetail('modal')}
                    className="flex justify-between items-center py-3 px-3 rounded-xl border border-transparent hover:border-indigo-200 hover:bg-indigo-50/60 cursor-pointer transition-all group"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-indigo-700 flex items-center gap-1.5">
                        Modal Awal / Disetor
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">Rincian & Sumber</span>
                      </span>
                      <span className="text-xs text-slate-500">Modal disetor pemilik & suntikan kas</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">{formatRupiah(balanceSheetData.modalDisetor)}</span>
                      <span className="text-[11px] text-indigo-600 font-semibold group-hover:underline">Lihat Detail ➔</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setSelectedBalanceDetail('laba')}
                    className="flex justify-between items-center py-3 px-3 rounded-xl border border-transparent hover:border-indigo-200 hover:bg-indigo-50/60 cursor-pointer transition-all group mt-2"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-indigo-700 flex items-center gap-1.5">
                        Laba Ditahan / Berjalan
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">Rincian & Sumber</span>
                      </span>
                      <span className="text-xs text-slate-500">Hasil kumulatif laba bersih apotek</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-extrabold block ${balanceSheetData.labaDitahan >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatRupiah(balanceSheetData.labaDitahan)}
                      </span>
                      <span className="text-[11px] text-indigo-600 font-semibold group-hover:underline">Lihat Detail ➔</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 mt-2 px-2 border-t border-slate-100">
                    <span className="font-bold text-slate-700 text-xs">Total Ekuitas</span>
                    <span className="font-bold text-slate-900 text-sm">{formatRupiah(balanceSheetData.totalEkuitas)}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-800 text-white flex justify-between items-center">
                <span className="font-extrabold text-lg">TOTAL EKUITAS & MODAL</span>
                <span className="font-extrabold text-xl text-emerald-400">
                  {formatRupiah(balanceSheetData.totalEkuitas)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT 2: LAPORAN LABA RUGI --- */}
      {activeTab === 'laporan' && (
        <div className="space-y-6 animate-fade-in">
          {/* Period Filter & Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span>Periode Laporan:</span>
              </div>
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all cursor-pointer"
              >
                <option value="hari_ini">Hari Ini</option>
                <option value="kemarin">Kemarin</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="bulan_lalu">Bulan Lalu</option>
                <option value="tahun_ini">Tahun Ini</option>
                <option value="semua">Semua Waktu</option>
                <option value="kustom">Kustom Tanggal</option>
              </select>

              {reportPeriod === 'kustom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-xs text-slate-400 font-bold">s/d</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800">{reportData.filteredTransactions.length}</span> Trx POS • <span className="font-bold text-slate-800">{reportData.filteredCashFlows.length}</span> Arus Kas
              </div>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0"
              >
                <Printer className="w-4 h-4" />
                Cetak / Export Laporan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Interactive Laba Rugi Table (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    Laporan Laba / Rugi Operasional
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Klik pada setiap komponen untuk melihat rincian transaksi detail</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 rounded-full">
                  Format Standar Akuntansi
                </span>
              </div>

              <div className="p-5 space-y-5 flex-1">
                {/* I. PENDAPATAN USAHA */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">I. Pendapatan Operasional Usaha</h3>
                  </div>

                  {/* Penjualan POS */}
                  <div
                    onClick={() => setSelectedIncomeDetail('penjualan')}
                    className="flex justify-between items-center py-2.5 px-3 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-emerald-50/50 cursor-pointer transition-all group"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-emerald-700 flex items-center gap-1.5">
                        Penjualan Obat & Alkes (POS)
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                          {reportData.filteredTransactions.length} Transaksi
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">Pendapatan bersih dari kasir POS</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">{formatRupiah(reportData.totalPenjualan)}</span>
                      <span className="text-[11px] text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5 justify-end">
                        Lihat Rincian <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* HPP */}
                  <div
                    onClick={() => setSelectedIncomeDetail('hpp')}
                    className="flex justify-between items-center py-2.5 px-3 rounded-xl border border-transparent hover:border-rose-200 hover:bg-rose-50/50 cursor-pointer transition-all group mt-1"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-rose-700 flex items-center gap-1.5">
                        Harga Pokok Penjualan (HPP)
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-semibold">
                          {reportData.hppRatioPct.toFixed(1)}% Ratio
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">Beban modal pokok obat yang terjual</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-rose-600 block">- {formatRupiah(reportData.totalHPP)}</span>
                      <span className="text-[11px] text-rose-600 font-semibold group-hover:underline flex items-center gap-0.5 justify-end">
                        Detail Margin <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Subtotal Laba Kotor */}
                  <div className="flex justify-between items-center pt-3 mt-2 px-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                    <div className="py-2">
                      <span className="font-extrabold text-emerald-950 text-sm block">LABA KOTOR (GROSS PROFIT)</span>
                      <span className="text-xs text-emerald-800/80 font-medium">Total Penjualan dikurangi HPP</span>
                    </div>
                    <div className="text-right py-2">
                      <span className="font-extrabold text-emerald-800 text-base block">{formatRupiah(reportData.labaKotor)}</span>
                      <span className="text-xs bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-md inline-block">
                        Margin Laba Kotor: {reportData.grossMarginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200 border-dashed my-3" />

                {/* II. BEBAN OPERASIONAL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">II. Beban Operasional Apotek</h3>
                  </div>

                  <div
                    onClick={() => setSelectedIncomeDetail('beban')}
                    className="p-3 rounded-2xl border border-transparent hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer transition-all group space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-800 text-sm font-bold block group-hover:text-slate-900 flex items-center gap-1.5">
                          Total Beban Kas Operasional
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                            {reportData.expensesList.length} Catatan Beban
                          </span>
                        </span>
                        <span className="text-xs text-slate-500">Biaya rutin operasional & administrasi</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-rose-600 text-sm block">- {formatRupiah(reportData.totalBebanOperasional)}</span>
                        <span className="text-[11px] text-slate-600 font-semibold group-hover:underline flex items-center gap-0.5 justify-end">
                          Lihat Rincian Beban <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    {/* Breakdown categories inline */}
                    {Object.keys(reportData.expensesByCategory).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                        {Object.entries(reportData.expensesByCategory).map(([cat, amt]) => (
                          <div key={cat} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                            <span className="text-slate-600 font-medium truncate">{cat}</span>
                            <span className="font-bold text-rose-600">{formatRupiah(Number(amt))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200 border-dashed my-3" />

                {/* III. PENDAPATAN LAINNYA */}
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">III. Pendapatan Lainnya (Non-Operasional)</h3>
                  
                  <div
                    onClick={() => setSelectedIncomeDetail('pemasukan_lain')}
                    className="flex justify-between items-center py-2.5 px-3 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-emerald-50/50 cursor-pointer transition-all group"
                  >
                    <div>
                      <span className="text-slate-800 text-sm font-bold block group-hover:text-emerald-700 flex items-center gap-1.5">
                        Pemasukan Non-Penjualan (Kas)
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                          {reportData.otherIncomeList.length} Catatan
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">Pendapatan diluar omset penjualan kasir (Eksklusif Suntikan Modal)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-emerald-600 block">+ {formatRupiah(reportData.pemasukanLainnya)}</span>
                      <span className="text-[11px] text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5 justify-end">
                        Lihat Detail <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {reportData.suntikanModalInPeriod > 0 && (
                    <div className="mt-2 p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Suntikan modal sebesar <strong>{formatRupiah(reportData.suntikanModalInPeriod)}</strong> di periode ini dialokasikan ke Ekuitas/Modal Disetor pada Neraca (tidak dihitung sebagai Laba/Rugi operasional).
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM HIGHLIGHT BANNER: LABA BERSIH */}
              <div 
                onClick={() => setSelectedIncomeDetail('laba_bersih')}
                className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-slate-850 transition-all border-t border-slate-800 group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg">LABA BERSIH (NET PROFIT)</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${reportData.labaBersih >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {reportData.netMarginPct.toFixed(1)}% Net Margin
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Hasil bersih setelah Laba Kotor - Total Beban Operasional + Pemasukan Lain</p>
                </div>
                <div className="text-right w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end">
                  <span className={`font-black text-2xl ${reportData.labaBersih >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatRupiah(reportData.labaBersih)}
                  </span>
                  <span className="text-xs text-slate-400 group-hover:text-emerald-300 transition-colors font-semibold flex items-center gap-1">
                    Analisis Rasio Keuangan <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Summary Cards & Profitability Ratios (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Total Income Card */}
              <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-200/80 shadow-2xs flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-emerald-950 font-extrabold text-sm mb-0.5">Total Omset & Income</p>
                  <p className="text-xs text-emerald-700/80 font-medium mb-2">Penjualan POS ({formatRupiah(reportData.totalPenjualan)}) + Pemasukan Lain ({formatRupiah(reportData.pemasukanLainnya)})</p>
                  <p className="text-2xl font-black text-emerald-800">
                    {formatRupiah(reportData.totalPenjualan + reportData.pemasukanLainnya)}
                  </p>
                </div>
              </div>
              
              {/* Total Expenses Card */}
              <div className="bg-rose-50 rounded-3xl p-5 border border-rose-200/80 shadow-2xs flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-200 text-rose-800 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-rose-950 font-extrabold text-sm mb-0.5">Total Beban & Pengeluaran</p>
                  <p className="text-xs text-rose-700/80 font-medium mb-2">HPP Obat ({formatRupiah(reportData.totalHPP)}) + Beban Operasional ({formatRupiah(reportData.totalBebanOperasional)})</p>
                  <p className="text-2xl font-black text-rose-800">
                    {formatRupiah(reportData.totalHPP + reportData.totalBebanOperasional)}
                  </p>
                </div>
              </div>

              {/* Ratios & Margins Panel */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Indikator Profitabilitas Periode Ini
                  </h3>
                  <button
                    onClick={() => setSelectedIncomeDetail('laba_bersih')}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Detail Analisis
                  </button>
                </div>

                {/* Progress bar: Gross Margin */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Margin Laba Kotor (Gross Margin)</span>
                    <span className="text-emerald-700">{reportData.grossMarginPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, reportData.grossMarginPct))}%` }}
                    />
                  </div>
                </div>

                {/* Progress bar: Net Margin */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Margin Laba Bersih (Net Margin)</span>
                    <span className={reportData.netMarginPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                      {reportData.netMarginPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${reportData.netMarginPct >= 0 ? 'bg-emerald-600' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, Math.abs(reportData.netMarginPct)))}%` }}
                    />
                  </div>
                </div>

                {/* Progress bar: HPP Ratio */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Rasio HPP Modal Obat</span>
                    <span className="text-amber-700">{reportData.hppRatioPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, reportData.hppRatioPct))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Top Profitable Medicines Preview Card */}
              {reportData.medicineProfits.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-2 uppercase tracking-wider">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      Top 3 Obat Paling Menguntungkan
                    </h3>
                    <button
                      onClick={() => setSelectedIncomeDetail('hpp')}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Lihat Semua →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {reportData.medicineProfits.slice(0, 3).map((item, idx) => (
                      <div key={item.id || idx} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[180px]">{item.name}</p>
                          <p className="text-[11px] text-slate-500">{item.qty} pcs terjual • Omset {formatRupiah(item.sales)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-emerald-700">+{formatRupiah(item.profit)}</p>
                          <p className="text-[10px] font-semibold text-slate-400">Margin: {item.sales > 0 ? ((item.profit / item.sales) * 100).toFixed(0) : 0}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT 3: ARUS KAS --- */}
      {activeTab === 'aruskas' && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary Cards for Filtered Cash Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pemasukan</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-1">+{formatRupiah(cashFlowSummary.totalPemasukan)}</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pengeluaran</p>
                <p className="text-xl font-extrabold text-rose-600 mt-1">-{formatRupiah(cashFlowSummary.totalPengeluaran)}</p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Arus Kas Bersih (Net)</p>
                <p className={`text-xl font-extrabold mt-1 ${cashFlowSummary.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {cashFlowSummary.netCashFlow >= 0 ? '+' : ''}{formatRupiah(cashFlowSummary.netCashFlow)}
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${cashFlowSummary.netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <WalletCards className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari keterangan / kategori..."
                    value={cashFlowSearch}
                    onChange={e => setCashFlowSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full transition-all"
                  />
                </div>

                {/* Filter Tipe */}
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={cashFlowTypeFilter}
                    onChange={e => setCashFlowTypeFilter(e.target.value as any)}
                    className="pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none bg-white text-slate-700"
                  >
                    <option value="Semua">Semua Tipe</option>
                    <option value="Pemasukan">Pemasukan</option>
                    <option value="Pengeluaran">Pengeluaran</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Filter Rentang Tanggal */}
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={cashFlowDatePreset}
                    onChange={e => handleCashFlowPresetChange(e.target.value as any)}
                    className="pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none bg-white text-slate-700"
                  >
                    <option value="semua">Semua Tanggal</option>
                    <option value="hari_ini">Hari Ini</option>
                    <option value="7_hari">7 Hari Terakhir</option>
                    <option value="30_hari">30 Hari Terakhir</option>
                    <option value="bulan_ini">Bulan Ini</option>
                    <option value="kustom">Rentang Kustom...</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {(cashFlowSearch || cashFlowTypeFilter !== 'Semua' || cashFlowDatePreset !== 'semua') && (
                  <button
                    onClick={() => {
                      setCashFlowSearch('');
                      setCashFlowTypeFilter('Semua');
                      handleCashFlowPresetChange('semua');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setCashFlowType('Pemasukan');
                    setCashFlowCategory('Suntikan Modal');
                    setIsCashFlowModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <TrendingUp className="w-4 h-4" />
                  + Catat Pemasukan
                </button>
                <button
                  onClick={() => {
                    setCashFlowType('Pengeluaran');
                    setCashFlowCategory('Operasional');
                    setIsCashFlowModalOpen(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <TrendingDown className="w-4 h-4" />
                  + Catat Pengeluaran
                </button>
              </div>
            </div>

            {/* Custom Date Range Inputs */}
            {cashFlowDatePreset === 'kustom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Pilih Rentang Tanggal:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={cashFlowStartDate}
                    onChange={e => setCashFlowStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <span className="font-bold text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={cashFlowEndDate}
                    onChange={e => setCashFlowEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* List Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-bold">Tanggal</th>
                    <th className="py-3 px-4 font-bold">Tipe & Kategori</th>
                    <th className="py-3 px-4 font-bold">Keterangan</th>
                    <th className="py-3 px-4 font-bold">Petugas</th>
                    <th className="py-3 px-4 font-bold text-right">Jumlah</th>
                    <th className="py-3 px-4 font-bold text-center w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArusKas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Tidak ada data arus kas.
                      </td>
                    </tr>
                  ) : (
                    filteredArusKas.map(cf => (
                      <tr key={cf.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-700">{formatDateTime(cf.date)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-1 ${
                              cf.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {cf.type}
                          </span>
                          <div className="text-slate-600 font-medium text-xs">{cf.category}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-800">{cf.note}</td>
                        <td className="py-3 px-4 text-slate-600">{cf.recordedBy}</td>
                        <td className={`py-3 px-4 text-right font-extrabold ${cf.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {cf.type === 'Pemasukan' ? '+' : '-'} {formatRupiah(cf.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setDeletingCashFlowId(cf.id)}
                            className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Cash Flow */}
      {isCashFlowModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="font-extrabold text-slate-800 text-lg">Catat Arus Kas</h3>
                <button
                  onClick={() => setIsCashFlowModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <form onSubmit={handleSaveCashFlow} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipe Arus Kas</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCashFlowType('Pemasukan');
                      setCashFlowCategory('Suntikan Modal');
                    }}
                    className={`p-3 rounded-xl border-2 font-bold transition-all ${
                      cashFlowType === 'Pemasukan'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashFlowType('Pengeluaran');
                      setCashFlowCategory('Operasional');
                    }}
                    className={`p-3 rounded-xl border-2 font-bold transition-all ${
                      cashFlowType === 'Pengeluaran'
                        ? 'border-rose-600 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <TrendingDown className="w-5 h-5 mx-auto mb-1" />
                    Pengeluaran
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Kategori</label>
                <select
                  value={cashFlowCategory}
                  onChange={e => setCashFlowCategory(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  {cashFlowType === 'Pengeluaran' ? (
                    <>
                      <option value="Operasional">Operasional (Alat Tulis, dsb)</option>
                      <option value="Gaji & Honor">Gaji & Honor Karyawan</option>
                      <option value="Listrik & Air">Listrik, Air & Internet</option>
                      <option value="Pajak & Retribusi">Pajak & Retribusi</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Suntikan Modal">Suntikan Modal</option>
                      <option value="Pendapatan Jasa Lainnya">Pendapatan Jasa Lainnya</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Jumlah Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={cashFlowAmount}
                  onChange={e => setCashFlowAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan / Catatan</label>
                <textarea
                  required
                  value={cashFlowNote}
                  onChange={e => setCashFlowNote(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Penjelasan ringkas tentang arus kas ini..."
                  rows={2}
                />
              </div>

                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl transition-colors shadow-md"
                  >
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- BALANCE SHEET DETAIL MODAL --- */}
      {selectedBalanceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col text-left my-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider block">Audit Rincian & Sumber Data Neraca</span>
                <h3 className="font-extrabold text-slate-800 text-xl">
                  {selectedBalanceDetail === 'kas' && 'Kas & Setara Kas'}
                  {selectedBalanceDetail === 'persediaan' && 'Persediaan Obat (Inventory)'}
                  {selectedBalanceDetail === 'modal' && 'Modal Awal / Disetor'}
                  {selectedBalanceDetail === 'laba' && 'Laba Ditahan / Berjalan'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBalanceDetail(null)}
                className="p-2 hover:bg-slate-200/60 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Formula & Explanation Card */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4">
                <h4 className="font-extrabold text-emerald-900 text-sm mb-1">Formula & Metode Perhitungan:</h4>
                <p className="text-xs text-emerald-800 font-mono bg-emerald-100/80 p-2 rounded-xl mb-2">
                  {selectedBalanceDetail === 'kas' && 'Saldo Kas = (Total Penjualan Obat POS Selesai) + (Pemasukan Arus Kas Lainnya) - (Pengeluaran Arus Kas Lainnya)'}
                  {selectedBalanceDetail === 'persediaan' && 'Valuasi Persediaan = Sum(Stok Fisik Obat Saja x Harga Beli / HPP per unit)'}
                  {selectedBalanceDetail === 'modal' && 'Modal Disetor = Modal Awal Standar (Rp 50.000.000) + Akumulasi Suntikan Modal via Log Arus Kas'}
                  {selectedBalanceDetail === 'laba' && 'Laba Ditahan = Total Aset (Kas + Stok Obat) - Total Liabilitas (Utang) - Total Modal Disetor'}
                </p>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {selectedBalanceDetail === 'kas' && 'Hanya transaksi penjualan obat apotek yang berstatus "Selesai" yang masuk ke kas neraca (penjualan non-obat dikecualikan dari neraca keuangan), ditambah pemasukan kas operasional dan dikurangi pengeluaran operasional.'}
                  {selectedBalanceDetail === 'persediaan' && 'Nilai persediaan neraca murni dihitung berdasarkan harga beli (HPP) dikalikan dengan stok fisik aktif sediaan obat (barang non-obat dikecualikan dari neraca keuangan).'}
                  {selectedBalanceDetail === 'modal' && 'Modal disetor mencakup modal pendirian awal apotek serta penambahan modal dari catatan arus kas bertipe pemasukan dengan kategori "Suntikan Modal".'}
                  {selectedBalanceDetail === 'laba' && 'Laba ditahan atau berjalan merepresentasikan akumulasi surplus kekayaan bersih apotek yang diperoleh dari selisih seluruh aset dikurangi kewajiban dan modal.'}
                </p>
              </div>

              {/* Data Source Tables */}
              {selectedBalanceDetail === 'kas' && (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm mb-2">
                      1. Sumber dari Penjualan POS Obat Selesai ({transactions.filter(t => t.status === 'Selesai' && getTrxObatTotal(t) > 0).length} transaksi - non-obat dikecualikan)
                    </h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-bold">No. Transaksi / Waktu</th>
                            <th className="py-2 px-3 font-bold">Pelanggan</th>
                            <th className="py-2 px-3 font-bold text-right">Penjualan Obat (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transactions.filter(t => t.status === 'Selesai' && getTrxObatTotal(t) > 0).map(t => {
                            const obatTotal = getTrxObatTotal(t);
                            return (
                              <tr key={t.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-medium text-slate-700">{t.id} - {formatDateTime(t.date)}</td>
                                <td className="py-2 px-3 text-slate-600">{t.customerName || 'Umum'}</td>
                                <td className="py-2 px-3 text-right font-extrabold text-emerald-600">+{formatRupiah(obatTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-slate-800 text-sm mb-2">2. Sumber dari Log Arus Kas ({cashFlows.length} catatan)</h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-bold">Tanggal</th>
                            <th className="py-2 px-3 font-bold">Tipe & Kategori</th>
                            <th className="py-2 px-3 font-bold">Keterangan</th>
                            <th className="py-2 px-3 font-bold text-right">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cashFlows.map(cf => (
                            <tr key={cf.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-700">{formatDate(cf.date)}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${cf.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {cf.type} ({cf.category})
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600">{cf.note}</td>
                              <td className={`py-2 px-3 text-right font-extrabold ${cf.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {cf.type === 'Pemasukan' ? '+' : '-'} {formatRupiah(cf.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {selectedBalanceDetail === 'persediaan' && (
                <div>
                  <h5 className="font-bold text-slate-800 text-sm mb-2">
                    Daftar Sediaan Obat & Valuasi Stok ({medicines.filter(m => (m.itemType || 'obat') === 'obat').length} Item - non-obat dikecualikan)
                  </h5>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">Nama Obat</th>
                          <th className="py-2.5 px-3 font-bold">Kategori</th>
                          <th className="py-2.5 px-3 font-bold text-center">Stok</th>
                          <th className="py-2.5 px-3 font-bold text-right">Harga Beli (HPP)</th>
                          <th className="py-2.5 px-3 font-bold text-right">Total Valuasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {medicines.filter(m => (m.itemType || 'obat') === 'obat').map(m => {
                          const mult = m.unit === 'Lusin' ? 12 : (m.unitMultiplier || 1);
                          const costPerPcs = mult > 1 ? m.purchasePrice / mult : m.purchasePrice;
                          const val = Math.round(m.stock * costPerPcs);
                          return (
                            <tr key={m.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-800">{m.name}</td>
                              <td className="py-2.5 px-3 text-slate-600">{m.category}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">{formatRupiah(m.purchasePrice)}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">{formatRupiah(val)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedBalanceDetail === 'modal' && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-indigo-900 font-bold text-sm block">Modal Awal Pendirian Apotek</span>
                        <span className="text-xs text-indigo-700">Dapat disesuaikan sesuai modal pendirian aktual</span>
                      </div>
                      {!isEditingInitialCapital ? (
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-indigo-900 text-base">{formatRupiah(settings.initialCapital ?? 50000000)}</span>
                          <button
                            onClick={() => {
                              setInitialCapitalInput(String(settings.initialCapital ?? 50000000));
                              setIsEditingInitialCapital(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-xs"
                          >
                            Ubah Modal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={initialCapitalInput}
                            onChange={(e) => setInitialCapitalInput(e.target.value)}
                            className="w-36 px-3 py-1 text-sm bg-white border border-indigo-300 rounded-xl font-bold text-indigo-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => {
                              const val = parseFloat(initialCapitalInput);
                              if (!isNaN(val) && val >= 0) {
                                updateSettings({ initialCapital: val });
                                setIsEditingInitialCapital(false);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setIsEditingInitialCapital(false)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-bold text-slate-800 text-sm">Tambahan Suntikan Modal via Arus Kas:</h5>
                      <button
                        onClick={() => {
                          setSelectedBalanceDetail(null);
                          setCashFlowType('Pemasukan');
                          setCashFlowCategory('Suntikan Modal');
                          setIsCashFlowModalOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Catat Suntikan Modal Baru
                      </button>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-bold">Tanggal</th>
                            <th className="py-2 px-3 font-bold">Keterangan</th>
                            <th className="py-2 px-3 font-bold text-right">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cashFlows.filter(cf => cf.type === 'Pemasukan' && (cf.category === 'Suntikan Modal' || cf.note.toLowerCase().includes('modal') || cf.note.toLowerCase().includes('suntikan'))).length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-6 text-center text-slate-400">Tidak ada suntikan modal tambahan dari arus kas.</td>
                            </tr>
                          ) : (
                            cashFlows.filter(cf => cf.type === 'Pemasukan' && (cf.category === 'Suntikan Modal' || cf.note.toLowerCase().includes('modal') || cf.note.toLowerCase().includes('suntikan'))).map(cf => (
                              <tr key={cf.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-700">{formatDate(cf.date)}</td>
                                <td className="py-2 px-3 text-slate-600">{cf.note}</td>
                                <td className="py-2 px-3 text-right font-extrabold text-emerald-600">+{formatRupiah(cf.amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {selectedBalanceDetail === 'laba' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">Total Aset Keseluruhan</span>
                      <span className="text-lg font-extrabold text-slate-900">{formatRupiah(balanceSheetData.totalAset)}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">Total Modal Disetor</span>
                      <span className="text-lg font-extrabold text-indigo-700">{formatRupiah(balanceSheetData.modalDisetor)}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-emerald-800 font-bold block">Selisih Bersih (Laba Ditahan / Berjalan)</span>
                      <span className="text-xs text-emerald-700">Hasil audit otomatis dari perhitungan neraca seimbang</span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-700">{formatRupiah(balanceSheetData.labaDitahan)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedBalanceDetail(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* --- MODAL DETAIL LAPORAN LABA RUGI --- */}
      {selectedIncomeDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100 text-left my-auto animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  {selectedIncomeDetail === 'penjualan' && <Receipt className="w-5 h-5" />}
                  {selectedIncomeDetail === 'hpp' && <Tag className="w-5 h-5" />}
                  {selectedIncomeDetail === 'beban' && <TrendingDown className="w-5 h-5" />}
                  {selectedIncomeDetail === 'pemasukan_lain' && <Coins className="w-5 h-5" />}
                  {selectedIncomeDetail === 'laba_bersih' && <BarChart3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    {selectedIncomeDetail === 'penjualan' && 'Rincian Penjualan Obat & Alkes (POS)'}
                    {selectedIncomeDetail === 'hpp' && 'Rincian Harga Pokok Penjualan (HPP) & Margin Produk'}
                    {selectedIncomeDetail === 'beban' && 'Rincian Beban & Pengeluaran Operasional'}
                    {selectedIncomeDetail === 'pemasukan_lain' && 'Rincian Pemasukan Non-Penjualan'}
                    {selectedIncomeDetail === 'laba_bersih' && 'Analisis Rasio & Kinerja Profitabilitas'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Data transaksi riil untuk periode laporan terpilih
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedIncomeDetail(null);
                  setExpandedTrxId(null);
                }}
                className="p-2 hover:bg-slate-200/60 rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* DETAIL PENJUALAN POS */}
              {selectedIncomeDetail === 'penjualan' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-emerald-800 font-bold block">Total Omset Penjualan POS Selesai</span>
                      <span className="text-xs text-emerald-700">{reportData.filteredTransactions.length} Transaksi terverifikasi</span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-800">{formatRupiah(reportData.totalPenjualan)}</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">No. Transaksi / Waktu</th>
                          <th className="py-2.5 px-3 font-bold">Pelanggan</th>
                          <th className="py-2.5 px-3 font-bold">Dokter</th>
                          <th className="py-2.5 px-3 font-bold">Kasir</th>
                          <th className="py-2.5 px-3 font-bold text-center">Item</th>
                          <th className="py-2.5 px-3 font-bold text-right">Total (Rp)</th>
                          <th className="py-2.5 px-3 font-bold text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">Tidak ada transaksi penjualan pada periode ini.</td>
                          </tr>
                        ) : (
                          reportData.filteredTransactions.map(trx => {
                            const isExpanded = expandedTrxId === trx.id;
                            return (
                              <React.Fragment key={trx.id}>
                                <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50/90' : ''}`}>
                                  <td className="py-2.5 px-3 font-bold text-slate-800">
                                    {trx.id}
                                    <span className="block font-normal text-[10px] text-slate-500">{formatDateTime(trx.date)}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 font-medium">{trx.customerName || 'Umum'}</td>
                                  <td className="py-2.5 px-3 text-slate-500">{trx.doctorName || '-'}</td>
                                  <td className="py-2.5 px-3 text-slate-500">{trx.cashierName || 'Kasir'}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                                      {trx.items.length} item
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatRupiah(trx.totalAmount)}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      onClick={() => setExpandedTrxId(isExpanded ? null : trx.id)}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold transition-colors"
                                    >
                                      {isExpanded ? 'Tutup' : 'Item Detail'}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="p-3 bg-slate-100/70">
                                      <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                                        <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Rincian Obat Terjual Pada Nota #{trx.id}</p>
                                        <div className="divide-y divide-slate-100">
                                          {trx.items.map((it, idx) => {
                                            const med = medicines.find(m => m.id === it.medicineId);
                                            const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
                                            const itemMult = it.unit === 'Lusin' ? 12 : (it.unitMultiplier || masterMult);
                                            const purPrice = it.purchasePrice ?? med?.purchasePrice ?? Math.round(it.price * 0.7);
                                            const costPerPcs = masterMult > 1 ? purPrice / masterMult : purPrice;
                                            const qtyPcs = it.qty * itemMult;
                                            const lineHPP = Math.round(costPerPcs * qtyPcs);
                                            const lineProfit = it.subtotal - lineHPP;
                                            return (
                                              <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                                                <div>
                                                  <span className="font-bold text-slate-800">{it.medicineName}</span>
                                                  <span className="text-slate-500 ml-2">({it.qty} x {formatRupiah(it.price)})</span>
                                                </div>
                                                <div className="text-right">
                                                  <span className="font-bold text-slate-900 mr-3">Subtotal: {formatRupiah(it.subtotal)}</span>
                                                  <span className="text-emerald-700 font-semibold text-[11px]">Profit: +{formatRupiah(lineProfit)}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DETAIL HPP PRODUK */}
              {selectedIncomeDetail === 'hpp' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">Total HPP Obat</span>
                      <span className="text-lg font-black text-rose-600">{formatRupiah(reportData.totalHPP)}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">Total Laba Kotor Produk</span>
                      <span className="text-lg font-black text-emerald-600">{formatRupiah(reportData.labaKotor)}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">Margin Laba Kotor Rata-rata</span>
                      <span className="text-lg font-black text-emerald-700">{reportData.grossMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-2">Laporan Profitabilitas Produk Terjual Periode Ini:</h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 font-bold">Nama Obat / Alkes</th>
                            <th className="py-2.5 px-3 font-bold text-center">Qty Terjual</th>
                            <th className="py-2.5 px-3 font-bold text-right">Total Omset Jual</th>
                            <th className="py-2.5 px-3 font-bold text-right">Total HPP (Modal)</th>
                            <th className="py-2.5 px-3 font-bold text-right">Laba Kotor (Rp)</th>
                            <th className="py-2.5 px-3 font-bold text-center">Margin %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportData.medicineProfits.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">Tidak ada produk terjual pada periode ini.</td>
                            </tr>
                          ) : (
                            reportData.medicineProfits.map((med, idx) => {
                              const marginPct = med.sales > 0 ? (med.profit / med.sales) * 100 : 0;
                              return (
                                <tr key={med.id || idx} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-bold text-slate-800">{med.name}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-700">{med.qty} pcs</td>
                                  <td className="py-2.5 px-3 text-right font-medium text-slate-900">{formatRupiah(med.sales)}</td>
                                  <td className="py-2.5 px-3 text-right text-rose-600 font-medium">{formatRupiah(med.hpp)}</td>
                                  <td className="py-2.5 px-3 text-right font-black text-emerald-700">+{formatRupiah(med.profit)}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                                      {marginPct.toFixed(0)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* DETAIL BEBAN OPERASIONAL */}
              {selectedIncomeDetail === 'beban' && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-rose-800 font-bold block">Total Beban Operasional Kas</span>
                      <span className="text-xs text-rose-700">{reportData.expensesList.length} Catatan Pengeluaran</span>
                    </div>
                    <span className="text-xl font-extrabold text-rose-700">- {formatRupiah(reportData.totalBebanOperasional)}</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">Tanggal</th>
                          <th className="py-2.5 px-3 font-bold">Kategori</th>
                          <th className="py-2.5 px-3 font-bold">Keterangan / Rincian</th>
                          <th className="py-2.5 px-3 font-bold">Pencatat</th>
                          <th className="py-2.5 px-3 font-bold text-right">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.expensesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">Tidak ada pengeluaran operasional pada periode ini.</td>
                          </tr>
                        ) : (
                          reportData.expensesList.map(cf => (
                            <tr key={cf.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-slate-700 font-medium">{formatDate(cf.date)}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                                  {cf.category || 'Operasional'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-medium">{cf.note}</td>
                              <td className="py-2.5 px-3 text-slate-500">{cf.recordedBy || 'Admin'}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-rose-600">- {formatRupiah(cf.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DETAIL PEMASUKAN LAIN */}
              {selectedIncomeDetail === 'pemasukan_lain' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-emerald-800 font-bold block">Total Pemasukan Non-Penjualan</span>
                      <span className="text-xs text-emerald-700">{reportData.otherIncomeList.length} Catatan Kas Inflow</span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-700">+ {formatRupiah(reportData.pemasukanLainnya)}</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">Tanggal</th>
                          <th className="py-2.5 px-3 font-bold">Kategori</th>
                          <th className="py-2.5 px-3 font-bold">Keterangan</th>
                          <th className="py-2.5 px-3 font-bold">Pencatat</th>
                          <th className="py-2.5 px-3 font-bold text-right">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.otherIncomeList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">Tidak ada pemasukan non-penjualan pada periode ini.</td>
                          </tr>
                        ) : (
                          reportData.otherIncomeList.map(cf => (
                            <tr key={cf.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-slate-700 font-medium">{formatDate(cf.date)}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                                  {cf.category || 'Pemasukan'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-medium">{cf.note}</td>
                              <td className="py-2.5 px-3 text-slate-500">{cf.recordedBy || 'Admin'}</td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600">+ {formatRupiah(cf.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DETAIL LABA BERSIH & ANALISIS RASIO */}
              {selectedIncomeDetail === 'laba_bersih' && (
                <div className="space-y-5">
                  <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Laba Bersih Akhir (Net Income)</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-bold">
                        Audit Laporan Keuangan
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-400">{formatRupiah(reportData.labaBersih)}</div>
                    <p className="text-xs text-slate-300">
                      Formula: Laba Kotor ({formatRupiah(reportData.labaKotor)}) - Beban Operasional ({formatRupiah(reportData.totalBebanOperasional)}) + Pemasukan Lain ({formatRupiah(reportData.pemasukanLainnya)})
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Margin Laba Kotor (Gross Profit Margin)</span>
                      <p className="text-2xl font-black text-slate-900">{reportData.grossMarginPct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Target ideal apotek retail: 25% - 35%</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Margin Laba Bersih (Net Profit Margin)</span>
                      <p className={`text-2xl font-black ${reportData.netMarginPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {reportData.netMarginPct.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-500">Persentase net profit terhadap total penjualan</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Rasio HPP Modal Obat</span>
                      <p className="text-2xl font-black text-amber-600">{reportData.hppRatioPct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Beban persentase pembelian stok terhadap harga jual</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-xs font-bold text-slate-500">Rasio Beban Operasional (Opex)</span>
                      <p className="text-2xl font-black text-rose-600">{reportData.opexRatioPct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">Beban operasional kas dibandingkan omset total</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setSelectedIncomeDetail(null);
                  setExpandedTrxId(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* --- PRINT / EXPORT FORMAL STATEMENT MODAL --- */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[95vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100 text-left my-auto animate-fade-in">
            {/* Action Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <span className="font-extrabold text-sm">Pratinjau Cetak Laporan Laba / Rugi Resmi</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Sekarang
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-full text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-slate-900 font-sans print:p-0">
              {/* Kop Surat Apotek */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <h1 className="font-black text-xl uppercase tracking-wider text-slate-900">
                  {settings.pharmacyName || 'APOTEK SEHAT BERSAMA'}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {settings.address || 'Jl. Kesehatan No. 123, Jakarta Indonesia'}
                </p>
                <p className="text-xs text-slate-500">
                  SIA: {settings.siaNumber || 'SIA-992/2026/DKS'} • APA: {settings.apaName || 'apt. Farmasis Utama, S.Farm'}
                </p>
              </div>

              {/* Title */}
              <div className="text-center space-y-1">
                <h2 className="font-black text-base text-slate-900 uppercase underline tracking-wide">
                  LAPORAN LABA / RUGI KOMPREHENSIF
                </h2>
                <p className="text-xs font-bold text-slate-600 uppercase">
                  PERIODE: {reportPeriod === 'hari_ini' ? 'HARI INI' : reportPeriod === 'bulan_ini' ? 'BULAN INI' : reportPeriod === 'tahun_ini' ? 'TAHUN INI' : 'SEMUA PERIODE'}
                </p>
                <p className="text-[11px] text-slate-400">Dicetak Pada: {formatDateTime(new Date().toISOString())}</p>
              </div>

              {/* Statement Table */}
              <div className="border border-slate-900 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b border-slate-900 text-slate-900">
                    <tr>
                      <th className="py-2.5 px-4 font-black uppercase">Komponen Keuangan</th>
                      <th className="py-2.5 px-4 font-black uppercase text-right">Jumlah (Rupiah)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {/* Pendapatan POS */}
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-900">I. PENDAPATAN OPERASIONAL (Penjualan Kasir POS)</td>
                      <td className="py-2 px-4 text-right font-bold text-slate-900">{formatRupiah(reportData.totalPenjualan)}</td>
                    </tr>
                    {/* HPP */}
                    <tr className="bg-white">
                      <td className="py-2 px-4 text-slate-700 pl-8">Harga Pokok Penjualan (HPP Modal Obat)</td>
                      <td className="py-2 px-4 text-right text-slate-800">({formatRupiah(reportData.totalHPP)})</td>
                    </tr>
                    {/* Laba Kotor */}
                    <tr className="bg-emerald-50/80 font-black">
                      <td className="py-2.5 px-4 text-emerald-950">LABA KOTOR (GROSS PROFIT)</td>
                      <td className="py-2.5 px-4 text-right text-emerald-950">{formatRupiah(reportData.labaKotor)}</td>
                    </tr>

                    {/* Beban Operasional */}
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-900">II. BEBAN OPERASIONAL APOTEK</td>
                      <td className="py-2 px-4 text-right font-bold text-slate-900">({formatRupiah(reportData.totalBebanOperasional)})</td>
                    </tr>
                    {Object.entries(reportData.expensesByCategory).map(([cat, amt]) => (
                      <tr key={cat} className="bg-white text-slate-600">
                        <td className="py-1 px-4 pl-8">• Beban {cat}</td>
                        <td className="py-1 px-4 text-right">({formatRupiah(Number(amt))})</td>
                      </tr>
                    ))}

                    {/* Laba Operasional */}
                    <tr className="bg-slate-100 font-extrabold">
                      <td className="py-2 px-4 text-slate-900">LABA OPERASIONAL SAHAM (EBIT)</td>
                      <td className="py-2 px-4 text-right text-slate-900">{formatRupiah(reportData.labaKotor - reportData.totalBebanOperasional)}</td>
                    </tr>

                    {/* Pendapatan Lain */}
                    <tr className="bg-white">
                      <td className="py-2 px-4 font-bold text-slate-900">III. PENDAPATAN LAINNYA (NON-OPERASIONAL)</td>
                      <td className="py-2 px-4 text-right font-bold text-slate-900">+{formatRupiah(reportData.pemasukanLainnya)}</td>
                    </tr>

                    {/* LABA BERSIH */}
                    <tr className="bg-slate-900 text-white font-black text-sm">
                      <td className="py-3 px-4">LABA BERSIH AKHIR (NET PROFIT)</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{formatRupiah(reportData.labaBersih)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Ratios Footnote */}
              <div className="grid grid-cols-2 gap-4 text-[11px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-bold text-slate-800">Margin Laba Kotor: <span className="text-emerald-700">{reportData.grossMarginPct.toFixed(1)}%</span></p>
                  <p className="font-bold text-slate-800">Margin Laba Bersih: <span className="text-emerald-700">{reportData.netMarginPct.toFixed(1)}%</span></p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">Total Transaksi POS: {reportData.filteredTransactions.length}</p>
                  <p className="font-bold text-slate-800">Total Arus Kas: {reportData.filteredCashFlows.length}</p>
                </div>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-8 flex justify-between items-end text-xs text-center">
                <div className="space-y-12">
                  <p className="font-bold">Dibuat Oleh (Admin/Kasir),</p>
                  <p className="border-b border-slate-900 font-extrabold pb-0.5 min-w-[140px] inline-block">
                    ( ......................................... )
                  </p>
                </div>
                <div className="space-y-12">
                  <p className="font-bold">Mengetahui (Apoteker Pengelola),</p>
                  <p className="border-b border-slate-900 font-extrabold pb-0.5 min-w-[140px] inline-block">
                    {settings.apaName || 'apt. Farmasis Utama, S.Farm'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Delete Cash Flow Modal */}
      {deletingCashFlowId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left my-auto animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Hapus Catatan Arus Kas</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Yakin ingin menghapus catatan transaksi arus kas ini dari jurnal keuangan?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingCashFlowId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  deleteCashFlow(deletingCashFlowId);
                  setDeletingCashFlowId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Ya, Hapus Catatan
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
