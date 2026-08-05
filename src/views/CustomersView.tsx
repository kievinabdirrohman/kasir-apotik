import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Customer } from '../types';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Receipt,
  Phone,
  MapPin,
  X,
  UserCheck,
  ShoppingBag,
  Info,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    transactions,
    currentUser,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Detail / Transaction History Modal
  const [selectedCustForHistory, setSelectedCustForHistory] = useState<Customer | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setAddress('');
    setStatus('Aktif');
    setIsFormOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setAddress(cust.address || '');
    setStatus(cust.status);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Mohon isi nama dan nomor HP pelanggan.');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name,
        phone,
        address,
        status,
      });
    } else {
      addCustomer({
        name,
        phone,
        address,
        status,
      });
    }

    setIsFormOpen(false);
  };

  const handleDelete = (cust: Customer) => {
    if (currentUser.role !== 'admin') {
      setAlertMessage('Penghapusan data pelanggan hanya dapat dilakukan oleh akun Admin.');
      return;
    }
    setDeletingCustomer(cust);
  };

  const confirmDelete = () => {
    if (deletingCustomer) {
      deleteCustomer(deletingCustomer.id);
      setDeletingCustomer(null);
    }
  };

  const filteredCustomers = customers.filter(
    c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.memberNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Customer / Membership</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan data pelanggan setia apotek, akumulasi poin pembelian, dan riwayat resep.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Customer Baru
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, no member (MBR-...), no HP..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total: <span className="font-bold text-slate-900">{customers.length} Member</span>
        </div>
      </div>

      {/* Customers Display */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Mobile & Tablet Card List Layout */}
        <div className="lg:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredCustomers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
              Tidak ada data customer yang ditemukan.
            </div>
          ) : (
            filteredCustomers.map(cust => (
              <div
                key={cust.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-mono font-bold text-emerald-700 text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {cust.memberNo}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">{cust.name}</h4>
                    <span className="text-[10px] text-slate-400 block">Terdaftar: {cust.createdAt}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      cust.status === 'Aktif'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cust.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {cust.phone}
                  </div>
                  {cust.address && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{cust.address}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Belanja:</span>
                    <span className="font-extrabold text-emerald-700 text-xs">{formatRupiah(cust.totalSpent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Jumlah Transaksi:</span>
                    <span className="font-bold text-slate-800">{cust.totalTransactions} Transaksi</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    onClick={() => setSelectedCustForHistory(cust)}
                    className="px-2.5 py-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Riwayat
                  </button>
                  <button
                    onClick={() => openEditModal(cust)}
                    className="px-2.5 py-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cust)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      currentUser.role === 'admin'
                        ? 'text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50'
                        : 'text-slate-300 cursor-not-allowed opacity-50 bg-slate-50'
                    }`}
                    title={
                      currentUser.role === 'admin'
                        ? 'Hapus Customer'
                        : 'Hanya Admin yang dapat menghapus'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                <th className="py-3 px-4">No Member / Nama</th>
                <th className="py-3 px-4">Kontak & Alamat</th>
                <th className="py-3 px-4">Total Transaksi</th>
                <th className="py-3 px-4">Total Pembelian (Rp)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada data customer yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-700 text-[11px]">{cust.memberNo}</div>
                      <div className="font-bold text-slate-900 text-xs">{cust.name}</div>
                      <div className="text-[10px] text-slate-400">Terdaftar: {cust.createdAt}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {cust.phone}
                      </div>
                      {cust.address && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{cust.address}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-800">
                      {cust.totalTransactions} Transaksi
                    </td>

                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {formatRupiah(cust.totalSpent)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cust.status === 'Aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cust.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedCustForHistory(cust)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Lihat Riwayat Belanja"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cust)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            currentUser.role === 'admin'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-300 cursor-not-allowed opacity-50'
                          }`}
                          title={
                            currentUser.role === 'admin'
                              ? 'Hapus Customer'
                              : 'Hanya Admin yang dapat menghapus'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <h3 className="font-bold text-sm">
                  {editingCustomer ? 'Edit Data Customer' : 'Tambah Customer Baru'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bpk. Hendra Wijaya"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / HP</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 081234567890"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat (Opsional)</label>
                    <textarea
                      rows={2}
                      placeholder="Alamat domisili..."
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Member</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as 'Aktif' | 'Nonaktif')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                    </select>
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
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    Simpan Data Member
                  </button>
                </div>
              </form>
            </div>
          </div>
      </div>
      )}

      {/* Customer Purchase History Modal */}
      {selectedCustForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Riwayat Belanja Member</h3>
                <p className="text-xs text-emerald-400">
                  {selectedCustForHistory.name} ({selectedCustForHistory.memberNo})
                </p>
              </div>
              <button
                onClick={() => setSelectedCustForHistory(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {transactions.filter(t => t.customerId === selectedCustForHistory.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-xs">
                  Belum ada transaksi belanja untuk member ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions
                    .filter(t => t.customerId === selectedCustForHistory.id)
                    .map(trx => (
                      <div
                        key={trx.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono text-slate-900">{trx.trxNo}</span>
                          <span className="text-emerald-700 font-extrabold">{formatRupiah(trx.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>Waktu: {formatDateTime(trx.date)}</span>
                          <span>Kasir: {trx.cashierName}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 text-[11px] space-y-1">
                          <span className="font-semibold text-slate-700 block">Item Dibeli:</span>
                          <ul className="list-disc list-inside text-slate-600 pl-1 space-y-0.5">
                            {trx.items.map((it, i) => (
                              <li key={i}>
                                {it.medicineName} ({it.qty} {it.unit} x {formatRupiah(it.price)})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Total Akumulasi Pembelian: </span>
                <span className="font-bold text-emerald-700">{formatRupiah(selectedCustForHistory.totalSpent)}</span>
              </div>
              <button
                onClick={() => setSelectedCustForHistory(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left my-auto animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Hapus Data Pelanggan</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Yakin ingin menghapus data pelanggan <strong className="text-slate-900">{deletingCustomer.name}</strong> ({deletingCustomer.memberNo})?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Ya, Hapus
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
                className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
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
