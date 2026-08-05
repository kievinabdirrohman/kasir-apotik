import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah } from '../utils/formatters';
import {
  Calculator,
  Percent,
  TrendingUp,
  DollarSign,
  Receipt,
  Stethoscope,
  BookOpen,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Pill,
  Check,
  RefreshCw,
} from 'lucide-react';

export const PrescriptionCalculators: React.FC = () => {
  const { transactions, medicines } = useApp();

  // Completed transactions data for Live Auto-Fill
  const completedTrxs = transactions.filter(t => t.status === 'Selesai');
  const totalSalesLive = completedTrxs.reduce((sum, t) => sum + t.totalAmount, 0);
  const prescriptionTrxsLive = completedTrxs.filter(t => t.isPrescription);
  const prescriptionSalesLive = prescriptionTrxsLive.reduce((sum, t) => sum + t.totalAmount, 0);

  // Generic medicines count for Live Auto-Fill
  const genericMedicinesLive = medicines.filter(m =>
    m.category.toLowerCase().includes('generik') || m.name.toLowerCase().includes('generik')
  ).length;
  const totalMedicinesLive = medicines.length;

  // Selected Calculator Tab (1 to 9 + Practical Pricing)
  const [selectedCalc, setSelectedCalc] = useState<number | 'pricing'>(1);

  // --- STATE FOR CALCULATOR 1: Penjualan Resep vs Total Penjualan ---
  const [c1PrescriptionSales, setC1PrescriptionSales] = useState<number>(30000000);
  const [c1TotalSales, setC1TotalSales] = useState<number>(50000000);

  // --- STATE FOR CALCULATOR 2: Margin / Keuntungan Resep ---
  const [c2Hpp, setC2Hpp] = useState<number>(100000);
  const [c2SellingPrice, setC2SellingPrice] = useState<number>(130000);

  // --- STATE FOR CALCULATOR 3: Markup Resep ---
  const [c3Hpp, setC3Hpp] = useState<number>(100000);
  const [c3SellingPrice, setC3SellingPrice] = useState<number>(130000);

  // --- STATE FOR CALCULATOR 4: Jasa Pelayanan Resep ---
  const [c4MedicinePrice, setC4MedicinePrice] = useState<number>(150000);
  const [c4ServiceFee, setC4ServiceFee] = useState<number>(15000);

  // --- STATE FOR CALCULATOR 5: Resep Racikan ---
  const [c5RacikanCount, setC5RacikanCount] = useState<number>(50);
  const [c5TotalPrescriptions, setC5TotalPrescriptions] = useState<number>(200);

  // --- STATE FOR CALCULATOR 6: Kepatuhan Penebusan Resep ---
  const [c6RedeemedCount, setC6RedeemedCount] = useState<number>(450);
  const [c6ReceivedCount, setC6ReceivedCount] = useState<number>(500);

  // --- STATE FOR CALCULATOR 7: Penggunaan Obat Generik ---
  const [c7GenericItems, setC7GenericItems] = useState<number>(120);
  const [c7TotalItems, setC7TotalItems] = useState<number>(150);

  // --- STATE FOR CALCULATOR 8: Insentif Resep ---
  const [c8SalesAmount, setC8SalesAmount] = useState<number>(10000000);
  const [c8IncentivePct, setC8IncentivePct] = useState<number>(5);

  // --- STATE FOR CALCULATOR 9: Profit Bersih Resep ---
  const [c9SalesAmount, setC9SalesAmount] = useState<number>(50000000);
  const [c9NetProfit, setC9NetProfit] = useState<number>(7500000);

  // --- STATE FOR PRACTICAL PATIENT PRICING CALCULATOR ---
  const [pMedicineCost, setPMedicineCost] = useState<number>(100000);
  const [pMarginPct, setPMarginPct] = useState<number>(20);
  const [pServiceFee, setPServiceFee] = useState<number>(10000);
  const [pPackagingFee, setPPackagingFee] = useState<number>(5000);
  const [pTaxPct, setPTaxPct] = useState<number>(0);

  // Autofill Live Store Data handlers
  const handleAutofillLive = (calcId: number) => {
    if (calcId === 1) {
      setC1PrescriptionSales(prescriptionSalesLive || 30000000);
      setC1TotalSales(totalSalesLive || 50000000);
    } else if (calcId === 5) {
      setC5RacikanCount(prescriptionTrxsLive.length || 50);
      setC5TotalPrescriptions(completedTrxs.length || 200);
    } else if (calcId === 7) {
      setC7GenericItems(genericMedicinesLive || 120);
      setC7TotalItems(totalMedicinesLive || 150);
    }
  };

  // Reset to Prompt Default Examples
  const handleResetExample = (calcId: number | 'pricing') => {
    switch (calcId) {
      case 1:
        setC1PrescriptionSales(30000000);
        setC1TotalSales(50000000);
        break;
      case 2:
        setC2Hpp(100000);
        setC2SellingPrice(130000);
        break;
      case 3:
        setC3Hpp(100000);
        setC3SellingPrice(130000);
        break;
      case 4:
        setC4MedicinePrice(150000);
        setC4ServiceFee(15000);
        break;
      case 5:
        setC5RacikanCount(50);
        setC5TotalPrescriptions(200);
        break;
      case 6:
        setC6RedeemedCount(450);
        setC6ReceivedCount(500);
        break;
      case 7:
        setC7GenericItems(120);
        setC7TotalItems(150);
        break;
      case 8:
        setC8SalesAmount(10000000);
        setC8IncentivePct(5);
        break;
      case 9:
        setC9SalesAmount(50000000);
        setC9NetProfit(7500000);
        break;
      case 'pricing':
        setPMedicineCost(100000);
        setPMarginPct(20);
        setPServiceFee(10000);
        setPPackagingFee(5000);
        setPTaxPct(0);
        break;
    }
  };

  // Calculations for Practical Pricing
  const calculatedMarginRp = (pMedicineCost * pMarginPct) / 100;
  const subtotalBeforeTax = pMedicineCost + calculatedMarginRp + pServiceFee + pPackagingFee;
  const calculatedTaxRp = (subtotalBeforeTax * pTaxPct) / 100;
  const finalPatientPrice = subtotalBeforeTax + calculatedTaxRp;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-3xl">
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-bold inline-flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-indigo-300" />
            Modul Panduan & Kalkulator Persentase Farmasi Apotek
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Panduan & Kalkulator Simulasi Persentase Resep
          </h3>
          <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
            Hitung kontribusi resep, margin keuntungan, markup, jasa pelayanan, kepatuhan penebusan, penggunaan obat generik, hingga rumus simulasi penetapan harga resep untuk pasien secara akurat.
          </p>
        </div>
        <div className="absolute right-4 bottom-0 opacity-10 pointer-events-none hidden md:block">
          <Percent className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Main Mode Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setSelectedCalc(1)}
          className={`py-2.5 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 ${
            selectedCalc === 1
              ? 'bg-white text-indigo-950 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>1. Kontribusi Resep</span>
        </button>

        <button
          onClick={() => setSelectedCalc(2)}
          className={`py-2.5 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 ${
            selectedCalc === 2
              ? 'bg-white text-indigo-950 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>2. Gross Margin (%)</span>
        </button>

        <button
          onClick={() => setSelectedCalc(3)}
          className={`py-2.5 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 ${
            selectedCalc === 3
              ? 'bg-white text-indigo-950 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-4 h-4 text-amber-600" />
          <span>3. Markup Rate (%)</span>
        </button>

        <button
          onClick={() => setSelectedCalc(4)}
          className={`py-2.5 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 ${
            selectedCalc === 4
              ? 'bg-white text-indigo-950 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4 text-purple-600" />
          <span>4. Jasa Pelayanan</span>
        </button>

        <button
          onClick={() => setSelectedCalc('pricing')}
          className={`py-2.5 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 col-span-2 sm:col-span-1 ${
            selectedCalc === 'pricing'
              ? 'bg-indigo-700 text-white shadow-sm shadow-indigo-200'
              : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-300" />
          <span>Formulasi Harga Resep</span>
        </button>
      </div>

      {/* Secondary Selector Grid (Formulas 5 - 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-semibold">
        <button
          onClick={() => setSelectedCalc(5)}
          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
            selectedCalc === 5
              ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs font-bold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
            5
          </span>
          <span className="truncate">Biaya Racikan</span>
        </button>

        <button
          onClick={() => setSelectedCalc(6)}
          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
            selectedCalc === 6
              ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs font-bold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
            6
          </span>
          <span className="truncate">Diskon Penebusan</span>
        </button>

        <button
          onClick={() => setSelectedCalc(7)}
          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
            selectedCalc === 7
              ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs font-bold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
            7
          </span>
          <span className="truncate">Diskon Generik</span>
        </button>

        <button
          onClick={() => setSelectedCalc(8)}
          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
            selectedCalc === 8
              ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs font-bold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
            8
          </span>
          <span className="truncate">Insentif Dokter</span>
        </button>

        <button
          onClick={() => setSelectedCalc(9)}
          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
            selectedCalc === 9
              ? 'bg-white border-indigo-600 text-indigo-950 shadow-2xs font-bold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
            9
          </span>
          <span className="truncate">Surcharge Farmasi</span>
        </button>
      </div>

      {/* CALCULATOR 1: PERSENTASE PENJUALAN RESEP VS TOTAL PENJUALAN */}
      {selectedCalc === 1 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block">Rumus #1</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Penjualan Resep terhadap Total Penjualan</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan untuk mengetahui kontribusi resep dokter terhadap total omzet apotek.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAutofillLive(1)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Isi otomatis dengan data transaksi apotek saat ini"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Isi Data Apotek Saat Ini
              </button>
              <button
                onClick={() => handleResetExample(1)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
              >
                Contoh Soal
              </button>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs font-mono text-indigo-900 space-y-1">
            <span className="text-[10px] font-bold text-indigo-500 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-indigo-950">
              Persentase Resep = ( Penjualan Resep / Total Penjualan ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Penjualan Resep (Rp):
                </label>
                <input
                  type="number"
                  value={c1PrescriptionSales}
                  onChange={e => setC1PrescriptionSales(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Total Penjualan Apotek (Rp):
                </label>
                <input
                  type="number"
                  value={c1TotalSales}
                  onChange={e => setC1TotalSales(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Hasil Perhitungan:</span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">
                  {c1TotalSales > 0 ? ((c1PrescriptionSales / c1TotalSales) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong>{' '}
                  <span className="text-emerald-300 font-bold">
                    {c1TotalSales > 0 ? ((c1PrescriptionSales / c1TotalSales) * 100).toFixed(1) : '0'}%
                  </span>{' '}
                  omzet apotek berasal dari transaksi resep dokter.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Penjualan OTC (Bebas): {formatRupiah(Math.max(0, c1TotalSales - c1PrescriptionSales))}</span>
                <span>Porsi OTC: {c1TotalSales > 0 ? (100 - (c1PrescriptionSales / c1TotalSales) * 100).toFixed(1) : '0'}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 2: PERSENTASE MARGIN ATEU KEUNTUNGAN RESEP */}
      {selectedCalc === 2 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider block">Rumus #2</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Margin / Keuntungan Resep</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan untuk mengetahui persentase keuntungan murni dari penjualan obat resep terhadap modal.</p>
            </div>
            <button
              onClick={() => handleResetExample(2)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-xs font-mono text-emerald-900 space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-emerald-950">
              Margin (%) = ( Laba / Harga Pokok HPP ) × 100%
            </div>
            <div className="text-[11px] text-emerald-700">di mana Laba = Harga Jual - Harga Pokok (HPP)</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Harga Pokok / Modal Obat (Rp):
                </label>
                <input
                  type="number"
                  value={c2Hpp}
                  onChange={e => setC2Hpp(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Harga Jual Resep (Rp):
                </label>
                <input
                  type="number"
                  value={c2SellingPrice}
                  onChange={e => setC2SellingPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Hasil Perhitungan:</span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">
                  {c2Hpp > 0 ? (((c2SellingPrice - c2Hpp) / c2Hpp) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Laba Kotor: <strong className="text-emerald-300">{formatRupiah(c2SellingPrice - c2Hpp)}</strong>
                  <br />
                  <strong>Hasil:</strong> Persentase Margin Keuntungan adalah{' '}
                  <strong className="text-emerald-300">
                    {c2Hpp > 0 ? (((c2SellingPrice - c2Hpp) / c2Hpp) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Rasio Laba terhadap Harga Jual (Gross Margin): {c2SellingPrice > 0 ? (((c2SellingPrice - c2Hpp) / c2SellingPrice) * 100).toFixed(1) : '0'}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 3: MARKUP RESEP */}
      {selectedCalc === 3 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider block">Rumus #3</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Markup Resep</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan saat menentukan penetapan harga jual obat dari modal (HPP).</p>
            </div>
            <button
              onClick={() => handleResetExample(3)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 text-xs font-mono text-amber-900 space-y-1">
            <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-amber-950">
              Markup (%) = [ ( Harga Jual - Harga Pokok ) / Harga Pokok ] × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Harga Pokok / Modal (Rp):
                </label>
                <input
                  type="number"
                  value={c3Hpp}
                  onChange={e => setC3Hpp(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Harga Jual Ditargetkan (Rp):
                </label>
                <input
                  type="number"
                  value={c3SellingPrice}
                  onChange={e => setC3SellingPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Hasil Markup:</span>
                <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-2">
                  {c3Hpp > 0 ? (((c3SellingPrice - c3Hpp) / c3Hpp) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong> Persentase Markup obat ini adalah{' '}
                  <strong className="text-amber-300">
                    {c3Hpp > 0 ? (((c3SellingPrice - c3Hpp) / c3Hpp) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Faktor Pengali Harga (Multiplier): {c3Hpp > 0 ? (c3SellingPrice / c3Hpp).toFixed(2) : '1.00'}x Modal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 4: JASA PELAYANAN RESEP */}
      {selectedCalc === 4 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-purple-600 tracking-wider block">Rumus #4</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Jasa Pelayanan Resep (Embalase / Tuscan)</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan untuk menghitung proporsi jasa pelayanan kefarmasian terhadap nominal obat.</p>
            </div>
            <button
              onClick={() => handleResetExample(4)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 text-xs font-mono text-purple-900 space-y-1">
            <span className="text-[10px] font-bold text-purple-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-purple-950">
              Persentase Jasa = ( Jasa Resep / Harga Obat ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Harga Obat (Rp):
                </label>
                <input
                  type="number"
                  value={c4MedicinePrice}
                  onChange={e => setC4MedicinePrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nominal Jasa Resep / Tuscan (Rp):
                </label>
                <input
                  type="number"
                  value={c4ServiceFee}
                  onChange={e => setC4ServiceFee(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Hasil Persentase Jasa:</span>
                <div className="text-3xl sm:text-4xl font-black text-purple-300 mt-2">
                  {c4MedicinePrice > 0 ? ((c4ServiceFee / c4MedicinePrice) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Total Tagihan Obat + Jasa:{' '}
                  <strong className="text-purple-300">{formatRupiah(c4MedicinePrice + c4ServiceFee)}</strong>
                  <br />
                  <strong>Hasil:</strong> Jasa pelayanan sebesar{' '}
                  <strong className="text-purple-300">
                    {c4MedicinePrice > 0 ? ((c4ServiceFee / c4MedicinePrice) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Pelayanan kefarmasian standar apotek</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 5: PERSENTASE RESEP RACIKAN */}
      {selectedCalc === 5 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block">Rumus #5</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Resep Racikan</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan untuk mengetahui proporsi resep racikan (puyer/kapsul/salep) dibanding total resep.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAutofillLive(5)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Isi Data Apotek
              </button>
              <button
                onClick={() => handleResetExample(5)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
              >
                Contoh Soal
              </button>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs font-mono text-indigo-900 space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-indigo-950">
              Persentase Racikan = ( Jumlah Resep Racikan / Total Resep ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Jumlah Resep Racikan (Lembar):
                </label>
                <input
                  type="number"
                  value={c5RacikanCount}
                  onChange={e => setC5RacikanCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Total Resep Diterima (Lembar):
                </label>
                <input
                  type="number"
                  value={c5TotalPrescriptions}
                  onChange={e => setC5TotalPrescriptions(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Proporsi Racikan:</span>
                <div className="text-3xl sm:text-4xl font-black text-indigo-300 mt-2">
                  {c5TotalPrescriptions > 0 ? ((c5RacikanCount / c5TotalPrescriptions) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong>{' '}
                  <strong className="text-indigo-300">
                    {c5TotalPrescriptions > 0 ? ((c5RacikanCount / c5TotalPrescriptions) * 100).toFixed(1) : '0'}%
                  </strong>{' '}
                  resep merupakan jenis racikan.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Resep Non-Racikan (Jadi): {Math.max(0, c5TotalPrescriptions - c5RacikanCount)} Lembar</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 6: KEPATUHAN PENEBUSAN RESEP */}
      {selectedCalc === 6 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider block">Rumus #6</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Kepatuhan Penebusan Resep</h4>
              <p className="text-xs text-slate-500 mt-0.5">Mengukur tingkat keberhasilan penebusan resep yang dibawa pasien ke apotek.</p>
            </div>
            <button
              onClick={() => handleResetExample(6)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs font-mono text-blue-900 space-y-1">
            <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-blue-950">
              Persentase Penebusan = ( Resep Ditebus / Resep Diterima ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Resep Ditebus / Selesai (Lembar):
                </label>
                <input
                  type="number"
                  value={c6RedeemedCount}
                  onChange={e => setC6RedeemedCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Total Resep Diterima / Masuk (Lembar):
                </label>
                <input
                  type="number"
                  value={c6ReceivedCount}
                  onChange={e => setC6ReceivedCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Tingkat Penebusan:</span>
                <div className="text-3xl sm:text-4xl font-black text-blue-300 mt-2">
                  {c6ReceivedCount > 0 ? ((c6RedeemedCount / c6ReceivedCount) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong> Tingkat penebusan resep adalah{' '}
                  <strong className="text-blue-300">
                    {c6ReceivedCount > 0 ? ((c6RedeemedCount / c6ReceivedCount) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Resep Batal / Tidak Ditebus: {Math.max(0, c6ReceivedCount - c6RedeemedCount)} Lembar</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 7: PERSENTASE PENGGUNAAN OBAT GENERIK */}
      {selectedCalc === 7 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-teal-600 tracking-wider block">Rumus #7</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Penggunaan Obat Generik</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan dalam audit pelayanan kefarmasian & pemantauan obat generik vs paten.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAutofillLive(7)}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Isi Data Stok
              </button>
              <button
                onClick={() => handleResetExample(7)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
              >
                Contoh Soal
              </button>
            </div>
          </div>

          <div className="bg-teal-50/70 border border-teal-100 rounded-2xl p-4 text-xs font-mono text-teal-900 space-y-1">
            <span className="text-[10px] font-bold text-teal-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-teal-950">
              Persentase Generik = ( Jumlah Item Generik / Total Item Obat ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Jumlah Item Obat Generik:
                </label>
                <input
                  type="number"
                  value={c7GenericItems}
                  onChange={e => setC7GenericItems(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Total Item Obat Keseluruhan:
                </label>
                <input
                  type="number"
                  value={c7TotalItems}
                  onChange={e => setC7TotalItems(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Proporsi Generik:</span>
                <div className="text-3xl sm:text-4xl font-black text-teal-300 mt-2">
                  {c7TotalItems > 0 ? ((c7GenericItems / c7TotalItems) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong> Penggunaan obat generik mencapai{' '}
                  <strong className="text-teal-300">
                    {c7TotalItems > 0 ? ((c7GenericItems / c7TotalItems) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Obat Paten / Bermerek: {Math.max(0, c7TotalItems - c7GenericItems)} Item</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 8: INSENTIF RESEP */}
      {selectedCalc === 8 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-rose-600 tracking-wider block">Rumus #8</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Insentif Berdasarkan Resep</h4>
              <p className="text-xs text-slate-500 mt-0.5">Digunakan untuk menghitung nominal insentif/fee dokter atau petugas berdasarkan persentase resep.</p>
            </div>
            <button
              onClick={() => handleResetExample(8)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 text-xs font-mono text-rose-900 space-y-1">
            <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-rose-950">
              Insentif (Rp) = Nilai Penjualan Resep × Persentase Insentif (%)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nilai Penjualan Resep (Rp):
                </label>
                <input
                  type="number"
                  value={c8SalesAmount}
                  onChange={e => setC8SalesAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Persentase Insentif (%):
                </label>
                <input
                  type="number"
                  value={c8IncentivePct}
                  onChange={e => setC8IncentivePct(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Nominal Insentif:</span>
                <div className="text-3xl sm:text-4xl font-black text-rose-400 mt-2">
                  {formatRupiah((c8SalesAmount * c8IncentivePct) / 100)}
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong> Total insentif yang diperoleh adalah{' '}
                  <strong className="text-rose-300">{formatRupiah((c8SalesAmount * c8IncentivePct) / 100)}</strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Porsi Apotek Bersih: {formatRupiah(c8SalesAmount - (c8SalesAmount * c8IncentivePct) / 100)} ({100 - c8IncentivePct}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR 9: PROFIT BERSIH DARI RESEP */}
      {selectedCalc === 9 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider block">Rumus #9</span>
              <h4 className="text-lg font-black text-slate-900">Persentase Profit Bersih dari Resep</h4>
              <p className="text-xs text-slate-500 mt-0.5">Memperhitungkan laba bersih akhir setelah dikurangi biaya operasional dari omzet resep.</p>
            </div>
            <button
              onClick={() => handleResetExample(9)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Contoh Soal
            </button>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-xs font-mono text-emerald-900 space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider font-sans">Rumus Matematika:</span>
            <div className="text-sm font-black text-emerald-950">
              Profit Bersih (%) = ( Laba Bersih / Penjualan Resep ) × 100%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Penjualan Resep (Rp):
                </label>
                <input
                  type="number"
                  value={c9SalesAmount}
                  onChange={e => setC9SalesAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Laba Bersih Setelah Biaya (Rp):
                </label>
                <input
                  type="number"
                  value={c9NetProfit}
                  onChange={e => setC9NetProfit(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Profit Bersih (%):</span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 mt-2">
                  {c9SalesAmount > 0 ? ((c9NetProfit / c9SalesAmount) * 100).toFixed(1) : '0'}%
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Hasil:</strong> Persentase profit bersih apotek dari resep adalah{' '}
                  <strong className="text-emerald-300">
                    {c9SalesAmount > 0 ? ((c9NetProfit / c9SalesAmount) * 100).toFixed(1) : '0'}%
                  </strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Rasio efisiensi operasional apotek</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATOR MODUL 10: RUMUS PRAKTIS HARGA RESEP UNTUK PASIEN */}
      {selectedCalc === 'pricing' && (
        <div className="bg-white rounded-3xl border border-indigo-200 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider inline-block mb-1">
                Rumus Praktis Apotek
              </span>
              <h4 className="text-lg font-black text-slate-900">Kalkulator Simulasi Harga Resep untuk Pasien</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Formula lengkap penetapan harga tagihan resep pasien (Modal Obat + Margin + Jasa Pelayanan + Kemasan + Pajak).
              </p>
            </div>
            <button
              onClick={() => handleResetExample('pricing')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold self-start sm:self-auto"
            >
              Reset ke Contoh Standard
            </button>
          </div>

          <div className="bg-indigo-950 text-white rounded-2xl p-4 text-xs font-mono space-y-2">
            <span className="text-[10px] font-bold text-indigo-300 block uppercase tracking-wider font-sans">Formula Penetapan Harga Pasien:</span>
            <div className="text-sm font-black text-emerald-300 leading-snug">
              Harga Resep = Harga Pokok + Margin (%) + Jasa Pelayanan + Biaya Kemasan/Racikan + Pajak
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">1. Harga Pokok / Modal Obat (Rp):</label>
                <input
                  type="number"
                  value={pMedicineCost}
                  onChange={e => setPMedicineCost(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">2. Margin Keuntungan (%):</label>
                  <input
                    type="number"
                    value={pMarginPct}
                    onChange={e => setPMarginPct(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    = {formatRupiah(calculatedMarginRp)}
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">3. Jasa Pelayanan (Rp):</label>
                  <input
                    type="number"
                    value={pServiceFee}
                    onChange={e => setPServiceFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">4. Biaya Kemasan / Pot (Rp):</label>
                  <input
                    type="number"
                    value={pPackagingFee}
                    onChange={e => setPPackagingFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">5. Pajak PPN (%):</label>
                  <input
                    type="number"
                    value={pTaxPct}
                    onChange={e => setPTaxPct(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                  {pTaxPct > 0 && (
                    <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                      = {formatRupiah(calculatedTaxRp)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rincian Komponen Tagihan Pasien */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  Rincian Tagihan Resep Pasien:
                </span>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Harga Pokok Obat</span>
                    <strong className="text-white">{formatRupiah(pMedicineCost)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Margin ({pMarginPct}%)</span>
                    <strong className="text-emerald-400">+{formatRupiah(calculatedMarginRp)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Jasa Pelayanan Kefarmasian</span>
                    <strong className="text-purple-300">+{formatRupiah(pServiceFee)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Biaya Kemasan / Cangkang Kapsul</span>
                    <strong className="text-indigo-300">+{formatRupiah(pPackagingFee)}</strong>
                  </div>
                  {pTaxPct > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Pajak PPN ({pTaxPct}%)</span>
                      <strong className="text-amber-400">+{formatRupiah(calculatedTaxRp)}</strong>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-400 block uppercase">Total Yang Dibayar Pasien:</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {formatRupiah(finalPatientPrice)}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                💡 <strong>Catatan Praktik:</strong> Dalam transaksi kasir POS, nilai total ini merupakan tagihan akhir yang dicetak pada nota/struk resep pasien.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
