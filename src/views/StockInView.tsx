import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime, formatRupiah, getWIBDateString, formatStockDisplay } from '../utils/formatters';
import { MedicineCategory, StockHistory } from '../types';
import {
  PackagePlus,
  History,
  Search,
  Plus,
  CheckCircle2,
  Trash2,
  RotateCcw,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Building2,
  FileText,
  ListPlus,
  AlertTriangle,
  Layers,
  Calculator,
  RefreshCw,
  Percent,
  Tag,
  Filter,
  TrendingUp,
  DollarSign,
  Info,
  Receipt,
  ShoppingBag,
  X,
} from 'lucide-react';

interface BulkRestockItem {
  id: string;
  medicineId: string;
  amount: number;
  note: string;
  taxType: 'PPN' | 'NON_PPN';
  purchasePrice: number; // HPP Beli per unit
  bhpAmount: number;     // Bahan Habis Pakai per unit
  marginPct: number;     // Persentase Margin (%)
  sellingPrice: number;  // Harga Jual per unit
  updateMedicineMaster: boolean; // Flag to update master catalog
}

interface BulkOpnameState {
  physicalStock: number | string;
  note: string;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalItems: number;
  itemsPerPage: number;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl text-xs">
      <span className="text-slate-500 font-medium">
        Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} entri
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs cursor-pointer"
        >
          Sebelumnya
        </button>
        <span className="px-2.5 py-1 font-bold text-slate-700 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px]">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-slate-200/60 shadow-2xs cursor-pointer"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
};

