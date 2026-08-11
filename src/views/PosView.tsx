import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Medicine, TransactionItem, Customer, Doctor, MedicineCategory, Transaction } from '../types';
import { formatRupiah, getExpiredStatus, formatDateTime, formatStockDisplay as formatStockDisplayUtil } from '../utils/formatters';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Stethoscope,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  UserPlus,
  X,
  Pill,
  Printer,
  Receipt,
  Eye,
  Calculator,
  Percent,
  Info,
  Tag,
  Package,
  TrendingUp,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';

export interface ScanAlert {
  type: 'not_found' | 'out_of_stock' | 'expired' | 'stock_exceeded';
  barcode: string;
  medicine?: Medicine;
  message?: string;
}

export type PrescriptionFormulaMode =
  | 'default' // Default-sebelumnya (Bagi Hasil Standard Apotek % / Dokter %)
  | 'calc1' // 1. Persentase Penjualan Resep (Bagi Hasil Kustom %)
  | 'calc2' // 2. Margin Keuntungan Resep (%)
  | 'calc3' // 3. Markup Resep (%)
  | 'calc4' // 4. Jasa Pelayanan Resep (Embalase / Tuscan Fee)
  | 'calc5' // 5. Resep Racikan (Biaya Kemasan / Puyer)
  | 'calc6' // 6. Diskon Penebusan Resep (%)
  | 'calc7' // 7. Diskon Obat Generik (%)
  | 'calc8' // 8. Insentif Dokter Khusus
  | 'calc9' // 9. Profit Bersih & Surcharge Operasional (%)
  | 'pricing'; // Rumus Praktis Harga Resep Pasien Complete

