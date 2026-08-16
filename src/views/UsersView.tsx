import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PaginationControls } from '../components/PaginationControls';
import { User, UserRole } from '../types';
import { getPasswordStrengthScore, validatePasswordStrength } from '../utils/authUtils';
import {
  UserCog,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  UserCheck,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('kasir');
  const [status, setStatus] = useState<'aktif' | 'nonaktif'>('aktif');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-xs my-8 space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Akses Terbatas untuk Admin</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Pengelolaan pengguna hanya dapat diakses oleh akun dengan hak akses Admin atau Admin Utama.
        </p>
      </div>
    );
  }

  // Security Rule: Super Admin cannot be seen or edited by other users (including normal admins)
  const visibleUsers = users.filter(u => {
    if (u.isSuperAdmin) {
      return currentUser.isSuperAdmin; // Only Super Admin can see Super Admin
    }
    return true;
  });

  const paginatedUsers = visibleUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setRole('kasir');
    setStatus('aktif');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username);
    setRole(u.role);
    setStatus(u.status);
    setPhone(u.phone || '');
    setPassword('');
    setConfirmPassword('');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !username.trim()) {
      setFormError('Nama lengkap dan username wajib diisi.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    let res: { success: boolean; message: string };

    try {
      if (!editingUser) {
        // Adding new user requires password
        if (!password) {
          setFormError('Password wajib diisi untuk pembuatan akun baru.');
          return;
        }
        if (password !== confirmPassword) {
          setFormError('Konfirmasi password tidak cocok dengan password.');
          return;
        }
        const val = validatePasswordStrength(password);
        if (!val.isValid) {
          setFormError(`Password tidak memenuhi standar keamanan: ${val.errors.join(' ')}`);
          return;
        }

        res = await addUser({
          name: name.trim(),
          username: username.trim(),
          role,
          status,
          phone: phone.trim(),
          password,
        });
      } else {
        // Editing existing user
        if (password || confirmPassword) {
          if (password !== confirmPassword) {
            setFormError('Konfirmasi password baru tidak cocok.');
            return;
          }
          const val = validatePasswordStrength(password);
          if (!val.isValid) {
            setFormError(`Password baru tidak memenuhi standar keamanan: ${val.errors.join(' ')}`);
            return;
          }
        }

        res = await updateUser(editingUser.id, {
          name: name.trim(),
          username: username.trim(),
          role,
          status,
          phone: phone.trim(),
          ...(password ? { password } : {}),
        });
      }

      if (!res.success) {
        setFormError(res.message);
        return;
      }

      setActionNotice({ type: 'success', message: res.message });
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    const res = await deleteUser(deletingUser.id);
    setDeletingUser(null);
    if (res.success) {
      setActionNotice({ type: 'success', message: res.message });
    } else {
      setActionNotice({ type: 'error', message: res.message });
    }
  };

  const strength = getPasswordStrengthScore(password);

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">Manajemen Pengguna & Otorisasi</h2>
          </div>
          <p className="text-xs text-slate-300">
            Kelola data akun staf, hak akses (Kasir vs Admin), serta status aktifasi pengguna apotek.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah User Baru
        </button>
      </div>

      {/* Global Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users Display Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
        {/* Mobile & Tablet Card View */}
        <div className="lg:hidden p-3 space-y-3 bg-slate-50/50">
          {paginatedUsers.map(u => {
            const isSelf = currentUser.id === u.id;
            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl border shadow-2xs space-y-3 text-xs bg-white ${
                  u.isSuperAdmin ? 'border-amber-300/80 bg-amber-50/20' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-slate-900 text-sm">{u.name}</h4>
                      {isSelf && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          AKUN ANDA
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 block mt-0.5">@{u.username}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${
                        u.isSuperAdmin
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {u.isSuperAdmin ? 'SUPER ADMIN' : u.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">No. WA: {u.phone || '-'}</span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(u)}
                      className="px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    {/* Rule: Users CANNOT delete themselves & Super Admin cannot be deleted */}
                    {!isSelf && !u.isSuperAdmin && (
                      <button
                        onClick={() => setDeletingUser(u)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Hapus User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-5">Nama User</th>
                <th className="py-3.5 px-5">Username</th>
                <th className="py-3.5 px-5">Peran (Role)</th>
                <th className="py-3.5 px-5">Kontak WA</th>
                <th className="py-3.5 px-5 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.map(u => {
                const isSelf = currentUser.id === u.id;
                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      u.isSuperAdmin ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">{u.name}</span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            AKUN ANDA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-medium text-slate-600">@{u.username}</td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          u.isSuperAdmin
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.isSuperAdmin ? 'SUPER ADMIN' : u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-medium">{u.phone || '-'}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Security Rule: Cannot delete self or Super Admin */}
                        {!isSelf && !u.isSuperAdmin && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={Math.ceil(visibleUsers.length / ITEMS_PER_PAGE)}
          onPageChange={setCurrentPage}
          totalItems={visibleUsers.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* User Creation & Editing Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in duration-200">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-extrabold text-sm text-white">
                    {editingUser ? `Edit Data User: ${editingUser.name}` : 'Tambah Pengguna Baru'}
                  </h4>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-xs leading-relaxed">{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      placeholder="Contoh: Budi Santoso"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Username Login *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      placeholder="Contoh: budi_kasir"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Peran (Role) *</label>
                      <select
                        value={role}
                        onChange={e => setRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="kasir">Staff Kasir</option>
                        <option value="admin">Admin Operasional</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Status Akun *</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as 'aktif' | 'nonaktif')}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="aktif">Aktif</option>
                        <option value="nonaktif">Nonaktif</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">No. WhatsApp / HP</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      placeholder="0812xxxxxxxx"
                    />
                  </div>

                  {/* Password Section */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        {editingUser ? 'Set Password Baru (Opsional)' : 'Password Akun Baru *'}
                      </span>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        {editingUser ? 'Password Baru (Kosongkan jika tidak ubah)' : 'Password Baru'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                          placeholder="Min. 8 karakter kuat"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {password && (
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Konfirmasi Password Baru</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                          placeholder="Ulangi password"
                        />

                        <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">Kekuatan Password:</span>
                            <span className="font-extrabold text-slate-800">{strength.label}</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${strength.color}`}
                              style={{ width: `${(strength.score / 4) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat User Baru'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left my-auto animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Hapus Pengguna</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun <strong className="text-slate-900">{deletingUser.name}</strong> (@{deletingUser.username}) secara permanen?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