export const StockInView: React.FC = () => {
  const { medicines, addMedicine, addStock, adjustStock, bulkAdjustStock, bulkAddStock, stockHistory, currentUser } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'masuk' | 'penyesuaian'>('masuk');
  const [restockItemType, setRestockItemType] = useState<'obat' | 'non_obat'>('obat');

  // Modal State for Tambah Item Baru
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'obat' | 'non_obat'>('obat');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MedicineCategory>('Obat Bebas');
  const [newItemUnit, setNewItemUnit] = useState('Strip');
  const [newItemStock, setNewItemStock] = useState<number>(10);
  const [newItemMinStock, setNewItemMinStock] = useState<number>(10);
  const [newItemExpiredDate, setNewItemExpiredDate] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('Rak A1');
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState<number>(10000);
  const [newItemBhpAmount, setNewItemBhpAmount] = useState<number>(0);
  const [newItemMarginPct, setNewItemMarginPct] = useState<number>(20);
  const [newItemSellingPrice, setNewItemSellingPrice] = useState<number>(12000);
  const [newItemIsPpn, setNewItemIsPpn] = useState(true);

  // Modal State for Input Stok Masuk (Dialog Form)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [modalItemType, setModalItemType] = useState<'obat' | 'non_obat'>('obat');
  const [modalMedId, setModalMedId] = useState('');
  const [modalSupplier, setModalSupplier] = useState('PBF Kimia Farma');
  const [modalFakturNo, setModalFakturNo] = useState(`FK-${getWIBDateString().replace(/-/g, '')}-01`);
  const [modalQty, setModalQty] = useState<number>(10);
  const [modalUnit, setModalUnit] = useState<string>('Strip');
  const [modalPurchasePrice, setModalPurchasePrice] = useState<number>(0);
  const [modalBhpAmount, setModalBhpAmount] = useState<number>(0);
  const [modalMarginPct, setModalMarginPct] = useState<number>(20);
  const [modalSellingPrice, setModalSellingPrice] = useState<number>(0);
  const [modalTaxType, setModalTaxType] = useState<'PPN' | 'NON_PPN'>('PPN');
  const [modalNote, setModalNote] = useState('');
  const [modalExpiredDate, setModalExpiredDate] = useState('');

  // Sub-tabs for Opname
  const [opnameTab, setOpnameTab] = useState<'form' | 'log'>('form');

  // Single vs Bulk Mode Toggle for Opname & Restock
  const [restockMode, setRestockMode] = useState<'single' | 'bulk'>('bulk');
  const [opnameMode, setOpnameMode] = useState<'single' | 'bulk'>('bulk');

  // Category Filter for Restock & Opname
  const [restockCategoryFilter, setRestockCategoryFilter] = useState<string>('all');
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState('all');

  // Alerts
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-sync handlers for Stock In Modal
  const handleModalPurchasePriceChange = (val: number) => {
    const hpp = Math.max(0, val);
    setModalPurchasePrice(hpp);
    const totalCost = hpp + modalBhpAmount;
    const computedSell = Math.round(totalCost * (1 + modalMarginPct / 100));
    setModalSellingPrice(computedSell);
  };

  const handleModalBhpAmountChange = (val: number) => {
    const bhp = Math.max(0, val);
    setModalBhpAmount(bhp);
    const totalCost = modalPurchasePrice + bhp;
    const computedSell = Math.round(totalCost * (1 + modalMarginPct / 100));
    setModalSellingPrice(computedSell);
  };

  const handleModalMarginPctChange = (val: number) => {
    const margin = val;
    setModalMarginPct(margin);
    const totalCost = modalPurchasePrice + modalBhpAmount;
    const computedSell = Math.round(totalCost * (1 + margin / 100));
    setModalSellingPrice(computedSell);
  };

  const handleModalSellingPriceChange = (val: number) => {
    const sell = Math.max(0, val);
    setModalSellingPrice(sell);
    const totalCost = modalPurchasePrice + modalBhpAmount;
    if (totalCost > 0) {
      const computedMargin = Math.round(((sell - totalCost) / totalCost) * 10000) / 100;
      setModalMarginPct(computedMargin);
    }
  };

  // Open Restock Modal Handler
  const openRestockModal = (type: 'obat' | 'non_obat' = 'obat') => {
    setModalItemType(type);
    const candidateMeds = medicines.filter(m => m.isActive && (m.itemType || 'obat') === type);
    const defaultMed = candidateMeds[0] || medicines[0];
    if (defaultMed) {
      handleModalMedSelect(defaultMed.id);
    } else {
      setModalMedId('');
      setModalPurchasePrice(0);
      setModalBhpAmount(0);
      setModalMarginPct(20);
      setModalSellingPrice(0);
    }
    setModalQty(10);
    setModalSupplier('PBF Kimia Farma');
    setModalFakturNo(`FK-${getWIBDateString().replace(/-/g, '')}-01`);
    setModalNote('Penerimaan stok distributor');
    setIsRestockModalOpen(true);
  };

  const handleModalMedSelect = (medId: string) => {
    setModalMedId(medId);
    const targetMed = medicines.find(m => m.id === medId);
    if (targetMed) {
      const isPpn = (targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0;
      const tax = isPpn ? 'PPN' : 'NON_PPN';
      setModalTaxType(tax);
      setModalUnit(targetMed.unit || 'Pcs');
      const hpp = targetMed.purchasePrice || (targetMed.price > 0 ? Math.round(targetMed.price * 0.75) : 0);
      const bhp = targetMed.bhpAmount || 0;
      const totalCost = hpp + bhp;
      const sell = targetMed.price || 0;

      // Determine margin percentage from selected item data
      let margin = 20;
      if (targetMed.marginPct !== undefined && targetMed.marginPct !== null) {
        margin = targetMed.marginPct;
      } else if (totalCost > 0 && sell > 0) {
        margin = Math.round(((sell - totalCost) / totalCost) * 10000) / 100;
      }

      setModalPurchasePrice(hpp);
      setModalBhpAmount(bhp);
      setModalMarginPct(margin);

      const computedSellingPrice = sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100));
      setModalSellingPrice(computedSellingPrice);
      setModalExpiredDate(targetMed.expiredDate || '');
    }
  };

  const handleRestockModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMedId) {
      setErrorMessage('Mohon pilih sediaan obat / barang.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (modalQty <= 0) {
      setErrorMessage('Jumlah stok masuk harus lebih dari 0.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const targetMed = medicines.find(m => m.id === modalMedId);
    if (!targetMed) return;

    const mult = (modalUnit === 'Lusin' || targetMed.unit === 'Lusin') ? 12 : (targetMed.unitMultiplier || 1);
    const totalPcsAdded = modalQty * mult;

    const isPpn = modalTaxType === 'PPN';
    const computedTaxType: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';

    const hpp = modalPurchasePrice;
    const bhp = modalBhpAmount;
    const totalCost = hpp + bhp;
    const sell = modalSellingPrice;
    const marginPct = modalMarginPct;

    const fullNote = `[RESTOCK ${computedTaxType}] Supplier: ${modalSupplier || '-'} | Faktur: ${modalFakturNo || '-'} | Qty: ${modalQty} ${modalUnit} (${totalPcsAdded} pcs) | HPP: ${formatRupiah(hpp)}${bhp > 0 ? ` + BHP: ${formatRupiah(bhp)}` : ''} | Margin: ${marginPct}% | Jual: ${formatRupiah(sell)} | ${modalNote || 'Restock via Dialog Modal'}`;

    addStock(modalMedId, totalPcsAdded, fullNote, {
      taxType: computedTaxType,
      purchasePrice: hpp,
      bhpAmount: bhp,
      sellingPrice: sell,
      ppnAmount: isPpn ? Math.round((hpp - hpp / 1.11) * totalPcsAdded) : 0,
      marginPct,
      updateMedicineMaster: true,
    });

    setIsRestockModalOpen(false);
    setSuccessMessage(
      `Berhasil menambahkan +${modalQty} ${modalUnit} (${totalPcsAdded} pcs) (${computedTaxType}) untuk "${targetMed.name}"! No. Faktur: ${modalFakturNo || '-'}.`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 4500);
  };

  // Open New Item Modal Handlers
  const openNewObatModal = () => {
    setNewItemType('obat');
    const count = medicines.filter(m => (m.itemType || 'obat') === 'obat').length + 1;
    setNewItemCode(`OBT-${String(count).padStart(3, '0')}`);
    setNewItemName('');
    setNewItemCategory('Obat Bebas');
    setNewItemUnit('Strip');
    setNewItemStock(10);
    setNewItemMinStock(10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setNewItemExpiredDate(nextYear.toISOString().split('T')[0]);
    setNewItemLocation('Rak A1');
    setNewItemPurchasePrice(10000);
    setNewItemBhpAmount(0);
    setNewItemMarginPct(20);
    setNewItemSellingPrice(12000);
    setNewItemIsPpn(true);
    setIsNewItemModalOpen(true);
  };

  const openNewNonObatModal = () => {
    setNewItemType('non_obat');
    const count = medicines.filter(m => m.itemType === 'non_obat').length + 1;
    setNewItemCode(`NOB-${String(count).padStart(3, '0')}`);
    setNewItemName('');
    setNewItemCategory('Barang Umum' as MedicineCategory);
    setNewItemUnit('Pcs');
    setNewItemStock(10);
    setNewItemMinStock(5);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 2);
    setNewItemExpiredDate(nextYear.toISOString().split('T')[0]);
    setNewItemLocation('Etalase Depan');
    setNewItemPurchasePrice(15000);
    setNewItemBhpAmount(0);
    setNewItemMarginPct(25);
    setNewItemSellingPrice(15000);
    setNewItemIsPpn(false);
    setIsNewItemModalOpen(true);
  };

  const handleCreateNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCode.trim()) {
      setErrorMessage('Mohon lengkapi kode dan nama item.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const computedSellingPrice = Number(newItemSellingPrice || 0);
    const hpp = Math.round(computedSellingPrice * 0.75);
    const bhp = 0;
    const margin = 20;

    const medData = {
      code: newItemCode,
      name: newItemName,
      category: newItemCategory,
      price: computedSellingPrice,
      purchasePrice: hpp,
      stock: Number(newItemStock || 0),
      minStock: Number(newItemMinStock || 10),
      unit: newItemUnit,
      unitMultiplier: 1,
      expiredDate: newItemExpiredDate,
      location: newItemLocation,
      isActive: true,
      itemType: newItemType,
      marginPct: margin,
      bhpAmount: bhp,
      ppnRate: newItemIsPpn ? 11 : 0,
      isPpnIncluded: newItemIsPpn,
      purchasePriceNonPpn: newItemIsPpn ? Math.round(hpp / 1.11) : hpp,
      purchasePriceIncPpn: newItemIsPpn ? hpp : Math.round(hpp * 1.11),
      priceNonPpn: newItemIsPpn ? Math.round(computedSellingPrice / 1.11) : computedSellingPrice,
      priceIncPpn: newItemIsPpn ? computedSellingPrice : Math.round(computedSellingPrice * 1.11),
    };

    const added = addMedicine(medData);
    setIsNewItemModalOpen(false);

    setSuccessMessage(
      `Berhasil menambahkan item baru "${added.name}" (${newItemType === 'obat' ? 'Obat' : 'Non-Obat'}). Harga Jual Kasir: ${formatRupiah(computedSellingPrice)}.`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 4500);
  };

  // ==========================================
  // 1. SINGLE RESTOCK STATE
  // ==========================================
  const [selectedMedId, setSelectedMedId] = useState('');
  const [singleAmount, setSingleAmount] = useState<number>(10);
  const [singleNote, setSingleNote] = useState('');
  const [singleTaxType, setSingleTaxType] = useState<'PPN' | 'NON_PPN'>('PPN');
  const [singlePurchasePrice, setSinglePurchasePrice] = useState<number>(0);
  const [singleBhpAmount, setSingleBhpAmount] = useState<number>(0);
  const [singleMarginPct, setSingleMarginPct] = useState<number>(20);
  const [singleSellingPrice, setSingleSellingPrice] = useState<number>(0);

  // Update Single Restock Defaults when medicine is selected
  useEffect(() => {
    if (selectedMedId) {
      const targetMed = medicines.find(m => m.id === selectedMedId);
      if (targetMed) {
        const isPpn = (targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0;
        const tax = isPpn ? 'PPN' : 'NON_PPN';
        setSingleTaxType(tax);

        const hpp = tax === 'PPN' 
          ? (targetMed.purchasePriceIncPpn || targetMed.purchasePrice || Math.round(targetMed.price * 0.75))
          : (targetMed.purchasePriceNonPpn || targetMed.purchasePrice || Math.round(targetMed.price * 0.75));
        const bhp = targetMed.bhpAmount || 0;
        const sell = tax === 'PPN' 
          ? (targetMed.priceIncPpn || targetMed.price)
          : (targetMed.priceNonPpn || targetMed.price);

        const totalCost = hpp + bhp;
        let margin = 20;
        if (targetMed.marginPct !== undefined && targetMed.marginPct !== null) {
          margin = targetMed.marginPct;
        } else if (totalCost > 0 && sell > 0) {
          margin = Math.round(((sell - totalCost) / totalCost) * 10000) / 100;
        }

        setSinglePurchasePrice(hpp);
        setSingleBhpAmount(bhp);
        setSingleMarginPct(margin);
        setSingleSellingPrice(sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)));
      }
    }
  }, [selectedMedId, medicines]);

  // ==========================================
  // 2. BULK RESTOCK STATE
  // ==========================================
  const [bulkSupplier, setBulkSupplier] = useState('PBF Kimia Farma');
  const [bulkFakturNo, setBulkFakturNo] = useState(`FK-${getWIBDateString().replace(/-/g, '')}-01`);
  const [bulkNote, setBulkNote] = useState('Penerimaan stok rutin distributor');
  const [bulkTaxTypeGlobal, setBulkTaxTypeGlobal] = useState<'PPN' | 'NON_PPN' | 'custom'>('PPN');
  const [bulkItems, setBulkItems] = useState<BulkRestockItem[]>([]);

  // Category Quick Batch Modal State
  const [categoryBatchModal, setCategoryBatchModal] = useState<{
    isOpen: boolean;
    selectedCategory: string;
    addQty: number;
    taxType: 'PPN' | 'NON_PPN';
  }>({
    isOpen: false,
    selectedCategory: 'Obat Keras',
    addQty: 10,
    taxType: 'PPN',
  });

  // Initialize Bulk Restock Items
  useEffect(() => {
    if (bulkItems.length === 0 && medicines.length > 0) {
      const activeMeds = medicines.filter(m => m.isActive);
      const ppnMeds = activeMeds.filter(m => (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0);
      const nonPpnMeds = activeMeds.filter(m => !m.isPpnIncluded || m.ppnRate === 0);

      const items: BulkRestockItem[] = [];

      // Add up to 2 PPN items
      ppnMeds.slice(0, 2).forEach((m, idx) => {
        const hpp = m.purchasePriceIncPpn || m.purchasePrice || Math.round(m.price * 0.75);
        const bhp = m.bhpAmount || 0;
        const totalCost = hpp + bhp;
        const sell = m.priceIncPpn || m.price;
        const margin = m.marginPct !== undefined && m.marginPct !== null
          ? m.marginPct
          : (totalCost > 0 && sell > 0 ? Math.round(((sell - totalCost) / totalCost) * 10000) / 100 : 20);

        items.push({
          id: `init-ppn-${idx}-${Date.now()}`,
          medicineId: m.id,
          amount: 10,
          note: 'Restock Faktur PPN 11%',
          taxType: 'PPN',
          purchasePrice: hpp,
          bhpAmount: bhp,
          marginPct: margin,
          sellingPrice: sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)),
          updateMedicineMaster: true,
        });
      });

      // Add up to 2 Non-PPN items
      nonPpnMeds.slice(0, 2).forEach((m, idx) => {
        const hpp = m.purchasePriceNonPpn || m.purchasePrice || Math.round(m.price * 0.75);
        const bhp = m.bhpAmount || 0;
        const totalCost = hpp + bhp;
        const sell = m.priceNonPpn || m.price;
        const margin = m.marginPct !== undefined && m.marginPct !== null
          ? m.marginPct
          : (totalCost > 0 && sell > 0 ? Math.round(((sell - totalCost) / totalCost) * 10000) / 100 : 20);

        items.push({
          id: `init-nonppn-${idx}-${Date.now()}`,
          medicineId: m.id,
          amount: 10,
          note: 'Pembelian Nota Non-PPN',
          taxType: 'NON_PPN',
          purchasePrice: hpp,
          bhpAmount: bhp,
          marginPct: margin,
          sellingPrice: sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)),
          updateMedicineMaster: true,
        });
      });

      if (items.length > 0) {
        setBulkItems(items);
      }
    }
  }, [medicines]);

  // ==========================================
  // 3. SINGLE OPNAME STATE
  // ==========================================
  const [adjMedId, setAdjMedId] = useState('');
  const [newStock, setNewStock] = useState<number>(0);
  const [adjNote, setAdjNote] = useState('');

  // ==========================================
  // 4. BULK OPNAME STATE
  // ==========================================
  const [bulkOpnameData, setBulkOpnameData] = useState<Record<string, BulkOpnameState>>({});
  const [opnameLocationFilter, setOpnameLocationFilter] = useState('all');
  const [opnameSearchTerm, setOpnameSearchTerm] = useState('');
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const [globalOpnameNote, setGlobalOpnameNote] = useState('Stok opnam fisik berkala');

  // Modal confirmation for Bulk Opname
  const [opnameConfirmModal, setOpnameConfirmModal] = useState<{
    isOpen: boolean;
    itemsToAdjust: {
      medicineId: string;
      name: string;
      code: string;
      unit: string;
      category: string;
      prevStock: number;
      newStock: number;
      diff: number;
      note: string;
    }[];
  }>({ isOpen: false, itemsToAdjust: [] });

  // Maintain Bulk Opname Data
  useEffect(() => {
    setBulkOpnameData(prev => {
      const next = { ...prev };
      let changed = false;
      medicines.forEach(m => {
        if (next[m.id] === undefined) {
          next[m.id] = { physicalStock: m.stock, note: '' };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [medicines]);

  // Dedicated History Search & Tax Filter States
  const [restockHistorySearch, setRestockHistorySearch] = useState('');
  const [opnameHistorySearch, setOpnameHistorySearch] = useState('');
  const [bulkViewTaxFilter, setBulkViewTaxFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<string>('all');
  const [singleTaxFilter, setSingleTaxFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');
  const [opnameTaxFilter, setOpnameTaxFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');
  const [restockHistoryTaxFilter, setRestockHistoryTaxFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');
  const [opnameHistoryTaxFilter, setOpnameHistoryTaxFilter] = useState<'all' | 'PPN' | 'NON_PPN'>('all');

  // Opname Item Type Filters (Obat vs Non-Obat Separation)
  const [opnameItemTypeFilter, setOpnameItemTypeFilter] = useState<'all' | 'obat' | 'non_obat'>('all');
  const [opnameHistoryItemTypeFilter, setOpnameHistoryItemTypeFilter] = useState<'all' | 'obat' | 'non_obat'>('all');

  // Pagination States
  const ITEMS_PER_PAGE = 10;
  const [restockHistoryPage, setRestockHistoryPage] = useState(1);
  const [opnameMedicinesPage, setOpnameMedicinesPage] = useState(1);
  const [opnameHistoryPage, setOpnameHistoryPage] = useState(1);

  // Auto-reset pagination pages on filter changes
  useEffect(() => {
    setRestockHistoryPage(1);
  }, [restockHistorySearch, restockHistoryTaxFilter, restockItemType]);

  useEffect(() => {
    setOpnameMedicinesPage(1);
  }, [opnameSearchTerm, opnameCategoryFilter, opnameLocationFilter, opnameTaxFilter, opnameItemTypeFilter, showOnlyDiff, activeSubTab]);

  useEffect(() => {
    setOpnameHistoryPage(1);
  }, [opnameHistorySearch, opnameHistoryTaxFilter, opnameHistoryItemTypeFilter]);

  // States for Bulk Opname by Category Inputs
  const [bulkOpnameStockVal, setBulkOpnameStockVal] = useState<string>('');
  const [bulkOpnameNoteVal, setBulkOpnameNoteVal] = useState<string>('');

  // Helper function to reliably detect if a history log is PPN vs Non-PPN
  const getHistoryIsPpn = React.useCallback((sh: StockHistory) => {
    if (sh.taxType === 'PPN') return true;
    if (sh.taxType === 'NON_PPN') return false;
    if (sh.note && sh.note.includes('NON_PPN')) return false;
    if (sh.note && (sh.note.includes('RESTOCK PPN') || sh.note.includes('Faktur PPN') || sh.note.includes('Tax: PPN'))) return true;
    const med = medicines.find(m => m.id === sh.medicineId);
    if (med) {
      return (med.isPpnIncluded ?? true) && (med.ppnRate ?? 11) > 0;
    }
    return true;
  }, [medicines]);

  // ==========================================
  // HANDLERS: SINGLE RESTOCK
  // ==========================================
  const handleSingleMedicineSelect = (medId: string) => {
    setSelectedMedId(medId);
    const medObj = medicines.find(m => m.id === medId);
    if (medObj) {
      const isPpn = (medObj.isPpnIncluded ?? true) && (medObj.ppnRate ?? 11) > 0;
      const tax = isPpn ? 'PPN' : 'NON_PPN';
      setSingleTaxType(tax);

      const hpp = tax === 'PPN' 
        ? (medObj.purchasePriceIncPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75))
        : (medObj.purchasePriceNonPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75));
      const bhp = medObj.bhpAmount || 0;
      const sell = tax === 'PPN' 
        ? (medObj.priceIncPpn || medObj.price)
        : (medObj.priceNonPpn || medObj.price);

      const totalCost = hpp + bhp;
      let margin = medObj.marginPct !== undefined && medObj.marginPct !== null ? medObj.marginPct : 20;
      if (totalCost > 0 && sell > 0 && medObj.marginPct === undefined) {
        margin = Math.round(((sell - totalCost) / totalCost) * 10000) / 100;
      }

      setSinglePurchasePrice(hpp);
      setSingleBhpAmount(bhp);
      setSingleMarginPct(margin);
      setSingleSellingPrice(sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)));
    }
  };

  const handleSingleTaxToggle = (tax: 'PPN' | 'NON_PPN') => {
    setSingleTaxType(tax);
    const medObj = medicines.find(m => m.id === selectedMedId);
    if (medObj) {
      const hpp = tax === 'PPN' 
        ? (medObj.purchasePriceIncPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75))
        : (medObj.purchasePriceNonPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75));
      const bhp = medObj.bhpAmount || 0;
      const sell = tax === 'PPN' 
        ? (medObj.priceIncPpn || medObj.price)
        : (medObj.priceNonPpn || medObj.price);

      const totalCost = hpp + bhp;
      let margin = medObj.marginPct !== undefined && medObj.marginPct !== null ? medObj.marginPct : 20;

      setSinglePurchasePrice(hpp);
      setSingleBhpAmount(bhp);
      setSingleMarginPct(margin);
      setSingleSellingPrice(sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)));
    }
  };

  const handleSingleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId) {
      setErrorMessage('Mohon pilih obat terlebih dahulu.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (singleAmount <= 0) {
      setErrorMessage('Jumlah stok masuk harus lebih dari 0.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const targetMed = medicines.find(m => m.id === selectedMedId);
    if (!targetMed) return;

    const mult = targetMed.unit === 'Lusin' ? 12 : (targetMed.unitMultiplier || 1);
    const totalPcsAdded = singleAmount * mult;

    // Evaluate tax classification on form submit
    const isPpn = singleTaxType === 'PPN' || ((targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0);
    const computedTaxType: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';
    
    // Calculations
    const hpp = singlePurchasePrice;
    const bhp = singleBhpAmount;
    const totalCost = hpp + bhp;
    const sell = singleSellingPrice;
    const marginPct = singleMarginPct;
    const ppnAmountPerUnit = isPpn ? Math.round(hpp - hpp / 1.11) : 0;

    const fullNote = `[RESTOCK ${computedTaxType}] ${singleNote || 'Stok masuk manual'} | Qty: ${singleAmount} ${targetMed.unit || 'unit'}${mult > 1 ? ` (${totalPcsAdded} pcs)` : ''} | HPP: ${formatRupiah(hpp)}${bhp > 0 ? ` + BHP: ${formatRupiah(bhp)}` : ''} | Margin: ${marginPct}% | Jual: ${formatRupiah(sell)}`;

    addStock(selectedMedId, totalPcsAdded, fullNote, {
      taxType: computedTaxType,
      purchasePrice: hpp,
      bhpAmount: bhp,
      sellingPrice: sell,
      ppnAmount: ppnAmountPerUnit * totalPcsAdded,
      marginPct,
      updateMedicineMaster: true,
    });

    setSuccessMessage(
      `Berhasil menambahkan +${singleAmount} ${targetMed.unit || 'unit'}${mult > 1 ? ` (${totalPcsAdded} pcs)` : ''} stok (${computedTaxType}) untuk "${targetMed.name}"! Margin Laba: ${marginPct}%.`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 4000);

    setSelectedMedId('');
    setSingleAmount(10);
    setSingleNote('');
  };

  // ==========================================
  // HANDLERS: BULK RESTOCK
  // ==========================================
  const handleSwitchBulkTaxFilter = (filter: 'all' | 'PPN' | 'NON_PPN') => {
    setBulkViewTaxFilter(filter);
    if (filter === 'NON_PPN') {
      const hasNonPpn = bulkItems.some(item => item.taxType === 'NON_PPN');
      if (!hasNonPpn) {
        const nonPpnMeds = medicines.filter(m => m.isActive && (!m.isPpnIncluded || m.ppnRate === 0));
        if (nonPpnMeds.length > 0) {
          const newNonPpnItems: BulkRestockItem[] = nonPpnMeds.map((m, idx) => ({
            id: `bulk-auto-nonppn-${m.id}-${idx}-${Date.now()}`,
            medicineId: m.id,
            amount: 10,
            note: 'Pembelian Nota Non-PPN',
            taxType: 'NON_PPN',
            purchasePrice: m.purchasePriceNonPpn || m.purchasePrice || Math.round(m.price * 0.75),
            sellingPrice: m.priceNonPpn || m.price,
            updateMedicineMaster: true,
          }));
          setBulkItems(prev => [...prev, ...newNonPpnItems]);
        }
      }
    } else if (filter === 'PPN') {
      const hasPpn = bulkItems.some(item => item.taxType === 'PPN');
      if (!hasPpn) {
        const ppnMeds = medicines.filter(m => m.isActive && (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0);
        if (ppnMeds.length > 0) {
          const newPpnItems: BulkRestockItem[] = ppnMeds.map((m, idx) => ({
            id: `bulk-auto-ppn-${m.id}-${idx}-${Date.now()}`,
            medicineId: m.id,
            amount: 10,
            note: 'Restock Faktur PPN 11%',
            taxType: 'PPN',
            purchasePrice: m.purchasePriceIncPpn || m.purchasePrice || Math.round(m.price * 0.75),
            sellingPrice: m.priceIncPpn || m.price,
            updateMedicineMaster: true,
          }));
          setBulkItems(prev => [...prev, ...newPpnItems]);
        }
      }
    }
  };

  const handleAddBulkRow = () => {
    let candidateMeds = medicines.filter(m => m.isActive);

    if (bulkCategoryFilter !== 'all') {
      const catMeds = candidateMeds.filter(m => m.category === bulkCategoryFilter);
      if (catMeds.length > 0) candidateMeds = catMeds;
    }

    if (bulkViewTaxFilter === 'NON_PPN') {
      const nonPpnList = candidateMeds.filter(m => !m.isPpnIncluded || m.ppnRate === 0);
      if (nonPpnList.length > 0) candidateMeds = nonPpnList;
    } else if (bulkViewTaxFilter === 'PPN') {
      const ppnList = candidateMeds.filter(m => (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0);
      if (ppnList.length > 0) candidateMeds = ppnList;
    }

    const unselectedMed = candidateMeds.find(
      m => !bulkItems.some(item => item.medicineId === m.id)
    ) || candidateMeds[0] || medicines[0];

    if (!unselectedMed) return;

    const actualTax: 'PPN' | 'NON_PPN' = bulkViewTaxFilter === 'NON_PPN' ? 'NON_PPN' : (bulkViewTaxFilter === 'PPN' ? 'PPN' : (((unselectedMed.isPpnIncluded ?? true) && (unselectedMed.ppnRate ?? 11) > 0) ? 'PPN' : 'NON_PPN'));
    const hpp = actualTax === 'NON_PPN' ? (unselectedMed.purchasePriceNonPpn || unselectedMed.purchasePrice || Math.round(unselectedMed.price * 0.75)) : (unselectedMed.purchasePriceIncPpn || unselectedMed.purchasePrice || Math.round(unselectedMed.price * 0.75));
    const bhp = unselectedMed.bhpAmount || 0;
    const totalCost = hpp + bhp;
    const sell = actualTax === 'NON_PPN' ? (unselectedMed.priceNonPpn || unselectedMed.price) : (unselectedMed.priceIncPpn || unselectedMed.price);
    const margin = unselectedMed.marginPct !== undefined && unselectedMed.marginPct !== null
      ? unselectedMed.marginPct
      : (totalCost > 0 && sell > 0 ? Math.round(((sell - totalCost) / totalCost) * 10000) / 100 : 20);

    setBulkItems(prev => [
      ...prev,
      {
        id: `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        medicineId: unselectedMed.id,
        amount: 10,
        note: bulkCategoryFilter !== 'all' ? `Restock Kategori ${unselectedMed.category}` : '',
        taxType: actualTax,
        purchasePrice: hpp,
        bhpAmount: bhp,
        marginPct: margin,
        sellingPrice: sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)),
        updateMedicineMaster: true,
      },
    ]);
  };

  // Category Quick Action: Load All Medicines in a Category
  const handleAddCategoryMedsToBulk = (catName: string) => {
    setBulkCategoryFilter(catName);
    let filteredMeds = medicines.filter(
      m => m.isActive && (catName === 'all' || m.category === catName)
    );

    if (bulkViewTaxFilter === 'PPN') {
      filteredMeds = filteredMeds.filter(m => (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0);
    } else if (bulkViewTaxFilter === 'NON_PPN') {
      filteredMeds = filteredMeds.filter(m => !m.isPpnIncluded || m.ppnRate === 0);
    }

    if (filteredMeds.length === 0) {
      const taxLabel = bulkViewTaxFilter === 'PPN' ? ' (Khusus PPN 11%)' : bulkViewTaxFilter === 'NON_PPN' ? ' (Khusus Non-PPN)' : '';
      setErrorMessage(`Tidak ada sediaan obat aktif${taxLabel} pada kategori "${catName}".`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const newItems: BulkRestockItem[] = filteredMeds.map((m, idx) => {
      const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
      const tax: 'PPN' | 'NON_PPN' = bulkViewTaxFilter === 'NON_PPN' ? 'NON_PPN' : (bulkViewTaxFilter === 'PPN' ? 'PPN' : (isPpn ? 'PPN' : 'NON_PPN'));
      const hpp = tax === 'NON_PPN' ? (m.purchasePriceNonPpn || m.purchasePrice || Math.round(m.price * 0.75)) : (m.purchasePriceIncPpn || m.purchasePrice || Math.round(m.price * 0.75));
      const bhp = m.bhpAmount || 0;
      const totalCost = hpp + bhp;
      const sell = tax === 'NON_PPN' ? (m.priceNonPpn || m.price) : (m.priceIncPpn || m.price);
      const margin = m.marginPct !== undefined && m.marginPct !== null
        ? m.marginPct
        : (totalCost > 0 && sell > 0 ? Math.round(((sell - totalCost) / totalCost) * 10000) / 100 : 20);

      return {
        id: `bulk-cat-${m.id}-${idx}-${Date.now()}`,
        medicineId: m.id,
        amount: 10,
        note: `Restock Kategori ${m.category}`,
        taxType: tax,
        purchasePrice: hpp,
        bhpAmount: bhp,
        marginPct: margin,
        sellingPrice: sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)),
        updateMedicineMaster: true,
      };
    });

    setBulkItems(newItems);
    const taxLabel = bulkViewTaxFilter === 'PPN' ? ' (Faktur PPN 11%)' : bulkViewTaxFilter === 'NON_PPN' ? ' (Nota Non-PPN)' : '';
    setSuccessMessage(`Berhasil memuat ${newItems.length} sediaan obat${taxLabel} dari kategori "${catName === 'all' ? 'Semua Kategori' : catName}" ke tabel Restock.`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);
  };

  const handleApplyGlobalTaxTypeToBulk = (tax: 'PPN' | 'NON_PPN') => {
    setBulkTaxTypeGlobal(tax);
    setBulkItems(prev =>
      prev.map(it => {
        const medObj = medicines.find(m => m.id === it.medicineId);
        const hpp = tax === 'NON_PPN' ? (medObj?.purchasePriceNonPpn || it.purchasePrice) : (medObj?.purchasePriceIncPpn || it.purchasePrice);
        const sell = tax === 'NON_PPN' ? (medObj?.priceNonPpn || it.sellingPrice) : (medObj?.priceIncPpn || it.sellingPrice);
        return {
          ...it,
          taxType: tax,
          purchasePrice: hpp,
          sellingPrice: sell,
        };
      })
    );
  };

  const handleRemoveBulkRow = (id: string) => {
    setBulkItems(prev => prev.filter(item => item.id !== id));
  };

  const handleBulkRestockItemChange = (
    id: string,
    field: keyof BulkRestockItem,
    value: any
  ) => {
    setBulkItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        // If medicineId changed, auto update default prices & tax type from master
        if (field === 'medicineId') {
          const medObj = medicines.find(m => m.id === value);
          if (medObj) {
            const isPpn = (medObj.isPpnIncluded ?? true) && (medObj.ppnRate ?? 11) > 0;
            const tax: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';
            const hpp = tax === 'NON_PPN' ? (medObj.purchasePriceNonPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75)) : (medObj.purchasePriceIncPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75));
            const bhp = medObj.bhpAmount || 0;
            const totalCost = hpp + bhp;
            const sell = tax === 'NON_PPN' ? (medObj.priceNonPpn || medObj.price) : (medObj.priceIncPpn || medObj.price);
            const margin = medObj.marginPct !== undefined && medObj.marginPct !== null
              ? medObj.marginPct
              : (totalCost > 0 && sell > 0 ? Math.round(((sell - totalCost) / totalCost) * 10000) / 100 : 20);

            return {
              ...item,
              medicineId: value,
              taxType: tax,
              purchasePrice: hpp,
              bhpAmount: bhp,
              marginPct: margin,
              sellingPrice: sell > 0 ? sell : Math.round(totalCost * (1 + margin / 100)),
            };
          }
        }

        const updated = { ...item, [field]: value };

        // Auto recalculate selling price or margin percentage
        if (field === 'purchasePrice' || field === 'bhpAmount' || field === 'marginPct') {
          const hpp = Number(field === 'purchasePrice' ? value : item.purchasePrice || 0);
          const bhp = Number(field === 'bhpAmount' ? value : item.bhpAmount || 0);
          const margin = Number(field === 'marginPct' ? value : item.marginPct || 0);
          const totalCost = hpp + bhp;
          updated.sellingPrice = Math.round(totalCost * (1 + margin / 100));
        } else if (field === 'sellingPrice') {
          const hpp = Number(item.purchasePrice || 0);
          const bhp = Number(item.bhpAmount || 0);
          const totalCost = hpp + bhp;
          const sell = Number(value || 0);
          if (totalCost > 0) {
            updated.marginPct = Math.round(((sell - totalCost) / totalCost) * 10000) / 100;
          }
        }

        return updated;
      })
    );
  };

  const handleBulkRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = bulkItems.filter(item => item.medicineId && item.amount > 0);

    if (validItems.length === 0) {
      setErrorMessage('Mohon isi minimal 1 item obat dengan jumlah stok masuk > 0.');
      setTimeout(() => setErrorMessage(''), 3500);
      return;
    }

    const fullBatchHeader = `[BULK RESTOCK] Distributor: ${bulkSupplier} | Faktur: ${bulkFakturNo} ${bulkNote ? '| ' + bulkNote : ''}`;

    const itemsToAdd = validItems.map(item => {
      const targetMed = medicines.find(m => m.id === item.medicineId);
      const mult = targetMed ? (targetMed.unit === 'Lusin' ? 12 : (targetMed.unitMultiplier || 1)) : 1;
      const totalPcsAdded = Number(item.amount) * mult;

      // Determine tax classification on form submit based on item selection or medicine master data
      const isPpn = item.taxType === 'PPN' || (targetMed ? ((targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0) : true);
      const computedTaxType: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';

      const hpp = item.purchasePrice;
      const bhp = item.bhpAmount || 0;
      const sell = item.sellingPrice;
      const ppnAmountPerUnit = isPpn ? Math.round(hpp - hpp / 1.11) : 0;
      const marginPct = item.marginPct;

      const itemNote = `${fullBatchHeader} [Tax: ${computedTaxType} | Qty: ${item.amount} ${targetMed?.unit || 'unit'}${mult > 1 ? ` (${totalPcsAdded} pcs)` : ''} | HPP: ${formatRupiah(hpp)}${bhp > 0 ? ` + BHP: ${formatRupiah(bhp)}` : ''} | Jual: ${formatRupiah(sell)} | Margin: ${marginPct}%] ${item.note ? ' - ' + item.note : ''}`;

      return {
        medicineId: item.medicineId,
        amount: totalPcsAdded,
        note: itemNote,
        taxType: computedTaxType,
        purchasePrice: hpp,
        bhpAmount: bhp,
        sellingPrice: sell,
        ppnAmount: ppnAmountPerUnit * totalPcsAdded,
        marginPct,
        updateMedicineMaster: item.updateMedicineMaster,
      };
    });

    bulkAddStock(itemsToAdd);

    const totalQty = itemsToAdd.reduce((acc, curr) => acc + curr.amount, 0);

    setSuccessMessage(
      `Berhasil memproses Bulk Restock! Total ${itemsToAdd.length} jenis obat (${totalQty} unit) telah ditambahkan ke stok apotek.`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 4500);

    // Reset Form
    if (medicines.length > 0) {
      const m1 = medicines[0];
      setBulkItems([
        {
          id: '1',
          medicineId: m1.id,
          amount: 10,
          note: '',
          taxType: m1.isPpnIncluded ? 'PPN' : 'NON_PPN',
          purchasePrice: m1.purchasePrice || Math.round(m1.price * 0.75),
          sellingPrice: m1.price,
          updateMedicineMaster: true,
        },
      ]);
    }
  };

  // Calculate Live Bulk Margin & Tax Metrics (filtered dynamically by bulkViewTaxFilter and bulkCategoryFilter tabs)
  const bulkMetrics = React.useMemo(() => {
    let ppnItemCount = 0;
    let nonPpnItemCount = 0;

    bulkItems.forEach(it => {
      const medObj = medicines.find(m => m.id === it.medicineId);
      const matchCategory = bulkCategoryFilter === 'all' || (medObj && medObj.category === bulkCategoryFilter);
      if (matchCategory) {
        if (it.taxType === 'PPN') ppnItemCount++;
        else nonPpnItemCount++;
      }
    });

    const displayItems = bulkItems.filter(it => {
      const medObj = medicines.find(m => m.id === it.medicineId);
      const matchCategory = bulkCategoryFilter === 'all' || (medObj && medObj.category === bulkCategoryFilter);
      if (!matchCategory) return false;
      if (bulkViewTaxFilter === 'PPN') return it.taxType === 'PPN';
      if (bulkViewTaxFilter === 'NON_PPN') return it.taxType === 'NON_PPN';
      return true;
    });

    let totalItems = displayItems.length;
    let totalQty = 0;
    let totalHppCost = 0;
    let totalPpnInput = 0;
    let totalExpectedRevenue = 0;

    displayItems.forEach(it => {
      const qty = Number(it.amount || 0);
      const hpp = Number(it.purchasePrice || 0);
      const sell = Number(it.sellingPrice || 0);
      const isPpn = it.taxType === 'PPN';

      const itemCost = hpp * qty;
      const itemRev = sell * qty;
      const itemPpn = isPpn ? Math.round(hpp - hpp / 1.11) * qty : 0;

      totalQty += qty;
      totalHppCost += itemCost;
      totalExpectedRevenue += itemRev;
      totalPpnInput += itemPpn;
    });

    const totalGrossProfit = totalExpectedRevenue - totalHppCost;
    const avgMarginPct =
      totalExpectedRevenue > 0
        ? Math.round((totalGrossProfit / totalExpectedRevenue) * 10000) / 100
        : 0;
    const avgMarkupPct =
      totalHppCost > 0
        ? Math.round((totalGrossProfit / totalHppCost) * 10000) / 100
        : 0;

    return {
      totalItems,
      totalQty,
      totalHppCost,
      totalPpnInput,
      totalExpectedRevenue,
      totalGrossProfit,
      avgMarginPct,
      avgMarkupPct,
      ppnItemCount,
      nonPpnItemCount,
    };
  }, [bulkItems, bulkViewTaxFilter, bulkCategoryFilter, medicines]);

  // ==========================================
  // HANDLERS: OPNAME
  // ==========================================
  const handleSingleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjMedId) {
      setErrorMessage('Mohon pilih obat terlebih dahulu.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const targetMed = medicines.find(m => m.id === adjMedId);
    adjustStock(adjMedId, Number(newStock), adjNote || 'Penyesuaian stok opnam');

    setSuccessMessage(
      `Penyesuaian stok opnam untuk "${targetMed?.name || 'Obat'}" berhasil disimpan (Stok fisik baru: ${newStock}).`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);

    setAdjMedId('');
    setNewStock(0);
    setAdjNote('');
  };

  const handlePhysicalStockChange = (medId: string, val: string) => {
    setBulkOpnameData(prev => ({
      ...prev,
      [medId]: {
        ...prev[medId],
        physicalStock: val === '' ? '' : Math.max(0, Number(val)),
      },
    }));
  };

  const handleOpnameRowNoteChange = (medId: string, noteVal: string) => {
    setBulkOpnameData(prev => ({
      ...prev,
      [medId]: {
        ...prev[medId],
        note: noteVal,
      },
    }));
  };

  const handleBulkOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const changedMedicines = medicines
      .map(m => {
        const data = bulkOpnameData[m.id];
        const rawPhys = data?.physicalStock;
        const physNum =
          rawPhys === undefined || rawPhys === '' || isNaN(Number(rawPhys))
            ? m.stock
            : Number(rawPhys);
        const diff = physNum - m.stock;
        return {
          medicineId: m.id,
          name: m.name,
          code: m.code,
          unit: m.unit,
          category: m.category,
          prevStock: m.stock,
          newStock: physNum,
          diff,
          note: data?.note || '',
        };
      })
      .filter(item => item.diff !== 0);

    if (changedMedicines.length === 0) {
      setErrorMessage('Tidak ada perubahan stok fisik yang perlu disesuaikan.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    setOpnameConfirmModal({
      isOpen: true,
      itemsToAdjust: changedMedicines,
    });
  };

  const handleConfirmBulkOpnameSave = () => {
    const adjustments = opnameConfirmModal.itemsToAdjust.map(item => ({
      medicineId: item.medicineId,
      newStock: item.newStock,
      note: `[BULK OPNAME] ${globalOpnameNote} ${item.note ? '- ' + item.note : ''}`.trim(),
    }));

    bulkAdjustStock(adjustments);

    setBulkOpnameData(prev => {
      const next = { ...prev };
      adjustments.forEach(adj => {
        if (next[adj.medicineId]) {
          next[adj.medicineId] = {
            physicalStock: adj.newStock,
            note: '',
          };
        }
      });
      return next;
    });

    setOpnameConfirmModal({ isOpen: false, itemsToAdjust: [] });
    setSuccessMessage(
      `Bulk Stok Opnam Berhasil! ${adjustments.length} sediaan obat telah disesuaikan dengan stok fisik.`
    );
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 4500);
  };

  // Bulk Opname by Category Handlers
  const handleSetOpnameMatchSystemByCategory = (catName: string) => {
    const targetMeds = medicines.filter(
      m => m.isActive && (catName === 'all' || m.category === catName)
    );
    if (targetMeds.length === 0) {
      setErrorMessage(`Tidak ada sediaan obat pada kategori "${catName}".`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setBulkOpnameData(prev => {
      const next = { ...prev };
      targetMeds.forEach(m => {
        next[m.id] = {
          ...next[m.id],
          physicalStock: m.stock,
        };
      });
      return next;
    });

    const catLabel = catName === 'all' ? 'Semua Kategori' : catName;
    setSuccessMessage(`Stok fisik ${targetMeds.length} obat pada kategori "${catLabel}" telah disamakan dengan stok sistem.`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);
  };

  const handleApplyBulkOpnameStockByCategory = (catName: string, value: string) => {
    if (value === '' || isNaN(Number(value))) {
      setErrorMessage('Masukkan angka stok fisik yang valid.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const targetMeds = medicines.filter(
      m => m.isActive && (catName === 'all' || m.category === catName)
    );
    if (targetMeds.length === 0) {
      setErrorMessage(`Tidak ada sediaan obat pada kategori "${catName}".`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const numVal = Math.max(0, Number(value));
    setBulkOpnameData(prev => {
      const next = { ...prev };
      targetMeds.forEach(m => {
        next[m.id] = {
          ...next[m.id],
          physicalStock: numVal,
        };
      });
      return next;
    });

    const catLabel = catName === 'all' ? 'Semua Kategori' : catName;
    setSuccessMessage(`Stok fisik ${targetMeds.length} obat pada kategori "${catLabel}" berhasil diubah masal menjadi ${numVal}.`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);
  };

  const handleApplyBulkOpnameNoteByCategory = (catName: string, noteText: string) => {
    if (!noteText.trim()) {
      setErrorMessage('Masukkan catatan penyesuaian.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const targetMeds = medicines.filter(
      m => m.isActive && (catName === 'all' || m.category === catName)
    );
    if (targetMeds.length === 0) {
      setErrorMessage(`Tidak ada sediaan obat pada kategori "${catName}".`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setBulkOpnameData(prev => {
      const next = { ...prev };
      targetMeds.forEach(m => {
        next[m.id] = {
          ...next[m.id],
          note: noteText,
        };
      });
      return next;
    });

    const catLabel = catName === 'all' ? 'Semua Kategori' : catName;
    setSuccessMessage(`Catatan untuk ${targetMeds.length} obat pada kategori "${catLabel}" berhasil diperbarui.`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);
  };

  // Filtered lists
  const uniqueCategories: MedicineCategory[] = [
    'Obat Keras',
    'Obat Bebas',
    'Obat Bebas Terbatas',
    'Jamu & Herbal',
    'Alat Kesehatan',
    'Suplemen & Vitamin',
    'Barang Umum',
    'Perawatan & Kosmetik',
    'Makanan & Minuman',
    'Lainnya',
  ];

  const uniqueLocations = Array.from(
    new Set(medicines.map(m => m.location).filter(Boolean))
  ).sort();

  // Restock History Summary Stats (PPN vs Non-PPN) - filtered by restockItemType (Obat vs Non-Obat)
  const allRestockLogs = React.useMemo(() => stockHistory.filter(sh => {
    if (sh.type !== 'masuk') return false;
    const med = medicines.find(m => m.id === sh.medicineId);
    const itemType = sh.itemType || med?.itemType || 'obat';
    if (restockItemType === 'obat') return itemType === 'obat';
    if (restockItemType === 'non_obat') return itemType === 'non_obat';
    return true;
  }), [stockHistory, medicines, restockItemType]);
  
  const ppnRestockLogs = React.useMemo(() => allRestockLogs.filter(sh => getHistoryIsPpn(sh)), [allRestockLogs, getHistoryIsPpn]);

  const nonPpnRestockLogs = React.useMemo(() => allRestockLogs.filter(sh => !getHistoryIsPpn(sh)), [allRestockLogs, getHistoryIsPpn]);

  const restockPpnStats = React.useMemo(() => {
    let totalTrx = ppnRestockLogs.length;
    let totalQty = 0;
    let totalHppCost = 0;
    let totalPpnInput = 0;

    ppnRestockLogs.forEach(sh => {
      const qty = sh.amount || 0;
      const med = medicines.find(m => m.id === sh.medicineId);
      const hpp = sh.purchasePrice || (med?.purchasePrice || (med?.price ? Math.round(med.price * 0.75) : 0));
      const ppnUnit = sh.ppnAmount ? sh.ppnAmount / (qty || 1) : Math.round(hpp - hpp / 1.11);
      totalQty += qty;
      totalHppCost += hpp * qty;
      totalPpnInput += sh.ppnAmount || (ppnUnit * qty);
    });

    return { totalTrx, totalQty, totalHppCost, totalPpnInput };
  }, [ppnRestockLogs, medicines]);

  const restockNonPpnStats = React.useMemo(() => {
    let totalTrx = nonPpnRestockLogs.length;
    let totalQty = 0;
    let totalHppCost = 0;

    nonPpnRestockLogs.forEach(sh => {
      const qty = sh.amount || 0;
      const med = medicines.find(m => m.id === sh.medicineId);
      const hpp = sh.purchasePrice || (med?.purchasePrice || (med?.price ? Math.round(med.price * 0.75) : 0));
      totalQty += qty;
      totalHppCost += hpp * qty;
    });

    return { totalTrx, totalQty, totalHppCost };
  }, [nonPpnRestockLogs, medicines]);

  const handleResetAllOpnameToSystem = () => {
    setBulkOpnameData(prev => {
      const resetData: Record<string, BulkOpnameState> = {};
      medicines.forEach(m => {
        resetData[m.id] = { physicalStock: m.stock, note: '' };
      });
      return resetData;
    });
    setSuccessMessage('Semua input stok opnam fisik berhasil di-reset disamakan dengan stok sistem.');
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3500);
  };

  // Opnam Physical Stats (PPN vs Non-PPN) - Only for active medicines filtered by opnameItemTypeFilter
  const opnameTaxStats = React.useMemo(() => {
    let ppnMedCount = 0;
    let ppnSystemStock = 0;
    let ppnPhysicalStock = 0;
    let ppnDiff = 0;

    let nonPpnMedCount = 0;
    let nonPpnSystemStock = 0;
    let nonPpnPhysicalStock = 0;
    let nonPpnDiff = 0;

    medicines.filter(m => {
      if (!m.isActive) return false;
      const medType = m.itemType || 'obat';
      if (opnameItemTypeFilter === 'obat' && medType !== 'obat') return false;
      if (opnameItemTypeFilter === 'non_obat' && medType !== 'non_obat') return false;
      return true;
    }).forEach(m => {
      const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
      const rawPhys = bulkOpnameData[m.id]?.physicalStock;
      const physNum = rawPhys === undefined || rawPhys === '' || isNaN(Number(rawPhys)) ? m.stock : Number(rawPhys);
      const diff = physNum - m.stock;

      if (isPpn) {
        ppnMedCount++;
        ppnSystemStock += m.stock;
        ppnPhysicalStock += physNum;
        ppnDiff += diff;
      } else {
        nonPpnMedCount++;
        nonPpnSystemStock += m.stock;
        nonPpnPhysicalStock += physNum;
        nonPpnDiff += diff;
      }
    });

    return {
      ppnMedCount, ppnSystemStock, ppnPhysicalStock, ppnDiff,
      nonPpnMedCount, nonPpnSystemStock, nonPpnPhysicalStock, nonPpnDiff
    };
  }, [medicines, bulkOpnameData, opnameItemTypeFilter]);

  // Opnam Log Stats (PPN vs Non-PPN)
  const allOpnameLogs = React.useMemo(() => stockHistory.filter(sh => {
    if (sh.type !== 'penyesuaian') return false;
    const med = medicines.find(m => m.id === sh.medicineId);
    const itemType = sh.itemType || med?.itemType || 'obat';
    if (opnameHistoryItemTypeFilter === 'obat') return itemType === 'obat';
    if (opnameHistoryItemTypeFilter === 'non_obat') return itemType === 'non_obat';
    return true;
  }), [stockHistory, medicines, opnameHistoryItemTypeFilter]);

  const ppnOpnameLogs = React.useMemo(() => allOpnameLogs.filter(sh => getHistoryIsPpn(sh)), [allOpnameLogs, getHistoryIsPpn]);
  const nonPpnOpnameLogs = React.useMemo(() => allOpnameLogs.filter(sh => !getHistoryIsPpn(sh)), [allOpnameLogs, getHistoryIsPpn]);

  const filteredOpnameMedicines = medicines.filter(m => {
    if (!m.isActive) return false;

    const medType = m.itemType || 'obat';
    if (opnameItemTypeFilter === 'obat' && medType !== 'obat') return false;
    if (opnameItemTypeFilter === 'non_obat' && medType !== 'non_obat') return false;

    const matchesSearch =
      m.name.toLowerCase().includes(opnameSearchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(opnameSearchTerm.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(opnameSearchTerm.toLowerCase()));

    const matchesCategory = opnameCategoryFilter === 'all' || m.category === opnameCategoryFilter;
    const matchesLocation = opnameLocationFilter === 'all' || m.location === opnameLocationFilter;

    const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
    const matchesTax =
      opnameTaxFilter === 'all' ||
      (opnameTaxFilter === 'PPN' && isMedPpn) ||
      (opnameTaxFilter === 'NON_PPN' && !isMedPpn);

    const rawPhys = bulkOpnameData[m.id]?.physicalStock;
    const physNum =
      rawPhys === undefined || rawPhys === '' || isNaN(Number(rawPhys)) ? m.stock : Number(rawPhys);
    const isDiff = physNum !== m.stock;
    const matchesDiffOnly = !showOnlyDiff || isDiff;

    return matchesSearch && matchesCategory && matchesLocation && matchesTax && matchesDiffOnly;
  });

  // Filter Restock History
  const filteredRestockHistory = stockHistory.filter(sh => {
    if (sh.type !== 'masuk') return false;

    const med = medicines.find(m => m.id === sh.medicineId);
    const itemType = sh.itemType || med?.itemType || 'obat';
    if (restockItemType === 'obat' && itemType !== 'obat') return false;
    if (restockItemType === 'non_obat' && itemType !== 'non_obat') return false;

    const isPpn = getHistoryIsPpn(sh);
    if (restockHistoryTaxFilter === 'PPN' && !isPpn) return false;
    if (restockHistoryTaxFilter === 'NON_PPN' && isPpn) return false;

    const q = restockHistorySearch.toLowerCase();
    return (
      sh.medicineName.toLowerCase().includes(q) ||
      sh.medicineCode.toLowerCase().includes(q) ||
      sh.note.toLowerCase().includes(q) ||
      (sh.user && sh.user.toLowerCase().includes(q))
    );
  });

  // Filter Opname History
  const filteredOpnameHistory = stockHistory.filter(sh => {
    if (sh.type !== 'penyesuaian') return false;

    const med = medicines.find(m => m.id === sh.medicineId);
    const itemType = sh.itemType || med?.itemType || 'obat';
    if (opnameHistoryItemTypeFilter === 'obat' && itemType !== 'obat') return false;
    if (opnameHistoryItemTypeFilter === 'non_obat' && itemType !== 'non_obat') return false;

    const isPpn = getHistoryIsPpn(sh);
    if (opnameHistoryTaxFilter === 'PPN' && !isPpn) return false;
    if (opnameHistoryTaxFilter === 'NON_PPN' && isPpn) return false;

    const q = opnameHistorySearch.toLowerCase();
    return (
      sh.medicineName.toLowerCase().includes(q) ||
      sh.medicineCode.toLowerCase().includes(q) ||
      sh.note.toLowerCase().includes(q) ||
      (sh.user && sh.user.toLowerCase().includes(q))
    );
  });

  // Paginated Lists
  const paginatedRestockHistory = filteredRestockHistory.slice(
    (restockHistoryPage - 1) * ITEMS_PER_PAGE,
    restockHistoryPage * ITEMS_PER_PAGE
  );

  const paginatedOpnameMedicines = filteredOpnameMedicines.slice(
    (opnameMedicinesPage - 1) * ITEMS_PER_PAGE,
    opnameMedicinesPage * ITEMS_PER_PAGE
  );

  const paginatedOpnameHistory = filteredOpnameHistory.slice(
    (opnameHistoryPage - 1) * ITEMS_PER_PAGE,
    opnameHistoryPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Manajemen Stok Masuk, Perhitungan Margin & Opnam
            <span className="bg-blue-100 text-blue-900 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-blue-200">
              <Percent className="w-3.5 h-3.5 text-blue-700" /> PPN 11% vs Non-PPN & Margin Analysis
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Input penerimaan distributor dengan klasifikasi Faktur PPN / Nota Non-PPN, analisis detail margin laba kotor, dan atur stok berdasarkan kategori.
          </p>
        </div>
      </div>

      {/* Primary Sub Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-4 text-xs font-bold justify-between items-center pb-1">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveSubTab('masuk');
              setRestockItemType('obat');
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeSubTab === 'masuk' && restockItemType === 'obat'
                ? 'border-emerald-600 text-emerald-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            1. Stok Masuk - Obat
          </button>
          <button
            onClick={() => {
              setActiveSubTab('masuk');
              setRestockItemType('non_obat');
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeSubTab === 'masuk' && restockItemType === 'non_obat'
                ? 'border-purple-600 text-purple-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-purple-600" />
            2. Stok Masuk - Non Obat
          </button>
          <button
            onClick={() => setActiveSubTab('penyesuaian')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeSubTab === 'penyesuaian'
                ? 'border-blue-600 text-blue-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            3. Penyesuaian Stok (Stok Opnam)
          </button>
        </div>

        {activeSubTab === 'masuk' && (
          <div className="pb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => openRestockModal(restockItemType)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              ＋ Input Stok Masuk Baru (Form Dialog)
            </button>
          </div>
        )}
      </div>

      {/* Alert Success */}
      {isSuccessAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMessage}
          </div>
        </div>
      )}

      {/* Alert Error */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            {errorMessage}
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN UNIFIED: LOG & RIWAYAT STOK MASUK + BUTTON INPUT DIALOG MODAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'masuk' && (
        <div className="space-y-5">



          {/* LOG & RIWAYAT STOK MASUK UNIFIED */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <History className="w-4.5 h-4.5 text-emerald-600" />
                    Riwayat Penerimaan Stok Masuk (Terpisah PPN & Non-PPN)
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      {filteredRestockHistory.length} Transaksi
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catatan histori transaksi sediaan obat yang ditambahkan dengan rincian pemisahan Faktur PPN 11% vs Nota Non-PPN 0%.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari obat, kode, supplier..."
                    value={restockHistorySearch}
                    onChange={e => setRestockHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Ringkasan Terpisah PPN 11% vs Non-PPN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Card PPN 11% */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-4 rounded-2xl border border-blue-800/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-blue-800/80 pb-2">
                    <span className="font-extrabold text-blue-200 text-xs flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-blue-400" />
                      Ringkasan Penerimaan Faktur PPN 11%
                    </span>
                    <span className="bg-blue-800 text-blue-100 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {restockPpnStats.totalTrx} Transaksi
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[10px] text-blue-300 block">Total Qty Masuk</span>
                      <span className="font-black text-white text-base">+{restockPpnStats.totalQty}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-300 block">Nilai Pembelian HPP</span>
                      <span className="font-bold text-amber-300 text-xs">{formatRupiah(restockPpnStats.totalHppCost)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-300 block">Kredit PPN Masukan</span>
                      <span className="font-bold text-emerald-300 text-xs">{formatRupiah(restockPpnStats.totalPpnInput)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Non-PPN */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl border border-slate-700 shadow-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-extrabold text-slate-200 text-xs flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      Ringkasan Penerimaan Nota Non-PPN (0%)
                    </span>
                    <span className="bg-slate-700 text-slate-200 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {restockNonPpnStats.totalTrx} Transaksi
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Qty Masuk</span>
                      <span className="font-black text-white text-base">+{restockNonPpnStats.totalQty}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Nilai Pembelian HPP</span>
                      <span className="font-bold text-emerald-300 text-xs">{formatRupiah(restockNonPpnStats.totalHppCost)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax Filter Controls */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 font-bold shrink-0">Filter Pajak Log:</span>
                <button
                  type="button"
                  onClick={() => setRestockHistoryTaxFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                    restockHistoryTaxFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Semua Log ({allRestockLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRestockHistoryTaxFilter('PPN')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition-all border ${
                    restockHistoryTaxFilter === 'PPN'
                      ? 'bg-blue-900 text-white border-blue-800 shadow-2xs'
                      : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  🏷️ Khusus Faktur PPN 11% ({ppnRestockLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRestockHistoryTaxFilter('NON_PPN')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold transition-all border ${
                    restockHistoryTaxFilter === 'NON_PPN'
                      ? 'bg-slate-900 text-white border-slate-800 shadow-2xs'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  📦 Khusus Nota Non-PPN ({nonPpnRestockLogs.length})
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Waktu & Petugas</th>
                      <th className="py-2.5 px-3">Kode & Nama Obat</th>
                      <th className="py-2.5 px-3 text-center">Status Perpajakan</th>
                      <th className="py-2.5 px-3 text-center">Jumlah Masuk</th>
                      <th className="py-2.5 px-3 text-center">Stok (Sebelum → Sesudah)</th>
                      <th className="py-2.5 px-3">HPP & Harga Jual</th>
                      <th className="py-2.5 px-3 text-center">Margin %</th>
                      <th className="py-2.5 px-3">Distributor / Catatan Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRestockHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Belum ada riwayat penerimaan stok masuk yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      paginatedRestockHistory.map((sh, idx) => {
                        const isPpn = getHistoryIsPpn(sh);
                        const med = medicines.find(m => m.id === sh.medicineId);
                        
                        const hpp = sh.purchasePrice !== undefined && sh.purchasePrice > 0
                          ? sh.purchasePrice
                          : (med?.purchasePrice || (med?.price ? Math.round(med.price * 0.75) : 0));
                          
                        const sell = sh.sellingPrice !== undefined && sh.sellingPrice > 0
                          ? sh.sellingPrice
                          : (med?.price || 0);
                          
                        const margin = sh.marginPct !== undefined && sh.marginPct !== null
                          ? sh.marginPct
                          : (med?.marginPct !== undefined && med?.marginPct !== null
                            ? med.marginPct
                            : (hpp > 0 ? Math.round(((sell - hpp) / hpp) * 10000) / 100 : 20));

                        return (
                          <tr key={`${sh.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">{formatDateTime(sh.date)}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Oleh: {sh.user || 'Sistem'}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[10px] text-slate-400 block">{sh.medicineCode}</span>
                              <span className="font-bold text-slate-900">{sh.medicineName}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                  isPpn
                                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {isPpn ? 'PPN 11%' : 'Non-PPN'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 font-mono font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-xs">
                                +{sh.amount}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className="text-slate-500">{sh.prevStock}</span>
                              <span className="text-slate-300 mx-1.5">→</span>
                              <span className="font-bold text-slate-900">{sh.newStock}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {hpp > 0 ? (
                                <div className="text-[11px]">
                                  <span className="text-slate-500 block">HPP: <strong>{formatRupiah(hpp)}</strong></span>
                                  <span className="text-indigo-700 font-bold block">Jual: {formatRupiah(sell)}</span>
                                </div>
                              ) : (
                                <div className="text-[11px]">
                                  <span className="text-slate-400 block">HPP: -</span>
                                  <span className="text-indigo-700 font-bold block">Jual: {formatRupiah(sell)}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                                margin >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {margin}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs">{sh.note || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={restockHistoryPage}
                totalPages={Math.ceil(filteredRestockHistory.length / ITEMS_PER_PAGE)}
                onPageChange={setRestockHistoryPage}
                totalItems={filteredRestockHistory.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENYESUAIAN STOK (STOK OPNAM) */}
      {/* ========================================================================= */}
      {activeSubTab === 'penyesuaian' && (
        <div className="space-y-5">
          {/* Opname Secondary Sub-Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setOpnameTab('form')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                opnameTab === 'form'
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Form Stok Opnam Fisik
            </button>
            <button
              type="button"
              onClick={() => setOpnameTab('log')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                opnameTab === 'log'
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <History className="w-4 h-4" />
              Log & Riwayat Penyesuaian
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  opnameTab === 'log' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {filteredOpnameHistory.length}
              </span>
            </button>
          </div>

          {/* FORM STOK OPNAM */}
          {opnameTab === 'form' && (
            <div className="space-y-5">
              {/* Category Quick Opname Toolbar ("Input & Atur Bulk Stok Opnam Berdasarkan Kategori") */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="font-extrabold text-xs text-white">Input & Atur Bulk Stok Opnam Berdasarkan Kategori Obat</h3>
                      <p className="text-[11px] text-slate-300">
                        Pilih kategori obat dari dropdown di bawah untuk mengatur atau menginput stok fisik sediaan obat secara masal (bulk).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2 border-t border-slate-800">
                  {/* Category Selector Dropdown */}
                  <div className="flex-1 flex items-center gap-2">
                    <label className="text-[11px] font-extrabold text-slate-300 shrink-0">
                      Dropdown Kategori:
                    </label>
                    <select
                      value={opnameCategoryFilter}
                      onChange={(e) => setOpnameCategoryFilter(e.target.value)}
                      className="w-full bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer shadow-inner"
                    >
                      <option value="all">
                        ⚡ Semua Kategori ({medicines.filter(m => m.isActive).length} Obat)
                      </option>
                      {uniqueCategories.map(cat => {
                        const count = medicines.filter(m => m.isActive && m.category === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            Kategori: {cat} ({count} Obat)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Quick Action: Set Sesuai Stok Sistem */}
                  <button
                    type="button"
                    onClick={() => handleSetOpnameMatchSystemByCategory(opnameCategoryFilter)}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                  >
                    ⚡ Samakan Ke Stok Sistem ({
                      medicines.filter(m => m.isActive && (opnameCategoryFilter === 'all' || m.category === opnameCategoryFilter)).length
                    } Obat)
                  </button>
                </div>

                {/* Row 2: Bulk Fill Physical Stock & Bulk Fill Note Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
                  {/* Bulk Stock Input */}
                  <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/80">
                    <span className="text-[11px] font-bold text-slate-300 shrink-0">Set Stok Fisik Masal:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Angka stok..."
                      value={bulkOpnameStockVal}
                      onChange={e => setBulkOpnameStockVal(e.target.value)}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyBulkOpnameStockByCategory(opnameCategoryFilter, bulkOpnameStockVal)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] rounded-lg transition-colors shrink-0 cursor-pointer shadow-2xs"
                    >
                      Terapkan Stok
                    </button>
                  </div>

                  {/* Bulk Note Input */}
                  <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/80">
                    <span className="text-[11px] font-bold text-slate-300 shrink-0">Catatan Masal:</span>
                    <input
                      type="text"
                      placeholder="e.g. Opnam Fisik Rak A..."
                      value={bulkOpnameNoteVal}
                      onChange={e => setBulkOpnameNoteVal(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyBulkOpnameNoteByCategory(opnameCategoryFilter, bulkOpnameNoteVal)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] rounded-lg transition-colors shrink-0 cursor-pointer shadow-2xs"
                    >
                      Terapkan Catatan
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Filter & Opname Summary Header */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
                      Pemeriksaan Stok Opnam Fisik (Terpisah PPN & Non-PPN)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sandingkan stok fisik riil di rak/gudang dengan stok sistem. Terpisah antara obat PPN 11% dan Non-PPN.
                    </p>
                  </div>

                  {/* Category & Location Filter Dropdowns & Reset Button */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700 shrink-0">Kategori:</span>
                      <select
                        value={opnameCategoryFilter}
                        onChange={e => setOpnameCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="all">Semua Kategori ({medicines.filter(m => m.isActive).length})</option>
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat} ({medicines.filter(m => m.isActive && m.category === cat).length})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700 shrink-0">Lokasi Rak:</span>
                      <select
                        value={opnameLocationFilter}
                        onChange={e => setOpnameLocationFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="all">Semua Lokasi ({medicines.filter(m => m.isActive).length})</option>
                        {uniqueLocations.map(loc => (
                          <option key={loc} value={loc}>
                            {loc} ({medicines.filter(m => m.isActive && m.location === loc).length})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetAllOpnameToSystem}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs"
                      title="Reset semua input stok fisik agar kembali sama dengan stok sistem"
                    >
                      🔄 Reset Form Opnam
                    </button>
                  </div>
                </div>

                {/* Status Ringkasan Fisik PPN vs Non-PPN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-blue-900">
                    <div>
                      <span className="font-black text-xs block">sediaan Obat Skema PPN 11%</span>
                      <span className="text-[11px] text-blue-700 font-medium">
                        Total {opnameTaxStats.ppnMedCount} Jenis | Sistem: <strong>{opnameTaxStats.ppnSystemStock}</strong> | Fisik: <strong>{opnameTaxStats.ppnPhysicalStock}</strong>
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg font-black text-xs border ${
                      opnameTaxStats.ppnDiff === 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      Selisih: {opnameTaxStats.ppnDiff > 0 ? `+${opnameTaxStats.ppnDiff}` : opnameTaxStats.ppnDiff} Unit
                    </span>
                  </div>

                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-amber-900">
                    <div>
                      <span className="font-black text-xs block">sediaan Obat Skema Non-PPN (0%)</span>
                      <span className="text-[11px] text-amber-700 font-medium">
                        Total {opnameTaxStats.nonPpnMedCount} Jenis | Sistem: <strong>{opnameTaxStats.nonPpnSystemStock}</strong> | Fisik: <strong>{opnameTaxStats.nonPpnPhysicalStock}</strong>
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg font-black text-xs border ${
                      opnameTaxStats.nonPpnDiff === 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      Selisih: {opnameTaxStats.nonPpnDiff > 0 ? `+${opnameTaxStats.nonPpnDiff}` : opnameTaxStats.nonPpnDiff} Unit
                    </span>
                  </div>
                </div>

                {/* Opname Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <span className="font-bold text-slate-700 shrink-0">Jenis Sediaan:</span>
                      <button
                        type="button"
                        onClick={() => setOpnameItemTypeFilter('all')}
                        className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                          opnameItemTypeFilter === 'all'
                            ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({medicines.filter(m => m.isActive).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpnameItemTypeFilter('obat')}
                        className={`px-3 py-1 rounded-xl font-bold transition-all border cursor-pointer ${
                          opnameItemTypeFilter === 'obat'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs font-extrabold'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        💊 Obat ({medicines.filter(m => m.isActive && (m.itemType || 'obat') === 'obat').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpnameItemTypeFilter('non_obat')}
                        className={`px-3 py-1 rounded-xl font-bold transition-all border cursor-pointer ${
                          opnameItemTypeFilter === 'non_obat'
                            ? 'bg-purple-900 text-white border-purple-800 shadow-2xs font-extrabold'
                            : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        🛍️ Non-Obat ({medicines.filter(m => m.isActive && m.itemType === 'non_obat').length})
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto border-l border-slate-200 pl-2">
                      <span className="font-bold text-slate-700 shrink-0">Status Pajak:</span>
                      <button
                        type="button"
                        onClick={() => setOpnameTaxFilter('all')}
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                          opnameTaxFilter === 'all'
                            ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpnameTaxFilter('PPN')}
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer ${
                          opnameTaxFilter === 'PPN'
                            ? 'bg-blue-900 text-white border-blue-800 shadow-2xs font-extrabold'
                            : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        🏷️ PPN 11%
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpnameTaxFilter('NON_PPN')}
                        className={`px-2.5 py-1 rounded-xl font-bold transition-all border cursor-pointer ${
                          opnameTaxFilter === 'NON_PPN'
                            ? 'bg-slate-900 text-white border-slate-800 shadow-2xs font-extrabold'
                            : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        📦 Non-PPN
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari kode, nama, lokasi..."
                        value={opnameSearchTerm}
                        onChange={e => setOpnameSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl text-xs hover:bg-slate-200 transition-colors shrink-0">
                      <input
                        type="checkbox"
                        checked={showOnlyDiff}
                        onChange={e => setShowOnlyDiff(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Hanya Selisih Stok</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Opname Physical Table */}
              <form onSubmit={handleBulkOpnameSubmit} className="space-y-4">
                <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3 w-10 text-center">No</th>
                        <th className="py-3 px-3">Kode & Nama Sediaan</th>
                        <th className="py-3 px-3 text-center">Skema PPN</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3 text-center">Stok Sistem</th>
                        <th className="py-3 px-3 text-center w-36">Stok Fisik Opnam</th>
                        <th className="py-3 px-3 text-center">Selisih</th>
                        <th className="py-3 px-3">Catatan Penyesuaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedOpnameMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Tidak ada sediaan obat yang sesuai dengan filter pencarian / kategori / status PPN / jenis item.
                          </td>
                        </tr>
                      ) : (
                        paginatedOpnameMedicines.map((m, idx) => {
                          const rawPhys = bulkOpnameData[m.id]?.physicalStock;
                          const physNum =
                            rawPhys === undefined || rawPhys === '' || isNaN(Number(rawPhys))
                              ? m.stock
                              : Number(rawPhys);
                          const diff = physNum - m.stock;
                          const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                {((opnameMedicinesPage - 1) * ITEMS_PER_PAGE) + idx + 1}
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="font-mono text-[10px] text-slate-400 block">{m.code}</span>
                                <span className="font-bold text-slate-900">{m.name}</span>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                    isMedPpn
                                      ? 'bg-blue-50 text-blue-900 border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {isMedPpn ? 'PPN 11%' : 'Non-PPN'}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 font-semibold text-indigo-700">
                                {m.category}
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                                {formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}
                              </td>

                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={rawPhys ?? m.stock}
                                  onChange={e => handlePhysicalStockChange(m.id, e.target.value)}
                                  className={`w-full px-2.5 py-1.5 rounded-lg border text-center font-bold text-xs focus:outline-none ${
                                    diff !== 0
                                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-extrabold'
                                      : 'bg-white border-slate-200 text-slate-800'
                                  }`}
                                />
                              </td>

                              <td className="py-2.5 px-3 text-center font-mono font-extrabold">
                                {diff === 0 ? (
                                  <span className="text-slate-400">0</span>
                                ) : diff > 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    +{diff} (Surplus)
                                  </span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    {diff} (Defisit)
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  placeholder="Alasan selisih..."
                                  value={bulkOpnameData[m.id]?.note || ''}
                                  onChange={e => handleOpnameRowNoteChange(m.id, e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  <PaginationControls
                    currentPage={opnameMedicinesPage}
                    totalPages={Math.ceil(filteredOpnameMedicines.length / ITEMS_PER_PAGE)}
                    onPageChange={setOpnameMedicinesPage}
                    totalItems={filteredOpnameMedicines.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-md">
                  <div className="text-xs">
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Catatan Global Opnam</span>
                    <input
                      type="text"
                      value={globalOpnameNote}
                      onChange={e => setGlobalOpnameNote(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white px-3 py-1.5 rounded-xl text-xs w-72 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs shadow-xs transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Proses Penyesuaian Stok Opnam
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LOG STOK OPNAM */}
          {opnameTab === 'log' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <History className="w-4.5 h-4.5 text-emerald-600" />
                    Riwayat Log Penyesuaian Stok Opnam (Terpisah PPN & Non-PPN)
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      {filteredOpnameHistory.length} Audit Log
                    </span>
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Jenis Sediaan Filter Buttons */}
                  <div className="flex items-center gap-1 text-xs border-r border-slate-200 pr-2">
                    <span className="font-bold text-slate-500 shrink-0 mr-0.5">Jenis:</span>
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryItemTypeFilter('all')}
                      className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        opnameHistoryItemTypeFilter === 'all'
                          ? 'bg-purple-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryItemTypeFilter('obat')}
                      className={`px-2 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                        opnameHistoryItemTypeFilter === 'obat'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs font-extrabold'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      💊 Obat
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryItemTypeFilter('non_obat')}
                      className={`px-2 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                        opnameHistoryItemTypeFilter === 'non_obat'
                          ? 'bg-purple-900 text-white border-purple-800 shadow-2xs font-extrabold'
                          : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      🛍️ Non-Obat
                    </button>
                  </div>

                  {/* Tax Filter Buttons */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryTaxFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        opnameHistoryTaxFilter === 'all'
                          ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({allOpnameLogs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryTaxFilter('PPN')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                        opnameHistoryTaxFilter === 'PPN'
                          ? 'bg-blue-900 text-white border-blue-800 shadow-2xs font-extrabold'
                          : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      🏷️ PPN 11% ({ppnOpnameLogs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryTaxFilter('NON_PPN')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                        opnameHistoryTaxFilter === 'NON_PPN'
                          ? 'bg-slate-900 text-white border-slate-800 shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      📦 Non-PPN ({nonPpnOpnameLogs.length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari histori opnam..."
                      value={opnameHistorySearch}
                      onChange={e => setOpnameHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Waktu & Petugas</th>
                      <th className="py-2.5 px-3">Kode & Nama Obat</th>
                      <th className="py-2.5 px-3 text-center">Status Perpajakan</th>
                      <th className="py-2.5 px-3 text-center">Selisih</th>
                      <th className="py-2.5 px-3 text-center">Stok (Sebelum → Sesudah)</th>
                      <th className="py-2.5 px-3">Alasan / Catatan Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedOpnameHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada riwayat penyesuaian opnam yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedOpnameHistory.map((sh, idx) => {
                        const isPpn = getHistoryIsPpn(sh);

                        return (
                          <tr key={`${sh.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 block">{formatDateTime(sh.date)}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Oleh: {sh.user || 'Sistem'}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[10px] text-slate-400 block">{sh.medicineCode}</span>
                              <span className="font-bold text-slate-900">{sh.medicineName}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                  isPpn
                                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {isPpn ? 'PPN 11%' : 'Non-PPN'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {sh.amount > 0 ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  +{sh.amount}
                                </span>
                              ) : (
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  {sh.amount}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className="text-slate-500">{sh.prevStock}</span>
                              <span className="text-slate-300 mx-1.5">→</span>
                              <span className="font-bold text-slate-900">{sh.newStock}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs">{sh.note || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={opnameHistoryPage}
                totalPages={Math.ceil(filteredOpnameHistory.length / ITEMS_PER_PAGE)}
                onPageChange={setOpnameHistoryPage}
                totalItems={filteredOpnameHistory.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Bulk Opname */}
      {opnameConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-fade-in">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Penyesuaian Stok Opnam</h3>
                <p className="text-xs text-slate-500">
                  Terdapat {opnameConfirmModal.itemsToAdjust.length} sediaan obat yang mengalami selisih stok fisik.
                </p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {opnameConfirmModal.itemsToAdjust.map(item => {
                const med = medicines.find(m => m.id === item.medicineId);
                const isPpn = med ? ((med.isPpnIncluded ?? true) && (med.ppnRate ?? 11) > 0) : true;

                return (
                  <div key={item.medicineId} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{item.name} ({item.code})</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                          isPpn ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isPpn ? 'PPN 11%' : 'Non-PPN'}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-700 font-semibold">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-slate-500">{item.prevStock} → <strong className="text-slate-900">{item.newStock}</strong> {item.unit}</span>
                      <span className={`block font-bold text-[11px] ${item.diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Selisih: {item.diff > 0 ? `+${item.diff}` : item.diff}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpnameConfirmModal({ isOpen: false, itemsToAdjust: [] })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkOpnameSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
              >
                Ya, Simpan Penyesuaian
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: TAMBAH ITEM BARU (+ AUTO MARGIN & BHP) */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-fade-in my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl text-white ${newItemType === 'obat' ? 'bg-emerald-600' : 'bg-purple-600'}`}>
                  {newItemType === 'obat' ? <PackagePlus className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Tambah {newItemType === 'obat' ? 'Obat Baru' : 'Barang Non-Obat Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Atur data produk baru dan penetapan harga jual kasir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewItemModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItemSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Item *</label>
                  <input
                    type="text"
                    required
                    value={newItemCode}
                    onChange={e => setNewItemCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Item *</label>
                  <input
                    type="text"
                    required
                    placeholder={newItemType === 'obat' ? 'cth. Amoxicillin 500mg' : 'cth. Sabun Cuci Tangan'}
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newItemCategory}
                    onChange={e => setNewItemCategory(e.target.value as MedicineCategory)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {newItemType === 'obat' ? (
                      <>
                        <option value="Obat Bebas">Obat Bebas</option>
                        <option value="Obat Bebas Terbatas">Obat Bebas Terbatas</option>
                        <option value="Obat Keras">Obat Keras</option>
                        <option value="Jamu & Herbal">Jamu & Herbal</option>
                        <option value="Suplemen & Vitamin">Suplemen & Vitamin</option>
                        <option value="Alat Kesehatan">Alat Kesehatan</option>
                      </>
                    ) : (
                      <>
                        <option value="Barang Umum">Barang Umum</option>
                        <option value="Perawatan & Kosmetik">Perawatan & Kosmetik</option>
                        <option value="Makanan & Minuman">Makanan & Minuman</option>
                        <option value="Lainnya">Lainnya</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  >
                    <option value="Strip">Strip</option>
                    <option value="Botol">Botol</option>
                    <option value="Tube">Tube</option>
                    <option value="Box">Box</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Blister">Blister</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Ampul">Ampul</option>
                    <option value="Sachet">Sachet</option>
                    <option value="Dus">Dus</option>
                    <option value="Pack">Pack</option>
                    <option value="Lusin">Lusin</option>
                    <option value="Vial">Vial</option>
                    <option value="Kapsul">Kapsul</option>
                    <option value="Suppositoria">Suppositoria</option>
                    <option value="Syringe">Syringe</option>
                    <option value="Pasang">Pasang</option>
                    <option value="Set">Set</option>
                    <option value="Roll">Roll</option>
                    <option value="Galon">Galon</option>
                    <option value="Bag">Bag</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Rak</label>
                  <input
                    type="text"
                    value={newItemLocation}
                    onChange={e => setNewItemLocation(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemStock}
                    onChange={e => setNewItemStock(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stok Minimum Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemMinStock}
                    onChange={e => setNewItemMinStock(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Expired</label>
                  <input
                    type="date"
                    value={newItemExpiredDate}
                    onChange={e => setNewItemExpiredDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* HARGA JUAL KASIR SECTION */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  Penetapan Harga Jual Kasir (Rp) *
                </h4>

                <div>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newItemSellingPrice}
                    onChange={e => setNewItemSellingPrice(Number(e.target.value))}
                    placeholder="cth. 12000"
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 justify-between">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemIsPpn}
                    onChange={e => setNewItemIsPpn(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Faktur Termasuk PPN 11%</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewItemModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan Item Baru
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DIALOG INPUT STOK MASUK BARU */}
      {/* ========================================================================= */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${modalItemType === 'obat' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    Input Stok Masuk Baru ({modalItemType === 'obat' ? 'Sediaan Obat' : 'Non-Obat / Alkes'})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Form penerimaan stok barang masuk, klasifikasi PPN, dan perhitungan margin laba kotor.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockModalSubmit} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setModalItemType('obat');
                    const firstMed = medicines.find(m => m.isActive && ((m.itemType || 'obat') === 'obat'));
                    if (firstMed) {
                      handleModalMedSelect(firstMed.id);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    modalItemType === 'obat' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💊 Sediaan Obat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalItemType('non_obat');
                    const firstNonMed = medicines.find(m => m.isActive && m.itemType === 'non_obat');
                    if (firstNonMed) {
                      handleModalMedSelect(firstNonMed.id);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    modalItemType === 'non_obat' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🛍️ Barang Non-Obat
                </button>
              </div>

              {/* Select Item */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Pilih Sediaan {modalItemType === 'obat' ? 'Obat' : 'Non-Obat'} <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={modalMedId}
                  onChange={e => handleModalMedSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Pilih Sediaan Barang --</option>
                  {medicines
                    .filter(m => {
                      if (!m.isActive) return false;
                      if (modalItemType === 'obat') {
                        return (m.itemType || 'obat') === 'obat';
                      } else {
                        return m.itemType === 'non_obat';
                      }
                    })
                    .map(m => {
                      const hpp = m.purchasePrice || (m.price > 0 ? Math.round(m.price * 0.75) : 0);
                      const bhp = m.bhpAmount || 0;
                      const totalCost = hpp + bhp;
                      const itemMargin = m.marginPct !== undefined && m.marginPct !== null
                        ? m.marginPct
                        : (totalCost > 0 && m.price > 0 ? Math.round(((m.price - totalCost) / totalCost) * 10000) / 100 : 20);

                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}) — Margin: {itemMargin}% | Stok: {formatStockDisplay(m.stock, m.unit, m.unitMultiplier)}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Supplier & Faktur No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PBF Distributor / Supplier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalSupplier}
                    onChange={e => setModalSupplier(e.target.value)}
                    placeholder="e.g. PBF Kimia Farma / Anugrah Argon"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    No. Faktur / Surat Jalan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={modalFakturNo}
                    onChange={e => setModalFakturNo(e.target.value)}
                    placeholder="e.g. FK-2026-0089"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Qty, Unit, Expired Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah Masuk (Qty) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={modalQty}
                    onChange={e => setModalQty(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-emerald-300 font-black text-emerald-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={modalUnit}
                    onChange={e => setModalUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer text-xs"
                  >
                    {[
                      'Strip', 'Botol', 'Tube', 'Box', 'Tablet', 'Blister', 'Pcs',
                      'Ampul', 'Sachet', 'Dus', 'Pack', 'Lusin', 'Vial',
                      'Kapsul', 'Suppositoria', 'Syringe', 'Pasang', 'Set', 'Roll', 'Galon', 'Bag'
                    ].concat(modalUnit && !['Strip', 'Botol', 'Tube', 'Box', 'Tablet', 'Blister', 'Pcs', 'Ampul', 'Sachet', 'Dus', 'Pack', 'Lusin', 'Vial', 'Kapsul', 'Suppositoria', 'Syringe', 'Pasang', 'Set', 'Roll', 'Galon', 'Bag'].includes(modalUnit) ? [modalUnit] : []).map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tgl Kedaluwarsa (Expired)</label>
                  <input
                    type="date"
                    value={modalExpiredDate}
                    onChange={e => setModalExpiredDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Tax Type & Prices (HPP, BHP, Margin, Harga Jual Auto-Sync) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-800">Status Perpajakan Faktur</label>
                  <select
                    value={modalTaxType}
                    onChange={e => setModalTaxType(e.target.value as 'PPN' | 'NON_PPN')}
                    className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 font-extrabold text-xs text-indigo-950 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                  >
                    <option value="PPN">🏷️ Faktur PPN 11% Included</option>
                    <option value="NON_PPN">📦 Nota Non-PPN (Bebas Pajak)</option>
                  </select>
                </div>

                {/* 4 Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      HPP Beli Modal (Rp/Unit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={modalPurchasePrice}
                      onChange={e => handleModalPurchasePriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                      {formatRupiah(modalPurchasePrice)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Bahan Habis Pakai / BHP (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={modalBhpAmount}
                      onChange={e => handleModalBhpAmountChange(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold text-amber-900 focus:outline-none focus:border-amber-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                      {formatRupiah(modalBhpAmount)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Margin Laba (%)</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">Auto</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={modalMarginPct}
                      onChange={e => handleModalMarginPctChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-400 font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                      Margin {modalMarginPct}%
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Harga Jual (Rp/Unit)</span>
                      <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.2 rounded">Sinkron</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={modalSellingPrice}
                      onChange={e => handleModalSellingPriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-300 font-extrabold text-indigo-900 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                      {formatRupiah(modalSellingPrice)}
                    </span>
                  </div>
                </div>

                {/* Live Margin Calculation Preview */}
                {(() => {
                  const hpp = modalPurchasePrice;
                  const bhp = modalBhpAmount;
                  const totalCost = hpp + bhp;
                  const sell = modalSellingPrice;
                  const isPpn = modalTaxType === 'PPN';
                  const dppBeli = isPpn ? Math.round(hpp / 1.11) : hpp;
                  const ppnVal = isPpn ? hpp - dppBeli : 0;
                  const profitUnit = sell - totalCost;
                  const marginPct = sell > 0 ? Math.round((profitUnit / sell) * 10000) / 100 : 0;
                  const markupPct = totalCost > 0 ? Math.round((profitUnit / totalCost) * 10000) / 100 : 0;
                  const totalProfitBatch = profitUnit * modalQty;

                  return (
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl space-y-1.5 border border-slate-800 shadow-inner">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                        <span>⚡ Perhitungan Modal & Harga Jual Auto-Sinkron:</span>
                        <span className="text-amber-300 font-extrabold">Est. Total Profit Batch: {formatRupiah(totalProfitBatch)}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1 border-t border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[9px]">Total Modal (HPP+BHP):</span>
                          <span className="font-extrabold text-amber-300">{formatRupiah(totalCost)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">DPP Beli (Excl PPN):</span>
                          <span className="font-mono text-white">{formatRupiah(dppBeli)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">PPN Masukan (11%):</span>
                          <span className="font-mono text-blue-300">{formatRupiah(ppnVal)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">Margin Laba:</span>
                          <span className="font-black text-emerald-400">{marginPct}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">Profit per Unit:</span>
                          <span className={`font-extrabold ${profitUnit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                            {formatRupiah(profitUnit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan Nota (Opsional)</label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  placeholder="e.g. Pembelian rutin PBF Kimia Farma"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Modal Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan & Tambahkan Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
