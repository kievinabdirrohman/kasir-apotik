import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  formatRupiah,
  formatDateTime,
  getExpiredStatus,
  getWIBDateString,
  getDaysUntilExpired,
  formatDate,
  formatStockDisplay,
} from '../utils/formatters';
import {
  TrendingUp,
  Receipt,
  Users,
  Stethoscope,
  Pill,
  AlertTriangle,
  Clock,
  AlertCircle,
  ShoppingCart,
  ShoppingBag,
  PackagePlus,
  ArrowUpRight,
  ChevronRight,
  CheckCircle,
  Bell,
  ShieldAlert,
  Search,
  Tag,
  ExternalLink,
  BarChart3,
  Calendar,
  Activity,
  DollarSign,
} from 'lucide-react';

function getPastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDateLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
      ];
      return `${day} ${monthNames[monthIdx] || ''}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

const CustomTooltip = ({ active, payload, label, timeframe }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 border border-slate-800">
        <div className="font-bold text-slate-300">
          {timeframe === 'today' ? `Jam ${label}` : `Tanggal ${label}`}
        </div>
        <div className="text-emerald-400 font-extrabold text-sm">
          {formatRupiah(data.revenue)}
        </div>
        <div className="text-slate-400 text-[11px] flex items-center justify-between gap-4 pt-1.5 border-t border-slate-800">
          <span>Jumlah Transaksi:</span>
          <span className="font-bold text-white">{data.count} transaksi</span>
        </div>
        {data.count > 0 && (
          <div className="text-slate-400 text-[11px] flex items-center justify-between gap-4">
            <span>Rata-rata / Trx:</span>
            <span className="font-bold text-slate-200">
              {formatRupiah(Math.round(data.revenue / data.count))}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CustomSalesTooltip = ({ active, payload, label, timeframe }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-2 border border-slate-800">
        <div className="font-bold text-slate-300 pb-1 border-b border-slate-800">
          {timeframe === 'today' ? `Jam ${label}` : `Tanggal ${label}`}
        </div>
        <div className="text-indigo-400 font-extrabold text-xs flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
            Jumlah Transaksi:
          </span>
          <span className="text-sm font-black text-white">{data.transactionsCount} Trx</span>
        </div>
        <div className="text-amber-400 font-bold text-xs flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            Sediaan Obat Terjual:
          </span>
          <span className="text-sm font-black text-white">{data.itemsCount} Pcs</span>
        </div>
        <div className="text-emerald-400 text-[11px] font-medium flex items-center justify-between gap-4 pt-1.5 border-t border-slate-800">
          <span>Nilai Penjualan:</span>
          <span className="font-bold">{formatRupiah(data.revenue)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardView: React.FC = () => {
  const {
    medicines,
    customers,
    doctors,
    transactions,
    setActiveTab,
    lowStockCount,
    expiredCount,
    expiring30Count,
    expiring60Count,
    expiring90Count,
    expiring120Count,
    expiring180Count,
  } = useApp();

  const [dashboardExpiryFilter, setDashboardExpiryFilter] = useState<'all' | 'expired' | '30' | '90' | '180'>('all');
  const [dashboardExpirySearch, setDashboardExpirySearch] = useState('');

  // Chart Timeframe State: 'today' (default), '7days', '30days'
  const [chartTimeframe, setChartTimeframe] = useState<'today' | '7days' | '30days'>('today');

  const todayStr = getWIBDateString();

  // Calculations for Today
  const todayTransactions = transactions.filter(
    t => t.date.startsWith(todayStr) && t.status === 'Selesai'
  );

  const totalSalesToday = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Chart Data Generation based on selected timeframe
  let chartData: { label: string; revenue: number; count: number }[] = [];

  if (chartTimeframe === 'today') {
    // Hourly breakdown for Today (07:00 to 22:00)
    const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    chartData = hours.map(h => {
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      const hourTrx = transactions.filter(t => {
        if (t.status !== 'Selesai') return false;
        if (!t.date.startsWith(todayStr)) return false;
        const timePart = t.date.split(' ')[1];
        if (timePart) {
          const trxHour = parseInt(timePart.split(':')[0], 10);
          return trxHour === h;
        } else {
          const d = new Date(t.date);
          return d.getHours() === h;
        }
      });
      const revenue = hourTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: hourLabel,
        revenue,
        count: hourTrx.length,
      };
    });
  } else if (chartTimeframe === '7days') {
    // Daily breakdown for Last 7 Days
    const daysList = Array.from({ length: 7 }, (_, i) => 6 - i);
    chartData = daysList.map(daysAgo => {
      const dateStr = getPastDateString(daysAgo);
      const dayTrx = transactions.filter(t => t.status === 'Selesai' && t.date.startsWith(dateStr));
      const revenue = dayTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: formatShortDateLabel(dateStr),
        revenue,
        count: dayTrx.length,
      };
    });
  } else {
    // Daily breakdown for Last 30 Days (1 Bulan Terakhir)
    const daysList = Array.from({ length: 30 }, (_, i) => 29 - i);
    chartData = daysList.map(daysAgo => {
      const dateStr = getPastDateString(daysAgo);
      const dayTrx = transactions.filter(t => t.status === 'Selesai' && t.date.startsWith(dateStr));
      const revenue = dayTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: formatShortDateLabel(dateStr),
        revenue,
        count: dayTrx.length,
      };
    });
  }

  // Summary Metrics for the chart period
  const totalChartRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const totalChartCount = chartData.reduce((sum, item) => sum + item.count, 0);
  const avgChartRevenue = totalChartCount > 0 ? Math.round(totalChartRevenue / totalChartCount) : 0;
  const peakChartPoint = chartData.reduce((max, item) => (item.revenue > max.revenue ? item : max), {
    label: '-',
    revenue: 0,
    count: 0,
  });

  // Sales Trend Chart Timeframe State: 'today' (default), '7days', '30days'
  const [salesTimeframe, setSalesTimeframe] = useState<'today' | '7days' | '30days'>('today');

  // Sales Trend Chart Data Generation
  let salesChartData: { label: string; transactionsCount: number; itemsCount: number; revenue: number }[] = [];

  if (salesTimeframe === 'today') {
    const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    salesChartData = hours.map(h => {
      const hourLabel = `${String(h).padStart(2, '0')}:00`;
      const hourTrx = transactions.filter(t => {
        if (t.status !== 'Selesai') return false;
        if (!t.date.startsWith(todayStr)) return false;
        const timePart = t.date.split(' ')[1];
        if (timePart) {
          const trxHour = parseInt(timePart.split(':')[0], 10);
          return trxHour === h;
        } else {
          const d = new Date(t.date);
          return d.getHours() === h;
        }
      });
      const itemsCount = hourTrx.reduce((sum, t) => sum + (t.items ? t.items.reduce((iSum, item) => iSum + item.qty, 0) : 0), 0);
      const revenue = hourTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: hourLabel,
        transactionsCount: hourTrx.length,
        itemsCount,
        revenue,
      };
    });
  } else if (salesTimeframe === '7days') {
    const daysList = Array.from({ length: 7 }, (_, i) => 6 - i);
    salesChartData = daysList.map(daysAgo => {
      const dateStr = getPastDateString(daysAgo);
      const dayTrx = transactions.filter(t => t.status === 'Selesai' && t.date.startsWith(dateStr));
      const itemsCount = dayTrx.reduce((sum, t) => sum + (t.items ? t.items.reduce((iSum, item) => iSum + item.qty, 0) : 0), 0);
      const revenue = dayTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: formatShortDateLabel(dateStr),
        transactionsCount: dayTrx.length,
        itemsCount,
        revenue,
      };
    });
  } else {
    const daysList = Array.from({ length: 30 }, (_, i) => 29 - i);
    salesChartData = daysList.map(daysAgo => {
      const dateStr = getPastDateString(daysAgo);
      const dayTrx = transactions.filter(t => t.status === 'Selesai' && t.date.startsWith(dateStr));
      const itemsCount = dayTrx.reduce((sum, t) => sum + (t.items ? t.items.reduce((iSum, item) => iSum + item.qty, 0) : 0), 0);
      const revenue = dayTrx.reduce((sum, t) => sum + t.totalAmount, 0);
      return {
        label: formatShortDateLabel(dateStr),
        transactionsCount: dayTrx.length,
        itemsCount,
        revenue,
      };
    });
  }

  const totalSalesTrxCount = salesChartData.reduce((sum, item) => sum + item.transactionsCount, 0);
  const totalSalesItemsCount = salesChartData.reduce((sum, item) => sum + item.itemsCount, 0);
  const avgItemsPerTrx = totalSalesTrxCount > 0 ? (totalSalesItemsCount / totalSalesTrxCount).toFixed(1) : '0';
  const peakSalesPoint = salesChartData.reduce((max, item) => (item.transactionsCount > max.transactionsCount ? item : max), {
    label: '-',
    transactionsCount: 0,
    itemsCount: 0,
    revenue: 0,
  });

  // Prescription Percentage
  const completedTrxList = transactions.filter(t => t.status === 'Selesai');
  const prescriptionTrxList = completedTrxList.filter(t => t.isPrescription);
  const prescriptionPercentage = completedTrxList.length > 0
    ? Math.round((prescriptionTrxList.length / completedTrxList.length) * 100)
    : 0;

  // Recent 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  // Critical items
  const lowStockMedicines = medicines.filter(m => m.stock <= m.minStock && m.isActive);
  const expiredMedicines = medicines.filter(m => getExpiredStatus(m.expiredDate).isExpired && m.isActive);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Operasional Apotek</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ringkasan transaksi harian, status stok obat, dan rekapitulasi pelanggan & dokter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pos')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Buka Kasir Penjualan
          </button>
        </div>
      </div>

      {/* Urgent Alert Banner if Expired or Low Stock */}
      {(expiredCount > 0 || lowStockCount > 0 || expiring30Count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Perhatian Inventaris Apotek</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {expiredCount > 0 && <span className="font-bold text-rose-700">{expiredCount} obat kadaluwarsa</span>}
                {expiredCount > 0 && (lowStockCount > 0 || expiring30Count > 0) && ' • '}
                {lowStockCount > 0 && <span className="font-bold text-amber-800">{lowStockCount} obat stok menipis</span>}
                {lowStockCount > 0 && expiring30Count > 0 && ' • '}
                {expiring30Count > 0 && <span className="font-bold text-orange-800">{expiring30Count} obat exp &lt; 30 hari</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('medicines')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors self-start md:self-auto"
          >
            Periksa Data Obat →
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Penjualan Hari Ini */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Penjualan Hari Ini</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg sm:text-xl font-bold text-slate-900 block truncate">
              {formatRupiah(totalSalesToday)}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              {todayTransactions.length} Transaksi hari ini
            </span>
          </div>
        </div>

        {/* Jumlah Transaksi */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Jumlah Transaksi</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 block">
              {todayTransactions.length}
            </span>
            <span className="text-[11px] text-slate-500">Total sukses hari ini</span>
          </div>
        </div>

        {/* Total Customer */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Customer</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 block">
              {customers.length}
            </span>
            <span className="text-[11px] text-slate-500">Member terdaftar</span>
          </div>
        </div>

        {/* Total Dokter & Persentase Resep */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Resep & Dokter</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                {doctors.length} Dokter
              </span>
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                {prescriptionPercentage}% Resep
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {prescriptionTrxList.length} dari {completedTrxList.length} transaksi resep
            </span>
          </div>
        </div>

        {/* Total Obat */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Item Obat</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 block">
              {medicines.length}
            </span>
            <span className="text-[11px] text-slate-500">Sediaan dalam katalog</span>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        {/* Card Header with Timeframe Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/80">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Grafik Ringkasan Tren Pendapatan
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisasi omzet penjualan apotek secara langsung ({chartTimeframe === 'today' ? 'per jam hari ini' : chartTimeframe === '7days' ? 'harian 7 hari terakhir' : 'harian 30 hari terakhir'})
              </p>
            </div>
          </div>

          {/* Filter Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setChartTimeframe('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartTimeframe === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setChartTimeframe('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartTimeframe === '7days'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setChartTimeframe('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartTimeframe === '30days'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              1 Bulan Terakhir
            </button>
          </div>
        </div>

        {/* Highlight Summary Stats Bar for the Selected Period */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 border border-slate-100 p-3.5 rounded-xl text-xs">
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Total Omzet Periode Ini</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 block mt-0.5">
              {formatRupiah(totalChartRevenue)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Jumlah Transaksi Selesai</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-600 block mt-0.5">
              {totalChartCount} Transaksi
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Rata-rata / Transaksi</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 block mt-0.5">
              {formatRupiah(avgChartRevenue)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">
              {chartTimeframe === 'today' ? 'Jam Teramai Omzet' : 'Hari Omzet Tertinggi'}
            </span>
            <span className="text-sm font-bold text-indigo-700 block mt-0.5 truncate">
              {peakChartPoint.revenue > 0 ? `${peakChartPoint.label} (${formatRupiah(peakChartPoint.revenue)})` : '-'}
            </span>
          </div>
        </div>

        {/* Recharts Area Chart Container */}
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                interval={chartTimeframe === '30days' ? 2 : 0}
              />
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return `${value}`;
                }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip timeframe={chartTimeframe} />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Pendapatan"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales Trend Chart Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        {/* Card Header with Timeframe Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100/80">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Grafik Ringkasan Tren Penjualan
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisasi volume transaksi & jumlah produk sediaan obat terjual ({salesTimeframe === 'today' ? 'per jam hari ini' : salesTimeframe === '7days' ? 'harian 7 hari terakhir' : 'harian 30 hari terakhir'})
              </p>
            </div>
          </div>

          {/* Filter Selector Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSalesTimeframe('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                salesTimeframe === 'today'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setSalesTimeframe('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                salesTimeframe === '7days'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setSalesTimeframe('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                salesTimeframe === '30days'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              1 Bulan Terakhir
            </button>
          </div>
        </div>

        {/* Highlight Summary Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 border border-slate-100 p-3.5 rounded-xl text-xs">
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Total Transaksi</span>
            <span className="text-sm sm:text-base font-extrabold text-indigo-600 block mt-0.5">
              {totalSalesTrxCount} Transaksi
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Total Sediaan Terjual</span>
            <span className="text-sm sm:text-base font-extrabold text-amber-600 block mt-0.5">
              {totalSalesItemsCount} Pcs / Unit
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">Rata-rata Sediaan / Trx</span>
            <span className="text-sm sm:text-base font-bold text-slate-800 block mt-0.5">
              {avgItemsPerTrx} Pcs / Trx
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] font-medium block">
              {salesTimeframe === 'today' ? 'Jam Puncak Transaksi' : 'Hari Puncak Transaksi'}
            </span>
            <span className="text-sm font-bold text-indigo-700 block mt-0.5 truncate">
              {peakSalesPoint.transactionsCount > 0 ? `${peakSalesPoint.label} (${peakSalesPoint.transactionsCount} Trx)` : '-'}
            </span>
          </div>
        </div>

        {/* Recharts Bar Chart Container */}
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                interval={salesTimeframe === '30days' ? 2 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={35}
              />
              <Tooltip content={<CustomSalesTooltip timeframe={salesTimeframe} />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>}
              />
              <Bar dataKey="transactionsCount" name="Jumlah Transaksi" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="itemsCount" name="Sediaan Terjual (Pcs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stock & Expiry Health Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Status Stok & Kadaluwarsa Obat</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Masa Pantau: 6 Bulan (180 Hari)
          </span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Stok Menipis */}
          <div
            onClick={() => setActiveTab('medicines')}
            className="p-3.5 rounded-xl bg-orange-50/80 border border-orange-100 hover:bg-orange-100/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-orange-700 mb-1">
              <span className="font-semibold">Stok Menipis</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold text-orange-900">{lowStockCount}</span>
            <p className="text-[10px] text-orange-700 mt-0.5">&le; Batas Minimum Stok</p>
          </div>

          {/* Sudah Expired */}
          <div
            onClick={() => {
              setDashboardExpiryFilter('expired');
              setActiveTab('medicines');
            }}
            className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-100 hover:bg-rose-100/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="font-semibold">Sudah Expired</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold text-rose-900">{expiredCount}</span>
            <p className="text-[10px] text-rose-700 mt-0.5">Wajib ditarik dari rak</p>
          </div>

          {/* Expired < 30 Hari */}
          <div
            onClick={() => {
              setDashboardExpiryFilter('30');
            }}
            className="p-3.5 rounded-xl bg-red-50/80 border border-red-100 hover:bg-red-100/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-red-700 mb-1">
              <span className="font-semibold">Exp &lt; 30 Hari</span>
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold text-red-900">{expiring30Count}</span>
            <p className="text-[10px] text-red-700 mt-0.5">Prioritas diskon / cuci stok</p>
          </div>

          {/* Expired 1-3 Bulan */}
          <div
            onClick={() => {
              setDashboardExpiryFilter('90');
            }}
            className="p-3.5 rounded-xl bg-yellow-50/80 border border-yellow-100 hover:bg-yellow-100/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between text-yellow-800 mb-1">
              <span className="font-semibold">Exp 1 - 3 Bulan</span>
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold text-yellow-900">{expiring60Count + expiring90Count}</span>
            <p className="text-[10px] text-yellow-800 mt-0.5">Skema FIFO (Utama Jual)</p>
          </div>

          {/* Expired 3-6 Bulan */}
          <div
            onClick={() => {
              setDashboardExpiryFilter('180');
            }}
            className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 hover:bg-indigo-100/80 cursor-pointer transition-colors col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-indigo-800 mb-1">
              <span className="font-semibold">Exp 3 - 6 Bulan</span>
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-2xl font-bold text-indigo-900">{expiring120Count + expiring180Count}</span>
            <p className="text-[10px] text-indigo-800 mt-0.5">Pantau & batasi restock</p>
          </div>
        </div>
      </div>

      {/* Automatic Expiry Notification & Prevention Widget (Up to 6 Months) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Notifikasi Obat Kadaluwarsa (6 Bulan Ke Depan)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {medicines.filter(m => m.isActive && getDaysUntilExpired(m.expiredDate) <= 180).length} Item Risiko
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar otomatis sediaan obat yang mendekati kadaluwarsa (&le; 180 hari) agar dapat dipantau dan dikelola lebih awal.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('medicines')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 self-start sm:self-auto shrink-0 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            Buka Katalog Lengkap <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            {[
              { id: 'all', label: 'Semua (&le; 6 Bln)' },
              { id: 'expired', label: '🔴 Expired' },
              { id: '30', label: '🟠 < 30 Hari' },
              { id: '90', label: '🟡 1-3 Bulan' },
              { id: '180', label: '🔵 3-6 Bulan' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDashboardExpiryFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  dashboardExpiryFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari obat / kode / rak..."
              value={dashboardExpirySearch}
              onChange={e => setDashboardExpirySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Table List of Expiring Medicines */}
        {(() => {
          const list = medicines
            .filter(m => {
              if (!m.isActive) return false;
              const days = getDaysUntilExpired(m.expiredDate);
              if (days > 180) return false;

              const matchesSearch =
                m.name.toLowerCase().includes(dashboardExpirySearch.toLowerCase()) ||
                m.code.toLowerCase().includes(dashboardExpirySearch.toLowerCase()) ||
                (m.rack && m.rack.toLowerCase().includes(dashboardExpirySearch.toLowerCase()));

              if (dashboardExpiryFilter === 'expired') return matchesSearch && days < 0;
              if (dashboardExpiryFilter === '30') return matchesSearch && days >= 0 && days <= 30;
              if (dashboardExpiryFilter === '90') return matchesSearch && days > 30 && days <= 90;
              if (dashboardExpiryFilter === '180') return matchesSearch && days > 90 && days <= 180;
              return matchesSearch;
            })
            .sort((a, b) => getDaysUntilExpired(a.expiredDate) - getDaysUntilExpired(b.expiredDate));

          if (list.length === 0) {
            return (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-1">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-800 text-xs">Stok & Expired Dalam Kondisi Aman</p>
                <p className="text-[11px] text-slate-400">
                  Tidak ada obat dengan kriteria filter kadaluwarsa ini dalam 6 bulan ke depan.
                </p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-3">Kode & Nama Obat</th>
                    <th className="py-2.5 px-3">Kategori & Rak</th>
                    <th className="py-2.5 px-3 text-center">Sisa Stok</th>
                    <th className="py-2.5 px-3">Tgl Expired & Status</th>
                    <th className="py-2.5 px-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map(med => {
                    const status = getExpiredStatus(med.expiredDate);

                    return (
                      <tr key={med.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{med.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{med.code}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 font-medium">{med.category}</div>
                          <div className="text-[10px] text-slate-400">Rak: {med.rack || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              med.stock <= med.minStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {formatStockDisplay(med.stock, med.unit, med.unitMultiplier)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{formatDate(med.expiredDate)}</div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${status.badgeColor}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setActiveTab('medicines')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded-lg text-[10px] transition-colors"
                          >
                            Kelola
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Grid Section: Quick Actions & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm mb-2">Aksi Cepat Operasional</h3>
          
          <button
            onClick={() => setActiveTab('pos')}
            className="w-full p-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 font-semibold text-xs flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-lg">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-slate-900 font-bold">Transaksi Penjualan Baru</span>
                <span className="text-[11px] text-slate-500">Kasir cepat resep & non-resep</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => setActiveTab('stock-in')}
            className="w-full p-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 font-semibold text-xs flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <PackagePlus className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-slate-900 font-bold">Input Stok Masuk</span>
                <span className="text-[11px] text-slate-500">Restock dari supplier</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => setActiveTab('medicines')}
            className="w-full p-3.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 font-semibold text-xs flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 text-white rounded-lg">
                <Pill className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-slate-900 font-bold">Kelola Sediaan Obat</span>
                <span className="text-[11px] text-slate-500">Tambah / edit data obat & harga</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-xs flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700 text-white rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-slate-900 font-bold">Cetak Laporan Penjualan</span>
                <span className="text-[11px] text-slate-500">Harian & bulanan</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Recent Transactions Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Transaksi Terakhir</h3>
              <button
                onClick={() => setActiveTab('transactions')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              >
                Lihat Semua ({transactions.length}) →
              </button>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden space-y-2">
              {recentTransactions.map(trx => (
                <div key={trx.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{trx.trxNo}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        trx.status === 'Selesai'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {trx.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{formatDateTime(trx.date)}</span>
                    <span className="font-semibold text-slate-800">{trx.customerName || 'Umum (Non-Member)'}</span>
                  </div>
                  <div className="text-right font-black text-emerald-700 text-sm">
                    {formatRupiah(trx.totalAmount)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="pb-2">No Transaksi</th>
                    <th className="pb-2">Waktu</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentTransactions.map(trx => (
                    <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono font-semibold text-slate-900">{trx.trxNo}</td>
                      <td className="py-2.5 text-slate-500">{formatDateTime(trx.date)}</td>
                      <td className="py-2.5 font-medium text-slate-800">
                        {trx.customerName || 'Umum (Non-Member)'}
                      </td>
                        <td className="py-2.5 font-bold text-emerald-700">
                          {formatRupiah(trx.totalAmount)}
                        </td>
                      <td className="py-2.5 text-right">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Sistem Kasir Apotek siap digunakan.</span>
            <span className="font-medium text-slate-700">Akses Cepat Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
};
