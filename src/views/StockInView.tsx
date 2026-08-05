import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTime, formatRupiah, getWIBDateString } from '../utils/formatters';
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
} from 'lucide-react';

interface BulkRestockItem {
  id: string;
  medicineId: string;
  amount: number;
  note: string;
  taxType: 'PPN' | 'NON_PPN';
  purchasePrice: number; // HPP Beli per unit
  sellingPrice: number;  // Harga Jual per unit
  updateMedicineMaster: boolean; // Flag to update master catalog
}

interface BulkOpnameState {
  physicalStock: number | string;
  note: string;
}

export const StockInView: React.FC = () => {
  const { medicines, addStock, adjustStock, bulkAdjustStock, bulkAddStock, stockHistory, currentUser } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'masuk' | 'penyesuaian'>('masuk');

  // Sub-tabs for Form vs Log
  const [restockTab, setRestockTab] = useState<'form' | 'log'>('form');
  const [opnameTab, setOpnameTab] = useState<'form' | 'log'>('form');

  // Single vs Bulk Mode Toggle for Restock & Opname
  const [restockMode, setRestockMode] = useState<'single' | 'bulk'>('bulk');
  const [opnameMode, setOpnameMode] = useState<'single' | 'bulk'>('bulk');

  // Category Filter for Restock & Opname
  const [restockCategoryFilter, setRestockCategoryFilter] = useState<string>('all');
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState('all');

  // Alerts
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ==========================================
  // 1. SINGLE RESTOCK STATE
  // ==========================================
  const [selectedMedId, setSelectedMedId] = useState('');
  const [singleAmount, setSingleAmount] = useState<number>(10);
  const [singleNote, setSingleNote] = useState('');
  const [singleTaxType, setSingleTaxType] = useState<'PPN' | 'NON_PPN'>('PPN');
  const [singlePurchasePrice, setSinglePurchasePrice] = useState<number>(0);
  const [singleSellingPrice, setSingleSellingPrice] = useState<number>(0);
  const [singleUpdateMaster, setSingleUpdateMaster] = useState(true);

  // Update Single Restock Defaults when medicine is selected
  useEffect(() => {
    if (selectedMedId) {
      const targetMed = medicines.find(m => m.id === selectedMedId);
      if (targetMed) {
        setSingleTaxType(targetMed.isPpnIncluded ? 'PPN' : 'NON_PPN');
        const defaultHpp = targetMed.purchasePrice || Math.round(targetMed.price * 0.75);
        setSinglePurchasePrice(defaultHpp);
        setSingleSellingPrice(targetMed.price);
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
        items.push({
          id: `init-ppn-${idx}-${Date.now()}`,
          medicineId: m.id,
          amount: 10,
          note: 'Restock Faktur PPN 11%',
          taxType: 'PPN',
          purchasePrice: m.purchasePriceIncPpn || m.purchasePrice || Math.round(m.price * 0.75),
          sellingPrice: m.priceIncPpn || m.price,
          updateMedicineMaster: true,
        });
      });

      // Add up to 2 Non-PPN items
      nonPpnMeds.slice(0, 2).forEach((m, idx) => {
        items.push({
          id: `init-nonppn-${idx}-${Date.now()}`,
          medicineId: m.id,
          amount: 10,
          note: 'Pembelian Nota Non-PPN',
          taxType: 'NON_PPN',
          purchasePrice: m.purchasePriceNonPpn || m.purchasePrice || Math.round(m.price * 0.75),
          sellingPrice: m.priceNonPpn || m.price,
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
      const sell = tax === 'PPN' 
        ? (medObj.priceIncPpn || medObj.price)
        : (medObj.priceNonPpn || medObj.price);

      setSinglePurchasePrice(hpp);
      setSingleSellingPrice(sell);
    }
  };

  const handleSingleTaxToggle = (tax: 'PPN' | 'NON_PPN') => {
    setSingleTaxType(tax);
    const medObj = medicines.find(m => m.id === selectedMedId);
    if (medObj) {
      const hpp = tax === 'PPN' 
        ? (medObj.purchasePriceIncPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75))
        : (medObj.purchasePriceNonPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75));
      const sell = tax === 'PPN' 
        ? (medObj.priceIncPpn || medObj.price)
        : (medObj.priceNonPpn || medObj.price);

      setSinglePurchasePrice(hpp);
      setSingleSellingPrice(sell);
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

    // Evaluate tax classification on form submit
    const isPpn = singleTaxType === 'PPN' || ((targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0);
    const computedTaxType: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';
    
    // Calculations
    const hpp = singlePurchasePrice;
    const sell = singleSellingPrice;
    const ppnAmountPerUnit = isPpn ? Math.round(hpp - hpp / 1.11) : 0;
    const grossProfitPerUnit = sell - hpp;
    const marginPct = sell > 0 ? Math.round((grossProfitPerUnit / sell) * 10000) / 100 : 0;

    const fullNote = `[RESTOCK ${computedTaxType}] ${singleNote || 'Stok masuk manual'} | HPP: ${formatRupiah(hpp)} | Jual: ${formatRupiah(sell)} | Margin: ${marginPct}%`;

    addStock(selectedMedId, Number(singleAmount), fullNote, {
      taxType: computedTaxType,
      purchasePrice: hpp,
      sellingPrice: sell,
      ppnAmount: ppnAmountPerUnit * singleAmount,
      marginPct,
      updateMedicineMaster: singleUpdateMaster,
    });

    setSuccessMessage(
      `Berhasil menambahkan +${singleAmount} ${targetMed.unit || 'unit'} stok (${computedTaxType}) untuk "${targetMed.name}"! Margin Laba: ${marginPct}%.`
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

    setBulkItems(prev => [
      ...prev,
      {
        id: `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        medicineId: unselectedMed.id,
        amount: 10,
        note: bulkCategoryFilter !== 'all' ? `Restock Kategori ${unselectedMed.category}` : '',
        taxType: actualTax,
        purchasePrice: actualTax === 'NON_PPN' ? (unselectedMed.purchasePriceNonPpn || unselectedMed.purchasePrice || Math.round(unselectedMed.price * 0.75)) : (unselectedMed.purchasePriceIncPpn || unselectedMed.purchasePrice || Math.round(unselectedMed.price * 0.75)),
        sellingPrice: actualTax === 'NON_PPN' ? (unselectedMed.priceNonPpn || unselectedMed.price) : (unselectedMed.priceIncPpn || unselectedMed.price),
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

      return {
        id: `bulk-cat-${m.id}-${idx}-${Date.now()}`,
        medicineId: m.id,
        amount: 10,
        note: `Restock Kategori ${m.category}`,
        taxType: tax,
        purchasePrice: tax === 'NON_PPN' ? (m.purchasePriceNonPpn || m.purchasePrice || Math.round(m.price * 0.75)) : (m.purchasePriceIncPpn || m.purchasePrice || Math.round(m.price * 0.75)),
        sellingPrice: tax === 'NON_PPN' ? (m.priceNonPpn || m.price) : (m.priceIncPpn || m.price),
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
            return {
              ...item,
              medicineId: value,
              taxType: tax,
              purchasePrice: tax === 'NON_PPN' ? (medObj.purchasePriceNonPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75)) : (medObj.purchasePriceIncPpn || medObj.purchasePrice || Math.round(medObj.price * 0.75)),
              sellingPrice: tax === 'NON_PPN' ? (medObj.priceNonPpn || medObj.price) : (medObj.priceIncPpn || medObj.price),
            };
          }
        }

        return { ...item, [field]: value };
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
      // Determine tax classification on form submit based on item selection or medicine master data
      const isPpn = item.taxType === 'PPN' || (targetMed ? ((targetMed.isPpnIncluded ?? true) && (targetMed.ppnRate ?? 11) > 0) : true);
      const computedTaxType: 'PPN' | 'NON_PPN' = isPpn ? 'PPN' : 'NON_PPN';

      const hpp = item.purchasePrice;
      const sell = item.sellingPrice;
      const ppnAmountPerUnit = isPpn ? Math.round(hpp - hpp / 1.11) : 0;
      const profitPerUnit = sell - hpp;
      const marginPct = sell > 0 ? Math.round((profitPerUnit / sell) * 10000) / 100 : 0;

      const itemNote = `${fullBatchHeader} [Tax: ${computedTaxType} | HPP: ${formatRupiah(hpp)} | Jual: ${formatRupiah(sell)} | Margin: ${marginPct}%] ${item.note ? ' - ' + item.note : ''}`;

      return {
        medicineId: item.medicineId,
        amount: Number(item.amount),
        note: itemNote,
        taxType: computedTaxType,
        purchasePrice: hpp,
        sellingPrice: sell,
        ppnAmount: ppnAmountPerUnit * item.amount,
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
    'Lainnya',
  ];

  const uniqueLocations = Array.from(
    new Set(medicines.map(m => m.location).filter(Boolean))
  ).sort();

  // Restock History Summary Stats (PPN vs Non-PPN)
  const allRestockLogs = React.useMemo(() => stockHistory.filter(sh => sh.type === 'masuk'), [stockHistory]);
  
  const ppnRestockLogs = React.useMemo(() => allRestockLogs.filter(sh => getHistoryIsPpn(sh)), [allRestockLogs, getHistoryIsPpn]);

  const nonPpnRestockLogs = React.useMemo(() => allRestockLogs.filter(sh => !getHistoryIsPpn(sh)), [allRestockLogs, getHistoryIsPpn]);

  const restockPpnStats = React.useMemo(() => {
    let totalTrx = ppnRestockLogs.length;
    let totalQty = 0;
    let totalHppCost = 0;
    let totalPpnInput = 0;

    ppnRestockLogs.forEach(sh => {
      const qty = sh.amount || 0;
      const hpp = sh.purchasePrice || 0;
      const ppnUnit = sh.ppnAmount ? sh.ppnAmount / (qty || 1) : Math.round(hpp - hpp / 1.11);
      totalQty += qty;
      totalHppCost += hpp * qty;
      totalPpnInput += sh.ppnAmount || (ppnUnit * qty);
    });

    return { totalTrx, totalQty, totalHppCost, totalPpnInput };
  }, [ppnRestockLogs]);

  const restockNonPpnStats = React.useMemo(() => {
    let totalTrx = nonPpnRestockLogs.length;
    let totalQty = 0;
    let totalHppCost = 0;

    nonPpnRestockLogs.forEach(sh => {
      const qty = sh.amount || 0;
      const hpp = sh.purchasePrice || 0;
      totalQty += qty;
      totalHppCost += hpp * qty;
    });

    return { totalTrx, totalQty, totalHppCost };
  }, [nonPpnRestockLogs]);

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

  // Opnam Physical Stats (PPN vs Non-PPN) - Only for active medicines
  const opnameTaxStats = React.useMemo(() => {
    let ppnMedCount = 0;
    let ppnSystemStock = 0;
    let ppnPhysicalStock = 0;
    let ppnDiff = 0;

    let nonPpnMedCount = 0;
    let nonPpnSystemStock = 0;
    let nonPpnPhysicalStock = 0;
    let nonPpnDiff = 0;

    medicines.filter(m => m.isActive).forEach(m => {
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
  }, [medicines, bulkOpnameData]);

  // Opnam Log Stats (PPN vs Non-PPN)
  const allOpnameLogs = React.useMemo(() => stockHistory.filter(sh => sh.type === 'penyesuaian'), [stockHistory]);
  const ppnOpnameLogs = React.useMemo(() => allOpnameLogs.filter(sh => getHistoryIsPpn(sh)), [allOpnameLogs, getHistoryIsPpn]);
  const nonPpnOpnameLogs = React.useMemo(() => allOpnameLogs.filter(sh => !getHistoryIsPpn(sh)), [allOpnameLogs, getHistoryIsPpn]);

  const filteredOpnameMedicines = medicines.filter(m => {
    if (!m.isActive) return false;

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
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('masuk')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'masuk'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          1. Input Stok Masuk & Perhitungan Margin
        </button>
        <button
          onClick={() => setActiveSubTab('penyesuaian')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'penyesuaian'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          2. Penyesuaian Stok (Stok Opnam Physical)
        </button>
      </div>

      {/* Alert Success */}
      {isSuccessAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMessage}
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'masuk') setRestockTab('log');
              else setOpnameTab('log');
            }}
            className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shrink-0 text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <History className="w-3.5 h-3.5" />
            Lihat Log Riwayat →
          </button>
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
      {/* TAB 1: INPUT STOK MASUK & PERHITUNGAN MARGIN */}
      {/* ========================================================================= */}
      {activeSubTab === 'masuk' && (
        <div className="space-y-5">
          {/* Restock Secondary Sub-Tab Switcher (Form vs Log) */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setRestockTab('form')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                restockTab === 'form'
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ListPlus className="w-4 h-4" />
              Form Input & Kalkulator Margin
            </button>
            <button
              type="button"
              onClick={() => setRestockTab('log')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                restockTab === 'log'
                  ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <History className="w-4 h-4" />
              Log & Riwayat Restock (PPN vs Non-PPN)
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  restockTab === 'log' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {filteredRestockHistory.length}
              </span>
            </button>
          </div>

          {/* TAB CONTENT 1: FORM INPUT & MARGIN CALCULATOR */}
          {restockTab === 'form' && (
            <div className="space-y-5">
              {/* Category Quick Selector Toolbar ("Atur Stok Barang Berdasarkan Kategori") */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="font-extrabold text-xs text-white">Atur Stok Barang Berdasarkan Kategori Obat</h3>
                      <p className="text-[11px] text-slate-300">
                        Pilih kategori obat dari dropdown di bawah untuk memuat seluruh sediaan obat aktif kategori tersebut secara otomatis ke form input restock bulk.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <div className="flex-1 flex items-center gap-2">
                    <label className="text-[11px] font-extrabold text-slate-300 shrink-0">
                      Pilih Kategori Obat:
                    </label>
                    <select
                      value={bulkCategoryFilter}
                      onChange={(e) => handleAddCategoryMedsToBulk(e.target.value)}
                      className="w-full bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer shadow-inner"
                    >
                      <option value="all">
                        ⚡ Semua Kategori ({
                          medicines.filter(m => {
                            if (!m.isActive) return false;
                            const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                            if (bulkViewTaxFilter === 'PPN') return isPpn;
                            if (bulkViewTaxFilter === 'NON_PPN') return !isPpn;
                            return true;
                          }).length
                        } Obat)
                      </option>
                      {uniqueCategories.map(cat => {
                        const count = medicines.filter(m => {
                          if (!m.isActive || m.category !== cat) return false;
                          const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                          if (bulkViewTaxFilter === 'PPN') return isPpn;
                          if (bulkViewTaxFilter === 'NON_PPN') return !isPpn;
                          return true;
                        }).length;

                        return (
                          <option key={cat} value={cat}>
                            Kategori: {cat} ({count} Obat)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCategoryMedsToBulk(bulkCategoryFilter)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
                  >
                    ⚡ Muat Sediaan Kategori
                  </button>
                </div>
              </div>

              {/* Restock Mode Toggle Header */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Mode Input Stok Masuk:
                  </span>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl font-bold text-xs gap-1">
                    <button
                      onClick={() => setRestockMode('bulk')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        restockMode === 'bulk'
                          ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      Bulk / Batch Restock Banyak Obat
                      <span className="bg-emerald-800 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                        Rekomendasi
                      </span>
                    </button>
                    <button
                      onClick={() => setRestockMode('single')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        restockMode === 'single'
                          ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Form Single (1 Item)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1">
                    Status Perpajakan: Otomatis Sesuai Sediaan Master
                  </span>
                </div>
              </div>

              {/* MODE BULK RESTOCK */}
              {restockMode === 'bulk' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <ListPlus className="w-4.5 h-4.5 text-emerald-600" />
                        Form Input Restock Batch & Analisis Margin Laba
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lengkapi nomor faktur, klasifikasi perpajakan (PPN 11% vs Non-PPN), HPP Modal, dan harga jual untuk melihat estimasi margin laba kotor.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddBulkRow}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-emerald-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Tambah Baris Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkItems([])}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  {/* Batch Supplier Metadata Header */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" /> Distributor / PBF Supplier
                      </label>
                      <input
                        type="text"
                        required
                        value={bulkSupplier}
                        onChange={e => setBulkSupplier(e.target.value)}
                        placeholder="e.g. PBF Kimia Farma / Anugrah Argon"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-500" /> No. Faktur / Surat Jalan
                      </label>
                      <input
                        type="text"
                        required
                        value={bulkFakturNo}
                        onChange={e => setBulkFakturNo(e.target.value)}
                        placeholder="e.g. FK-2026-0881"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Catatan Nota Batch</label>
                      <input
                        type="text"
                        value={bulkNote}
                        onChange={e => setBulkNote(e.target.value)}
                        placeholder="e.g. Restock rutin gudang utama"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Interactive Bulk Items Table with Margin & Tax Detail */}
                  <form onSubmit={handleBulkRestockSubmit} className="space-y-4">
                    {/* Tax & Category View & Filter Bar for Bulk Input */}
                    <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      {/* Row 1: Category Filter Dropdown */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                          <span className="font-extrabold text-slate-700 shrink-0 flex items-center gap-1 text-xs">
                            <Tag className="w-3.5 h-3.5 text-indigo-600" /> Dropdown Filter Kategori:
                          </span>
                          <select
                            value={bulkCategoryFilter}
                            onChange={(e) => setBulkCategoryFilter(e.target.value)}
                            className="bg-white text-indigo-950 font-extrabold text-xs px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                          >
                            <option value="all">
                              Semua Kategori ({
                                bulkItems.filter(it => {
                                  if (bulkViewTaxFilter === 'PPN') return it.taxType === 'PPN';
                                  if (bulkViewTaxFilter === 'NON_PPN') return it.taxType === 'NON_PPN';
                                  return true;
                                }).length
                              } Item)
                            </option>
                            {uniqueCategories.map(cat => {
                              const catInBulk = bulkItems.filter(it => {
                                const m = medicines.find(med => med.id === it.medicineId);
                                if (!m || m.category !== cat) return false;
                                if (bulkViewTaxFilter === 'PPN') return it.taxType === 'PPN';
                                if (bulkViewTaxFilter === 'NON_PPN') return it.taxType === 'NON_PPN';
                                return true;
                              }).length;

                              return (
                                <option key={cat} value={cat}>
                                  Kategori: {cat} ({catInBulk} Item)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Tax Filter Tabs & Summary Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                        <div className="flex items-center gap-2 overflow-x-auto">
                          <span className="font-bold text-slate-700 shrink-0">Filter Perpajakan:</span>
                          <button
                            type="button"
                            onClick={() => handleSwitchBulkTaxFilter('all')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${
                              bulkViewTaxFilter === 'all'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            Semua Perpajakan ({bulkMetrics.totalItems})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchBulkTaxFilter('PPN')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer border ${
                              bulkViewTaxFilter === 'PPN'
                                ? 'bg-blue-900 text-white border-blue-800 shadow-2xs'
                                : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            🏷️ Faktur PPN 11% ({bulkMetrics.ppnItemCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwitchBulkTaxFilter('NON_PPN')}
                            className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer border ${
                              bulkViewTaxFilter === 'NON_PPN'
                                ? 'bg-slate-900 text-white border-slate-800 shadow-2xs'
                                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            📦 Nota Non-PPN ({bulkMetrics.nonPpnItemCount})
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          {bulkCategoryFilter !== 'all' && (
                            <button
                              type="button"
                              onClick={() => handleAddCategoryMedsToBulk(bulkCategoryFilter)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs text-[11px]"
                            >
                              ⚡ Muat Sediaan "{bulkCategoryFilter}"
                            </button>
                          )}
                          <span className="text-blue-900 font-bold bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200">
                            🏷️ PPN 11%: {bulkMetrics.ppnItemCount} Item
                          </span>
                          <span className="text-slate-800 font-bold bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300">
                            📦 Non-PPN: {bulkMetrics.nonPpnItemCount} Item
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-3 w-8 text-center">No</th>
                            <th className="py-3 px-3 min-w-[200px]">Sediaan Obat & Kategori</th>
                            <th className="py-3 px-3 text-center min-w-[120px]">Jenis Perpajakan</th>
                            <th className="py-3 px-3 text-center w-24">Qty Masuk</th>
                            <th className="py-3 px-3 min-w-[130px]">HPP Beli Modal (Rp)</th>
                            <th className="py-3 px-3 min-w-[130px]">Harga Jual (Rp)</th>
                            <th className="py-3 px-3 text-center min-w-[150px]">Rincian Margin & Laba</th>
                            <th className="py-3 px-3 text-center w-12">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bulkItems.filter(item => {
                            const medObj = medicines.find(m => m.id === item.medicineId);
                            const matchCategory = bulkCategoryFilter === 'all' || (medObj && medObj.category === bulkCategoryFilter);
                            const matchTax = bulkViewTaxFilter === 'all' || item.taxType === bulkViewTaxFilter;
                            return matchCategory && matchTax;
                          }).length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                <div className="space-y-2">
                                  <p className="font-semibold text-slate-600">
                                    Tidak ada item restock pada tab <strong>Kategori: {bulkCategoryFilter === 'all' ? 'Semua Kategori' : bulkCategoryFilter}</strong>
                                    {bulkViewTaxFilter !== 'all' && ` & Tax: ${bulkViewTaxFilter === 'PPN' ? 'Faktur PPN 11%' : 'Nota Non-PPN'}`}.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleAddCategoryMedsToBulk(bulkCategoryFilter)}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                                  >
                                    ⚡ Muat Semua Obat Kategori "{bulkCategoryFilter === 'all' ? 'Semua Kategori' : bulkCategoryFilter}"
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            bulkItems
                              .filter(item => {
                                const medObj = medicines.find(m => m.id === item.medicineId);
                                const matchCategory = bulkCategoryFilter === 'all' || (medObj && medObj.category === bulkCategoryFilter);
                                const matchTax = bulkViewTaxFilter === 'all' || item.taxType === bulkViewTaxFilter;
                                return matchCategory && matchTax;
                              })
                              .map((item, idx) => {
                              const medObj = medicines.find(m => m.id === item.medicineId);
                              const currentStk = medObj ? medObj.stock : 0;
                              const newStk = currentStk + Number(item.amount || 0);

                              // Margin & Tax calculations
                              const hpp = Number(item.purchasePrice || 0);
                              const sell = Number(item.sellingPrice || 0);
                              const isPpn = item.taxType === 'PPN';
                              const dppBeli = isPpn ? Math.round(hpp / 1.11) : hpp;
                              const ppnInputUnit = isPpn ? hpp - dppBeli : 0;
                              const profitPerUnit = sell - hpp;
                              const marginPct = sell > 0 ? Math.round((profitPerUnit / sell) * 10000) / 100 : 0;
                              const markupPct = hpp > 0 ? Math.round((profitPerUnit / hpp) * 10000) / 100 : 0;
                              const totalBatchProfit = profitPerUnit * Number(item.amount || 0);

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                                  <td className="py-3 px-3 text-center font-bold text-slate-400">
                                    {idx + 1}
                                  </td>

                                  {/* Medicine Dropdown */}
                                  <td className="py-3 px-3">
                                    <select
                                      required
                                      value={item.medicineId}
                                      onChange={e =>
                                        handleBulkRestockItemChange(item.id, 'medicineId', e.target.value)
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                                    >
                                      {medicines
                                        .filter(m => {
                                          if (!m.isActive && m.id !== item.medicineId) return false;
                                          if (bulkCategoryFilter !== 'all' && m.category !== bulkCategoryFilter && m.id !== item.medicineId) return false;
                                          const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                                          if (bulkViewTaxFilter === 'PPN') return isMedPpn || m.id === item.medicineId;
                                          if (bulkViewTaxFilter === 'NON_PPN') return !isMedPpn || m.id === item.medicineId;
                                          return true;
                                        })
                                        .map(m => {
                                          const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                                          return (
                                            <option key={m.id} value={m.id}>
                                              {m.name} ({m.code}) — {m.category} [{isMedPpn ? 'PPN 11%' : 'Non-PPN'}]
                                            </option>
                                          );
                                        })}
                                    </select>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
                                      <span>Stok: {currentStk} → <strong className="text-emerald-700">{newStk} {medObj?.unit}</strong></span>
                                      <span className="font-semibold text-indigo-700">{medObj?.category}</span>
                                    </div>
                                  </td>

                                  {/* Tax Status Informative Badge (PPN vs NON_PPN) */}
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                        isPpn
                                          ? 'bg-blue-50 text-blue-900 border-blue-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {isPpn ? '🏷️ PPN 11%' : '📦 Non-PPN'}
                                    </span>
                                    {isPpn && (
                                      <span className="block text-[9px] text-blue-700 font-medium mt-0.5">
                                        PPN: {formatRupiah(ppnInputUnit)}/unit
                                      </span>
                                    )}
                                  </td>

                                  {/* Amount Input */}
                                  <td className="py-3 px-3">
                                    <input
                                      type="number"
                                      min="1"
                                      required
                                      value={item.amount}
                                      onChange={e =>
                                        handleBulkRestockItemChange(
                                          item.id,
                                          'amount',
                                          Math.max(1, Number(e.target.value))
                                        )
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-emerald-400 font-black text-emerald-800 text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                  </td>

                                  {/* Purchase Price Input */}
                                  <td className="py-3 px-3">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={item.purchasePrice}
                                      onChange={e =>
                                        handleBulkRestockItemChange(
                                          item.id,
                                          'purchasePrice',
                                          Math.max(0, Number(e.target.value))
                                        )
                                      }
                                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="block text-[9px] text-slate-400 mt-0.5">
                                      {formatRupiah(hpp)}
                                    </span>
                                  </td>

                                  {/* Selling Price Input */}
                                  <td className="py-3 px-3">
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={item.sellingPrice}
                                      onChange={e =>
                                        handleBulkRestockItemChange(
                                          item.id,
                                          'sellingPrice',
                                          Math.max(0, Number(e.target.value))
                                        )
                                      }
                                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-indigo-900 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                    <span className="block text-[9px] text-slate-400 mt-0.5">
                                      {formatRupiah(sell)}
                                    </span>
                                  </td>

                                  {/* Detailed Margin Breakdown Cell */}
                                  <td className="py-3 px-3 text-center">
                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-left space-y-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500 font-medium">Laba/Unit:</span>
                                        <span className={`font-extrabold ${profitPerUnit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                          {formatRupiah(profitPerUnit)}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-500">Margin:</span>
                                        <span className={`font-black px-1.5 py-0.2 rounded ${
                                          marginPct >= 20 ? 'bg-emerald-100 text-emerald-800' : marginPct >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          {marginPct}% (Markup {markupPct}%)
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] border-t border-slate-200 pt-1">
                                        <span className="text-slate-500 font-medium">Total Profit Batch:</span>
                                        <span className="font-extrabold text-emerald-800">
                                          {formatRupiah(totalBatchProfit)}
                                        </span>
                                      </div>

                                      <label className="flex items-center gap-1.5 text-[9px] text-slate-600 font-medium pt-0.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={item.updateMedicineMaster}
                                          onChange={e =>
                                            handleBulkRestockItemChange(
                                              item.id,
                                              'updateMedicineMaster',
                                              e.target.checked
                                            )
                                          }
                                          className="rounded text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>Sync Ke Katalog Master</span>
                                      </label>
                                    </div>
                                  </td>

                                  {/* Remove Row */}
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBulkRow(item.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Hapus Baris"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Batch Summary & Profit Analytics Card */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-4.5 rounded-2xl shadow-md border border-slate-800 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Total Item & Volume</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-extrabold text-white">{bulkMetrics.totalItems} Jenis</span>
                          <span className="text-sm font-bold text-emerald-400">({bulkMetrics.totalQty} Unit)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          Faktur PPN: <strong>{bulkMetrics.ppnItemCount}</strong> | Non-PPN: <strong>{bulkMetrics.nonPpnItemCount}</strong>
                        </span>
                      </div>

                      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-700/80 pt-2 md:pt-0 md:pl-3">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Total HPP & PPN Masukan</span>
                        <span className="text-lg font-black text-amber-300 block">{formatRupiah(bulkMetrics.totalHppCost)}</span>
                        <span className="text-[10px] text-blue-300 block font-semibold">
                          PPN Masukan (11%): {formatRupiah(bulkMetrics.totalPpnInput)}
                        </span>
                      </div>

                      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-700/80 pt-2 md:pt-0 md:pl-3">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Proyeksi Omset Jual</span>
                        <span className="text-lg font-black text-indigo-200 block">{formatRupiah(bulkMetrics.totalExpectedRevenue)}</span>
                        <span className="text-[10px] text-emerald-400 block font-bold">
                          Est. Profit Kotor: {formatRupiah(bulkMetrics.totalGrossProfit)}
                        </span>
                      </div>

                      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-700/80 pt-2 md:pt-0 md:pl-3 flex flex-col justify-between">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Analisis Margin Batch</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xl font-extrabold text-emerald-400">{bulkMetrics.avgMarginPct}%</span>
                            <span className="text-xs text-slate-300 font-medium">(Markup {bulkMetrics.avgMarkupPct}%)</span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={bulkItems.length === 0}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 text-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Simpan & Update Stok ({bulkItems.length} Item)
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* MODE SINGLE RESTOCK FORM */}
              {restockMode === 'single' && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 max-w-2xl">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Form Penerimaan Stok Single & Perhitungan Margin
                  </h3>

                  <form onSubmit={handleSingleStockInSubmit} className="space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block font-semibold text-slate-700">Pilih Sediaan Obat</label>
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          <span className="text-slate-400">Filter Tax:</span>
                          <button
                            type="button"
                            onClick={() => setSingleTaxFilter('all')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              singleTaxFilter === 'all'
                                ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => setSingleTaxFilter('PPN')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              singleTaxFilter === 'PPN'
                                ? 'bg-blue-900 text-white shadow-2xs font-extrabold'
                                : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            🏷️ PPN 11%
                          </button>
                          <button
                            type="button"
                            onClick={() => setSingleTaxFilter('NON_PPN')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              singleTaxFilter === 'NON_PPN'
                                ? 'bg-slate-900 text-white shadow-2xs font-extrabold'
                                : 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            📦 Non-PPN
                          </button>
                        </div>
                      </div>
                      <select
                        required
                        value={selectedMedId}
                        onChange={e => handleSingleMedicineSelect(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="">-- Pilih Obat dari Katalog --</option>
                        {medicines
                          .filter(m => {
                            if (!m.isActive && m.id !== selectedMedId) return false;
                            const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                            if (singleTaxFilter === 'PPN') return isMedPpn || m.id === selectedMedId;
                            if (singleTaxFilter === 'NON_PPN') return !isMedPpn || m.id === selectedMedId;
                            return true;
                          })
                          .map(m => {
                            const isMedPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;
                            return (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.code}) — {m.category} [{isMedPpn ? 'PPN 11%' : 'Non-PPN'}] | Stok: {m.stock} {m.unit}
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Status Perpajakan Sediaan</label>
                        <div className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-between ${
                          singleTaxType === 'PPN'
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          <span className="flex items-center gap-1.5">
                            {singleTaxType === 'PPN' ? '🏷️ Faktur PPN 11%' : '📦 Nota Non-PPN'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            (Otomatis Master Obat)
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Jumlah Stok Masuk (+)</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={singleAmount}
                          onChange={e => setSingleAmount(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-emerald-300 font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">HPP Beli Modal (Rp/unit)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={singlePurchasePrice}
                          onChange={e => setSinglePurchasePrice(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Harga Jual Obat (Rp/unit)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={singleSellingPrice}
                          onChange={e => setSingleSellingPrice(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-indigo-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Single Item Margin Analysis Card */}
                    {singlePurchasePrice > 0 && singleSellingPrice > 0 && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Rincian Perhitungan Margin & Pajak Item</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[9px]">DPP Beli Bersih:</span>
                            <span className="font-bold text-slate-800">
                              {formatRupiah(singleTaxType === 'PPN' ? Math.round(singlePurchasePrice / 1.11) : singlePurchasePrice)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">PPN Masukan (11%):</span>
                            <span className="font-bold text-blue-800">
                              {formatRupiah(singleTaxType === 'PPN' ? Math.round(singlePurchasePrice - singlePurchasePrice / 1.11) : 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">Laba Kotor / Unit:</span>
                            <span className="font-extrabold text-emerald-700">
                              {formatRupiah(singleSellingPrice - singlePurchasePrice)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">Margin Laba:</span>
                            <span className="font-black text-emerald-800">
                              {singleSellingPrice > 0
                                ? (Math.round(((singleSellingPrice - singlePurchasePrice) / singleSellingPrice) * 10000) / 100)
                                : 0}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">Markup Modal:</span>
                            <span className="font-bold text-indigo-700">
                              {singlePurchasePrice > 0
                                ? (Math.round(((singleSellingPrice - singlePurchasePrice) / singlePurchasePrice) * 10000) / 100)
                                : 0}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px]">Est. Laba Total Batch:</span>
                            <span className="font-black text-emerald-900">
                              {formatRupiah((singleSellingPrice - singlePurchasePrice) * singleAmount)}
                            </span>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={singleUpdateMaster}
                            onChange={e => setSingleUpdateMaster(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Update harga modal & harga jual obat ini di Katalog Master Apotek</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Catatan / Supplier / No Faktur</label>
                      <input
                        type="text"
                        placeholder="e.g. Pembelian PBF Kimia Farma / Faktur #FK-8823"
                        value={singleNote}
                        onChange={e => setSingleNote(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                    >
                      Simpan & Tambahkan Stok
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: LOG & RIWAYAT STOK MASUK */}
          {restockTab === 'log' && (
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
                    {filteredRestockHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Belum ada riwayat penerimaan stok masuk yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      filteredRestockHistory.map((sh, idx) => {
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
                              {sh.purchasePrice ? (
                                <div className="text-[11px]">
                                  <span className="text-slate-500 block">HPP: <strong>{formatRupiah(sh.purchasePrice)}</strong></span>
                                  <span className="text-indigo-700 font-bold block">Jual: {formatRupiah(sh.sellingPrice || 0)}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {sh.marginPct !== undefined ? (
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                                  sh.marginPct >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {sh.marginPct}%
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-xs">{sh.note || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <span className="font-bold text-slate-700 shrink-0">Status Pajak:</span>
                    <button
                      type="button"
                      onClick={() => setOpnameTaxFilter('all')}
                      className={`px-3 py-1 rounded-xl font-bold transition-all ${
                        opnameTaxFilter === 'all'
                          ? 'bg-emerald-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Semua Sediaan ({medicines.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameTaxFilter('PPN')}
                      className={`px-3 py-1 rounded-xl font-bold transition-all border ${
                        opnameTaxFilter === 'PPN'
                          ? 'bg-blue-900 text-white border-blue-800 shadow-2xs font-extrabold'
                          : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      🏷️ Obat PPN 11% ({opnameTaxStats.ppnMedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpnameTaxFilter('NON_PPN')}
                      className={`px-3 py-1 rounded-xl font-bold transition-all border ${
                        opnameTaxFilter === 'NON_PPN'
                          ? 'bg-slate-900 text-white border-slate-800 shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      📦 Obat Non-PPN ({opnameTaxStats.nonPpnMedCount})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari kode, nama obat, lokasi..."
                      value={opnameSearchTerm}
                      onChange={e => setOpnameSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl text-xs hover:bg-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={showOnlyDiff}
                      onChange={e => setShowOnlyDiff(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Hanya Tampilkan Barang Yang Selisih Stok</span>
                  </label>
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
                      {filteredOpnameMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Tidak ada sediaan obat yang sesuai dengan filter pencarian / kategori / status PPN.
                          </td>
                        </tr>
                      ) : (
                        filteredOpnameMedicines.map((m, idx) => {
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
                                {idx + 1}
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
                                {m.stock} {m.unit}
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

                <div className="flex items-center gap-3">
                  {/* Tax Filter Buttons */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setOpnameHistoryTaxFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
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
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
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
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
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
                    {filteredOpnameHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada riwayat penyesuaian opnam yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOpnameHistory.map((sh, idx) => {
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
    </div>
  );
};
