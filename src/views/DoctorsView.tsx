import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Doctor } from '../types';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import {
  Stethoscope,
  Search,
  Plus,
  Edit2,
  Trash2,
  Percent,
  Phone,
  Receipt,
  X,
  CheckCircle,
  Clock,
  Wallet,
  Info,
} from 'lucide-react';

export const DoctorsView: React.FC = () => {
  const {
    doctors,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    transactions,
    currentUser,
    setActiveTab,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Detail modal for Doctor transactions
  const [selectedDocForRecap, setSelectedDocForRecap] = useState<Doctor | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');

  const openAddModal = () => {
    setEditingDoctor(null);
    setName('');
    setPhone('');
    setStatus('Aktif');
    setIsFormOpen(true);
  };

  const openEditModal = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setPhone(doc.phone);
    setStatus(doc.status);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Mohon isi nama dokter yang valid.');
      return;
    }

    if (editingDoctor) {
      updateDoctor(editingDoctor.id, {
        name,
        phone,
        status,
      });
    } else {
      addDoctor({
        name,
        phone,
        status,
      });
    }

    setIsFormOpen(false);
  };

  const handleDelete = (doc: Doctor) => {
    if (currentUser.role !== 'admin') {
      setAlertMessage('Penghapusan data dokter hanya dapat dilakukan oleh akun Admin.');
      return;
    }
    setDeletingDoctor(doc);
  };

  const confirmDelete = () => {
    if (deletingDoctor) {
      deleteDoctor(deletingDoctor.id);
      setDeletingDoctor(null);
    }
  };

  const filteredDoctors = doctors.filter(
    d =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Dokter Mitra</h2>
                <p className="text-xs text-slate-500 mt-1">
            Pengelolaan dokter pemberi resep.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Dokter Baru
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama dokter, no HP..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total: <span className="font-bold text-slate-900">{doctors.length} Dokter Mitra</span>
        </div>
      </div>

      {/* Doctors Display */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Mobile & Tablet Card List Layout */}
        <div className="lg:hidden p-3 space-y-3 bg-slate-50/50">
          {filteredDoctors.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
              Tidak ada data dokter yang cocok.
            </div>
          ) : (
            filteredDoctors.map(doc => {
              const unpaidCommission = Math.max(0, doc.totalCommissionEarned - doc.totalCommissionPaid);

              return (
                <div
                  key={doc.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {doc.phone || '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.status === 'Aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Resep:</span>
                      <span className="font-bold text-slate-800">{doc.totalPrescriptions} Resep</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-1">
                    <button
                      onClick={() => setSelectedDocForRecap(doc)}
                      className="px-2.5 py-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Rekap Resep
                    </button>
                    <button
                      onClick={() => openEditModal(doc)}
                      className="px-2.5 py-1 text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        currentUser.role === 'admin'
                          ? 'text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50'
                          : 'text-slate-300 cursor-not-allowed opacity-50 bg-slate-50'
                      }`}
                      title={
                        currentUser.role === 'admin'
                          ? 'Hapus Dokter'
                          : 'Hanya Admin yang dapat menghapus'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                <th className="py-3 px-4">Nama Dokter & HP</th>
                <th className="py-3 px-4">Total Resep</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Tidak ada data dokter yang cocok.
                  </td>
                </tr>
              ) : (
                filteredDoctors.map(doc => {
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{doc.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {doc.phone || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {doc.totalPrescriptions} Resep
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedDocForRecap(doc)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Rekap Resep Dokter"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(doc)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Dokter"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentUser.role === 'admin'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-300 cursor-not-allowed opacity-50'
                            }`}
                            title={
                              currentUser.role === 'admin'
                                ? 'Hapus Dokter'
                                : 'Hanya Admin yang dapat menghapus'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add / Edit Doctor Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 text-left my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden animate-in fade-in">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <h3 className="font-bold text-sm">
                  {editingDoctor ? 'Edit Data Dokter' : 'Tambah Dokter Mitra Baru'}
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
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Dokter</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. dr. Budi Santoso, Sp.PD"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor HP / Telepon</label>
                    <input
                      type="text"
                      placeholder="e.g. 081234567890"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Dokter</label>
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
                    Simpan Data Dokter
                  </button>
                </div>
              </form>
            </div>
          </div>
      </div>
      )}

      {/* Doctor Prescription Transactions Modal */}
      {selectedDocForRecap && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Rekap Resep Dokter</h3>
                <p className="text-xs text-indigo-300">{selectedDocForRecap.name}</p>
              </div>
              <button
                onClick={() => setSelectedDocForRecap(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {transactions.filter(t => t.doctorId === selectedDocForRecap.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-xs">
                  Belum ada transaksi resep untuk dokter ini.
                </p>
              ) : (
                transactions
                  .filter(t => t.doctorId === selectedDocForRecap.id)
                  .map(trx => (
                    <div
                      key={trx.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-slate-900">{trx.trxNo}</span>
                        <div className="text-right">
                          <span className="text-slate-900 block">{formatRupiah(trx.totalAmount)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Tgl: {formatDateTime(trx.date)}</span>
                        <span>Pasien: {trx.customerName || 'Umum'}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end text-xs">
              <button
                onClick={() => setSelectedDocForRecap(null)}
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
      {deletingDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left my-auto animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Hapus Data Dokter</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Yakin ingin menghapus data dokter resep <strong className="text-slate-900">{deletingDoctor.name}</strong> ({deletingDoctor.sip})?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingDoctor(null)}
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
