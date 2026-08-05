import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Medicine, MedicineCategory } from '../types';
import { formatRupiah, getExpiredStatus, getDaysUntilExpired, formatDate } from '../utils/formatters';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  History,
  X,
  Receipt,
  Coins,
  Tag,
  Percent,
  Calculator,
  Info,
  BadgePercent,
  CheckCircle2,
  RotateCcw,
  Archive,
  ShieldCheck,
} from 'lucide-react';

export const MedicinesView: React.FC = () => {
  const {
    medicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    restoreMedicine,
    stockHistory,
    currentUser,
  } = useApp();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all'); // 'all' | 'low' | 'normal'
  const [expiredFilter, setExpiredFilter] = useState<string>('all'); // 'all' | 'expired' | '30' | '60' | '90' | '120' | '150' | '180'
  const [statusFilter, setStatusFilter] = useState<string>('active'); // 'active' | 'inactive' | 'all'
  const [taxFilter, setTaxFilter] = useState<string>('ppn'); // 'ppn' | 'non_ppn'

  // Price Display Toggle in Table ('both' | 'inc' | 'non')
  const [priceDisplayMode, setPriceDisplayMode] = useState<'both' | 'inc' | 'non'>('inc');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  // Delete & Restore Confirmation Modal State
  const [deletingMedicine, setDeletingMedicine] = useState<Medicine | null>(null);
  const [restoringMedicine, setRestoringMedicine] = useState<Medicine | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Stock History Modal State
  const [selectedHistoryMed, setSelectedHistoryMed] = useState<Medicine | null>(null);

  // General Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MedicineCategory>('Obat Bebas');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(10);
  const [unit, setUnit] = useState('Strip');
  const [expiredDate, setExpiredDate] = useState('');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);

  // PPN & Pricing States
  const [ppnRate, setPpnRate] = useState<number>(11);
  const [isPpnIncluded, setIsPpnIncluded] = useState<boolean>(true);

  // HPP Modal Inputs
  const [purchasePriceNonPpn, setPurchasePriceNonPpn] = useState<number>(0);
  const [purchasePriceIncPpn, setPurchasePriceIncPpn] = useState<number>(0);

  // Harga Jual Inputs
  const [priceNonPpn, setPriceNonPpn] = useState<number>(0);
  const [priceIncPpn, setPriceIncPpn] = useState<number>(0);

  const categories: MedicineCategory[] = [
    'Obat Bebas',
    'Obat Bebas Terbatas',
    'Obat Keras',
    'Jamu & Herbal',
    'Alat Kesehatan',
    'Suplemen & Vitamin',
    'Lainnya',
  ];

  const units = ['Strip', 'Botol', 'Tube', 'Box', 'Tablet', 'Blister', 'Pcs', 'Ampul', 'Sachet'];

  // Helper Math Converters for PPN
  const calcIncFromNon = (nonVal: number, rate: number) => Math.round(nonVal * (1 + rate / 100));
  const calcNonFromInc = (incVal: number, rate: number) => Math.round(incVal / (1 + rate / 100));

  // Live Input Handlers for PPN Auto-Calculations
  const handlePpnRateChange = (newRate: number) => {
    setPpnRate(newRate);
    const newPurInc = calcIncFromNon(purchasePriceNonPpn, newRate);
    setPurchasePriceIncPpn(newPurInc);

    const newPriceInc = calcIncFromNon(priceNonPpn, newRate);
    setPriceIncPpn(newPriceInc);
  };

  const handlePurchaseNonPpnChange = (val: number) => {
    setPurchasePriceNonPpn(val);
    setPurchasePriceIncPpn(calcIncFromNon(val, ppnRate));
  };

  const handlePurchaseIncPpnChange = (val: number) => {
    setPurchasePriceIncPpn(val);
    setPurchasePriceNonPpn(calcNonFromInc(val, ppnRate));
  };

  const handlePriceNonPpnChange = (val: number) => {
    setPriceNonPpn(val);
    setPriceIncPpn(calcIncFromNon(val, ppnRate));
  };

  const handlePriceIncPpnChange = (val: number) => {
    setPriceIncPpn(val);
    setPriceNonPpn(calcNonFromInc(val, ppnRate));
  };

  const openAddModal = () => {
    setEditingMedicine(null);
    const nextCodeNum = medicines.length + 1;
    setCode(`OBT-${String(nextCodeNum).padStart(3, '0')}`);
    setName('');
    setCategory('Obat Bebas');
    
    // Default PPN settings & values
    const rate = 11;
    setPpnRate(rate);
    setIsPpnIncluded(true);

    const defaultPurInc = 7000;
    const defaultPurNon = calcNonFromInc(defaultPurInc, rate);
    setPurchasePriceIncPpn(defaultPurInc);
    setPurchasePriceNonPpn(defaultPurNon);

    const defaultPriceInc = 10000;
    const defaultPriceNon = calcNonFromInc(defaultPriceInc, rate);
    setPriceIncPpn(defaultPriceInc);
    setPriceNonPpn(defaultPriceNon);

    setStock(20);
    setMinStock(10);
    setUnit('Strip');

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setExpiredDate(nextYear.toISOString().split('T')[0]);
    setLocation('Rak A1');
    setIsActive(true);
    setIsFormOpen(true);
  };

  const openEditModal = (med: Medicine) => {
    setEditingMedicine(med);
    setCode(med.code);
    setName(med.name);
    setCategory(med.category);

    const incPpn = med.isPpnIncluded ?? true;
    const rate = incPpn ? (med.ppnRate ?? 11) : 0;
    setPpnRate(rate);
    setIsPpnIncluded(incPpn);

    if (!incPpn) {
      const p = med.priceNonPpn || med.price || 0;
      setPriceIncPpn(p);
      setPriceNonPpn(p);
      const pur = med.purchasePriceNonPpn || med.purchasePrice || 0;
      setPurchasePriceIncPpn(pur);
      setPurchasePriceNonPpn(pur);
    } else {
      const pInc = med.priceIncPpn || med.price || 0;
      const pNon = med.priceNonPpn || calcNonFromInc(pInc, rate);
      setPriceIncPpn(pInc);
      setPriceNonPpn(pNon);

      const purInc = med.purchasePriceIncPpn || med.purchasePrice || 0;
      const purNon = med.purchasePriceNonPpn || calcNonFromInc(purInc, rate);
      setPurchasePriceIncPpn(purInc);
      setPurchasePriceNonPpn(purNon);
    }

    setStock(med.stock);
    setMinStock(med.minStock);
    setUnit(med.unit);
    setExpiredDate(med.expiredDate);
    setLocation(med.location || '');
    setIsActive(med.isActive);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || priceIncPpn < 0 || priceNonPpn < 0) {
      alert('Mohon isi kode, nama obat, dan harga yang valid.');
      return;
    }

    const isPpn = isPpnIncluded;
    const rate = isPpn ? Number(ppnRate) : 0;
    const finalPrice = isPpn ? Number(priceIncPpn) : Number(priceNonPpn);
    const finalPurchase = isPpn ? Number(purchasePriceIncPpn) : Number(purchasePriceNonPpn);

    const medData = {
      code,
      name,
      category,
      price: finalPrice,
      purchasePrice: finalPurchase,
      stock: Number(stock),
      minStock: Number(minStock),
      unit,
      expiredDate,
      location,
      isActive,
      ppnRate: rate,
      isPpnIncluded: isPpn,
      purchasePriceNonPpn: isPpn ? Number(purchasePriceNonPpn) : finalPurchase,
      purchasePriceIncPpn: isPpn ? Number(purchasePriceIncPpn) : finalPurchase,
      priceNonPpn: isPpn ? Number(priceNonPpn) : finalPrice,
      priceIncPpn: isPpn ? Number(priceIncPpn) : finalPrice,
    };

    if (editingMedicine) {
      const { stock: _omitStock, ...updateFields } = medData;
      updateMedicine(editingMedicine.id, updateFields);
    } else {
      addMedicine(medData);
    }

    setIsFormOpen(false);
  };

  const handleDelete = (med: Medicine) => {
    if (currentUser.role !== 'admin') {
      setAlertMessage('Penghapusan data obat hanya dapat dilakukan oleh akun Admin.');
      return;
    }
    setDeletingMedicine(med);
  };

  const confirmDelete = () => {
    if (deletingMedicine) {
      deleteMedicine(deletingMedicine.id);
      setDeletingMedicine(null);
    }
  };

  const handleRestore = (med: Medicine) => {
    if (currentUser.role !== 'admin') {
      setAlertMessage('Pemulihan obat hanya dapat dilakukan oleh akun Admin.');
      return;
    }
    setRestoringMedicine(med);
  };

  const confirmRestore = () => {
    if (restoringMedicine) {
      restoreMedicine(restoringMedicine.id);
      setRestoringMedicine(null);
    }
  };

  // Filter Logic
  const filteredMedicines = medicines.filter(med => {
    const matchesSearch =
      med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (med.location && med.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || med.category === categoryFilter;
    const matchesStock = stockFilter === 'all' || (stockFilter === 'low' && med.stock <= med.minStock);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && med.isActive) ||
      (statusFilter === 'inactive' && !med.isActive);

    const days = getDaysUntilExpired(med.expiredDate);
    let matchesExpired = true;
    if (expiredFilter === 'expired') {
      matchesExpired = days < 0;
    } else if (expiredFilter === '30') {
      matchesExpired = days >= 0 && days <= 30;
    } else if (expiredFilter === '60') {
      matchesExpired = days >= 0 && days <= 60;
    } else if (expiredFilter === '90') {
      matchesExpired = days >= 0 && days <= 90;
    } else if (expiredFilter === '120') {
      matchesExpired = days >= 0 && days <= 120;
    } else if (expiredFilter === '150') {
      matchesExpired = days >= 0 && days <= 150;
    } else if (expiredFilter === '180') {
      matchesExpired = days >= 0 && days <= 180;
    }

    const isMedPpn = (med.isPpnIncluded ?? true) && (med.ppnRate ?? 11) > 0;

    const matchesTax =
      taxFilter === 'all' ||
      (taxFilter === 'ppn' && isMedPpn) ||
      (taxFilter === 'non_ppn' && !isMedPpn);

    return matchesSearch && matchesCategory && matchesStock && matchesStatus && matchesExpired && matchesTax;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Katalog & Stok Obat
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" /> PPN 11% Supported
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan data sediaan farmasi, konversi otomatis Harga Non-PPN & Harga (+PPN 11%), serta pantauan stok & kadaluwarsa.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Obat Baru (+ Atur PPN)
        </button>
      </div>

      {/* PPN & Pricing Info Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Sediaan Obat</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{medicines.length} Item</span>
          </div>
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Pill className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Sistem Pajak PPN</span>
            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block flex items-center gap-1.5">
              Tarif PPN Standar 11%
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <span className="text-[10px] text-emerald-700 font-medium block">Konversi Otomatis DPP & Inc. PPN</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mode Tampilan Harga Jual</span>
            <span className="text-xs font-bold text-slate-900 mt-1 block">
              {priceDisplayMode === 'both' ? 'Dua-Duanya (+PPN & Non-PPN)' : priceDisplayMode === 'inc' ? 'Fokus Harga + PPN 11%' : 'Fokus Harga Non-PPN (DPP)'}
            </span>
            <span className="text-[10px] text-slate-400">Kasir memakai harga final ter-set</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Calculator className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, kode, rak..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tax / PPN Status Filter */}
          <div>
            <select
              value={taxFilter}
              onChange={e => {
                const val = e.target.value;
                setTaxFilter(val);
                if (val === 'ppn') setPriceDisplayMode('inc');
                else if (val === 'non_ppn') setPriceDisplayMode('non');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
            >
              <option value="ppn">🏷️ Filter Khusus Obat PPN 11%</option>
              <option value="non_ppn">📄 Filter Khusus Obat Non-PPN</option>
            </select>
          </div>

          {/* Stock Filter */}
          <div>
            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Semua Status Stok</option>
              <option value="low">⚠️ Stok Menipis (&le; Min Stok)</option>
            </select>
          </div>

          {/* Expired Filter */}
          <div>
            <select
              value={expiredFilter}
              onChange={e => setExpiredFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            >
              <option value="all">Semua Masa Kadaluwarsa</option>
              <option value="expired">🔴 Sudah Expired</option>
              <option value="30">🟠 Expired &lt; 30 Hari (1 Bln)</option>
              <option value="60">🟡 Expired &lt; 60 Hari (2 Bln)</option>
              <option value="90">🟡 Expired &lt; 90 Hari (3 Bln)</option>
              <option value="120">🔵 Expired &lt; 120 Hari (4 Bln)</option>
              <option value="150">🔵 Expired &lt; 150 Hari (5 Bln)</option>
              <option value="180">🔵 Expired &lt; 180 Hari (6 Bulan)</option>
            </select>
          </div>

          {/* Status Filter (Aktif vs Terhapus/Arsip) */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-800"
            >
              <option value="active">🟢 Katalog Aktif</option>
              <option value="inactive">📁 Terhapus / Non-Aktif (Arsip)</option>
              <option value="all">📋 Semua Status Produk</option>
            </select>
          </div>
        </div>

        {/* PRICE DISPLAY MODE SELECTOR TOGGLE BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-bold flex items-center gap-1.5 text-[11px]">
              <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Filter Kelompok Pajak:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl font-bold text-[11px] gap-1">
              <button
                onClick={() => {
                  setPriceDisplayMode('inc');
                  setTaxFilter('ppn');
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  taxFilter === 'ppn'
                    ? 'bg-blue-700 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Filter Khusus Obat + PPN 11% ({medicines.filter(m => (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0).length})
              </button>
              <button
                onClick={() => {
                  setPriceDisplayMode('non');
                  setTaxFilter('non_ppn');
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  taxFilter === 'non_ppn'
                    ? 'bg-amber-700 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Filter Khusus Obat Non-PPN ({medicines.filter(m => !((m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0)).length})
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-slate-400 font-medium">Quick Filter:</span>
            <button
              onClick={() => {
                setStockFilter('low');
                setExpiredFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                stockFilter === 'low'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              }`}
            >
              Stok Menipis
            </button>
            <button
              onClick={() => {
                setExpiredFilter('expired');
                setStockFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                expiredFilter === 'expired'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              Sudah Expired
            </button>
            <button
              onClick={() => {
                setExpiredFilter('180');
                setStockFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                expiredFilter === '180'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              Exp &lt; 6 Bulan
            </button>
            {(categoryFilter !== 'all' || stockFilter !== 'all' || expiredFilter !== 'all' || statusFilter !== 'active' || taxFilter !== 'ppn' || searchTerm) && (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setStockFilter('all');
                  setExpiredFilter('all');
                  setStatusFilter('active');
                  setTaxFilter('ppn');
                  setPriceDisplayMode('inc');
                  setSearchTerm('');
                }}
                className="text-slate-500 hover:text-slate-800 underline ml-2 font-bold"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Medicines Data Display */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Daftar Sediaan ({filteredMedicines.length} Item)
          </span>
          <span className="text-[11px] text-slate-500">
            Rincian Harga Beli (HPP) & Harga Jual tersedia dalam skema Non-PPN & Include PPN
          </span>
        </div>

        {/* Mobile Card List Layout */}
        <div className="lg:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredMedicines.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
              Tidak ada obat yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            filteredMedicines.map(med => {
              const expStatus = getExpiredStatus(med.expiredDate);
              const isLowStock = med.stock <= med.minStock;

              const rate = med.ppnRate ?? 11;
              const pInc = med.priceIncPpn || med.price || 0;
              const pNon = med.priceNonPpn || Math.round(pInc / (1 + rate / 100));
              const purInc = med.purchasePriceIncPpn || med.purchasePrice || 0;
              const purNon = med.purchasePriceNonPpn || Math.round(purInc / (1 + rate / 100));

              return (
                <div
                  key={med.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          {med.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                          {med.category}
                        </span>
                        {med.location && (
                          <span className="text-[10px] text-slate-500">📍 {med.location}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{med.name}</h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        med.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {med.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {/* Price breakdown block */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold">Harga Jual Obat:</span>
                      <div className="font-extrabold text-emerald-700 text-xs">{formatRupiah(pInc)}</div>
                      <span className="inline-block text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1 rounded">
                        Inc. PPN {rate}%
                      </span>
                      <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                        Non-PPN (DPP): <strong className="text-slate-800 font-bold">{formatRupiah(pNon)}</strong>
                      </div>
                      {purInc > 0 && (
                        <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-200/60 pt-0.5">
                          Modal: {formatRupiah(purInc)} (+PPN) / {formatRupiah(purNon)} (DPP)
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold">Stok Tersedia:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`font-bold ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                          {med.stock} {med.unit}
                        </span>
                        <span className="text-[9px] text-slate-400">(Min: {med.minStock})</span>
                      </div>
                      {isLowStock && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 mt-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Menipis
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] mr-1">Exp:</span>
                      <span className="font-medium text-slate-800">{formatDate(med.expiredDate)}</span>
                      <span className={`ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${expStatus.badgeColor}`}>
                        {expStatus.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedHistoryMed(med)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        title="Riwayat Perubahan Stok"
                      >
                        <History className="w-3.5 h-3.5" />
                        Log
                      </button>
                      <button
                        onClick={() => openEditModal(med)}
                        className="p-1.5 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        title="Edit Obat & PPN"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {med.isActive ? (
                        <button
                          onClick={() => handleDelete(med)}
                          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold ${
                            currentUser.role === 'admin'
                              ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                              : 'text-slate-300 cursor-not-allowed opacity-50 bg-slate-50'
                          }`}
                          title={
                            currentUser.role === 'admin'
                              ? 'Hapus Obat (Aman untuk laporan)'
                              : 'Hanya Admin yang dapat menghapus'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(med)}
                          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-semibold ${
                            currentUser.role === 'admin'
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-slate-300 cursor-not-allowed opacity-50 bg-slate-50'
                          }`}
                          title="Pulihkan ke Katalog Aktif"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Kode / Sediaan</th>
                <th className="py-3 px-4">Kategori & Lokasi</th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span>Harga Beli (HPP)</span>
                    {priceDisplayMode === 'inc' && (
                      <span className="text-[9px] bg-blue-100 text-blue-900 font-extrabold px-1.5 py-0.5 rounded border border-blue-300">
                        +PPN 11%
                      </span>
                    )}
                    {priceDisplayMode === 'non' && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                        DPP Non-PPN
                      </span>
                    )}
                    {priceDisplayMode === 'both' && (
                      <span className="text-[9px] bg-slate-200 text-slate-800 font-extrabold px-1.5 py-0.5 rounded">
                        Semua Skema
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span>Harga Jual Obat</span>
                    {priceDisplayMode === 'inc' && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">
                        +PPN 11%
                      </span>
                    )}
                    {priceDisplayMode === 'non' && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                        DPP Non-PPN
                      </span>
                    )}
                    {priceDisplayMode === 'both' && (
                      <span className="text-[9px] bg-slate-200 text-slate-800 font-extrabold px-1.5 py-0.5 rounded">
                        Semua Skema
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Stok (Min)</th>
                <th className="py-3 px-4">Tanggal Expired</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada obat yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map(med => {
                  const expStatus = getExpiredStatus(med.expiredDate);
                  const isLowStock = med.stock <= med.minStock;

                  const isPpn = med.isPpnIncluded ?? true;
                  const rate = isPpn ? (med.ppnRate ?? 11) : 0;

                  let pInc: number;
                  let pNon: number;
                  let purInc: number;
                  let purNon: number;

                  if (!isPpn) {
                    pNon = med.priceNonPpn || med.price || 0;
                    pInc = pNon;
                    purNon = med.purchasePriceNonPpn || med.purchasePrice || 0;
                    purInc = purNon;
                  } else {
                    pInc = med.priceIncPpn || med.price || 0;
                    pNon = med.priceNonPpn || Math.round(pInc / (1 + (rate > 0 ? rate : 11) / 100));
                    purInc = med.purchasePriceIncPpn || med.purchasePrice || 0;
                    purNon = med.purchasePriceNonPpn || Math.round(purInc / (1 + (rate > 0 ? rate : 11) / 100));
                  }

                  return (
                    <tr key={med.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code & Name */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 text-[11px]">{med.code}</div>
                        <div className="font-semibold text-slate-900 text-xs">{med.name}</div>
                        <div className="text-[10px] text-slate-500">Satuan: {med.unit}</div>
                      </td>

                      {/* Category & Location & Tax Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                            {med.category}
                          </span>
                          {isPpn ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                              🏷️ PPN {rate}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded-md">
                              📄 Non-PPN
                            </span>
                          )}
                        </div>
                        {med.location && (
                          <div className="text-[10px] text-slate-500 mt-1">📍 {med.location}</div>
                        )}
                      </td>

                      {/* HPP Modal Beli (Non-PPN vs Inc. PPN) */}
                      <td className="py-3 px-4">
                        {!isPpn ? (
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{formatRupiah(purNon)}</div>
                            <div className="text-[9px] text-amber-800 font-bold bg-amber-50 border border-amber-200 inline-block px-1.5 py-0.2 rounded mt-0.5">
                              HPP Non-PPN (Bebas PPN)
                            </div>
                          </div>
                        ) : (
                          <>
                            {priceDisplayMode === 'both' && (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900 text-xs">{formatRupiah(purInc)}</div>
                                <div className="text-[9px] font-semibold text-slate-500">
                                  (+PPN {rate}%): <span className="font-bold text-slate-700">{formatRupiah(purInc)}</span>
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  DPP (Non-PPN): <span className="font-bold text-slate-700">{formatRupiah(purNon)}</span>
                                </div>
                              </div>
                            )}
                            {priceDisplayMode === 'inc' && (
                              <div>
                                <div className="font-bold text-slate-900">{formatRupiah(purInc)}</div>
                                <div className="text-[9px] text-emerald-700 font-semibold">+PPN {rate}%</div>
                              </div>
                            )}
                            {priceDisplayMode === 'non' && (
                              <div>
                                <div className="font-bold text-slate-900">{formatRupiah(purNon)}</div>
                                <div className="text-[9px] text-slate-500 font-medium">DPP Tanpa PPN</div>
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Harga Jual Obat (Non-PPN vs Inc. PPN) */}
                      <td className="py-3 px-4">
                        {!isPpn ? (
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{formatRupiah(pNon)}</div>
                            <div className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 inline-block px-1.5 py-0.2 rounded mt-0.5">
                              Harga Non-PPN
                            </div>
                          </div>
                        ) : (
                          <>
                            {priceDisplayMode === 'both' && (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-emerald-700 text-xs">{formatRupiah(pInc)}</span>
                                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">
                                    Inc PPN {rate}%
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium">
                                  Harga DPP (Non-PPN): <strong className="text-slate-800 font-bold">{formatRupiah(pNon)}</strong>
                                </div>
                              </div>
                            )}

                            {priceDisplayMode === 'inc' && (
                              <div>
                                <div className="font-extrabold text-emerald-700 text-xs">{formatRupiah(pInc)}</div>
                                <div className="text-[9px] font-bold text-emerald-800 bg-emerald-100 inline-block px-1 rounded mt-0.5">
                                  Termasuk PPN {rate}%
                                </div>
                              </div>
                            )}

                            {priceDisplayMode === 'non' && (
                              <div>
                                <div className="font-extrabold text-indigo-900 text-xs">{formatRupiah(pNon)}</div>
                                <div className="text-[9px] font-semibold text-slate-500">Harga DPP (Tanpa PPN)</div>
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold text-sm ${
                              isLowStock ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {med.stock}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {med.unit} (Min: {med.minStock})
                          </span>
                        </div>
                        {isLowStock && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded mt-0.5 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" /> Stok Menipis
                          </span>
                        )}
                      </td>

                      {/* Expired Date */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{formatDate(med.expiredDate)}</div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${expStatus.badgeColor}`}
                        >
                          {expStatus.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            med.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {med.isActive ? '🟢 Aktif' : '📁 Non-Aktif (Terhapus)'}
                        </span>
                        {!med.isActive && (
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                            Laporan Penjualan Aman
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedHistoryMed(med)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Riwayat Perubahan Stok"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(med)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Obat & Pengaturan PPN"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {med.isActive ? (
                            <button
                              onClick={() => handleDelete(med)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                currentUser.role === 'admin'
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-300 cursor-not-allowed opacity-50'
                              }`}
                              title={
                                currentUser.role === 'admin'
                                  ? 'Hapus Obat (Aman untuk Laporan Penjualan)'
                                  : 'Hanya Admin yang dapat menghapus'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(med)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                currentUser.role === 'admin'
                                  ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                  : 'text-slate-300 cursor-not-allowed opacity-50'
                              }`}
                              title="Pulihkan (Restore) Obat ke Katalog Aktif"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Medicine Modal with Interactive PPN Price Calculator */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in duration-200">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm">
                      {editingMedicine ? 'Edit Sediaan Obat & Harga PPN' : 'Tambah Obat Baru (+ Atur PPN)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">Atur harga beli modal dan harga jual dengan konversi PPN otomatis</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Obat</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as MedicineCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Obat</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg (Sanbe)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* FITUR ATUR HARGA + PPN DAN HARGA NON PPN (KALKULATOR INTERAKTIF) */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3.5 shadow-md border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white">Form Pengaturan Harga & PPN</h4>
                      <p className="text-[10px] text-slate-400">Isi salah satu kolom, nilai pasangan akan terhitung otomatis</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPpnIncluded(true);
                        const rate = ppnRate > 0 ? ppnRate : 11;
                        handlePpnRateChange(rate);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                        isPpnIncluded
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🏷️ PPN {ppnRate > 0 ? ppnRate : 11}%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPpnIncluded(false);
                        handlePpnRateChange(0);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                        !isPpnIncluded
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📄 Non-PPN
                    </button>
                  </div>
                </div>

                {/* Quick PPN Presets */}
                <div className="flex items-center gap-2 text-[10px] flex-wrap">
                  <span className="text-slate-400 font-semibold">Jenis / Tarif Pajak Obat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPpnIncluded(true);
                      handlePpnRateChange(11);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      isPpnIncluded && ppnRate === 11
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🏷️ PPN 11% (Faktur Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPpnIncluded(true);
                      handlePpnRateChange(12);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      isPpnIncluded && ppnRate === 12
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🏷️ PPN 12%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPpnIncluded(false);
                      handlePpnRateChange(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      !isPpnIncluded || ppnRate === 0
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    📄 Non-PPN (Bebas PPN)
                  </button>
                </div>

                {/* 1. HARGA BELI / MODAL HPP SUPPLIER */}
                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-emerald-300 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> 1. Harga Beli / HPP Modal Supplier
                    </span>
                    {ppnRate > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Pajak PPN Beli: +{formatRupiah(purchasePriceIncPpn - purchasePriceNonPpn)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Harga Beli Non-PPN (DPP)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">Rp</span>
                        <input
                          type="number"
                          min="0"
                          value={purchasePriceNonPpn}
                          onChange={e => handlePurchaseNonPpnChange(Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                        Harga Beli + PPN ({ppnRate}%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-[10px]">Rp</span>
                        <input
                          type="number"
                          min="0"
                          value={purchasePriceIncPpn}
                          onChange={e => handlePurchaseIncPpnChange(Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/50 text-emerald-300 font-extrabold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. HARGA JUAL OBAT DI KASIR */}
                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-indigo-300 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> 2. Harga Jual Penjualan Obat
                    </span>
                    {priceNonPpn > purchasePriceNonPpn && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-800">
                        Profit: +{formatRupiah(priceNonPpn - purchasePriceNonPpn)} (Margin: {Math.round(((priceNonPpn - purchasePriceNonPpn) / (priceNonPpn || 1)) * 100)}%)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Harga Jual Non-PPN (DPP)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">Rp</span>
                        <input
                          type="number"
                          min="0"
                          value={priceNonPpn}
                          onChange={e => handlePriceNonPpnChange(Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-indigo-300 mb-1 flex items-center gap-1">
                        Harga Jual + PPN ({ppnRate}%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-300 font-bold text-[10px]">Rp</span>
                        <input
                          type="number"
                          min="0"
                          value={priceIncPpn}
                          onChange={e => handlePriceIncPpnChange(Number(e.target.value))}
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/50 text-indigo-200 font-extrabold text-xs focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price Setting Preference */}
                  <div className="pt-1 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPpnIncluded}
                        onChange={e => setIsPpnIncluded(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                      />
                      <span>Gunakan Harga Inc. PPN ({formatRupiah(priceIncPpn)}) sebagai Harga Utama Penjualan Kasir</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingMedicine ? 'Stok Saat Ini (Terkunci)' : 'Stok Awal'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!!editingMedicine}
                    value={stock}
                    onChange={e => setStock(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border font-semibold focus:outline-none ${
                      editingMedicine
                        ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                    }`}
                  />
                  {editingMedicine && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Stok awal tidak dapat diubah dari menu edit. Gunakan menu Stok Masuk atau Penyesuaian Stok.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min. Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={e => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {units.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tgl Expired</label>
                  <input
                    type="date"
                    required
                    value={expiredDate}
                    onChange={e => setExpiredDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Rak / Etalase</label>
                  <input
                    type="text"
                    placeholder="e.g. Rak A1"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Status Obat Aktif (Dapat dijual di Kasir)
                </label>
              </div>

              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Data Obat & PPN
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* Stock History Modal */}
      {selectedHistoryMed && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in duration-200">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Riwayat Mutasi Stok Obat</h3>
                <p className="text-xs text-slate-400">
                  {selectedHistoryMed.name} ({selectedHistoryMed.code})
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryMed(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {stockHistory.filter(sh => sh.medicineId === selectedHistoryMed.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-xs">
                  Belum ada log pergerakan stok untuk obat ini.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2">Tanggal</th>
                      <th className="py-2">Jenis</th>
                      <th className="py-2">Sebelum</th>
                      <th className="py-2">Jumlah</th>
                      <th className="py-2">Sesudah</th>
                      <th className="py-2">Keterangan</th>
                      <th className="py-2">Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockHistory
                      .filter(sh => sh.medicineId === selectedHistoryMed.id)
                      .map((sh, idx) => (
                        <tr key={`${sh.id}-${idx}`} className="hover:bg-slate-50">
                          <td className="py-2 text-slate-500">{sh.date}</td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sh.type === 'masuk'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sh.type === 'keluar'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {sh.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 font-mono">{sh.prevStock}</td>
                          <td
                            className={`py-2 font-mono font-bold ${
                              sh.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {sh.amount > 0 ? `+${sh.amount}` : sh.amount}
                          </td>
                          <td className="py-2 font-mono font-bold text-slate-900">{sh.newStock}</td>
                          <td className="py-2 text-slate-600">{sh.note}</td>
                          <td className="py-2 text-slate-500">{sh.user}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedHistoryMed(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingMedicine && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 text-left my-auto">
              <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Hapus Produk</h3>
                <p className="text-xs text-slate-500">
                  Apakah Anda yakin ingin menghapus produk obat berikut dari katalog aktif?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-900 text-sm">{deletingMedicine.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">Kode: {deletingMedicine.code} | Kategori: {deletingMedicine.category}</div>
              
              <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-start gap-1.5 text-emerald-700 font-semibold">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>Riwayat Transaksi & Laporan Penjualan TETAP TERSIMPAN SANGAT AMAN.</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-600">
                  <Archive className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
                  <span>Obat dipindahkan ke status <strong>Non-Aktif (Arsip)</strong>. Anda dapat mengaktifkannya (restore) kapan saja.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingMedicine(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-200"
              >
                <Trash2 className="w-4 h-4" />
                Ya, Hapus Produk
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Restore Confirmation Modal */}
      {restoringMedicine && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in text-left my-auto">
              <div className="flex items-start gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Pulihkan Produk</h3>
                <p className="text-xs text-slate-500">
                  Aktifkan kembali sediaan obat ini ke katalog aktif kasir & manajemen stok?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs space-y-1">
              <div className="font-bold text-emerald-950 text-sm">{restoringMedicine.name}</div>
              <div className="text-emerald-700 font-mono text-[11px]">Kode: {restoringMedicine.code}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRestoringMedicine(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Ya, Pulihkan ke Katalog
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center my-auto animate-in fade-in">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Akses Dibatasi</h3>
                <p className="text-xs text-slate-600">{alertMessage}</p>
              </div>
              <button
                onClick={() => setAlertMessage(null)}
                className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
