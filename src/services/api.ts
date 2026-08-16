import type {
  Medicine,
  Customer,
  Doctor,
  User,
  Transaction,
  StockHistory,
  CashFlow,
  PharmacySettings,
} from '../types';

let cachedBaseUrl: string | null = null;

/**
 * Resolve the API base URL once:
 *  - Desktop (Electron): the in-process server started by electron/main.ts
 *  - Web: VITE_API_URL, falling back to the standalone dev server
 */
async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const desktopApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (desktopApi?.getApiBase) {
    cachedBaseUrl = await desktopApi.getApiBase();
    return cachedBaseUrl;
  }
  cachedBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return cachedBaseUrl;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = await getBaseUrl();
  let res: Response;
  try {
    res = await fetch(baseUrl + path, options);
  } catch {
    throw new Error(`Server tidak dapat dijangkau di ${baseUrl}. Pastikan server berjalan dengan: tsx server.ts`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.data as T;
}

// ── Medicines ──────────────────────────────────────────────────────────────

export function getMedicines(): Promise<Medicine[]> {
  return apiFetch<Medicine[]>('/api/medicines');
}

export function addMedicine(m: Omit<Medicine, 'id'>): Promise<Medicine> {
  return apiFetch<Medicine>('/api/medicines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  });
}

export function updateMedicine(id: string, m: Partial<Medicine>): Promise<Medicine> {
  return apiFetch<Medicine>('/api/medicines/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  });
}

export function deleteMedicine(id: string): Promise<void> {
  return apiFetch<void>('/api/medicines/' + id, { method: 'DELETE' });
}

// ── Customers ──────────────────────────────────────────────────────────────

export function getCustomers(): Promise<Customer[]> {
  return apiFetch<Customer[]>('/api/customers');
}

export function addCustomer(c: Omit<Customer, 'id'>): Promise<Customer> {
  return apiFetch<Customer>('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });
}

export function updateCustomer(id: string, c: Partial<Customer>): Promise<Customer> {
  return apiFetch<Customer>('/api/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });
}

export function deleteCustomer(id: string): Promise<void> {
  return apiFetch<void>('/api/customers/' + id, { method: 'DELETE' });
}

// ── Doctors ────────────────────────────────────────────────────────────────

export function getDoctors(): Promise<Doctor[]> {
  return apiFetch<Doctor[]>('/api/doctors');
}

export function addDoctor(d: Omit<Doctor, 'id'>): Promise<Doctor> {
  return apiFetch<Doctor>('/api/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });
}

export function updateDoctor(id: string, d: Partial<Doctor>): Promise<Doctor> {
  return apiFetch<Doctor>('/api/doctors/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });
}

export function deleteDoctor(id: string): Promise<void> {
  return apiFetch<void>('/api/doctors/' + id, { method: 'DELETE' });
}

// ── Users ──────────────────────────────────────────────────────────────────

export function getUsers(): Promise<User[]> {
  return apiFetch<User[]>('/api/users');
}

export function addUser(u: Omit<User, 'id'>): Promise<User> {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  });
}

export function updateUser(id: string, u: Partial<User>): Promise<User> {
  return apiFetch<User>('/api/users/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(u),
  });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>('/api/users/' + id, { method: 'DELETE' });
}

// ── Transactions ───────────────────────────────────────────────────────────

export function getTransactions(): Promise<Transaction[]> {
  return apiFetch<Transaction[]>('/api/transactions');
}

export function createTransaction(t: Omit<Transaction, 'id'>): Promise<Transaction> {
  return apiFetch<Transaction>('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t),
  });
}

export function cancelTransaction(
  id: string,
  payload: { cancel_reason: string; cancelled_by: string },
): Promise<Transaction> {
  return apiFetch<Transaction>(`/api/transactions/${id}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── Stock History ──────────────────────────────────────────────────────────

export function getStockHistory(): Promise<StockHistory[]> {
  return apiFetch<StockHistory[]>('/api/stock_history');
}

export function addStockHistory(sh: Omit<StockHistory, 'id'> & { id?: string }): Promise<StockHistory> {
  return apiFetch<StockHistory>('/api/stock_history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sh),
  });
}

// ── Cash Flows ─────────────────────────────────────────────────────────────

export function getCashFlows(): Promise<CashFlow[]> {
  return apiFetch<CashFlow[]>('/api/cash_flows');
}

export function addCashFlow(cf: Omit<CashFlow, 'id'>): Promise<CashFlow> {
  return apiFetch<CashFlow>('/api/cash_flows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cf),
  });
}

export function updateCashFlow(id: string, cf: Partial<CashFlow>): Promise<CashFlow> {
  return apiFetch<CashFlow>('/api/cash_flows/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cf),
  });
}

export function deleteCashFlow(id: string): Promise<void> {
  return apiFetch<void>('/api/cash_flows/' + id, { method: 'DELETE' });
}

// ── Settings ───────────────────────────────────────────────────────────────

export function getSettings(): Promise<PharmacySettings> {
  return apiFetch<PharmacySettings>('/api/settings');
}

export function updateSettings(s: Partial<PharmacySettings>): Promise<PharmacySettings> {
  return apiFetch<PharmacySettings>('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
}

// ── Reset ──────────────────────────────────────────────────────────────────

export function resetData(payload: {
  settings: PharmacySettings;
  users: User[];
  medicines: Medicine[];
  customers: Customer[];
  doctors: Doctor[];
  transactions: Transaction[];
  stockHistory: StockHistory[];
  cashFlows: CashFlow[];
}): Promise<void> {
  return apiFetch<void>('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── App Init ───────────────────────────────────────────────────────────────

export async function initializeApp(): Promise<{
  medicines: Medicine[];
  customers: Customer[];
  doctors: Doctor[];
  users: User[];
  transactions: Transaction[];
  stockHistory: StockHistory[];
  cashFlows: CashFlow[];
  settings: PharmacySettings;
}> {
  const [medicines, customers, doctors, users, transactions, stockHistory, cashFlows, settings] =
    await Promise.all([
      getMedicines(),
      getCustomers(),
      getDoctors(),
      getUsers(),
      getTransactions(),
      getStockHistory(),
      getCashFlows(),
      getSettings(),
    ]);
  return { medicines, customers, doctors, users, transactions, stockHistory, cashFlows, settings };
}
