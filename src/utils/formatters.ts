// Currency and Date formatting utilities for Indonesian locale

export function formatRupiah(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return 'Rp 0';
  const val = Number(amount);
  if (isNaN(val)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const normalized = dateString.includes(' ') && !dateString.includes('T') ? dateString.replace(' ', 'T') : dateString;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  try {
    const normalized = dateString.includes(' ') && !dateString.includes('T') ? dateString.replace(' ', 'T') : dateString;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatCashierName(name: string): string {
  if (!name) return '-';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

export function getWIBDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function getWIBDateTimeString(): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date());
}

export function getDaysUntilExpired(expiredDateStr: string): number {
  if (!expiredDateStr) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expiredDateStr);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiredStatus(expiredDateStr: string): {
  label: string;
  badgeColor: string;
  isExpired: boolean;
  days: number;
} {
  const days = getDaysUntilExpired(expiredDateStr);
  if (days < 0) {
    return {
      label: `Expired (${Math.abs(days)} hr lalu)`,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      isExpired: true,
      days,
    };
  } else if (days <= 30) {
    return {
      label: `Exp < 30 hr (${days} hr lagi)`,
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
      isExpired: false,
      days,
    };
  } else if (days <= 60) {
    return {
      label: `Exp < 60 hr (${days} hr lagi)`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      isExpired: false,
      days,
    };
  } else if (days <= 90) {
    return {
      label: `Exp < 90 hr (${days} hr lagi)`,
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      isExpired: false,
      days,
    };
  } else if (days <= 120) {
    return {
      label: `Exp < 4 bln (${days} hr lagi)`,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      isExpired: false,
      days,
    };
  } else if (days <= 180) {
    return {
      label: `Exp < 6 bln (${days} hr lagi)`,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      isExpired: false,
      days,
    };
  } else {
    return {
      label: 'Aman (>6 bln)',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isExpired: false,
      days,
    };
  }
}

export function isPpnTransaction(t: {
  taxType?: 'PPN' | 'NON_PPN';
  ppnRate?: number;
  ppnAmount?: number;
}): boolean {
  if (t.taxType === 'NON_PPN') return false;
  if (t.ppnRate === 0 && (t.ppnAmount ?? 0) === 0) return false;
  if (t.taxType === 'PPN') return true;
  if ((t.ppnAmount ?? 0) > 0) return true;
  if ((t.ppnRate ?? 0) > 0) return true;
  return false;
}
