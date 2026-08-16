import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NotificationCenter } from './NotificationCenter';
import { EditProfileModal } from './EditProfileModal';
import logoImg from '../assets/logo.png';
import {
  Menu,
  ShoppingCart,
  Store,
  User,
  ChevronRight,
  LogOut,
  ShieldCheck,
  UserCog,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const tabTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  medicines: 'Stok Obat',
  customers: 'Pelanggan',
  doctors: 'Dokter & Resep',
  'stock-in': 'Penerimaan Stok',
  pos: 'Kasir Penjualan',
  transactions: 'Riwayat Transaksi',
  reports: 'Laporan Operasional',
  users: 'Pengguna',
  settings: 'Pengaturan',
  tutorial: 'Panduan',
};

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const {
    settings,
    activeTab,
    setActiveTab,
    currentUser,
    logout,
  } = useApp();

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Mobile Menu Toggle & App Brand / Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 lg:hidden transition-colors"
            title="Buka Navigasi"
            aria-label="Buka Menu Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {/* Store Logo Badge */}
            <img
              src={logoImg}
              alt="Apotek Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 object-cover rounded-[8px] shadow-xs shrink-0"
            />

            {/* Brand Title & Active Context */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="font-bold text-slate-900 text-xs sm:text-sm md:text-base leading-tight truncate max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none">
                  {settings.pharmacyName || settings.name}
                </h1>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block shrink-0" />
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hidden sm:inline-block shrink-0">
                  {tabTitles[activeTab] || 'Apotek'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Sistem Operasional & Kasir Apotek
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Quick POS Action, User Profile Badge, Notifications, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Quick POS Shortcut Button */}
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 ${
              activeTab === 'pos'
                ? 'bg-emerald-800 text-white shadow-emerald-300 ring-2 ring-emerald-500/30'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
            }`}
            title="Buka Kasir Penjualan"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline sm:inline">Kasir</span>
            <span className="hidden md:inline">Penjualan</span>
          </button>

          {/* User Profile Info & Edit Button */}
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl p-1 border border-slate-200 transition-colors">
              <button
                type="button"
                onClick={() => setShowEditProfileModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-left text-xs font-bold text-slate-800 hover:text-emerald-700 transition-colors"
                title="Klik untuk Edit Profil & Ganti Password"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  {currentUser.isSuperAdmin ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    currentUser.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden xs:block truncate max-w-[100px] sm:max-w-[130px]">
                  <div className="truncate text-[11px] leading-tight">{currentUser.name}</div>
                  <div className="text-[9px] text-slate-500 font-medium truncate">@{currentUser.username}</div>
                </div>
              </button>

              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider hidden sm:inline-block shrink-0 ${
                  currentUser.isSuperAdmin
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : currentUser.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {currentUser.isSuperAdmin ? 'SUPER ADMIN' : currentUser.role}
              </span>

              <button
                type="button"
                onClick={() => setShowEditProfileModal(true)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
                title="Edit Profil & Password"
              >
                <UserCog className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Notifications Dropdown Center */}
          <NotificationCenter />

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            className="p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-colors flex items-center gap-1 font-bold text-xs"
            title="Keluar / Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Keluar</span>
          </button>

        </div>
      </div>
    </header>

    {/* Edit Profile Modal */}
    <EditProfileModal
      isOpen={showEditProfileModal}
      onClose={() => setShowEditProfileModal(false)}
    />
  </>
);
};