export const PosView: React.FC = () => {
  const {
    medicines,
    customers,
    doctors,
    settings,
    createTransaction,
    addCustomer,
    setLastTransaction,
    setIsReceiptModalOpen,
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [taxStatusFilter, setTaxStatusFilter] = useState<'ppn' | 'non_ppn'>('ppn');

  // Helper to check if a medicine is subject to PPN 11%
  const isMedicinePpn = (med: Medicine): boolean => {
    return (med.isPpnIncluded ?? true) && (med.ppnRate ?? 11) > 0;
  };

  // Helper to format stock display with proper unit and base pcs conversion
  const formatStockDisplay = (med: Medicine): string => {
    return formatStockDisplayUtil(med.stock, med.unit, med.unitMultiplier);
  };

  // Transaction Form State
  const [cart, setCart] = useState<TransactionItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [isPrescription, setIsPrescription] = useState<boolean>(false);
  const [prescriptionNote, setPrescriptionNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // PPN / Tax Settings state
  const [taxType, setTaxType] = useState<'PPN' | 'NON_PPN'>(settings.defaultTaxType || 'PPN');
  const [isPpnIncluded, setIsPpnIncluded] = useState<boolean>(settings.defaultPpnIncluded ?? true);
  const [ppnRate, setPpnRate] = useState<number>(settings.defaultPpnRate || 11);

  // Custom Prescription Settings (can override settings defaults for this transaction)
  const [useCustomPrescriptionSettings, setUseCustomPrescriptionSettings] = useState<boolean>(false);
  const [customMarkupRate, setCustomMarkupRate] = useState<number>(settings.defaultPrescriptionMarkup || 20);
  const [customRacikanFee, setCustomRacikanFee] = useState<number>(settings.defaultRacikanFee || 0);

  // Quick Customer Registration Modal state inside POS
  const [isQuickCustOpen, setIsQuickCustOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');

  // Barcode Scanner & Scan Alerts State
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [scanAlert, setScanAlert] = useState<ScanAlert | null>(null);
  const [recentScanToast, setRecentScanToast] = useState<string | null>(null);

  // Mobile view switcher for POS ('catalog' or 'cart')
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setMobileTab('cart');
        setTimeout(() => paymentInputRef.current?.focus(), 100);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setMobileTab('catalog');
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories: MedicineCategory[] = [
    'Obat Bebas',
    'Obat Bebas Terbatas',
    'Obat Keras',
    'Jamu & Herbal',
    'Alat Kesehatan',
    'Suplemen & Vitamin',
    'Lainnya',
  ];

  // Barcode Scan Handler (Auto-Add to Cart + Validation Popup Alerts)
  const handleScanBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Search medicine by code, id, or exact name
    const med = medicines.find(
      m => m.isActive && (
        m.code.toLowerCase() === code.toLowerCase() ||
        m.id.toLowerCase() === code.toLowerCase() ||
        m.name.toLowerCase() === code.toLowerCase()
      )
    );

    if (!med) {
      setScanAlert({
        type: 'not_found',
        barcode: code,
        message: `Sediaan obat dengan kode / barcode "${code}" tidak ditemukan dalam database apotek.`,
      });
      setBarcodeInput('');
      return;
    }

    const added = addToCart(med);
    setBarcodeInput('');

    if (added) {
      // Toast feedback
      setRecentScanToast(`✓ ${med.name} (${med.code}) berhasil masuk keranjang!`);
      setTimeout(() => {
        setRecentScanToast(null);
      }, 2500);
    }

    // Auto-refocus scanner input for continuous barcode scanning
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Cart Functions
  const processAddToCart = (med: Medicine) => {
    const isPpn = isMedicinePpn(med);
    const itemPpnRate = isPpn ? (med.ppnRate ?? 11) : 0;
    const multiplier = med.unit === 'Lusin' ? 12 : (med.unitMultiplier || 1);

    setCart(prev => {
      const existing = prev.find(item => item.medicineId === med.id);
      if (existing) {
        const nextQty = existing.qty + 1;
        const totalNeededPcs = nextQty * multiplier;
        if (totalNeededPcs > med.stock) {
          const currentCartPcs = existing.qty * multiplier;
          const availableStockStr = formatStockDisplay(med);
          setScanAlert({
            type: 'stock_exceeded',
            barcode: med.code,
            medicine: med,
            message: `Jumlah sediaan "${med.name}" di keranjang (${existing.qty} ${med.unit}${multiplier > 1 ? ` = ${currentCartPcs} pcs` : ''}) jika ditambah 1 ${med.unit} lagi (${totalNeededPcs} pcs) melebihi stok yang tersedia (${availableStockStr}).`,
          });
          return prev;
        }
        return prev.map(item => {
          if (item.medicineId === med.id) {
            const nextQty = item.qty + 1;
            const mult = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || multiplier);
            return { ...item, qty: nextQty, subtotal: nextQty * mult * item.price, unitMultiplier: mult };
          }
          return item;
        });
      } else {
        const totalNeededPcs = 1 * multiplier;
        if (totalNeededPcs > med.stock) {
          const availableStockStr = formatStockDisplay(med);
          setScanAlert({
            type: 'stock_exceeded',
            barcode: med.code,
            medicine: med,
            message: `Stok sediaan "${med.name}" (${availableStockStr}) tidak mencukupi untuk 1 ${med.unit}${multiplier > 1 ? ` (${multiplier} pcs)` : ''}.`,
          });
          return prev;
        }
        return [
          ...prev,
          {
            medicineId: med.id,
            medicineCode: med.code,
            medicineName: med.name,
            unit: med.unit,
            price: med.price,
            qty: 1,
            subtotal: 1 * multiplier * med.price,
            isPpn,
            ppnRate: itemPpnRate,
            itemType: med.itemType || 'obat',
            unitMultiplier: multiplier,
            purchasePrice: med.purchasePrice || 0,
          },
        ];
      }
    });
  };

  const addToCart = (med: Medicine): boolean => {
    if (med.stock <= 0) {
      setScanAlert({
        type: 'out_of_stock',
        barcode: med.code,
        medicine: med,
        message: `Sediaan obat "${med.name}" (${med.code}) saat ini TIDAK TERSEDIA (Stok Habis: ${formatStockDisplay(med)}). Barang tidak dapat dimasukkan ke keranjang.`,
      });
      return false;
    }

    const expStatus = getExpiredStatus(med.expiredDate);
    if (expStatus.isExpired) {
      setScanAlert({
        type: 'expired',
        barcode: med.code,
        medicine: med,
        message: `Sediaan obat "${med.name}" (${med.code}) telah KADALUWARSA pada tanggal ${med.expiredDate}. Sediaan kadaluwarsa dilarang dijual!`,
      });
      return false;
    }

    const existingInCart = cart.find(i => i.medicineId === med.id);
    const multiplier = med.unit === 'Lusin' ? 12 : (med.unitMultiplier || 1);
    if (existingInCart) {
      const nextTotalPcs = (existingInCart.qty + 1) * multiplier;
      if (nextTotalPcs > med.stock) {
        const availableStockStr = formatStockDisplay(med);
        const currentCartPcs = existingInCart.qty * multiplier;
        setScanAlert({
          type: 'stock_exceeded',
          barcode: med.code,
          medicine: med,
          message: `Jumlah sediaan "${med.name}" di keranjang (${existingInCart.qty} ${med.unit}${multiplier > 1 ? ` = ${currentCartPcs} pcs` : ''}) jika ditambah 1 ${med.unit} lagi (${nextTotalPcs} pcs) melebihi batas stok apotek (${availableStockStr}).`,
        });
        return false;
      }
    }

    // STRICT PERPAJAKAN SEPARATION: Obat PPN 11% & Non-PPN tidak boleh digabung dalam 1 transaksi
    const isPpn = isMedicinePpn(med);

    if (cart.length > 0) {
      const cartIsPpn = cart[0].isPpn !== false;
      if (cartIsPpn !== isPpn) {
        setScanAlert({
          type: 'expired',
          barcode: med.code,
          medicine: med,
          message: `PENGGABUNGAN TRANSAKSI DILARANG:\n\nTransaksi Obat PPN 11% dan Non-PPN TIDAK BOLEH DIGABUNG DALAM 1 TRANSAKSI!\n\nKeranjang saat ini terisi: ${cartIsPpn ? 'Obat PPN 11%' : 'Obat Non-PPN'}\nObat yang dipilih: "${med.name}" (${isPpn ? 'Obat PPN 11%' : 'Obat Non-PPN'}).\n\nSilakan selesaikan transaksi saat ini terlebih dahulu atau kosongkan keranjang sebelum memproses barang perpajakan berbeda.`,
        });
        return false;
      }
    } else {
      // Empty cart: auto set transaction tax type and filter to match the added item
      if (isPpn) {
        setTaxType('PPN');
        setTaxStatusFilter('ppn');
      } else {
        setTaxType('NON_PPN');
        setTaxStatusFilter('non_ppn');
      }
    }

    // Also verify against active taxType
    if (taxType === 'PPN' && !isPpn) {
      setScanAlert({
        type: 'expired',
        barcode: med.code,
        medicine: med,
        message: `PENGGABUNGAN TRANSAKSI DILARANG:\n\nTransaksi saat ini ditetapkan sebagai Transaksi PPN 11%. Sediaan Obat Non-PPN ("${med.name}") tidak dapat dimasukkan ke Transaksi PPN.`,
      });
      return false;
    }
    if (taxType === 'NON_PPN' && isPpn) {
      setScanAlert({
        type: 'expired',
        barcode: med.code,
        medicine: med,
        message: `PENGGABUNGAN TRANSAKSI DILARANG:\n\nTransaksi saat ini ditetapkan sebagai Transaksi Non-PPN. Sediaan Obat PPN 11% ("${med.name}") tidak dapat dimasukkan ke Transaksi Non-PPN.`,
      });
      return false;
    }

    processAddToCart(med);
    return true;
  };

  // Safe tax type and filter switches
  const handleSwitchTaxType = (targetType: 'PPN' | 'NON_PPN') => {
    if (cart.length > 0) {
      const cartIsPpn = cart[0].isPpn !== false;
      const currentCartType = cartIsPpn ? 'PPN' : 'NON_PPN';
      if (currentCartType !== targetType) {
        setScanAlert({
          type: 'expired',
          message: `PERUBAHAN JENIS TRANSAKSI DILARANG:\n\nKeranjang saat ini terisi ${cartIsPpn ? 'Obat PPN 11%' : 'Obat Non-PPN'}. Jenis transaksi perpajakan tidak dapat diubah ke ${targetType === 'PPN' ? 'Transaksi PPN' : 'Non-PPN'} saat keranjang terisi. Silakan kosongkan keranjang terlebih dahulu.`,
        });
        return;
      }
    }
    setTaxType(targetType);
    setTaxStatusFilter(targetType === 'PPN' ? 'ppn' : 'non_ppn');
  };

  const handleSwitchTaxFilter = (targetFilter: 'ppn' | 'non_ppn') => {
    if (cart.length > 0) {
      const cartIsPpn = cart[0].isPpn !== false;
      const currentCartFilter = cartIsPpn ? 'ppn' : 'non_ppn';
      if (currentCartFilter !== targetFilter) {
        setScanAlert({
          type: 'expired',
          message: `PERPINDAHAN FILTER DILARANG:\n\nKeranjang saat ini terisi ${cartIsPpn ? 'Obat PPN 11%' : 'Obat Non-PPN'}. Silakan kosongkan keranjang terlebih dahulu sebelum berpindah filter perpajakan.`,
        });
        return;
      }
    }
    setTaxStatusFilter(targetFilter);
    setTaxType(targetFilter === 'ppn' ? 'PPN' : 'NON_PPN');
  };

  const updateCartQty = (medicineId: string, delta: number) => {
    const med = medicines.find(m => m.id === medicineId);
    if (!med) return;

    setCart(prev =>
      prev
        .map(item => {
          if (item.medicineId === medicineId) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null; // remove item
            const multiplier = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || 1);
            const totalNeededPcs = newQty * multiplier;
            if (totalNeededPcs > med.stock) {
              const availableStockStr = formatStockDisplay(med);
              setScanAlert({
                type: 'stock_exceeded',
                barcode: med.code,
                medicine: med,
                message: `Permintaan ${newQty} ${item.unit}${multiplier > 1 ? ` (${totalNeededPcs} pcs)` : ''} melebihi sisa stok apotek yang tersedia (${availableStockStr}).`,
              });
              return item;
            }
            return { ...item, qty: newQty, subtotal: newQty * multiplier * item.price, unitMultiplier: multiplier };
          }
          return item;
        })
        .filter(Boolean) as TransactionItem[]
    );
  };

  const setCartItemQty = (medicineId: string, targetQty: number) => {
    const med = medicines.find(m => m.id === medicineId);
    if (!med) return;

    if (isNaN(targetQty) || targetQty <= 0) {
      removeFromCart(medicineId);
      return;
    }

    setCart(prev =>
      prev.map(item => {
        if (item.medicineId === medicineId) {
          const multiplier = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || 1);
          const totalNeededPcs = targetQty * multiplier;
          if (totalNeededPcs > med.stock) {
            const availableStockStr = formatStockDisplay(med);
            setScanAlert({
              type: 'stock_exceeded',
              barcode: med.code,
              medicine: med,
              message: `Permintaan ${targetQty} ${item.unit}${multiplier > 1 ? ` (${totalNeededPcs} pcs)` : ''} melebihi sisa stok apotek yang tersedia (${availableStockStr}).`,
            });
            const maxPossibleQty = Math.floor(med.stock / multiplier);
            if (maxPossibleQty <= 0) return item;
            return { ...item, qty: maxPossibleQty, subtotal: maxPossibleQty * multiplier * item.price, unitMultiplier: multiplier };
          }
          return { ...item, qty: targetQty, subtotal: targetQty * multiplier * item.price, unitMultiplier: multiplier };
        }
        return item;
      })
    );
  };

  const removeFromCart = (medicineId: string) => {
    setCart(prev => prev.filter(item => item.medicineId !== medicineId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentAmount(0);
  };

  // Calculations (Subtotals & Modal Costs)
  const rawCartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  // Separate cart item totals by tax classification (PPN vs Non-PPN)
  const ppnItemsInCart = cart.filter(item => item.isPpn !== false);
  const nonPpnItemsInCart = cart.filter(item => item.isPpn === false);

  const ppnItemsSubtotal = ppnItemsInCart.reduce((sum, item) => sum + item.subtotal, 0);
  const nonPpnItemsSubtotal = nonPpnItemsInCart.reduce((sum, item) => sum + item.subtotal, 0);

  // Selected Doctor & Prescription calculations
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  let calculatedTotalAmount = rawCartSubtotal;
  let effectiveMarkupRate = 0;
  let effectiveRacikanFee = 0;
  let prescriptionFormulaNote = 'Penjualan Non-Resep';

  if (isPrescription) {
    effectiveMarkupRate = useCustomPrescriptionSettings ? customMarkupRate : (settings.defaultPrescriptionMarkup || 20);
    effectiveRacikanFee = useCustomPrescriptionSettings ? customRacikanFee : (settings.defaultRacikanFee || 0);

    const markupVal = Math.round((rawCartSubtotal * effectiveMarkupRate) / 100);
    calculatedTotalAmount = rawCartSubtotal + markupVal + effectiveRacikanFee;

    prescriptionFormulaNote = `Jasa Racikan ${effectiveMarkupRate}%, Biaya Racikan ${formatRupiah(effectiveRacikanFee)}`;
  }

  // Tax & PPN Breakdown Calculations (Propagated per item PPN classification)
  let dppAmount = calculatedTotalAmount;
  let ppnAmount = 0;
  let grandTotal = calculatedTotalAmount;

  if (taxType === 'PPN') {
    const ppnRatio = rawCartSubtotal > 0 ? ppnItemsSubtotal / rawCartSubtotal : 0;
    const effectivePpnItemsBase = Math.round(calculatedTotalAmount * ppnRatio);
    const effectiveNonPpnItemsBase = calculatedTotalAmount - effectivePpnItemsBase;

    if (isPpnIncluded) {
      // Harga sudah termasuk PPN
      const dppPpnPart = Math.round(effectivePpnItemsBase / (1 + ppnRate / 100));
      ppnAmount = effectivePpnItemsBase - dppPpnPart;
      dppAmount = dppPpnPart + effectiveNonPpnItemsBase;
      grandTotal = calculatedTotalAmount;
    } else {
      // PPN ditambahkan di luar subtotal (Exclude)
      ppnAmount = Math.round((effectivePpnItemsBase * ppnRate) / 100);
      dppAmount = calculatedTotalAmount;
      grandTotal = dppAmount + ppnAmount;
    }
  } else {
    dppAmount = calculatedTotalAmount;
    ppnAmount = 0;
    grandTotal = calculatedTotalAmount;
  }

  const totalAmount = grandTotal;
  const changeAmount = Math.max(0, paymentAmount - totalAmount);
  const shortageAmount = Math.max(0, totalAmount - paymentAmount);
  const isPaymentInsufficient = totalAmount > 0 && paymentAmount < totalAmount;

  // Submit POS Transaction
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Keranjang belanja masih kosong! Silakan pilih obat terlebih dahulu.');
      return;
    }

    if (isPrescription && !selectedDoctorId) {
      alert('⚠️ WAJIB PILIH DOKTER:\n\nTransaksi resep mewajibkan pemilihan Dokter Pemberi Resep terlebih dahulu!');
      return;
    }

    if (paymentAmount < totalAmount) {
      alert(
        `⚠️ PEMBAYARAN KURANG!\n\nTotal belanja: ${formatRupiah(
          totalAmount
        )}\nNominal dibayar: ${formatRupiah(paymentAmount)}\nKekurangan: ${formatRupiah(
          shortageAmount
        )}\n\nMohon sesuaikan nominal pembayaran pelanggan.`
      );
      return;
    }

    // Submit via Context
    const created = createTransaction({
      items: cart,
      customerId: selectedCustomerId || undefined,
      doctorId: isPrescription ? selectedDoctorId || undefined : undefined,
      paymentMethod,
      paymentAmount: Number(paymentAmount),
      isPrescription,
      prescriptionMarkupRate: isPrescription ? effectiveMarkupRate : undefined,
      prescriptionRacikanFee: isPrescription ? effectiveRacikanFee : undefined,
      overrideTotalAmount: calculatedTotalAmount,
      prescriptionFormulaNote: isPrescription ? prescriptionFormulaNote : undefined,
      prescriptionNote: isPrescription && prescriptionNote.trim() ? prescriptionNote.trim() : undefined,
      taxType,
      ppnRate: taxType === 'PPN' ? ppnRate : 0,
      isPpnIncluded: taxType === 'PPN' ? isPpnIncluded : false,
    });

    // Open Receipt Modal directly (1 popup instead of 2)
    setLastTransaction(created);
    setIsReceiptModalOpen(true);

    // Reset POS form
    setCart([]);
    setSelectedCustomerId('');
    setSelectedDoctorId('');
    setIsPrescription(false);
    setPrescriptionNote('');
    setUseCustomPrescriptionSettings(false);
    setPaymentAmount(0);
  };

  // Quick Customer Registration
  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName || !quickCustPhone) {
      alert('Mohon isi nama dan nomor HP.');
      return;
    }
    const newC = addCustomer({
      name: quickCustName,
      phone: quickCustPhone,
      status: 'Aktif',
    });
    setSelectedCustomerId(newC.id);
    setIsQuickCustOpen(false);
    setQuickCustName('');
    setQuickCustPhone('');
  };

  // Filter Medicines for catalog selection
  const filteredMedicines = medicines.filter(m => {
    if (!m.isActive) return false;
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;

    const isPpn = isMedicinePpn(m);
    const matchesTax = taxStatusFilter === 'ppn' ? isPpn : !isPpn;

    return matchesSearch && matchesCategory && matchesTax;
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            Kasir Penjualan Apotek (POS)
          </h2>
          <p className="text-xs text-slate-500">
            Transaksi resep & non-resep cepat, pemotongan stok otomatis, dan perhitungan komisi apotek.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] shadow-xs">F1</kbd>
            <span>Bayar</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] shadow-xs">F2</kbd>
            <span>Cari Obat</span>
          </div>
        </div>
      </div>

      {/* Mobile Responsive Navigation Switcher (Hidden on Desktop) */}
      <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-xl lg:hidden text-xs font-bold">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2.5 rounded-lg transition-all text-center flex items-center justify-center gap-2 ${
            mobileTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Pill className="w-4 h-4 text-emerald-600" />
          Katalog Obat
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 rounded-lg transition-all text-center flex items-center justify-center gap-2 relative ${
            mobileTab === 'cart'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Keranjang ({cart.length})
          {cart.length > 0 && (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[10px] font-black">
              {formatRupiah(totalAmount)}
            </span>
          )}
        </button>
      </div>

      {/* Toast Notification when item auto-scanned into cart */}
      {recentScanToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{recentScanToast}</span>
        </div>
      )}

      {/* POS Main Layout: Left = Medicine Catalog Grid & Barcode Scanner, Right = Cart & Checkout Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT 7 COLS: Catalog & Search */}
        <div className={`lg:col-span-7 space-y-3 ${mobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
          {/* Dedicated Barcode Scan Fast Input Widget */}
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-md border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <QrCode className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-xs text-white block">
                  Scan Barcode Kasir
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Arahkan fisik barcode ke scanner / ketik kode lalu tekan Enter
                </span>
              </div>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleScanBarcode(barcodeInput);
              }}
            >
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Arahkan barcode scanner / ketik kode obat..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-slate-800 text-white placeholder-slate-400 border border-slate-700 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 font-semibold"
                  autoFocus
                />
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => setBarcodeInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Search & Category Filter */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari cepat kode, nama obat, barcode (Tekan Enter untuk scan)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    e.preventDefault();
                    handleScanBarcode(searchTerm.trim());
                    setSearchTerm('');
                  }
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>

            {/* Horizontal Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua ({medicines.filter(m => m.isActive).length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg font-medium shrink-0 transition-colors ${
                    categoryFilter === cat
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Filter Status Pajak Obat (PPN vs Non-PPN) */}
            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-[11px] overflow-x-auto">
              <span className="font-extrabold text-slate-700 text-[10.5px] shrink-0 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-blue-600" /> Filter Pajak:
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSwitchTaxFilter('ppn')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all flex items-center gap-1 ${
                    taxStatusFilter === 'ppn'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  Obat PPN 11% ({medicines.filter(m => m.isActive && isMedicinePpn(m)).length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTaxFilter('non_ppn')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all flex items-center gap-1 ${
                    taxStatusFilter === 'non_ppn'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Tag className="w-3 h-3 text-slate-400" />
                  Non-PPN ({medicines.filter(m => m.isActive && !isMedicinePpn(m)).length})
                </button>
              </div>
            </div>
          </div>

          {/* Medicines Grid */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-xs min-h-[480px] max-h-[580px] overflow-y-auto">
            {filteredMedicines.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-1">
                <Pill className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">Tidak ada obat yang cocok.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredMedicines.map(med => {
                  const isOutOfStock = med.stock <= 0;
                  const expStatus = getExpiredStatus(med.expiredDate);
                  const isPpn = isMedicinePpn(med);

                  return (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => addToCart(med)}
                      disabled={isOutOfStock}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between group relative overflow-hidden ${
                        isOutOfStock
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : isPpn
                          ? 'bg-white border-slate-200/90 hover:border-blue-500 hover:shadow-md hover:bg-blue-50/10'
                          : 'bg-white border-slate-200/90 hover:border-emerald-500 hover:shadow-md hover:bg-emerald-50/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] gap-1 mb-1">
                          <span className="font-mono text-slate-400">{med.code}</span>
                          {isPpn ? (
                            <span className="bg-blue-100/90 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200/90 flex items-center gap-0.5 shrink-0">
                              <Receipt className="w-2.5 h-2.5 text-blue-600 shrink-0" /> PPN 11%
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                              Non-PPN
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-emerald-700">
                          {med.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <span className="font-extrabold text-emerald-700 text-xs block">
                            {formatRupiah(med.price)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium block">
                            {isPpn ? (med.priceNonPpn ? `DPP: ${formatRupiah(med.priceNonPpn)}` : 'Inc. PPN 11%') : 'Bebas PPN'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : med.stock <= med.minStock
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          Stok: {formatStockDisplay(med)}
                        </span>
                      </div>

                      {/* Expired warning badge on card */}
                      {expStatus.isExpired && (
                        <div className="absolute top-0 right-0 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg">
                          EXPIRED
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 5 COLS: Shopping Cart & Checkout Form */}
        <div className={`lg:col-span-5 space-y-3 ${mobileTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-4">
            {/* Header / Clear */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                Keranjang Transaksi ({cart.length} Item)
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 space-y-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <p className="text-xs">Keranjang masih kosong.</p>
                  <p className="text-[10px]">Klik sediaan obat di sebelah kiri untuk menambahkan.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.medicineId} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-bold text-slate-900 truncate">{item.medicineName}</h5>
                        {item.isPpn !== false ? (
                          <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                            PPN {item.ppnRate || 11}%
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                            NON-PPN
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>{formatRupiah(item.price)} / {item.unit}</span>
                        {(item.unit === 'Lusin' || (item.unitMultiplier && item.unitMultiplier > 1)) && (
                          <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded text-[9px]">
                            = {item.qty * (item.unit === 'Lusin' ? 12 : (item.unitMultiplier || 1))} pcs
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.medicineId, -1)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Kurangi 1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={e => setCartItemQty(item.medicineId, parseInt(e.target.value) || 0)}
                          className="w-11 text-center font-extrabold text-slate-900 text-xs bg-white border-x border-slate-200 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.medicineId, 1)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Tambah 1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-emerald-700 text-xs min-w-[70px] text-right">
                        {formatRupiah(item.subtotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.medicineId)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Status Pajak Transaksi Keranjang */}
            {cart.length > 0 && (
              <div
                className={`p-2.5 rounded-xl border space-y-1 text-xs ${
                  cart[0].isPpn !== false
                    ? 'bg-blue-50/90 border-blue-200 text-blue-950'
                    : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between font-extrabold">
                  <span className="flex items-center gap-1.5 text-xs">
                    {cart[0].isPpn !== false ? (
                      <>
                        <Receipt className="w-4 h-4 text-blue-600 shrink-0" />
                        Transaksi Khusus Obat PPN 11%
                      </>
                    ) : (
                      <>
                        <Tag className="w-4 h-4 text-slate-600 shrink-0" />
                        Transaksi Khusus Obat Non-PPN
                      </>
                    )}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      cart[0].isPpn !== false ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                    }`}
                  >
                    {cart[0].isPpn !== false ? `Faktur PPN (${ppnRate}%)` : 'Nota Non-PPN'}
                  </span>
                </div>
                <p
                  className={`text-[10.5px] font-medium ${
                    cart[0].isPpn !== false ? 'text-blue-800' : 'text-slate-600'
                  }`}
                >
                  {cart[0].isPpn !== false
                    ? `Semua ${cart.length} item di keranjang tergolong Obat PPN 11%. Penggabungan dengan Obat Non-PPN dilarang.`
                    : `Semua ${cart.length} item di keranjang tergolong Obat Non-PPN. Penggabungan dengan Obat PPN dilarang.`}
                </p>
              </div>
            )}

            {/* Customer & Doctor Selection Controls */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
              {/* Jenis Transaksi Perpajakan (PPN vs Non-PPN) */}
              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-blue-950 text-xs flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    Jenis Transaksi Perpajakan
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    taxType === 'PPN' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-100'
                  }`}>
                    {taxType === 'PPN' ? `Faktur PPN (${ppnRate}%)` : 'Nota Non-PPN'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchTaxType('PPN')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      taxType === 'PPN'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Transaksi PPN
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchTaxType('NON_PPN')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      taxType === 'NON_PPN'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" /> Non-PPN
                  </button>
                </div>

                {taxType === 'PPN' && (
                  <div className="pt-1.5 border-t border-blue-200/80 flex items-center justify-between text-[11px] text-blue-950">
                    <label className="font-bold flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPpnIncluded}
                        onChange={e => setIsPpnIncluded(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      Harga termasuk PPN 11% (Included)
                    </label>
                  </div>
                )}
              </div>

              {/* Customer Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Customer / Member (Opsional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustOpen(true)}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5"
                  >
                    <UserPlus className="w-3 h-3" /> Member Baru
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Customer Umum (Non-Member) --</option>
                  {customers
                    .filter(c => c.status === 'Aktif')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.memberNo})
                      </option>
                    ))}
                </select>
              </div>

              {/* Prescription Toggle & Doctor Selector */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="isPrescriptionToggle" className="font-bold text-slate-800 text-xs cursor-pointer flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                    Transaksi Berasal dari Resep Dokter
                  </label>
                  <input
                    type="checkbox"
                    id="isPrescriptionToggle"
                    checked={isPrescription}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsPrescription(checked);
                      if (checked && !selectedDoctorId) {
                        alert('⚠️ DOKTER WAJIB DIPILIH:\n\nKasir wajib memilih Dokter Pemberi Resep terlebih dahulu sebelum dapat mengonfigurasi opsi dan rumus perhitungan!');
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {isPrescription && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          Dokter Pemberi Resep
                          <span className="text-rose-500 font-extrabold">*</span>
                        </span>
                        {!selectedDoctorId && (
                          <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-extrabold animate-pulse">
                            Wajib Dipilih
                          </span>
                        )}
                      </div>
                      <select
                        value={selectedDoctorId}
                        onChange={e => {
                          const docId = e.target.value;
                          setSelectedDoctorId(docId);
                        }}
                        className={`w-full px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:ring-2 font-semibold transition-all ${
                          !selectedDoctorId
                            ? 'bg-rose-50/50 border-2 border-rose-400 text-rose-900 focus:ring-rose-500/30 shadow-2xs'
                            : 'bg-white border border-slate-300 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      >
                        <option value="">-- Pilih Dokter Pemberi Resep (Wajib) --</option>
                        {doctors
                          .filter(d => d.status === 'Aktif')
                          .map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {!selectedDoctorId ? (
                      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>PILIH DOKTER TERLEBIH DAHULU</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed pl-6">
                          Kasir <strong>wajib memilih Dokter Pemberi Resep</strong> di atas sebelum dapat mengaktifkan dan memilih opsi/formula perhitungan resep.
                        </p>
                      </div>
                    ) : (
                      /* PENGATURAN RESEP (MARKUP & RACIKAN) */
                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <label className="font-extrabold text-indigo-950 text-[11px] flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            Pengaturan Resep & Jasa Racikan
                          </label>
                        </div>

                        {/* Input Khusus Ket. Resep */}
                        <div className="space-y-1 pt-1 border-t border-indigo-200/60">
                          <label className="block font-bold text-slate-700 text-[11px]">Ket. Resep (Catatan / Aturan Pakai)</label>
                          <input
                            type="text"
                            placeholder="Contoh: 3x1 tablet sesudah makan / Racikan Puyer No. 10"
                            value={prescriptionNote}
                            onChange={e => setPrescriptionNote(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-2 pt-1 border-t border-indigo-200/60">
                          <div className="flex items-center justify-between text-[11px]">
                            <label className="font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={useCustomPrescriptionSettings}
                                onChange={e => setUseCustomPrescriptionSettings(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              Ubah Markup & Biaya Racikan Khusus Transaksi Ini
                            </label>
                          </div>

                          {useCustomPrescriptionSettings ? (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-slate-500 mb-1">Markup (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={customMarkupRate}
                                  onChange={e => setCustomMarkupRate(Number(e.target.value))}
                                  className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 mb-1">Biaya Racikan (Rp)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={customRacikanFee}
                                  onChange={e => setCustomRacikanFee(Number(e.target.value))}
                                  className="w-full px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-indigo-100/50 rounded-lg text-[10px] space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Markup Default:</span>
                                <strong className="text-indigo-900">{settings.defaultPrescriptionMarkup || 20}%</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Biaya Racikan Default:</span>
                                <strong className="text-indigo-900">{formatRupiah(settings.defaultRacikanFee || 0)}</strong>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Realtime Split Preview */}
                      {totalAmount > 0 && (
                        <div className="space-y-1.5 pt-1.5 border-t border-indigo-100 text-[11px]">
                          <div className="text-[10px] font-bold text-indigo-900 flex items-center gap-1 bg-white p-1.5 rounded-lg border border-indigo-100">
                            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{prescriptionFormulaNote}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Total & Payment Method */}
            <form onSubmit={handleCheckout} className="space-y-3 pt-3 border-t border-slate-100">
              <div className="bg-emerald-950 text-white p-4 rounded-xl space-y-2.5 shadow-xs">
                {/* Breakdown Subtotal & Biaya */}
                <div className="space-y-1.5 text-xs pb-2 border-b border-emerald-800/80">
                  <div className="flex justify-between items-center text-emerald-200">
                    <span>Subtotal Sediaan ({cart.reduce((sum, i) => sum + i.qty, 0)} {cart.length === 1 ? cart[0].unit : 'item'}):</span>
                    <span className="font-mono font-bold text-white">{formatRupiah(rawCartSubtotal)}</span>
                  </div>

                  {isPrescription && (
                    <>
                      {effectiveMarkupRate > 0 && (
                        <div className="flex justify-between items-center text-indigo-200">
                          <span>Jasa / Markup Resep ({effectiveMarkupRate}%):</span>
                          <span className="font-mono font-bold text-indigo-300">
                            +{formatRupiah(Math.round((rawCartSubtotal * effectiveMarkupRate) / 100))}
                          </span>
                        </div>
                      )}
                      {effectiveRacikanFee > 0 && (
                        <div className="flex justify-between items-center text-indigo-200">
                          <span>Biaya Racikan Dokter:</span>
                          <span className="font-mono font-bold text-indigo-300">
                            +{formatRupiah(effectiveRacikanFee)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {taxType === 'PPN' && (
                    <>
                      <div className="flex justify-between items-center text-blue-200">
                        <span>DPP (Dasar Pengenaan Pajak):</span>
                        <span className="font-mono font-bold text-blue-100">{formatRupiah(dppAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-amber-200">
                        <span>PPN ({ppnRate}% {isPpnIncluded ? 'Inc.' : 'Exc.'}):</span>
                        <span className="font-mono font-bold text-amber-300">
                          {isPpnIncluded ? `(Inc) ${formatRupiah(ppnAmount)}` : `+${formatRupiah(ppnAmount)}`}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Grand Total */}
                <div className="flex items-center justify-between pt-0.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                      TOTAL BAYAR {taxType === 'PPN' ? `(FAKTUR PPN)` : '(NOTA NON-PPN)'}
                    </span>
                    <span className="text-xs text-emerald-200">{cart.length} Jenis Sediaan</span>
                  </div>
                  <span className="text-2xl font-black text-amber-300 tracking-tight font-mono">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                      paymentMethod === 'Tunai'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" /> Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                      paymentMethod === 'QRIS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" /> QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Transfer')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                      paymentMethod === 'Transfer'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Transfer
                  </button>
                </div>
              </div>

              {/* Payment Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Nominal Pembayaran (Rp)</label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(totalAmount)}
                    className="text-[10px] text-emerald-700 font-bold hover:underline"
                  >
                    Uang Pas ({formatRupiah(totalAmount)})
                  </button>
                </div>

                <input
                  ref={paymentInputRef}
                  type="number"
                  min="0"
                  required
                  value={paymentAmount || ''}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-xl text-base font-extrabold focus:outline-none transition-all ${
                    isPaymentInsufficient
                      ? 'bg-rose-50/50 border-2 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                      : paymentAmount >= totalAmount && totalAmount > 0
                      ? 'bg-emerald-50/50 border-2 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />

                {/* Insufficient Payment Feedback Alert */}
                {isPaymentInsufficient && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-xs font-bold animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Pembayaran kurang <strong className="text-rose-900 underline">{formatRupiah(shortageAmount)}</strong>!
                    </span>
                  </div>
                )}

                {/* Quick Nominal Chips */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px]">
                  {[50000, 100000, 150000, 200000].map(nom => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => setPaymentAmount(nom)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 shrink-0"
                    >
                      {formatRupiah(nom)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Realtime Change / Shortage calculation */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  isPaymentInsufficient
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : paymentAmount >= totalAmount && totalAmount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <span className="font-bold flex items-center gap-1">
                  {isPaymentInsufficient ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Kekurangan Pembayaran:
                    </>
                  ) : (
                    'Kembalian:'
                  )}
                </span>
                <span
                  className={`font-black text-sm ${
                    isPaymentInsufficient
                      ? 'text-rose-700'
                      : paymentAmount >= totalAmount
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {isPaymentInsufficient
                    ? `-${formatRupiah(shortageAmount)}`
                    : formatRupiah(changeAmount)}
                </span>
              </div>

              {/* Submit Checkout Button */}
              <button
                type="submit"
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                  cart.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isPaymentInsufficient
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 active:scale-[0.99]'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 active:scale-[0.99]'
                }`}
              >
                {isPaymentInsufficient ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    PEMBAYARAN KURANG ({formatRupiah(shortageAmount)})
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    SIMPAN & PROSES TRANSAKSI
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Action Bar */}
      {cart.length > 0 && mobileTab === 'catalog' && (
        <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between border border-slate-700 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-extrabold text-xs">
                {cart.length}
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Belanja</span>
                <span className="font-extrabold text-emerald-400 text-sm">{formatRupiah(totalAmount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs bg-emerald-600 px-3 py-1.5 rounded-xl">
              <span>Lanjut Bayar</span>
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* Quick Customer Registration Modal */}
      {isQuickCustOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 overflow-hidden text-left my-auto animate-in fade-in">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-xs">Registrasi Cepat Member</h4>
              <button onClick={() => setIsQuickCustOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddCustomer} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Member</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap..."
                  value={quickCustName}
                  onChange={e => setQuickCustName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">No HP</label>
                <input
                  type="text"
                  required
                  placeholder="0812..."
                  value={quickCustPhone}
                  onChange={e => setQuickCustPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCustOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                >
                  Simpan & Pilih
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* Barcode / Stock / Expiry Popup Alert Modal */}
      {scanAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-slate-800 text-left my-auto animate-in fade-in relative overflow-hidden">
            {/* Top Accent Line */}
            <div
              className={`h-2.5 -mx-6 -mt-6 mb-3 ${
                scanAlert.type === 'expired'
                  ? 'bg-rose-600'
                  : scanAlert.type === 'out_of_stock'
                  ? 'bg-amber-500'
                  : scanAlert.type === 'not_found'
                  ? 'bg-slate-800'
                  : 'bg-indigo-600'
              }`}
            />

            <div className="flex items-start gap-3.5">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  scanAlert.type === 'expired'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : scanAlert.type === 'out_of_stock'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : scanAlert.type === 'not_found'
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}
              >
                {scanAlert.type === 'expired' ? (
                  <AlertTriangle className="w-7 h-7 text-rose-600 animate-bounce" />
                ) : scanAlert.type === 'out_of_stock' ? (
                  <AlertCircle className="w-7 h-7 text-amber-600" />
                ) : scanAlert.type === 'not_found' ? (
                  <XCircle className="w-7 h-7 text-slate-700" />
                ) : (
                  <Info className="w-7 h-7 text-indigo-600" />
                )}
              </div>

              <div className="space-y-1 pr-6">
                <span
                  className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md inline-block ${
                    scanAlert.type === 'expired'
                      ? 'bg-rose-100 text-rose-800'
                      : scanAlert.type === 'out_of_stock'
                      ? 'bg-amber-100 text-amber-900'
                      : scanAlert.type === 'not_found'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {scanAlert.type === 'expired'
                    ? '🚫 PERINGATAN KADALUWARSA'
                    : scanAlert.type === 'out_of_stock'
                    ? '⚠️ BARANG TIDAK TERSEDIA'
                    : scanAlert.type === 'not_found'
                    ? '❓ KODE TIDAK DITEMUKAN'
                    : 'ℹ️ PERINGATAN STOK'}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  {scanAlert.type === 'expired'
                    ? 'Obat Sudah Kadaluwarsa!'
                    : scanAlert.type === 'out_of_stock'
                    ? 'Stok Sediaan Habis'
                    : scanAlert.type === 'not_found'
                    ? 'Barcode Tidak Terdaftar'
                    : 'Stok Tidak Mencukupi'}
                </h3>
              </div>

              <button
                onClick={() => setScanAlert(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed space-y-2.5">
              <p className="font-medium text-slate-800">{scanAlert.message}</p>

              {scanAlert.medicine && (
                <div className="pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block font-normal text-[10px]">Sisa Stok Tersedia:</span>
                    <span className={`font-bold ${scanAlert.medicine.stock <= 0 ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                      {formatStockDisplay(scanAlert.medicine)}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block font-normal text-[10px]">Status Tanggal Expired:</span>
                    <span className={`font-bold ${scanAlert.type === 'expired' ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                      {scanAlert.medicine.expiredDate}
                    </span>
                  </div>
                </div>
              )}

              {scanAlert.type === 'expired' && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-900 text-[11px] font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Petunjuk Apotek: Segera pisahkan obat ini ke rak Karantina Obat Kadaluwarsa!</span>
                </div>
              )}

              {scanAlert.type === 'out_of_stock' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900 text-[11px] font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Petunjuk Apotek: Periksa penerimaan Stok Masuk atau buat Purchase Order supplier.</span>
                </div>
              )}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setScanAlert(null);
                  if (barcodeInputRef.current) barcodeInputRef.current.focus();
                }}
                className={`w-full py-3 rounded-2xl text-white font-black text-xs shadow-md transition-all active:scale-[0.98] ${
                  scanAlert.type === 'expired'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : scanAlert.type === 'out_of_stock'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                Paham & Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
