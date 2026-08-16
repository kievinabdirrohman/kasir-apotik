import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Medicine,
  Customer,
  Doctor,
  User,
  Transaction,
  StockHistory,
  PharmacySettings,
  ActiveTab,
  TransactionItem,
  CashFlow,
} from '../types';
import {
  initialUsers,
  initialSettings,
} from '../data/initialData';
import { getDaysUntilExpired, getWIBDateTimeString, getWIBDateString } from '../utils/formatters';
import { validatePasswordStrength } from '../utils/authUtils';
import {
  initializeApp,
  resetData,
  getMedicines,
  getStockHistory,
  addStockHistory,
  createTransaction as apiCreateTransaction,
  cancelTransaction as apiCancelTransaction,
  addMedicine as apiAddMedicine,
  updateMedicine as apiUpdateMedicine,
  deleteMedicine as apiDeleteMedicine,
  addCustomer as apiAddCustomer,
  updateCustomer as apiUpdateCustomer,
  deleteCustomer as apiDeleteCustomer,
  addDoctor as apiAddDoctor,
  updateDoctor as apiUpdateDoctor,
  deleteDoctor as apiDeleteDoctor,
  addUser as apiAddUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  updateSettings as apiUpdateSettings,
  addCashFlow as apiAddCashFlow,
  deleteCashFlow as apiDeleteCashFlow,
} from '../services/api';

