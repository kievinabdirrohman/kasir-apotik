// Security & Password Validation Utils for Apotek System

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Minimal 8 karakter.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Harus memuat minimal 1 huruf besar (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Harus memuat minimal 1 huruf kecil (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Harus memuat minimal 1 angka (0-9).');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Harus memuat minimal 1 karakter spesial (@#$%^&* dll).');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const getPasswordStrengthScore = (password: string): { score: number; label: string; color: string } => {
  if (!password) return { score: 0, label: 'Sangat Lemah', color: 'bg-slate-200' };
  
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: 'Lemah', color: 'bg-rose-500' };
  if (score <= 4) return { score: 2, label: 'Sedang', color: 'bg-amber-500' };
  if (score <= 5) return { score: 3, label: 'Kuat', color: 'bg-emerald-500' };
  return { score: 4, label: 'Sangat Kuat (Sesuai Standar)', color: 'bg-indigo-600' };
};
