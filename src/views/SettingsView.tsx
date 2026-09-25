import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, Store, FileText, CheckCircle2, Shield, Printer, RefreshCw, Loader2, HardDrive, FolderOpen } from 'lucide-react';
import type { PrinterInfo, StorageLocationInfo } from '../electron.d';
import { DEFAULT_PRINTER_SETTINGS, normalizePrinterSettings } from '../utils/printerSettings';

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

  // ── Printer thermal (desktop / Electron) ────────────────────────────────
  const isDesktop = !!window.electronAPI;
  const [printerName, setPrinterName] = useState(settings.printerName || '');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(
    settings.paperWidth === '80mm' ? '80mm' : '58mm'
  );
  const [marginTopMm, setMarginTopMm] = useState(settings.marginTopMm ?? DEFAULT_PRINTER_SETTINGS.marginTopMm);
  const [marginRightMm, setMarginRightMm] = useState(settings.marginRightMm ?? DEFAULT_PRINTER_SETTINGS.marginRightMm);
  const [marginBottomMm, setMarginBottomMm] = useState(settings.marginBottomMm ?? DEFAULT_PRINTER_SETTINGS.marginBottomMm);
  const [marginLeftMm, setMarginLeftMm] = useState(settings.marginLeftMm ?? DEFAULT_PRINTER_SETTINGS.marginLeftMm);
  const [printerFontSize, setPrinterFontSize] = useState(settings.printerFontSize ?? DEFAULT_PRINTER_SETTINGS.fontSize);
  const [printerLineHeight, setPrinterLineHeight] = useState(settings.printerLineHeight ?? DEFAULT_PRINTER_SETTINGS.lineHeight);
  const [printerLabelWidthPct, setPrinterLabelWidthPct] = useState(settings.printerLabelWidthPct ?? DEFAULT_PRINTER_SETTINGS.labelWidthPct);
  const [printerColumnGapMm, setPrinterColumnGapMm] = useState(settings.printerColumnGapMm ?? DEFAULT_PRINTER_SETTINGS.columnGapMm);
  const [printerAmountAlignment, setPrinterAmountAlignment] = useState<'left' | 'right'>(settings.printerAmountAlignment === 'left' ? 'left' : 'right');
  const [autoPrint, setAutoPrint] = useState(!!settings.autoPrintReceipt);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printerStatus, setPrinterStatus] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [storageLocation, setStorageLocation] = useState<StorageLocationInfo | null>(null);
  const [storageStatus, setStorageStatus] = useState('');
  const [isMigratingStorage, setIsMigratingStorage] = useState(false);

  const loadPrinters = async () => {
    if (!window.electronAPI) return;
    try {
      const list = await window.electronAPI.listPrinters();
      setPrinters(list || []);
    } catch {
      setPrinters([]);
    }
  };

  useEffect(() => {
    void loadPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    void window.electronAPI.getStorageLocation().then(setStorageLocation).catch(() => setStorageLocation(null));
  }, []);

  const handleMigrateStorage = async () => {
    if (!window.electronAPI || isMigratingStorage) return;
    const targetFolder = await window.electronAPI.chooseStorageFolder();
    if (!targetFolder) return;
    if (!window.confirm(`Pindahkan database ke folder berikut?\n\n${targetFolder}\n\nDatabase lama tetap disimpan sebagai backup.`)) return;

    setIsMigratingStorage(true);
    setStorageStatus('Menyalin dan memverifikasi database...');
    try {
      const result = await window.electronAPI.migrateStorage(targetFolder);
      if (!result.success) {
        setStorageStatus(`Gagal memindahkan data: ${result.error || 'kesalahan tidak diketahui'}`);
        return;
      }
      setStorageStatus(`Berhasil dipindahkan ke ${result.databasePath}. Aplikasi sedang dimuat ulang.`);
      setStorageLocation(await window.electronAPI.getStorageLocation());
    } catch (err: unknown) {
      setStorageStatus(`Gagal memindahkan data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMigratingStorage(false);
    }
  };

  const handleTestPrint = async () => {
    if (!window.electronAPI) return;
    setIsPrinting(true);
    setPrinterStatus('');
    try {
      const result = await window.electronAPI.printTest({
        paperWidth,
        printerName: printerName || undefined,
        pharmacyName: name,
        printerSettings: normalizePrinterSettings({ ...settings, marginTopMm, marginRightMm, marginBottomMm, marginLeftMm, printerFontSize, printerLineHeight, printerLabelWidthPct, printerColumnGapMm, printerAmountAlignment }, paperWidth),
      });
      setPrinterStatus(
        result.success
          ? '✅ Test cetak berhasil dikirim ke printer.'
          : `❌ Test cetak gagal: ${result.error || 'kesalahan tidak diketahui'}`
      );
    } catch (err: unknown) {
      setPrinterStatus(`❌ Test cetak gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPrinting(false);
    }
  };

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
      printerName,
      paperWidth,
      autoPrintReceipt: autoPrint,
      marginTopMm,
      marginRightMm,
      marginBottomMm,
      marginLeftMm,
      printerFontSize,
      printerLineHeight,
      printerLabelWidthPct,
      printerColumnGapMm,
      printerAmountAlignment,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const resetPrinterDefaults = () => {
    setMarginTopMm(DEFAULT_PRINTER_SETTINGS.marginTopMm);
    setMarginRightMm(DEFAULT_PRINTER_SETTINGS.marginRightMm);
    setMarginBottomMm(DEFAULT_PRINTER_SETTINGS.marginBottomMm);
    setMarginLeftMm(DEFAULT_PRINTER_SETTINGS.marginLeftMm);
    setPrinterFontSize(DEFAULT_PRINTER_SETTINGS.fontSize);
    setPrinterLineHeight(DEFAULT_PRINTER_SETTINGS.lineHeight);
    setPrinterLabelWidthPct(DEFAULT_PRINTER_SETTINGS.labelWidthPct);
    setPrinterColumnGapMm(DEFAULT_PRINTER_SETTINGS.columnGapMm);
    setPrinterAmountAlignment(DEFAULT_PRINTER_SETTINGS.amountAlignment);
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

        {/* Printer Thermal & Cetak Otomatis (Desktop) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
            <Printer className="w-4 h-4 text-emerald-600" />
            Printer Thermal & Cetak Otomatis
          </h3>

          {!isDesktop && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] leading-relaxed">
              Fitur printer (auto-print, test cetak, pilihan lebar kertas 58mm/80mm) tersedia di aplikasi
              desktop Windows (Electron). Pada mode web, struk dicetak melalui dialog print browser.
            </div>
          )}

          {isDesktop && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lebar Kertas Printer Thermal</label>
                  <div className="flex gap-3">
                    <label
                      className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${paperWidth === '58mm' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    >
                      <input
                        type="radio"
                        name="paperWidth"
                        checked={paperWidth === '58mm'}
                        onChange={() => setPaperWidth('58mm')}
                        className="accent-emerald-600"
                      />
                      Printer 58mm
                    </label>
                    <label
                      className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${paperWidth === '80mm' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    >
                      <input
                        type="radio"
                        name="paperWidth"
                        checked={paperWidth === '80mm'}
                        onChange={() => setPaperWidth('80mm')}
                        className="accent-emerald-600"
                      />
                      Printer 80mm
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Pilih sesuai lebar kertas thermal Anda (umumnya 58mm atau 80mm).
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Printer</label>
                  <div className="flex gap-2">
                    <select
                      value={printerName}
                      onChange={e => setPrinterName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
                    >
                      <option value="">(Printer Default Sistem)</option>
                      {printers.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.displayName}
                          {p.isDefault ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void loadPrinters()}
                      title="Muat ulang daftar printer"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Printer default sistem dipakai bila tidak ada yang dipilih.
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={e => setAutoPrint(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4"
                />
                <span className="font-semibold text-slate-700">
                  Cetak struk otomatis setelah transaksi selesai (Auto Print)
                </span>
              </label>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <h4 className="font-bold text-slate-800">Presisi Layout Struk</h4>
                  <p className="text-[10px] text-slate-400">Atur margin, font, dan kolom agar nominal tidak overlap atau keluar kertas.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['Atas', marginTopMm, setMarginTopMm], ['Kanan', marginRightMm, setMarginRightMm],
                    ['Bawah', marginBottomMm, setMarginBottomMm], ['Kiri', marginLeftMm, setMarginLeftMm],
                  ].map(([label, value, setter]) => (
                    <label key={label as string} className="font-semibold text-slate-700">
                      {label} (mm)
                      <input type="number" min="0" max="10" step="0.5" value={value as number} onChange={e => (setter as (v: number) => void)(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200" />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="font-semibold text-slate-700">Font (pt)<input type="number" min="7" max="18" step="1" value={printerFontSize} onChange={e => setPrinterFontSize(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200" /></label>
                  <label className="font-semibold text-slate-700">Line-height<input type="number" min="1" max="2" step="0.05" value={printerLineHeight} onChange={e => setPrinterLineHeight(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200" /></label>
                  <label className="font-semibold text-slate-700">Lebar label (%)<input type="number" min="35" max="70" step="1" value={printerLabelWidthPct} onChange={e => setPrinterLabelWidthPct(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200" /></label>
                  <label className="font-semibold text-slate-700">Jarak kolom (mm)<input type="number" min="0" max="12" step="0.5" value={printerColumnGapMm} onChange={e => setPrinterColumnGapMm(Number(e.target.value))} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200" /></label>
                </div>
                <div className="flex items-end gap-3">
                  <label className="font-semibold text-slate-700">Alignment nominal
                    <select value={printerAmountAlignment} onChange={e => setPrinterAmountAlignment(e.target.value as 'left' | 'right')} className="block mt-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <option value="right">Rata kanan</option><option value="left">Rata kiri</option>
                    </select>
                  </label>
                  <button type="button" onClick={resetPrinterDefaults} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Reset Default Printer</button>
                </div>
                <div className="mx-auto border border-dashed border-slate-300 bg-white p-3 font-mono text-[10px]" style={{ width: paperWidth === '80mm' ? '80mm' : '58mm', lineHeight: printerLineHeight }}>
                  <div className="text-center font-bold">{name || 'Apotek'}</div>
                  <div className="flex justify-between"><span style={{ width: `${printerLabelWidthPct}%` }}>Total:</span><span className="text-right whitespace-nowrap">Rp 125.000</span></div>
                  <div className="flex justify-between"><span style={{ width: `${printerLabelWidthPct}%` }}>Nama barang sangat panjang membungkus</span><span className="text-right whitespace-nowrap">Rp 12.000</span></div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void handleTestPrint()}
                  disabled={isPrinting}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Test Printer
                </button>
                {printerStatus && <span className="text-[11px] text-slate-600">{printerStatus}</span>}
              </div>
            </>
          )}
        </div>

        {/* Lokasi Penyimpanan Data (Desktop) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            Lokasi Penyimpanan Data
          </h3>
          {!isDesktop ? (
            <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
              Pemindahan lokasi database tersedia pada aplikasi desktop Windows.
            </p>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-700">Status</span>
                  <span className={`px-2 py-1 rounded-lg font-bold ${storageLocation?.isDefault ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    {storageLocation?.isDefault ? 'Default System' : 'Lokasi Custom'}
                  </span>
                </div>
                <div className="text-slate-500 break-all font-mono text-[10px]">
                  {storageLocation?.databasePath || 'Memuat lokasi database...'}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleMigrateStorage()}
                  disabled={isMigratingStorage}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  {isMigratingStorage ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                  Pindahkan Data ke Folder Lain
                </button>
                {storageStatus && <span className="text-[11px] text-slate-600 break-all">{storageStatus}</span>}
              </div>
              <p className="text-[10px] text-slate-400">
                Pilih folder kosong pada partisi lain, misalnya D:\DataApotek. Database lama tidak dihapus dan dibuatkan backup.
              </p>
            </>
          )}
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
