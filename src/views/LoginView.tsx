import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, User, Eye, EyeOff, Pill, AlertCircle, HelpCircle, ArrowRight, KeyRound } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Pharmacy Branding Card */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-900/40 border border-emerald-300/30 mb-2">
            <Pill className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {settings?.name || 'Apotek Az Zainiyah'}
          </h1>
          <p className="text-xs text-emerald-200/80 font-medium max-w-xs mx-auto">
            Sistem Informasi Apoteker, Kasir & Otomatisasi Laporan Keuangan Terpadu
          </p>
        </div>

        {/* Main Login Form Box */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Portal Otentikasi Pengguna
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan username dan password Anda untuk mengakses sistem
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  Butuh Bantuan?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <span>Memverifikasi Akses...</span>
              ) : (
                <>
                  <span>Masuk Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Contact Super Admin Helper Notice */}
          {showHelp && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <KeyRound className="w-4 h-4 text-amber-600" />
                Reset & Bantuan Akses Credentials:
              </div>
              <p className="leading-relaxed text-[11px] text-amber-950">
                Sesuai standar keamanan sistem, jika Anda mengalami kesalahan username/password atau akun Anda dinonaktifkan, silakan langsung menghubungi <strong>Admin Utama</strong> untuk melakukan reset username atau password.
              </p>
            </div>
          )}

        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400/80 mt-6 font-medium">
          Protected by High Security Standards &bull; {settings?.name || 'Apotek Az Zainiyah'} &copy; 2026
        </p>
      </div>
    </div>
  );
};
