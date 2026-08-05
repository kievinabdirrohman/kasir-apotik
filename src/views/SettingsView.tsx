import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, Store, FileText, CheckCircle2, Shield } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, currentUser } = useApp();

  const [name, setName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [siaNumber, setSiaNumber] = useState(settings.siaNumber || '');
  const [sipaNumber, setSipaNumber] = useState(settings.sipaNumber || '');
  const [apotekerName, setApotekerName] = useState(settings.apotekerName || '');
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [defaultMinStock, setDefaultMinStock] = useState(settings.defaultMinStock);
  const [defaultPrescriptionMarkup, setDefaultPrescriptionMarkup] = useState(
    settings.defaultPrescriptionMarkup || 20
  );
  const [defaultRacikanFee, setDefaultRacikanFee] = useState(
    settings.defaultRacikanFee || 0
  );

  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      name,
      address,
      phone,
      siaNumber,
      sipaNumber,
      apotekerName,
      receiptHeader,
      receiptFooter,
      defaultMinStock: Number(defaultMinStock),
      defaultPrescriptionMarkup: Number(defaultPrescriptionMarkup),
      defaultRacikanFee: Number(defaultRacikanFee),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-xs my-8 space-y-3">
        <Shield className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Akses Terbatas untuk Admin</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Pengaturan identitas dan struk apotek hanya dapat diubah oleh Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Identitas & Struk Apotek</h2>
        <p className="text-xs text-slate-500 mt-1">
          Atur informasi resmi apotek yang tercetak pada header/footer struk kasir dan dokumen laporan.
        </p>
      </div>

      {isSaved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          Pengaturan apotek berhasil diperbarui!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identitas Apotek */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
            <Store className="w-4 h-4 text-emerald-600" />
            Profil & Legalitas Apotek
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Resmi Apotek</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / Hotline</label>
              <input
                type="text"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Apoteker Penanggung Jawab (APA)</label>
              <input
                type="text"
                value={apotekerName}
                onChange={e => setApotekerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">No. SIA (Surat Izin Apotek)</label>
              <input
                type="text"
                value={siaNumber}
                onChange={e => setSiaNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">No. SIPA (Izin Praktik Apoteker)</label>
              <input
                type="text"
                value={sipaNumber}
                onChange={e => setSipaNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Format Struk Penjualan */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-emerald-600" />
            Konfigurasi Teks Struk Cetak
          </h3>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Header Atas Struk (Salam Pembuka)</label>
            <textarea
              rows={2}
              value={receiptHeader}
              onChange={e => setReceiptHeader(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Footer Bawah Struk (Pesan Penutup)</label>
            <textarea
              rows={2}
              value={receiptFooter}
              onChange={e => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Batas Minimum Stok Alert</label>
              <input
                type="number"
                min="1"
                value={defaultMinStock}
                onChange={e => setDefaultMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Markup Resep Default (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={defaultPrescriptionMarkup}
                onChange={e => setDefaultPrescriptionMarkup(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-emerald-700"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Persentase markup default untuk obat resep (default 20%).
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Biaya Jasa Racikan (Rp)</label>
              <input
                type="number"
                min="0"
                value={defaultRacikanFee}
                onChange={e => setDefaultRacikanFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-indigo-700"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Biaya jasa racikan default per transaksi resep (default Rp 0).
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 transition-colors"
          >
            Simpan Seluruh Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
};
