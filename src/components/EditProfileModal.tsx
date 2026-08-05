import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getPasswordStrengthScore, validatePasswordStrength } from '../utils/authUtils';
import { User, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff, X, Save } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile } = useApp();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && isOpen) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setPhone(currentUser.phone || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const strength = getPasswordStrengthScore(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !username.trim()) {
      setErrorMsg('Nama lengkap dan username tidak boleh kosong.');
      return;
    }

    // Password change checks
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        setErrorMsg('Mohon masukkan Password Saat Ini untuk verifikasi keamanan.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMsg('Konfirmasi password baru tidak cocok dengan password baru.');
        return;
      }

      const val = validatePasswordStrength(newPassword);
      if (!val.isValid) {
        setErrorMsg(`Password baru belum memenuhi standar keamanan: ${val.errors.join(' ')}`);
        return;
      }
    }

    setIsSubmitting(true);

    const res = updateProfile({
      name,
      username,
      phone,
      currentPassword: newPassword ? currentPassword : undefined,
      newPassword: newPassword ? newPassword : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
      }, 1200);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in duration-200">
          {/* Header Modal */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Edit Profil & Keamanan Password</h3>
                <p className="text-xs text-slate-300">
                  {currentUser.isSuperAdmin
                    ? 'Pengaturan Akun Admin Utama (Super Admin)'
                    : currentUser.role === 'admin'
                    ? 'Pengaturan Akun Admin Operasional'
                    : 'Pengaturan Akun Staff Kasir'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form wrapper */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Content Body */}
            <div className="p-5 sm:p-6 space-y-5 text-xs overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-medium text-xs leading-relaxed">{errorMsg}</div>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* User Role Badge */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-700">Peran Akses Terdeteksi:</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    currentUser.isSuperAdmin
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : currentUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {currentUser.isSuperAdmin ? 'ADMIN UTAMA (SUPER ADMIN)' : currentUser.role}
                </span>
              </div>

              {/* Section 1: Profil Informasi */}
              <div className="space-y-3 pt-1">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Informasi Pengguna
                </h4>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Username Login *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Username login"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">No. Telepon / WA</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0812xxxxxxxx"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Ganti Password */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Ubah Password (Opsional)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Kosongkan jika tidak ubah password</span>
                </h4>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Password Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Wajib diisi jika mau ubah password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Password Baru</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Minimal 8 karakter kuat"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Konfirmasi Password Baru</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Ulangi password baru"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Kekuatan Password:</span>
                      <span className="font-extrabold text-slate-800">{strength.label}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Standar keamanan: Min. 8 karakter, kombinasi huruf besar (A-Z), huruf kecil (a-z), angka (0-9), & simbol (@#$!).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-xs"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
