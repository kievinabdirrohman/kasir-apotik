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
  initialMedicines,
  initialCustomers,
  initialDoctors,
  initialUsers,
  initialTransactions,
  initialStockHistory,
  initialSettings,
} from '../data/initialData';
import { getDaysUntilExpired, getWIBDateTimeString, getWIBDateString } from '../utils/formatters';
import { validatePasswordStrength } from '../utils/authUtils';

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
  addCashFlow: (cashFlow: Omit<CashFlow, 'id' | 'date' | 'recordedBy'>) => void;
  deleteCashFlow: (id: string) => void;

  // Medicine Actions
  addMedicine: (medicine: Omit<Medicine, 'id'>) => Medicine;
  updateMedicine: (id: string, medicine: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  restoreMedicine: (id: string) => void;

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
  ) => void;
  adjustStock: (medicineId: string, newStock: number, note: string) => void;
  bulkAdjustStock: (adjustments: { medicineId: string; newStock: number; note: string }[]) => void;
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
  ) => void;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'memberNo' | 'totalSpent' | 'totalTransactions' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Doctor Actions
  addDoctor: (doctor: Omit<Doctor, 'id' | 'totalPrescriptions' | 'createdAt'>) => Doctor;
  updateDoctor: (id: string, doctor: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;

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
  }) => Transaction;
  cancelTransaction: (transactionId: string, reason: string) => void;

  // User & Settings Actions
  addUser: (user: Omit<User, 'id' | 'createdAt'> & { password?: string }) => { success: boolean; message: string };
  updateUser: (id: string, user: Partial<User>) => { success: boolean; message: string };
  deleteUser: (id: string) => { success: boolean; message: string };
  updateSettings: (newSettings: Partial<PharmacySettings>) => void;
  resetToDefaultData: () => void;

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getInitialStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error loading localStorage key "${key}":`, e);
    return defaultValue;
  }
}

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

  const [users, setUsers] = useState<User[]>(() => {
    const stored = getInitialStorage<User[]>('apotek_users', initialUsers);
    // Ensure Super Admin exists
    const hasSuperAdmin = stored.some(u => u.isSuperAdmin || u.id === 'usr-superadmin' || u.username === 'superadmin');
    const baseList = hasSuperAdmin ? stored : [initialUsers[0], ...stored];

    return baseList.map(u => {
      const matchInitial = initialUsers.find(i => i.id === u.id || i.username === u.username);
      return {
        ...u,
        password: u.password || matchInitial?.password || 'Apotek#2026!',
        isSuperAdmin: u.isSuperAdmin ?? (u.id === 'usr-superadmin' || u.username === 'superadmin'),
      };
    });
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const active = getInitialStorage<User | null>('apotek_active_user', null);
    if (!active) return null;
    const found = users.find(u => u.id === active.id || u.username === active.username);
    if (found && found.status === 'aktif') {
      return found;
    }
    return null;
  });

  const [settings, setSettings] = useState<PharmacySettings>(() =>
    getInitialStorage('apotek_settings', initialSettings)
  );

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const rawMeds = getInitialStorage<Medicine[]>('apotek_medicines', initialMedicines);
    return rawMeds.map(med => {
      if (med.unit === 'Lusin') {
        return {
          ...med,
          unitMultiplier: 12,
        };
      }
      return med;
    });
  });

  const [customers, setCustomers] = useState<Customer[]>(() =>
    getInitialStorage('apotek_customers', initialCustomers)
  );

  const [doctors, setDoctors] = useState<Doctor[]>(() =>
    getInitialStorage('apotek_doctors', initialDoctors)
  );

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    getInitialStorage('apotek_transactions', initialTransactions)
  );

  const [stockHistory, setStockHistory] = useState<StockHistory[]>(() =>
    getInitialStorage('apotek_stock_history', initialStockHistory)
  );

  const [cashFlows, setCashFlows] = useState<CashFlow[]>(() =>
    getInitialStorage('apotek_cash_flows', [])
  );

  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('apotek_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('apotek_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('apotek_active_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('apotek_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('apotek_medicines', JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem('apotek_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('apotek_doctors', JSON.stringify(doctors));
  }, [doctors]);

  useEffect(() => {
    localStorage.setItem('apotek_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('apotek_stock_history', JSON.stringify(stockHistory));
  }, [stockHistory]);

  useEffect(() => {
    localStorage.setItem('apotek_cash_flows', JSON.stringify(cashFlows));
  }, [cashFlows]);

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
  const addMedicine = (medData: Omit<Medicine, 'id'>): Medicine => {
    const newMed: Medicine = {
      ...medData,
      id: `med-${Date.now()}`,
    };
    setMedicines(prev => [newMed, ...prev]);

    // Record initial stock entry
    if (medData.stock > 0) {
      const historyItem: StockHistory = {
        id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        medicineId: newMed.id,
        medicineCode: newMed.code,
        medicineName: newMed.name,
        type: 'masuk',
        amount: medData.stock,
        prevStock: 0,
        newStock: medData.stock,
        date: getWIBDateTimeString(),
        note: `Stok awal ${newMed.itemType === 'non_obat' ? 'barang non-obat' : 'obat'} baru`,
        user: currentUser?.name || 'Sistem',
        taxType: (newMed.isPpnIncluded ?? true) && (newMed.ppnRate ?? 11) > 0 ? 'PPN' : 'NON_PPN',
        purchasePrice: newMed.purchasePrice,
        sellingPrice: newMed.price,
        marginPct: newMed.marginPct,
        bhpAmount: newMed.bhpAmount,
        itemType: newMed.itemType || 'obat',
      };
      setStockHistory(prev => [historyItem, ...prev]);
    }
    return newMed;
  };

  const updateMedicine = (id: string, updatedFields: Partial<Medicine>) => {
    setMedicines(prev =>
      prev.map(m => (m.id === id ? { ...m, ...updatedFields } : m))
    );
  };

  // Safe delete function: Soft-deletes medicine by marking isActive: false
  // so that historical transaction reports, financial statements, and HPP calculations remain 100% intact!
  const deleteMedicine = (id: string) => {
    // Check if medicine has transactions or stock history
    const hasTransactions = transactions.some(t => t.items.some(it => it.medicineId === id));
    const hasHistory = stockHistory.some(sh => sh.medicineId === id);

    if (hasTransactions || hasHistory) {
      // Soft delete / archive to preserve historical sales & financial reports
      setMedicines(prev => prev.map(m => (m.id === id ? { ...m, isActive: false } : m)));
    } else {
      // If no historical records exist, can safely remove
      setMedicines(prev => prev.filter(m => m.id !== id));
    }
  };

  const restoreMedicine = (id: string) => {
    setMedicines(prev => prev.map(m => (m.id === id ? { ...m, isActive: true } : m)));
  };

  // Stock Actions
  const addStock = (
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
  ) => {
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

    updateMedicine(medicineId, updateData);

    const historyItem: StockHistory = {
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    setStockHistory(prev => [historyItem, ...prev]);
  };

  const adjustStock = (medicineId: string, newStock: number, note: string) => {
    const target = medicines.find(m => m.id === medicineId);
    if (!target) return;

    const prevStock = target.stock;
    const diff = newStock - prevStock;

    updateMedicine(medicineId, { stock: newStock });

    const isPpn = (target.isPpnIncluded ?? true) && (target.ppnRate ?? 11) > 0;

    const historyItem: StockHistory = {
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    setStockHistory(prev => [historyItem, ...prev]);
  };

  const bulkAdjustStock = (adjustments: { medicineId: string; newStock: number; note: string }[]) => {
    if (adjustments.length === 0) return;

    const dateStr = getWIBDateTimeString();
    const updatedMedMap = new Map<string, { newStock: number; note: string }>();
    adjustments.forEach(adj => {
      updatedMedMap.set(adj.medicineId, { newStock: adj.newStock, note: adj.note });
    });

    const newHistoryItems: StockHistory[] = [];

    medicines.forEach(m => {
      if (updatedMedMap.has(m.id)) {
        const { newStock, note } = updatedMedMap.get(m.id)!;
        const prevStock = m.stock;
        const diff = newStock - prevStock;
        const isPpn = (m.isPpnIncluded ?? true) && (m.ppnRate ?? 11) > 0;

        newHistoryItems.push({
          id: `sh-${Date.now()}-${m.id}-${Math.random().toString(36).substring(2, 7)}`,
          medicineId: m.id,
          medicineCode: m.code,
          medicineName: m.name,
          type: 'penyesuaian',
          amount: diff,
          prevStock,
          newStock,
          date: dateStr,
          note: note || 'Penyesuaian stok opnam bulk',
          user: currentUser?.name || 'Sistem',
          taxType: isPpn ? 'PPN' : 'NON_PPN',
          purchasePrice: m.purchasePrice,
          sellingPrice: m.price,
        });
      }
    });

    setMedicines(prevMeds => {
      return prevMeds.map(m => {
        if (updatedMedMap.has(m.id)) {
          const { newStock } = updatedMedMap.get(m.id)!;
          return { ...m, stock: newStock };
        }
        return m;
      });
    });

    if (newHistoryItems.length > 0) {
      setStockHistory(prev => [...newHistoryItems, ...prev]);
    }
  };

  const bulkAddStock = (
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
  ) => {
    if (items.length === 0) return;

    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const addMap = new Map<
      string,
      {
        totalAmount: number;
        lastItem: typeof items[0];
      }
    >();

    items.forEach(it => {
      const existing = addMap.get(it.medicineId) || { totalAmount: 0, lastItem: it };
      existing.totalAmount += it.amount;
      existing.lastItem = it;
      addMap.set(it.medicineId, existing);
    });

    const newHistoryItems: StockHistory[] = [];

    items.forEach(it => {
      const target = medicines.find(m => m.id === it.medicineId);
      if (target) {
        const prevStock = target.stock;
        const newStock = prevStock + it.amount;
        newHistoryItems.push({
          id: `sh-${Date.now()}-${it.medicineId}-${Math.random().toString(36).substring(2, 7)}`,
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
        });
      }
    });

    setMedicines(prevMeds => {
      return prevMeds.map(m => {
        if (addMap.has(m.id)) {
          const { totalAmount, lastItem } = addMap.get(m.id)!;
          const newMed = { ...m, stock: m.stock + totalAmount };
          if (lastItem?.updateMedicineMaster) {
            if (lastItem.purchasePrice !== undefined && lastItem.purchasePrice >= 0) {
              newMed.purchasePrice = lastItem.purchasePrice;
            }
            if (lastItem.bhpAmount !== undefined && lastItem.bhpAmount >= 0) {
              newMed.bhpAmount = lastItem.bhpAmount;
            }
            if (lastItem.marginPct !== undefined) {
              newMed.marginPct = lastItem.marginPct;
            }
            if (lastItem.sellingPrice !== undefined && lastItem.sellingPrice > 0) {
              newMed.price = lastItem.sellingPrice;
            }
            if (lastItem.taxType) {
              const isPpn = lastItem.taxType === 'PPN';
              newMed.isPpnIncluded = isPpn;
              newMed.ppnRate = isPpn ? 11 : 0;

              const purchase = lastItem.purchasePrice ?? m.purchasePrice ?? 0;
              const sell = lastItem.sellingPrice ?? m.price ?? 0;

              if (isPpn) {
                newMed.purchasePriceIncPpn = purchase;
                newMed.purchasePriceNonPpn = Math.round(purchase / 1.11);
                newMed.priceIncPpn = sell;
                newMed.priceNonPpn = Math.round(sell / 1.11);
              } else {
                newMed.purchasePriceNonPpn = purchase;
                newMed.purchasePriceIncPpn = Math.round(purchase * 1.11);
                newMed.priceNonPpn = sell;
                newMed.priceIncPpn = Math.round(sell * 1.11);
              }
            }
          }
          return newMed;
        }
        return m;
      });
    });

    if (newHistoryItems.length > 0) {
      setStockHistory(prev => [...newHistoryItems, ...prev]);
    }
  };

  // Customer Actions
  const addCustomer = (data: Omit<Customer, 'id' | 'memberNo' | 'totalSpent' | 'totalTransactions' | 'createdAt'>): Customer => {
    const memberCount = customers.length + 1;
    const memberNo = `MBR-${String(memberCount).padStart(3, '0')}`;
    const newCust: Customer = {
      ...data,
      id: `cust-${Date.now()}`,
      memberNo,
      totalSpent: 0,
      totalTransactions: 0,
      createdAt: getWIBDateString(),
    };
    setCustomers(prev => [newCust, ...prev]);
    return newCust;
  };

  const updateCustomer = (id: string, data: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Doctor Actions
  const addDoctor = (data: Omit<Doctor, 'id' | 'totalPrescriptions' | 'createdAt'>): Doctor => {
    const newDoc: Doctor = {
      ...data,
      id: `doc-${Date.now()}`,
      totalPrescriptions: 0,
      createdAt: getWIBDateString(),
    };
    setDoctors(prev => [newDoc, ...prev]);
    return newDoc;
  };

  const updateDoctor = (id: string, data: Partial<Doctor>) => {
    setDoctors(prev => prev.map(d => (d.id === id ? { ...d, ...data } : d)));
  };

  const deleteDoctor = (id: string) => {
    setDoctors(prev => prev.filter(d => d.id !== id));
  };

  // Transaction / POS Execution
  const createTransaction = ({
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
  }): Transaction => {
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

    // 1. Subtract stocks & add stock history atomically
    const newHistories: StockHistory[] = [];

    items.forEach(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      if (med) {
        const multiplier = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || (med.unit === 'Lusin' ? 12 : 1));
        const qtyToDeduct = item.qty * multiplier;
        const prevStock = med.stock;
        const newStock = Math.max(0, prevStock - qtyToDeduct);

        newHistories.push({
          id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${med.id}`,
          medicineId: med.id,
          medicineCode: med.code,
          medicineName: med.name,
          type: 'keluar',
          amount: qtyToDeduct,
          prevStock,
          newStock,
          date: nowFormatted,
          note: `Penjualan ${trxNo} (${item.qty} ${item.unit}${multiplier > 1 ? ` = ${qtyToDeduct} pcs` : ''})`,
          user: currentUser?.name || 'Kasir',
          itemType: item.itemType || med.itemType || 'obat',
        });
      }
    });

    setMedicines(prevMeds => {
      return prevMeds.map(med => {
        const item = items.find(it => it.medicineId === med.id);
        if (!item) return med;
        const multiplier = item.unit === 'Lusin' ? 12 : (item.unitMultiplier || (med.unit === 'Lusin' ? 12 : 1));
        const qtyToDeduct = item.qty * multiplier;
        return { ...med, stock: Math.max(0, med.stock - qtyToDeduct) };
      });
    });

    if (newHistories.length > 0) {
      setStockHistory(prev => [...newHistories, ...prev]);
    }

    // 2. Update Customer Metrics
    if (customerObj) {
      updateCustomer(customerObj.id, {
        totalSpent: customerObj.totalSpent + finalTotalAmount,
        totalTransactions: customerObj.totalTransactions + 1,
      });
    }

    // 3. Update Doctor Metrics
    if (doctorObj) {
      updateDoctor(doctorObj.id, {
        totalPrescriptions: doctorObj.totalPrescriptions + 1,
      });
    }

    setTransactions(prev => [newTransaction, ...prev]);
    setLastTransaction(newTransaction);

    return newTransaction;
  };

  // Cancel Transaction (Admin Only)
  const cancelTransaction = (transactionId: string, reason: string) => {
    const target = transactions.find(t => t.id === transactionId);
    if (!target || target.status === 'Dibatalkan') return;

    const nowFormatted = getWIBDateTimeString();

    // 1. Revert medicine stocks atomically
    const revertHistories: StockHistory[] = [];

    target.items.forEach(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      if (med) {
        const prevStock = med.stock;
        const newStock = prevStock + item.qty;

        revertHistories.push({
          id: `sh-cancel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${med.id}`,
          medicineId: med.id,
          medicineCode: med.code,
          medicineName: med.name,
          type: 'masuk',
          amount: item.qty,
          prevStock,
          newStock,
          date: nowFormatted,
          note: `Pembatalan Transaksi ${target.trxNo} (${reason})`,
          user: currentUser?.name || 'Sistem',
        });
      }
    });

    setMedicines(prevMeds => {
      return prevMeds.map(med => {
        const item = target.items.find(it => it.medicineId === med.id);
        if (!item) return med;
        return { ...med, stock: med.stock + item.qty };
      });
    });

    if (revertHistories.length > 0) {
      setStockHistory(prev => [...revertHistories, ...prev]);
    }

    // 2. Revert Customer Metrics
    if (target.customerId) {
      const cust = customers.find(c => c.id === target.customerId);
      if (cust) {
        updateCustomer(cust.id, {
          totalSpent: Math.max(0, cust.totalSpent - target.totalAmount),
          totalTransactions: Math.max(0, cust.totalTransactions - 1),
        });
      }
    }

    // 3. Revert Doctor Metrics
    if (target.doctorId) {
      const doc = doctors.find(d => d.id === target.doctorId);
      if (doc) {
        updateDoctor(doc.id, {
          totalPrescriptions: Math.max(0, doc.totalPrescriptions - 1),
        });
      }
    }

    // Update Transaction status
    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId
          ? {
              ...t,
              status: 'Dibatalkan',
              cancelReason: reason,
              cancelledBy: currentUser?.name || 'Admin',
              cancelledAt: nowFormatted,
            }
          : t
      )
    );
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
    localStorage.setItem('apotek_active_user', JSON.stringify(foundUser));
    return {
      success: true,
      message: `Selamat datang kembali, ${foundUser.name}!`,
      user: foundUser,
    };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('apotek_active_user');
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
    localStorage.setItem('apotek_active_user', JSON.stringify(updatedUser));

    return { success: true, message: 'Profil dan kredensial Anda berhasil diperbarui.' };
  };

  // CashFlow & User Management
  const addCashFlow = (cashFlow: Omit<CashFlow, 'id' | 'date' | 'recordedBy'>) => {
    const newCashFlow: CashFlow = {
      ...cashFlow,
      id: `cf-${Date.now()}`,
      date: getWIBDateTimeString(),
      recordedBy: currentUser?.name || 'Sistem',
    };
    setCashFlows(prev => [newCashFlow, ...prev]);
  };

  const deleteCashFlow = (id: string) => {
    setCashFlows(prev => prev.filter(cf => cf.id !== id));
  };

  const addUser = (userData: Omit<User, 'id' | 'createdAt'> & { password?: string }) => {
    const cleanUsername = userData.username.trim();
    if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return { success: false, message: 'Username sudah digunakan oleh akun lain.' };
    }

    const userPassword = userData.password || 'Apotek#2026!';
    const val = validatePasswordStrength(userPassword);
    if (!val.isValid) {
      return {
        success: false,
        message: `Password tidak memenuhi standar keamanan: ${val.errors.join(' ')}`,
      };
    }

    const newUser: User = {
      ...userData,
      username: cleanUsername,
      password: userPassword,
      isSuperAdmin: false,
      id: `usr-${Date.now()}`,
      createdAt: getWIBDateString(),
    };

    setUsers(prev => [...prev, newUser]);
    return { success: true, message: 'User baru berhasil ditambahkan.' };
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return { success: false, message: 'User tidak ditemukan.' };

    // Protection rule: If target is Super Admin, only Super Admin can edit themselves
    if (targetUser.isSuperAdmin && currentUser?.id !== targetUser.id) {
      return {
        success: false,
        message: 'Akun Admin Utama dilindungi. Hanya Admin Utama yang dapat mengubah data akun tersebut.',
      };
    }

    if (data.username) {
      const cleanUsername = data.username.trim();
      const existing = users.find(
        u => u.username.toLowerCase() === cleanUsername.toLowerCase() && u.id !== id
      );
      if (existing) {
        return { success: false, message: 'Username sudah digunakan oleh akun lain.' };
      }
    }

    if (data.password && data.password.trim().length > 0) {
      const val = validatePasswordStrength(data.password);
      if (!val.isValid) {
        return {
          success: false,
          message: `Password baru tidak memenuhi standar keamanan: ${val.errors.join(' ')}`,
        };
      }
    }

    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...data } : u)));
    if (currentUser?.id === id) {
      const updatedCurrent = { ...currentUser, ...data };
      setCurrentUser(updatedCurrent);
      localStorage.setItem('apotek_active_user', JSON.stringify(updatedCurrent));
    }
    return { success: true, message: 'Data user berhasil diperbarui.' };
  };

  const deleteUser = (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return { success: false, message: 'User tidak ditemukan.' };

    // Rule 1: Cannot delete logged in account
    if (currentUser && id === currentUser.id) {
      return {
        success: false,
        message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.',
      };
    }

    // Rule 2: Cannot delete Super Admin
    if (targetUser.isSuperAdmin || targetUser.id === 'usr-superadmin') {
      return { success: false, message: 'Akun Admin Utama dilindungi dan tidak dapat dihapus.' };
    }

    setUsers(prev => prev.filter(u => u.id !== id));
    return { success: true, message: 'User berhasil dihapus.' };
  };

  // Settings Management
  const updateSettings = (newSettings: Partial<PharmacySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Reset to default sample state
  const resetToDefaultData = () => {
    setMedicines([]);
    setCustomers([]);
    setDoctors([]);
    setCashFlows([]);
    setUsers(initialUsers);
    setCurrentUser(null);
    setTransactions([]);
    setStockHistory([]);
    setSettings(initialSettings);
    localStorage.clear();
    localStorage.setItem('apotek_clean_init_v7', 'true');
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
      }}
    >
      {children}
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