interface AppContextType {
  // Navigation & User Role
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];

  // Auth Actions
  login: (username: string, password: string) => { success: boolean; message: string; user?: User };
  logout: () => void;
  updateProfile: (data: {
    name: string;
    username: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => { success: boolean; message: string };

  // Core Data
  medicines: Medicine[];
  customers: Customer[];
  doctors: Doctor[];
  transactions: Transaction[];
  stockHistory: StockHistory[];
  settings: PharmacySettings;
  cashFlows: CashFlow[];

  // CashFlow Actions
  addCashFlow: (cashFlow: Omit<CashFlow, 'id' | 'date' | 'recordedBy'>) => Promise<void>;
  deleteCashFlow: (id: string) => Promise<void>;

  // Medicine Actions
  addMedicine: (medicine: Omit<Medicine, 'id'>) => Promise<Medicine>;
  updateMedicine: (id: string, medicine: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  restoreMedicine: (id: string) => Promise<void>;

  // Stock In & Adjustment Actions
  addStock: (
    medicineId: string,
    amount: number,
    note: string,
    details?: {
      taxType?: 'PPN' | 'NON_PPN';
      purchasePrice?: number;
      sellingPrice?: number;
      ppnAmount?: number;
      marginPct?: number;
      updateMedicineMaster?: boolean;
    }
  ) => Promise<void>;
  adjustStock: (medicineId: string, newStock: number, note: string) => Promise<void>;
  bulkAdjustStock: (adjustments: { medicineId: string; newStock: number; note: string }[]) => Promise<void>;
  bulkAddStock: (
    items: {
      medicineId: string;
      amount: number;
      note: string;
      taxType?: 'PPN' | 'NON_PPN';
      purchasePrice?: number;
      sellingPrice?: number;
      ppnAmount?: number;
      marginPct?: number;
      updateMedicineMaster?: boolean;
    }[]
  ) => Promise<void>;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'memberNo' | 'totalSpent' | 'totalTransactions' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Doctor Actions
  addDoctor: (doctor: Omit<Doctor, 'id' | 'totalPrescriptions' | 'createdAt'>) => Promise<Doctor>;
  updateDoctor: (id: string, doctor: Partial<Doctor>) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;

  // Transaction / POS Actions
  createTransaction: (data: {
    items: TransactionItem[];
    customerId?: string;
    doctorId?: string;
    paymentMethod: 'Tunai' | 'QRIS' | 'Transfer';
    paymentAmount: number;
    isPrescription: boolean;
    prescriptionMarkupRate?: number;
    prescriptionRacikanFee?: number;
    overrideTotalAmount?: number;
    prescriptionFormulaMode?: string;
    prescriptionFormulaNote?: string;
    prescriptionNote?: string;
    taxType?: 'PPN' | 'NON_PPN';
    ppnRate?: number;
    isPpnIncluded?: boolean;
  }) => Promise<Transaction>;
  cancelTransaction: (transactionId: string, reason: string) => Promise<void>;

  // User & Settings Actions
  addUser: (user: Omit<User, 'id' | 'createdAt'> & { password?: string }) => Promise<{ success: boolean; message: string }>;
  updateUser: (id: string, user: Partial<User>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message: string }>;
  updateSettings: (newSettings: Partial<PharmacySettings>) => Promise<void>;
  resetToDefaultData: () => Promise<void>;

  // Computed Alert Counters
  lowStockCount: number;
  expiredCount: number;
  expiring30Count: number;
  expiring60Count: number;
  expiring90Count: number;
  expiring120Count: number;
  expiring180Count: number;

  // Last completed transaction for receipt modal
  lastTransaction: Transaction | null;
  setLastTransaction: (trx: Transaction | null) => void;
  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;

  // Async init state
  isLoading: boolean;
  apiError: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Ensure old sample data in localStorage is wiped once for clean testing
if (typeof window !== 'undefined' && localStorage.getItem('apotek_clean_init_v7') !== 'true') {
  localStorage.removeItem('apotek_medicines');
  localStorage.removeItem('apotek_customers');
  localStorage.removeItem('apotek_doctors');
  localStorage.removeItem('apotek_transactions');
  localStorage.removeItem('apotek_stock_history');
  localStorage.removeItem('apotek_cash_flows');
  localStorage.removeItem('apotek_settings');
  localStorage.setItem('apotek_clean_init_v7', 'true');
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [users, setUsers] = useState<User[]>(initialUsers);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const active = sessionStorage.getItem('apotek_active_user');
    if (!active) return null;
    try {
      return JSON.parse(active) as User;
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState<PharmacySettings>(initialSettings);

  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);

  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // API init on mount — load all collections from SQLite server
  useEffect(() => {
    async function init() {
      try {
        const data = await initializeApp();
        if (
          data.medicines.length === 0 &&
          data.users.length === 0 &&
          localStorage.getItem('apotek_migrated_to_sqlite') !== 'true'
        ) {
          // Empty DB and not yet seeded — load initial data
          const { initialMedicines, initialCustomers, initialDoctors, initialTransactions, initialStockHistory } = await import('../data/initialData');
          await resetData({
            settings: initialSettings,
            users: initialUsers,
            medicines: initialMedicines,
            customers: initialCustomers,
            doctors: initialDoctors,
            transactions: initialTransactions,
            stockHistory: initialStockHistory,
            cashFlows: [],
          });
          const seeded = await initializeApp();
          setMedicines(seeded.medicines);
          setCustomers(seeded.customers);
          setDoctors(seeded.doctors);
          setUsers(seeded.users);
          setTransactions(seeded.transactions);
          setStockHistory(seeded.stockHistory);
          setCashFlows(seeded.cashFlows);
          setSettings(seeded.settings);
        } else {
          setMedicines(data.medicines);
          setCustomers(data.customers);
          setDoctors(data.doctors);
          setUsers(data.users);
          setTransactions(data.transactions);
          setStockHistory(data.stockHistory);
          setCashFlows(data.cashFlows);
          setSettings(data.settings);
        }
      } catch (err: unknown) {
        setApiError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);
  // Computed Notification Counts
  const lowStockCount = medicines.filter(m => m.stock <= m.minStock && m.isActive).length;
  
  const expiredCount = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days < 0 && m.isActive;
  }).length;

  const expiring30Count = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days >= 0 && days <= 30 && m.isActive;
  }).length;

  const expiring60Count = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days > 30 && days <= 60 && m.isActive;
  }).length;

  const expiring90Count = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days > 60 && days <= 90 && m.isActive;
  }).length;

  const expiring120Count = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days > 90 && days <= 120 && m.isActive;
  }).length;

  const expiring180Count = medicines.filter(m => {
    const days = getDaysUntilExpired(m.expiredDate);
    return days > 120 && days <= 180 && m.isActive;
  }).length;

  // Medicine Actions
  const addMedicine = async (medData: Omit<Medicine, 'id'>): Promise<Medicine> => {
    const created = await apiAddMedicine(medData);
    setMedicines(prev => [created, ...prev]);
    // Record initial stock entry locally (no POST /api/stock_history endpoint)
    if (medData.stock > 0) {
      const historyItem: StockHistory = {
        id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        medicineId: created.id,
        medicineCode: created.code,
        medicineName: created.name,
        type: 'masuk',
        amount: medData.stock,
        prevStock: 0,
        newStock: medData.stock,
        date: getWIBDateTimeString(),
        note: `Stok awal ${created.itemType === 'non_obat' ? 'barang non-obat' : 'obat'} baru`,
        user: currentUser?.name || 'Sistem',
        taxType: (created.isPpnIncluded ?? true) && (created.ppnRate ?? 11) > 0 ? 'PPN' : 'NON_PPN',
        purchasePrice: created.purchasePrice,
        sellingPrice: created.price,
        marginPct: created.marginPct,
        bhpAmount: created.bhpAmount,
        itemType: created.itemType || 'obat',
      };
      setStockHistory(prev => [historyItem, ...prev]);
    }
    return created;
  };

  const updateMedicine = async (id: string, updatedFields: Partial<Medicine>): Promise<void> => {
    const updated = await apiUpdateMedicine(id, updatedFields);
    setMedicines(prev => prev.map(m => m.id === id ? updated : m));
  };

  // Safe delete: server handles soft/hard delete logic; refresh for authoritative state
  const deleteMedicine = async (id: string): Promise<void> => {
    await apiDeleteMedicine(id);
    const fresh = await getMedicines();
    setMedicines(fresh);
  };

  const restoreMedicine = async (id: string): Promise<void> => {
    const updated = await apiUpdateMedicine(id, { isActive: true });
    setMedicines(prev => prev.map(m => m.id === id ? updated : m));
  };

  // Stock Actions
  const addStock = async (
    medicineId: string,
    amount: number,
    note: string,
    details?: {
      taxType?: 'PPN' | 'NON_PPN';
      purchasePrice?: number;
      bhpAmount?: number;
      sellingPrice?: number;
      ppnAmount?: number;
      marginPct?: number;
      updateMedicineMaster?: boolean;
    }
  ): Promise<void> => {
    const target = medicines.find(m => m.id === medicineId);
    if (!target) return;

    const prevStock = target.stock;
    const newStock = prevStock + amount;

    const updateData: Partial<Medicine> = { stock: newStock };
    if (details?.updateMedicineMaster) {
      if (details.purchasePrice !== undefined && details.purchasePrice >= 0) updateData.purchasePrice = details.purchasePrice;
      if (details.bhpAmount !== undefined && details.bhpAmount >= 0) updateData.bhpAmount = details.bhpAmount;
      if (details.marginPct !== undefined) updateData.marginPct = details.marginPct;
      if (details.sellingPrice !== undefined && details.sellingPrice > 0) updateData.price = details.sellingPrice;
      if (details.taxType) {
        const isPpn = details.taxType === 'PPN';
        updateData.isPpnIncluded = isPpn;
        updateData.ppnRate = isPpn ? 11 : 0;

        const purchase = details.purchasePrice ?? target.purchasePrice ?? 0;
        const sell = details.sellingPrice ?? target.price ?? 0;

        if (isPpn) {
          updateData.purchasePriceIncPpn = purchase;
          updateData.purchasePriceNonPpn = Math.round(purchase / 1.11);
          updateData.priceIncPpn = sell;
          updateData.priceNonPpn = Math.round(sell / 1.11);
        } else {
          updateData.purchasePriceNonPpn = purchase;
          updateData.purchasePriceIncPpn = Math.round(purchase * 1.11);
          updateData.priceNonPpn = sell;
          updateData.priceIncPpn = Math.round(sell * 1.11);
        }
      }
    }

    try {
      const updated = await apiUpdateMedicine(medicineId, updateData);
      setMedicines(prev => prev.map(m => m.id === medicineId ? updated : m));

      const historyItem: Omit<StockHistory, 'id'> = {
        medicineId: target.id,
        medicineCode: target.code,
        medicineName: target.name,
        type: 'masuk',
        amount,
        prevStock,
        newStock,
        date: getWIBDateTimeString(),
        note: note || 'Stok masuk manual',
        user: currentUser?.name || 'Sistem',
        taxType: details?.taxType,
        purchasePrice: details?.purchasePrice,
        sellingPrice: details?.sellingPrice,
        ppnAmount: details?.ppnAmount,
        marginPct: details?.marginPct,
        itemType: target.itemType || 'obat',
      };
      const saved = await addStockHistory(historyItem);
      setStockHistory(prev => [saved, ...prev]);
    } catch (err) {
      console.error('addStock failed:', err);
    }
  };

  const adjustStock = async (medicineId: string, newStock: number, note: string): Promise<void> => {
    const target = medicines.find(m => m.id === medicineId);
    if (!target) return;

    const prevStock = target.stock;
    const diff = newStock - prevStock;

    try {
      const updated = await apiUpdateMedicine(medicineId, { stock: newStock });
      setMedicines(prev => prev.map(m => m.id === medicineId ? updated : m));

      const isPpn = (target.isPpnIncluded ?? true) && (target.ppnRate ?? 11) > 0;
      const historyItem: Omit<StockHistory, 'id'> = {
        medicineId: target.id,
        medicineCode: target.code,
        medicineName: target.name,
        type: 'penyesuaian',
        amount: diff,
        prevStock,
        newStock,
        date: getWIBDateTimeString(),
        note: note || 'Penyesuaian stok opnam',
        user: currentUser?.name || 'Sistem',
        taxType: isPpn ? 'PPN' : 'NON_PPN',
        purchasePrice: target.purchasePrice,
        sellingPrice: target.price,
      };
      const saved = await addStockHistory(historyItem);
      setStockHistory(prev => [saved, ...prev]);
    } catch (err) {
      console.error('adjustStock failed:', err);
    }
  };

  const bulkAdjustStock = async (adjustments: { medicineId: string; newStock: number; note: string }[]): Promise<void> => {
    if (adjustments.length === 0) return;

    const dateStr = getWIBDateTimeString();
    const newHistoryItems: StockHistory[] = [];

    for (const adj of adjustments) {
      const m = medicines.find(med => med.id === adj.medicineId);
      if (!m) continue;
      try {
        const updated = await apiUpdateMedicine(adj.medicineId, { stock: adj.newStock });
        const prevStock = m.stock;
        const diff = adj.newStock - prevStock;
        const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;

        setMedicines(prev => prev.map(med => med.id === adj.medicineId ? updated : med));

        const historyData: Omit<StockHistory, 'id'> = {
          medicineId: m.id,
          medicineCode: m.code,
          medicineName: m.name,
          type: 'penyesuaian',
          amount: diff,
          prevStock,
          newStock: adj.newStock,
          date: dateStr,
          note: adj.note || 'Penyesuaian stok opnam bulk',
          user: currentUser?.name || 'Sistem',
          taxType: isPpn ? 'PPN' : 'NON_PPN',
          purchasePrice: m.purchasePrice,
          sellingPrice: m.price,
        };
        const saved = await addStockHistory(historyData);
        newHistoryItems.push(saved);
      } catch (err) {
        console.error(`bulkAdjustStock failed for ${adj.medicineId}:`, err);
      }
    }

    if (newHistoryItems.length > 0) {
      setStockHistory(prev => [...newHistoryItems, ...prev]);
    }
  };

  const bulkAddStock = async (
    items: {
      medicineId: string;
      amount: number;
      note: string;
      taxType?: 'PPN' | 'NON_PPN';
      purchasePrice?: number;
      bhpAmount?: number;
      sellingPrice?: number;
      ppnAmount?: number;
      marginPct?: number;
      updateMedicineMaster?: boolean;
    }[]
  ): Promise<void> => {
    if (items.length === 0) return;

    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newHistoryItems: StockHistory[] = [];

    for (const it of items) {
      const target = medicines.find(m => m.id === it.medicineId);
      if (!target) continue;

      const prevStock = target.stock;
      const newStock = prevStock + it.amount;

      const updateData: Partial<Medicine> = { stock: newStock };
      if (it.updateMedicineMaster) {
        if (it.purchasePrice !== undefined && it.purchasePrice >= 0) updateData.purchasePrice = it.purchasePrice;
        if (it.bhpAmount !== undefined && it.bhpAmount >= 0) updateData.bhpAmount = it.bhpAmount;
        if (it.marginPct !== undefined) updateData.marginPct = it.marginPct;
        if (it.sellingPrice !== undefined && it.sellingPrice > 0) updateData.price = it.sellingPrice;
        if (it.taxType) {
          const isPpn = it.taxType === 'PPN';
          updateData.isPpnIncluded = isPpn;
          updateData.ppnRate = isPpn ? 11 : 0;

          const purchase = it.purchasePrice ?? target.purchasePrice ?? 0;
          const sell = it.sellingPrice ?? target.price ?? 0;

          if (isPpn) {
            updateData.purchasePriceIncPpn = purchase;
            updateData.purchasePriceNonPpn = Math.round(purchase / 1.11);
            updateData.priceIncPpn = sell;
            updateData.priceNonPpn = Math.round(sell / 1.11);
          } else {
            updateData.purchasePriceNonPpn = purchase;
            updateData.purchasePriceIncPpn = Math.round(purchase * 1.11);
            updateData.priceNonPpn = sell;
            updateData.priceIncPpn = Math.round(sell * 1.11);
          }
        }
      }

      try {
        const updated = await apiUpdateMedicine(it.medicineId, updateData);
        setMedicines(prev => prev.map(m => m.id === it.medicineId ? updated : m));

        const historyData: Omit<StockHistory, 'id'> = {
          medicineId: target.id,
          medicineCode: target.code,
          medicineName: target.name,
          type: 'masuk',
          amount: it.amount,
          prevStock,
          newStock,
          date: dateStr,
          note: it.note || 'Stok masuk bulk',
          user: currentUser?.name || 'Sistem',
          taxType: it.taxType,
          purchasePrice: it.purchasePrice,
          sellingPrice: it.sellingPrice,
          ppnAmount: it.ppnAmount,
          marginPct: it.marginPct,
          itemType: target.itemType || 'obat',
        };
        const saved = await addStockHistory(historyData);
        newHistoryItems.push(saved);
      } catch (err) {
        console.error(`bulkAddStock failed for ${it.medicineId}:`, err);
      }
    }

    if (newHistoryItems.length > 0) {
      setStockHistory(prev => [...newHistoryItems, ...prev]);
    }
  };

  // Customer Actions
  const addCustomer = async (data: Omit<Customer, 'id' | 'memberNo' | 'totalSpent' | 'totalTransactions' | 'createdAt'>): Promise<Customer> => {
    const memberCount = customers.length + 1;
    const memberNo = `MBR-${String(memberCount).padStart(3, '0')}`;
    const created = await apiAddCustomer({ ...data, memberNo, totalSpent: 0, totalTransactions: 0, createdAt: getWIBDateString() });
    setCustomers(prev => [created, ...prev]);
    return created;
  };

  const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
    const updated = await apiUpdateCustomer(id, data);
    setCustomers(prev => prev.map(c => c.id === id ? updated : c));
  };

  const deleteCustomer = async (id: string): Promise<void> => {
    await apiDeleteCustomer(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Doctor Actions
  const addDoctor = async (data: Omit<Doctor, 'id' | 'totalPrescriptions' | 'createdAt'>): Promise<Doctor> => {
    const created = await apiAddDoctor({ ...data, totalPrescriptions: 0, createdAt: getWIBDateString() });
    setDoctors(prev => [created, ...prev]);
    return created;
  };

  const updateDoctor = async (id: string, data: Partial<Doctor>): Promise<void> => {
    const updated = await apiUpdateDoctor(id, data);
    setDoctors(prev => prev.map(d => d.id === id ? updated : d));
  };

  const deleteDoctor = async (id: string): Promise<void> => {
    await apiDeleteDoctor(id);
    setDoctors(prev => prev.filter(d => d.id !== id));
  };

  // Transaction / POS Execution
  const createTransaction = async ({
    items,
    customerId,
    doctorId,
    paymentMethod,
    paymentAmount,
    isPrescription,
    prescriptionMarkupRate,
    prescriptionRacikanFee,
    overrideTotalAmount,
    prescriptionFormulaMode,
    prescriptionFormulaNote,
    prescriptionNote,
    taxType = 'PPN',
    ppnRate,
    isPpnIncluded = true,
  }: {
    items: TransactionItem[];
    customerId?: string;
    doctorId?: string;
    paymentMethod: 'Tunai' | 'QRIS' | 'Transfer';
    paymentAmount: number;
    isPrescription: boolean;
    prescriptionMarkupRate?: number;
    prescriptionRacikanFee?: number;
    overrideTotalAmount?: number;
    prescriptionFormulaMode?: string;
    prescriptionFormulaNote?: string;
    prescriptionNote?: string;
    taxType?: 'PPN' | 'NON_PPN';
    ppnRate?: number;
    isPpnIncluded?: boolean;
  }): Promise<Transaction> => {
    const todayStr = new Date().toISOString().replace(/-/g, '').substring(0, 8);
    const countToday = transactions.filter(t => t.trxNo.includes(todayStr)).length + 1;
    const trxNo = `TRX-${todayStr}-${String(countToday).padStart(3, '0')}`;

    const rawTotalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    let finalMarkupRate = 0;
    let finalRacikanFee = 0;
    let finalMarkupAmount = 0;

    if (isPrescription) {
      finalMarkupRate = prescriptionMarkupRate ?? (settings.defaultPrescriptionMarkup || 20);
      finalRacikanFee = prescriptionRacikanFee ?? (settings.defaultRacikanFee || 0);
      finalMarkupAmount = Math.round((rawTotalAmount * finalMarkupRate) / 100);
    }

    const calculatedBase = isPrescription 
      ? rawTotalAmount + finalMarkupAmount + finalRacikanFee 
      : rawTotalAmount;

    let baseTotal = overrideTotalAmount !== undefined ? overrideTotalAmount : calculatedBase;

    // Calculate Tax (PPN & DPP) considering item-level PPN status
    const effectivePpnRate = taxType === 'PPN' ? (ppnRate ?? (settings.defaultPpnRate || 11)) : 0;
    let finalTotalAmount = baseTotal;
    let dppAmount = baseTotal;
    let ppnAmount = 0;

    if (taxType === 'PPN' && effectivePpnRate > 0) {
      const ppnItemsSubtotal = items
        .filter(i => i.isPpn !== false)
        .reduce((sum, i) => sum + i.subtotal, 0);

      const ppnRatio = rawTotalAmount > 0 ? ppnItemsSubtotal / rawTotalAmount : 0;
      const effectivePpnItemsBase = Math.round(baseTotal * ppnRatio);
      const effectiveNonPpnItemsBase = baseTotal - effectivePpnItemsBase;

      if (isPpnIncluded) {
        // Harga POS sudah termasuk PPN (Include)
        const dppPpnPart = Math.round(effectivePpnItemsBase / (1 + effectivePpnRate / 100));
        ppnAmount = effectivePpnItemsBase - dppPpnPart;
        dppAmount = dppPpnPart + effectiveNonPpnItemsBase;
        finalTotalAmount = baseTotal;
      } else {
        // PPN ditambahkan di atas subtotal (Exclude)
        ppnAmount = Math.round((effectivePpnItemsBase * effectivePpnRate) / 100);
        dppAmount = baseTotal;
        finalTotalAmount = dppAmount + ppnAmount;
      }
    } else {
      dppAmount = baseTotal;
      ppnAmount = 0;
      finalTotalAmount = baseTotal;
    }

    const finalTaxType: 'PPN' | 'NON_PPN' = taxType === 'PPN' && effectivePpnRate > 0 && ppnAmount > 0 ? 'PPN' : 'NON_PPN';

    const changeAmount = Math.max(0, paymentAmount - finalTotalAmount);

    let customerObj: Customer | undefined;
    if (customerId) {
      customerObj = customers.find(c => c.id === customerId);
    }

    let doctorObj: Doctor | undefined;

    if (doctorId && isPrescription) {
      doctorObj = doctors.find(d => d.id === doctorId);
    }

    // Calculate breakdown of HPP & Omset for Obat vs Non-Obat
    let obatTotalAmount = 0;
    let nonObatTotalAmount = 0;
    let obatCostAmount = 0;
    let nonObatCostAmount = 0;

    items.forEach(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      const itType = item.itemType || med?.itemType || 'obat';
      const masterMult = med?.unit === 'Lusin' ? 12 : (med?.unitMultiplier || 1);
      const itemMult = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || masterMult);
      const purchasePrice = item.purchasePrice ?? med?.purchasePrice ?? Math.round(item.price * 0.75);

      const costPerPcs = masterMult > 1 ? purchasePrice / masterMult : purchasePrice;
      const qtyPcs = item.qty * itemMult;
      const totalItemCost = Math.round(costPerPcs * qtyPcs);

      if (itType === 'non_obat') {
        nonObatTotalAmount += item.subtotal;
        nonObatCostAmount += totalItemCost;
      } else {
        obatTotalAmount += item.subtotal;
        obatCostAmount += totalItemCost;
      }
    });

    const costAmount = obatCostAmount + nonObatCostAmount;

    const nowFormatted = getWIBDateTimeString();

    const newTransaction: Transaction = {
      id: `trx-${Date.now()}`,
      trxNo,
      date: nowFormatted,
      customerId: customerObj?.id,
      customerName: customerObj?.name,
      customerMemberNo: customerObj?.memberNo,
      doctorId: doctorObj?.id,
      doctorName: doctorObj?.name,
      prescriptionMarkupRate: finalMarkupRate,
      prescriptionMarkupAmount: finalMarkupAmount,
      prescriptionRacikanFee: finalRacikanFee,
      costAmount,
      obatTotalAmount,
      nonObatTotalAmount,
      obatCostAmount,
      nonObatCostAmount,
      cashierName: currentUser?.name || 'Kasir',
      cashierUsername: currentUser?.username || 'kasir',
      items: items.map(item => ({
        ...item,
        isPpn: finalTaxType === 'PPN' ? (item.isPpn !== false) : false,
        ppnRate: finalTaxType === 'PPN' ? (item.ppnRate || effectivePpnRate) : 0,
      })),
      totalAmount: finalTotalAmount,
      paymentMethod,
      paymentAmount,
      changeAmount,
      status: 'Selesai',
      isPrescription,
      prescriptionFormulaMode,
      prescriptionFormulaNote,
      prescriptionNote,
      taxType: finalTaxType,
      ppnRate: finalTaxType === 'PPN' ? effectivePpnRate : 0,
      dppAmount,
      ppnAmount,
      isPpnIncluded,
    };

    // Delegate to server: atomic stock deduction + stock_history + customer/doctor metrics
    const { id: _omit, ...transactionPayload } = newTransaction;
    const saved = await apiCreateTransaction(transactionPayload as Omit<Transaction, 'id'>);

    // Refresh authoritative state from server
    const [freshMeds, freshHistory] = await Promise.all([getMedicines(), getStockHistory()]);
    setMedicines(freshMeds);
    setStockHistory(freshHistory);
    setTransactions(prev => [saved, ...prev]);
    setLastTransaction(saved);

    return saved;
  };

  // Cancel Transaction (Admin Only)
  const cancelTransaction = async (transactionId: string, reason: string): Promise<void> => {
    const target = transactions.find(t => t.id === transactionId);
    if (!target || target.status === 'Dibatalkan') return;

    const updated = await apiCancelTransaction(transactionId, {
      cancel_reason: reason,
      cancelled_by: currentUser?.name || 'Admin',
    });

    const freshMeds = await getMedicines();
    setMedicines(freshMeds);
    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
  };

  // Auth & Session Logic
  const login = (usernameInput: string, passwordInput: string) => {
    const cleanUsername = usernameInput.trim().toLowerCase();
    const foundUser = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!foundUser || (foundUser.password && foundUser.password !== passwordInput)) {
      return {
        success: false,
        message: 'Username atau password salah. Jika Anda lupa username/password, silakan hubungi Admin Utama untuk reset credentials.',
      };
    }

    if (foundUser.status !== 'aktif') {
      return {
        success: false,
        message: 'Akun Anda sedang nonaktif. Silakan hubungi Admin Utama untuk mengaktifkan kembali akun Anda.',
      };
    }

    setCurrentUser(foundUser);
    sessionStorage.setItem('apotek_active_user', JSON.stringify(foundUser));
    return {
      success: true,
      message: `Selamat datang kembali, ${foundUser.name}!`,
      user: foundUser,
    };
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('apotek_active_user');
  };

  const updateProfile = ({
    name,
    username,
    phone,
    currentPassword,
    newPassword,
  }: {
    name: string;
    username: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    if (!currentUser) return { success: false, message: 'Tidak ada sesi login aktif.' };

    const cleanUsername = username.trim();
    if (!cleanUsername || !name.trim()) {
      return { success: false, message: 'Nama dan Username wajib diisi.' };
    }

    const existing = users.find(
      u => u.username.toLowerCase() === cleanUsername.toLowerCase() && u.id !== currentUser.id
    );
    if (existing) {
      return { success: false, message: 'Username sudah digunakan oleh akun lain.' };
    }

    let updatedPassword = currentUser.password;
    if (newPassword && newPassword.trim().length > 0) {
      if (currentUser.password && currentPassword !== currentUser.password) {
        return { success: false, message: 'Password saat ini salah.' };
      }

      const val = validatePasswordStrength(newPassword);
      if (!val.isValid) {
        return {
          success: false,
          message: `Password baru tidak memenuhi standar keamanan: ${val.errors.join(' ')}`,
        };
      }
      updatedPassword = newPassword;
    }

    const updatedUser: User = {
      ...currentUser,
      name: name.trim(),
      username: cleanUsername,
      phone: phone?.trim(),
      password: updatedPassword,
    };

    setUsers(prev => prev.map(u => (u.id === currentUser.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    sessionStorage.setItem('apotek_active_user', JSON.stringify(updatedUser));

    return { success: true, message: 'Profil dan kredensial Anda berhasil diperbarui.' };
  };

  // CashFlow & User Management
  const addCashFlow = async (cashFlow: Omit<CashFlow, 'id' | 'date' | 'recordedBy'>): Promise<void> => {
    const created = await apiAddCashFlow({ ...cashFlow, date: getWIBDateTimeString(), recordedBy: currentUser?.name || 'Sistem' });
    setCashFlows(prev => [created, ...prev]);
  };

  const deleteCashFlow = async (id: string): Promise<void> => {
    await apiDeleteCashFlow(id);
    setCashFlows(prev => prev.filter(cf => cf.id !== id));
  };

  const addUser = async (userData: Omit<User, 'id' | 'createdAt'> & { password?: string }): Promise<{ success: boolean; message: string }> => {
    try {
      const created = await apiAddUser({ ...userData, createdAt: getWIBDateString(), isSuperAdmin: false });
      setUsers(prev => [...prev, created]);
      return { success: true, message: 'User baru berhasil ditambahkan.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  };

  const updateUser = async (id: string, data: Partial<User>): Promise<{ success: boolean; message: string }> => {
    try {
      const updated = await apiUpdateUser(id, data);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
      if (currentUser?.id === id) {
        setCurrentUser(updated);
        sessionStorage.setItem('apotek_active_user', JSON.stringify(updated));
      }
      return { success: true, message: 'Data user berhasil diperbarui.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  };

  const deleteUser = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (currentUser && id === currentUser.id) {
      return { success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' };
    }
    try {
      await apiDeleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      return { success: true, message: 'User berhasil dihapus.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  };

  // Settings Management
  const updateSettings = async (newSettings: Partial<PharmacySettings>): Promise<void> => {
    const updated = await apiUpdateSettings(newSettings);
    setSettings(updated);
  };

  // Reset to default sample state
  const resetToDefaultData = async (): Promise<void> => {
    const { initialMedicines, initialCustomers, initialDoctors, initialTransactions, initialStockHistory } = await import('../data/initialData');
    await resetData({
      settings: initialSettings,
      users: initialUsers,
      medicines: initialMedicines,
      customers: initialCustomers,
      doctors: initialDoctors,
      transactions: initialTransactions,
      stockHistory: initialStockHistory,
      cashFlows: [],
    });
    const fresh = await initializeApp();
    setMedicines(fresh.medicines);
    setCustomers(fresh.customers);
    setDoctors(fresh.doctors);
    setUsers(fresh.users);
    setTransactions(fresh.transactions);
    setStockHistory(fresh.stockHistory);
    setCashFlows(fresh.cashFlows);
    setSettings(fresh.settings);
    setCurrentUser(null);
    sessionStorage.removeItem('apotek_active_user');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentUser,
        setCurrentUser,
        users,

        login,
        logout,
        updateProfile,
        medicines,
        customers,
        doctors,
        transactions,
        stockHistory,
        settings,
        cashFlows,

        addCashFlow,
        deleteCashFlow,

        addMedicine,
        updateMedicine,
        deleteMedicine,
        restoreMedicine,

        addStock,
        adjustStock,
        bulkAdjustStock,
        bulkAddStock,

        addCustomer,
        updateCustomer,
        deleteCustomer,

        addDoctor,
        updateDoctor,
        deleteDoctor,

        createTransaction,
        cancelTransaction,

        addUser,
        updateUser,
        deleteUser,
        updateSettings,
        resetToDefaultData,

        lowStockCount,
        expiredCount,
        expiring30Count,
        expiring60Count,
        expiring90Count,
        expiring120Count,
        expiring180Count,

        lastTransaction,
        setLastTransaction,
        isReceiptModalOpen,
        setIsReceiptModalOpen,

        isLoading,
        apiError,
      }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-screen text-xl">Loading...</div>
      ) : apiError ? (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600">Koneksi Server Gagal</h1>
          <p className="text-gray-700">{apiError}</p>
          <p className="text-gray-500 text-sm">Jalankan server dengan perintah: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev:server</code></p>
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
