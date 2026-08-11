import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, User, Eye, EyeOff, Pill, AlertCircle, HelpCircle, ArrowRight, KeyRound } from 'lucide-react';
import bannerImg from '../assets/banner.webp';
import logoImg from '../assets/logo.png';

export const LoginView: React.FC = () => {
  const { login, settings } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Mohon isi username dan password Anda.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = login(username, password);
      setIsLoading(false);

      if (!res.success) {
        setErrorMsg(res.message);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
      {/* Left Column: Pharmacy Banner Image (Clean Display) */}
      <div className="lg:col-span-7 xl:col-span-8 relative hidden lg:block bg-slate-950 overflow-hidden min-h-screen">
        <img
          src={bannerImg}
          alt="Apotek Az Zainiyah Banner"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Right Column: Authentication Form Components (Full Height) */}
      <div className="lg:col-span-5 xl:col-span-4 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white min-h-screen">
        <div className="space-y-8 my-auto py-6">
          
          {/* Header / Brand Title */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={logoImg}
                alt="Apotek Logo"
                referrerPolicy="no-referrer"
                className="w-14 h-14 object-cover shadow-lg shadow-emerald-600/10 rounded-[8px]"
              />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {settings?.name || 'Apotek Az Zainiyah'}
                </h1>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  Portal Masuk Otentikasi
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Silakan masuk menggunakan username dan password yang terdaftar untuk mengakses kasir POS, stok obat, resep, dan keuangan.
            </p>
          </div>

          {/* Alert Error Message */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-semibold">{errorMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-2">Username Login</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-extrabold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Bantuan Akses?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-70 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Memverifikasi Akses...</span>
              ) : (
                <>
                  <span className="text-sm">Masuk ke Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Helper Drawer/Box */}
          {showHelp && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <KeyRound className="w-4 h-4 text-amber-600" />
                Bantuan Akses & Reset Passcode:
              </div>
              <p className="leading-relaxed text-[11px] text-amber-950">
                Jika Anda lupa password atau memerlukan pembuatan akun petugas kasir/apoteker baru, silakan hubungi <strong>Administrator Utama</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="pt-6 border-t border-slate-100 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Akses Terenkripsi & Terproteksi</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            &copy; 2026 {settings?.name || 'Apotek Az Zainiyah'}. All Rights Reserved.
          </p>
        </div>
      </div>

    </div>
  );
};


