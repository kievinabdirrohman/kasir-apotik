import React from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';
import logoImg from '../assets/logo.png';
import {
  LayoutDashboard,
  Pill,
  Users,
  Stethoscope,
  PackagePlus,
  ShoppingCart,
  FileSpreadsheet,
  UserCog,
  Settings,
  X,
  ShieldAlert,
  AlertTriangle,
  Receipt,
  WalletCards,
  Package,
  Calculator,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    lowStockCount,
    expiredCount,
    expiring30Count,
  } = useApp();

  const totalUrgentAlerts = lowStockCount + expiredCount + expiring30Count;

  const navGroups = [
    {
      label: 'Utama',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Master Data',
      items: [
        {
          id: 'medicines',
          label: 'Obat & Stok',
          icon: Pill,
          badge: totalUrgentAlerts > 0 ? totalUrgentAlerts : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        { id: 'customers', label: 'Customer / Member', icon: Users },
        { id: 'doctors', label: 'Dokter', icon: Stethoscope },
      ],
    },
    {
      label: 'Transaksi',
      items: [
        { id: 'stock-in', label: 'Stok Masuk', icon: PackagePlus },
        {
          id: 'pos',
          label: 'Penjualan (Kasir)',
          icon: ShoppingCart,
          badge: 'POS',
          badgeColor: 'bg-emerald-600 text-white font-bold',
        },
        { id: 'transactions', label: 'Riwayat Penjualan', icon: Receipt },
      ],
    },
    {
      label: 'Finansial & Laporan',
      items: [
        { id: 'finances', label: 'Finansial & Arus Kas', icon: WalletCards },
        { id: 'reports', label: 'Laporan Operasional', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Laporan Perpajakan',
      items: [
        { id: 'report-pajak-ppn', label: 'Rekap Pajak PPN & Non-PPN', icon: Calculator },
        { id: 'report-obat', label: 'Laporan Produk Obat', icon: Pill },
        { id: 'report-non-obat', label: 'Laporan Non-Obat', icon: Package },
      ],
    },
    {
      label: 'Sistem',
      items: [
        { id: 'users', label: 'Pengguna', icon: UserCog, adminOnly: true },
        { id: 'settings', label: 'Pengaturan Apotek', icon: Settings, adminOnly: true },
      ],
    },
    {
      label: 'Bantuan',
      items: [
        { id: 'tutorial', label: 'Panduan Penggunaan', icon: BookOpen },
      ],
    },
  ] as const;

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <img
              src={logoImg}
              alt="Apotek Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 object-cover rounded-[8px]"
            />
            <div>
              <span className="font-bold text-white text-[12px] block leading-tight">APOTEK AZ ZAINIYAH</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 overflow-y-auto py-2">
          {navGroups.map((group, index) => (
            <div key={group.label} className={index > 0 ? 'mt-4' : ''}>
              <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-1 text-xs">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestricted = item.adminOnly && currentUser?.role !== 'admin';

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isRestricted) {
                          alert('Menu ini khusus untuk hak akses Admin. Silakan hubungi Admin Utama jika Anda memerlukan akses.');
                          return;
                        }
                        handleSelectTab(item.id);
                      }}
                      disabled={isRestricted}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all group ${
                        isActive
                          ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950'
                          : isRestricted
                          ? 'text-slate-600 cursor-not-allowed opacity-60'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : isRestricted ? 'text-slate-600' : 'text-slate-400 group-hover:text-emerald-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.adminOnly ? (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-bold border border-slate-700">
                          Admin
                        </span>
                      ) : item.badge !== undefined ? (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            item.badgeColor || 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          Sistem Kasir Apotek &copy; {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
};
