import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { formatRupiah, formatDateTime, getWIBDateString, isPpnTransaction } from '../utils/formatters';
import {
  Receipt,
  Search,
  Printer,
  XCircle,
  Eye,
  Filter,
  X,
  AlertTriangle,
  User,
  Stethoscope,
  Calendar,
  SlidersHorizontal,
  RotateCcw,
  TrendingUp,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    cancelTransaction,
    currentUser,
    setLastTransaction,
    setIsReceiptModalOpen,
  } = useApp();

  const todayStr = getWIBDateString();

  // Basic Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTrxDetail, setSelectedTrxDetail] = useState<Transaction | null>(null);

  // Date Range Filter State (Default: Hari Ini / 1_day)
  const [datePreset, setDatePreset] = useState<string>('1_day');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Advance Filters State
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>('all');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [taxFilter, setTaxFilter] = useState<string>('all');
  const [showAdvanceFilters, setShowAdvanceFilters] = useState<boolean>(false);

  // Cancel Modal state
  const [cancellingTrx, setCancellingTrx] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Preset Date Selection Handler
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'custom') return;

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

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDatePreset('1_day');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setMethodFilter('all');
    setPrescriptionFilter('all');
    setCashierFilter('all');
    setTaxFilter('all');
  };

  const handleOpenReceipt = (trx: Transaction) => {
    setLastTransaction(trx);
    setIsReceiptModalOpen(true);
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingTrx) return;
    if (!cancelReason.trim()) {
      alert('Mohon tuliskan alasan pembatalan transaksi.');
      return;
    }

    cancelTransaction(cancellingTrx.id, cancelReason);
    setCancellingTrx(null);
    setCancelReason('');
  };

  // Unique list of Cashiers from transactions
  const cashierOptions = Array.from(
    new Set(transactions.map(t => t.cashierName).filter(Boolean))
  );

  // Filtered Transactions Logic
  const filteredTransactions = transactions.filter(trx => {
    const trxDate = trx.date.split(' ')[0] || trx.date.split('T')[0];

    // Date Range Filter
    if (startDate && trxDate < startDate) return false;
    if (endDate && trxDate > endDate) return false;

    // Search Query
    const matchesSearch =
      trx.trxNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (trx.customerName && trx.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (trx.doctorName && trx.doctorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      trx.cashierName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Status Filter
    if (statusFilter !== 'all' && trx.status !== statusFilter) return false;

    // Payment Method Filter
    if (methodFilter !== 'all' && trx.paymentMethod !== methodFilter) return false;

    // Prescription Filter
    if (prescriptionFilter === 'resep' && !trx.isPrescription) return false;
    if (prescriptionFilter === 'non-resep' && trx.isPrescription) return false;

    // Cashier Filter
    if (cashierFilter !== 'all' && trx.cashierName.toLowerCase() !== cashierFilter.toLowerCase()) return false;

    // Tax Filter (PPN vs NON_PPN)
    if (taxFilter !== 'all') {
      const isPpn = isPpnTransaction(trx);
      if (taxFilter === 'PPN' && !isPpn) return false;
      if (taxFilter === 'NON_PPN' && isPpn) return false;
    }

    return true;
  });

  // Calculate Metrics for Current Filter
  const completedTrxs = filteredTransactions.filter(t => t.status === 'Selesai');
  const totalOmset = completedTrxs.reduce((sum, t) => sum + t.totalAmount, 0);

  // Tax Breakdown Metrics
  const ppnTrxs = completedTrxs.filter(isPpnTransaction);
  const nonPpnTrxs = completedTrxs.filter(t => !isPpnTransaction(t));

  const totalDppAmount = ppnTrxs.reduce((sum, t) => {
    const rate = t.ppnRate || 11;
    return sum + (t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100)));
  }, 0);
  const totalPpnAmount = ppnTrxs.reduce((sum, t) => {
    const rate = t.ppnRate || 11;
    const dpp = t.dppAmount ?? Math.round(t.totalAmount / (1 + rate / 100));
    return sum + (t.ppnAmount ?? (t.totalAmount - dpp));
  }, 0);
  const totalOmsetNonPpn = nonPpnTrxs.reduce((sum, t) => sum + t.totalAmount, 0);

  const totalSelesaiCount = completedTrxs.length;
  const totalDibatalkanCount = filteredTransactions.filter(t => t.status === 'Dibatalkan').length;

  // Active filters count
  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (methodFilter !== 'all' ? 1 : 0) +
    (prescriptionFilter !== 'all' ? 1 : 0) +
    (cashierFilter !== 'all' ? 1 : 0) +
    (taxFilter !== 'all' ? 1 : 0) +
    (datePreset !== '1_day' ? 1 : 0) +
    (searchTerm ? 1 : 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Transaksi Penjualan</h2>
          <p className="text-xs text-slate-500 mt-1">
            Daftar seluruh transaksi kasir dengan filter tanggal, pencarian cepat, cetak struk, dan audit pembatalan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Filter ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[11px] text-slate-400 font-medium block">Total Omset Terpilih</span>
          <span className="text-lg font-black text-emerald-700 mt-0.5 block">{formatRupiah(totalOmset)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-xs">
          <span className="text-[11px] text-blue-600 font-bold block">PPN Terutang Output</span>
          <span className="text-lg font-black text-blue-700 mt-0.5 block">{formatRupiah(totalPpnAmount)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[11px] text-slate-400 font-medium block">Omset Non-PPN</span>
          <span className="text-lg font-black text-slate-800 mt-0.5 block">{formatRupiah(totalOmsetNonPpn)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[11px] text-slate-400 font-medium block">Transaksi Selesai</span>
          <span className="text-lg font-black text-emerald-600 mt-0.5 block">{totalSelesaiCount} Selesai</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[11px] text-slate-400 font-medium block">Transaksi Dibatalkan</span>
          <span className="text-lg font-black text-rose-600 mt-0.5 block">{totalDibatalkanCount} Batal</span>
        </div>
      </div>

      {/* MAIN FILTER PANEL */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3.5">
        {/* ROW 1: Preset Buttons & Main Date Range Picker */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Date Presets */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-slate-100/90 p-1 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 px-2 shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Rentang:
            </span>
            <button
              type="button"
              onClick={() => handlePresetChange('1_day')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === '1_day' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hari Ini (1 Hari)
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('yesterday')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === 'yesterday' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('7_days')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === '7_days' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('30_days')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === '30_days' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('this_month')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === 'this_month' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('custom')}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 ${
                datePreset === 'custom' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kustom
            </button>
          </div>

          {/* Explicit Date Input Controls */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
              />
            </div>
            <span className="text-slate-400 font-bold text-xs">s/d</span>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ROW 2: Search, Status Filter & Toggle Advance Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari No Trx, nama customer, dokter, kasir..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="Selesai">Selesai</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>

            {/* Advance Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvanceFilters(!showAdvanceFilters)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                showAdvanceFilters || activeFiltersCount > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter Advance</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ADVANCE FILTERS EXPANDABLE BOX */}
        {showAdvanceFilters && (
          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
              <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Filter Lanjutan Transaksi (Advance Filters)
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-slate-500 hover:text-rose-600 underline font-semibold"
              >
                Reset Semua Filter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Filter Jenis Pajak PPN */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Jenis Perpajakan (PPN)
                </label>
                <select
                  value={taxFilter}
                  onChange={e => setTaxFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-blue-900 focus:outline-none"
                >
                  <option value="all">Semua (PPN & Non-PPN)</option>
                  <option value="PPN">Faktur Penjualan PPN</option>
                  <option value="NON_PPN">Nota Penjualan Non-PPN</option>
                </select>
              </div>

              {/* Filter Metode Pembayaran */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={methodFilter}
                  onChange={e => setMethodFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                >
                  <option value="all">Semua Metode (Tunai, QRIS, Transfer)</option>
                  <option value="Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer Bank</option>
                </select>
              </div>

              {/* Filter Jenis Resep */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Tipe Penjualan Obat
                </label>
                <select
                  value={prescriptionFilter}
                  onChange={e => setPrescriptionFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                >
                  <option value="all">Semua (Resep & Non-Resep)</option>
                  <option value="resep">Resep Dokter</option>
                  <option value="non-resep">Non-Resep / Bebas</option>
                </select>
              </div>

              {/* Filter Kasir */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Petugas Kasir
                </label>
                <select
                  value={cashierFilter}
                  onChange={e => setCashierFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none"
                >
                  <option value="all">Semua Petugas Kasir</option>
                  {cashierOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Data Display */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Mobile & Tablet Card List Layout */}
        <div className="lg:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
              Tidak ada riwayat transaksi yang cocok dengan filter.
            </div>
          ) : (
            filteredTransactions.map(trx => (
              <div
                key={trx.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                      {trx.trxNo}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(trx.date)}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      trx.status === 'Selesai'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {trx.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pelanggan & Dokter:</span>
                    <span className="font-bold text-slate-800">{trx.customerName || 'Customer Umum'}</span>
                    {trx.doctorName && (
                      <span className="text-[10px] text-indigo-700 font-medium block">
                        Dr: {trx.doctorName}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total & Kasir:</span>
                    <span className="font-extrabold text-emerald-700 text-xs">{formatRupiah(trx.totalAmount)}</span>
                    <span className="text-[10px] text-slate-500 block">Metode: {trx.paymentMethod}</span>
                    <span className="text-[9px] text-slate-400 block">Kasir: {trx.cashierName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {trx.items.length} jenis item
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenReceipt(trx)}
                      className="px-2.5 py-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Struk
                    </button>
                    <button
                      onClick={() => setSelectedTrxDetail(trx)}
                      className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detail
                    </button>
                    {trx.status === 'Selesai' && (
                      <button
                        onClick={() => {
                          if (currentUser.role !== 'admin') {
                            alert('Pembatalan transaksi hanya dapat dilakukan oleh Admin.');
                            return;
                          }
                          setCancellingTrx(trx);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          currentUser.role === 'admin'
                            ? 'text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50'
                            : 'text-slate-300 cursor-not-allowed opacity-50 bg-slate-50'
                        }`}
                        title="Batalkan Transaksi"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">No Transaksi & Waktu</th>
                <th className="py-3 px-4">Customer & Dokter</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Total & Bayar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada riwayat transaksi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(trx => (
                  <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* No TRX & Date */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-[11px]">{trx.trxNo}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          isPpnTransaction(trx)
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isPpnTransaction(trx) ? 'PPN 11%' : 'Non-PPN'}
                        </span>
                      </div>
                      {isPpnTransaction(trx) && (
                        <div className="text-[10px] font-extrabold text-blue-700 mt-0.5">
                          Nominal PPN: {formatRupiah(
                            trx.ppnAmount ?? (trx.totalAmount - Math.round(trx.totalAmount / (1 + (trx.ppnRate || 11) / 100)))
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">{formatDateTime(trx.date)}</div>
                    </td>

                    {/* Customer & Doctor */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {trx.customerName || 'Customer Umum'}
                      </div>
                      {trx.doctorName && (
                        <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
                          Dokter: {trx.doctorName}
                        </div>
                      )}
                      {trx.isPrescription && (
                        <span className="inline-block mt-0.5 text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                          Resep
                        </span>
                      )}
                    </td>

                    {/* Cashier */}
                    <td className="py-3 px-4 font-medium text-slate-700">{trx.cashierName}</td>

                    {/* Total & Payment */}
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-emerald-700">{formatRupiah(trx.totalAmount)}</div>
                      <div className="text-[10px] text-slate-400">Metode: {trx.paymentMethod}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          trx.status === 'Selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {trx.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Print / Struk */}
                        <button
                          onClick={() => handleOpenReceipt(trx)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Cetak / Lihat Struk"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Detail Modal */}
                        <button
                          onClick={() => setSelectedTrxDetail(trx)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Cancel Transaction (Admin Only) */}
                        {trx.status === 'Selesai' && (
                          <button
                            onClick={() => {
                              if (currentUser.role !== 'admin') {
                                alert('Pembatalan transaksi hanya dapat dilakukan oleh Admin.');
                                return;
                              }
                              setCancellingTrx(trx);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentUser.role === 'admin'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-300 cursor-not-allowed opacity-50'
                            }`}
                            title={
                              currentUser.role === 'admin'
                                ? 'Batalkan Transaksi (Stok Revert)'
                                : 'Hanya Admin yang dapat membatalkan'
                            }
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTrxDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">Detail Transaksi Penjualan</h3>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        selectedTrxDetail.status === 'Selesai'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {selectedTrxDetail.status}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        isPpnTransaction(selectedTrxDetail)
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-slate-700 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {isPpnTransaction(selectedTrxDetail) ? 'Faktur PPN 11%' : 'Nota Non-PPN'}
                    </span>
                    {selectedTrxDetail.isPrescription && (
                      <span className="text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                        Resep Dokter
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-emerald-400 mt-0.5">{selectedTrxDetail.trxNo}</p>
                </div>
                <button
                  onClick={() => setSelectedTrxDetail(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1 bg-slate-50/50">
                {/* 1. Ringkasan Finansial Utama */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Transaksi</span>
                    <span className="text-base font-black text-emerald-700 block mt-0.5">
                      {formatRupiah(selectedTrxDetail.totalAmount)}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">DPP (Dasar Pajak)</span>
                    <span className="text-sm font-extrabold text-slate-800 block mt-0.5">
                      {formatRupiah(
                        isPpnTransaction(selectedTrxDetail)
                          ? selectedTrxDetail.dppAmount ??
                              Math.round(
                                selectedTrxDetail.totalAmount / (1 + (selectedTrxDetail.ppnRate || 11) / 100)
                              )
                          : selectedTrxDetail.totalAmount
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-100 bg-blue-50/30 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-700 block uppercase">PPN Terutang (11%)</span>
                    <span className="text-sm font-extrabold text-blue-800 block mt-0.5">
                      {formatRupiah(
                        isPpnTransaction(selectedTrxDetail)
                          ? selectedTrxDetail.ppnAmount ??
                              selectedTrxDetail.totalAmount -
                                Math.round(
                                  selectedTrxDetail.totalAmount / (1 + (selectedTrxDetail.ppnRate || 11) / 100)
                                )
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Pembayaran</span>
                    <span className="text-xs font-black text-slate-900 block mt-0.5">
                      {selectedTrxDetail.paymentMethod}
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">
                      Bayar: {formatRupiah(selectedTrxDetail.paymentAmount)}
                    </span>
                    <span className="text-[9.5px] text-emerald-600 block font-semibold">
                      Kembali: {formatRupiah(selectedTrxDetail.changeAmount)}
                    </span>
                  </div>
                </div>

                {/* 2. Informasi Detail Pihak & Transaksi */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase">Waktu Transaksi</span>
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(selectedTrxDetail.date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase">Petugas Kasir</span>
                      <span className="font-semibold text-slate-800">
                        {selectedTrxDetail.cashierName}
                      </span>
                      {selectedTrxDetail.cashierUsername && (
                        <span className="text-[10px] text-slate-500 font-mono ml-1">
                          (@{selectedTrxDetail.cashierUsername})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase">Customer / Pasien</span>
                      <span className="font-bold text-slate-900">
                        {selectedTrxDetail.customerName || 'Customer Umum'}
                      </span>
                      {selectedTrxDetail.customerMemberNo && (
                        <span className="block text-[10px] text-emerald-700 font-mono font-medium">
                          No. Member: {selectedTrxDetail.customerMemberNo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase">Dokter & Jenis Resep</span>
                      <span className="font-bold text-indigo-800">
                        {selectedTrxDetail.doctorName || 'Tanpa Resep (Pembelian Bebas)'}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {selectedTrxDetail.isPrescription ? 'Penjualan Resep Dokter' : 'Penjualan Non-Resep'}
                      </span>
                    </div>

                    {(selectedTrxDetail.prescriptionMarkupAmount || selectedTrxDetail.prescriptionRacikanFee) ? (
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Markup & Racikan Resep</span>
                        <div className="text-[11px] text-slate-700 space-y-0.5">
                          {!!selectedTrxDetail.prescriptionMarkupAmount && (
                            <p>
                              Embalase/Markup ({selectedTrxDetail.prescriptionMarkupRate || 0}%):{' '}
                              <span className="font-bold text-slate-900">
                                {formatRupiah(selectedTrxDetail.prescriptionMarkupAmount)}
                              </span>
                            </p>
                          )}
                          {!!selectedTrxDetail.prescriptionRacikanFee && (
                            <p>
                              Jasa Racikan / Servis:{' '}
                              <span className="font-bold text-slate-900">
                                {formatRupiah(selectedTrxDetail.prescriptionRacikanFee)}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {selectedTrxDetail.prescriptionNote && (
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold block uppercase">Catatan Resep</span>
                        <p className="text-[11px] text-slate-700 italic bg-amber-50/80 p-1.5 rounded border border-amber-200">
                          "{selectedTrxDetail.prescriptionNote}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Table Rincian Sediaan / Item Obat */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-800 flex justify-between items-center flex-wrap gap-2">
                    <span>RINCIAN ITEM OBAT ({selectedTrxDetail.items.length} Sediaan)</span>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Kode & Sediaan Obat</th>
                          <th className="py-2.5 px-3 text-center">Status & Nominal PPN</th>
                          <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-center">Jumlah Qty</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedTrxDetail.items.map((it, idx) => {
                          const itemIsPpn = it.isPpn !== false && (isPpnTransaction(selectedTrxDetail) || it.isPpn);
                          const itemDpp = Math.round(it.subtotal / (1 + (it.ppnRate || 11) / 100));
                          const itemPpnVal = itemIsPpn ? it.subtotal - itemDpp : 0;

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-slate-400 text-[10px] block">
                                  {it.medicineCode || '-'}
                                </span>
                                <span className="font-bold text-slate-900">{it.medicineName}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
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
                              <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                {formatRupiah(it.price)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                                {it.qty} {it.unit}{(it.unit === 'Lusin' || (it.unitMultiplier && it.unitMultiplier > 1)) ? ` (${it.qty * (it.unit === 'Lusin' ? 12 : (it.unitMultiplier || 1))} pcs)` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700">
                                {formatRupiah(it.subtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Total Summary & Margin (Admin Audit) */}
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold border-b border-emerald-200/80 pb-1">
                    <span>Subtotal Sediaan ({selectedTrxDetail.items.reduce((sum, i) => sum + i.qty, 0)} {selectedTrxDetail.items.length === 1 ? selectedTrxDetail.items[0].unit : 'item'}):</span>
                    <span className="font-bold">{formatRupiah(selectedTrxDetail.items.reduce((sum, i) => sum + i.subtotal, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center font-extrabold text-emerald-950 text-sm">
                    <span>TOTAL DIBAYAR:</span>
                    <span className="text-base text-emerald-800">{formatRupiah(selectedTrxDetail.totalAmount)}</span>
                  </div>
                  {selectedTrxDetail.costAmount && selectedTrxDetail.costAmount > 0 && currentUser.role === 'admin' && (
                    <div className="flex justify-between items-center text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/80">
                      <span>Modal / HPP Obat: {formatRupiah(selectedTrxDetail.costAmount)}</span>
                      <span className="font-bold">
                        Estimasi Laba Kotor:{' '}
                        {formatRupiah(selectedTrxDetail.totalAmount - selectedTrxDetail.costAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. Detail Pembatalan jika Dibatalkan */}
                {selectedTrxDetail.status === 'Dibatalkan' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                    <span className="font-extrabold text-xs block flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" /> Audit Pembatalan Transaksi:
                    </span>
                    <p className="text-xs">
                      <span className="font-semibold">Alasan:</span> {selectedTrxDetail.cancelReason || '-'}
                    </p>
                    <p className="text-[10px] text-rose-600 font-medium">
                      Dibatalkan oleh <span className="font-bold">{selectedTrxDetail.cancelledBy || 'Admin'}</span> pada{' '}
                      {selectedTrxDetail.cancelledAt || '-'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Modal Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  onClick={() => handleOpenReceipt(selectedTrxDetail)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Cetak / Lihat Struk
                </button>
                <button
                  onClick={() => setSelectedTrxDetail(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Transaction Modal */}
      {cancellingTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in">
              <div className="px-5 py-3 bg-rose-700 text-white flex items-center justify-between">
              <h4 className="font-bold text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Konfirmasi Pembatalan Transaksi (Admin)
              </h4>
              <button onClick={() => setCancellingTrx(null)} className="p-1 text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Anda akan membatalkan transaksi <span className="font-bold text-slate-900">{cancellingTrx.trxNo}</span> sebesar{' '}
                <span className="font-bold text-rose-700">{formatRupiah(cancellingTrx.totalAmount)}</span>.
              </p>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-800 space-y-0.5">
                <p>• Stok obat akan dikembalikan otomatis ke katalog.</p>
                <p>• Total belanja customer terkait akan dikurangi.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Salah input item / retur obat dari customer"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingTrx(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                >
                  Ya, Batalkan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

