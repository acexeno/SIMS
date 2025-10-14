// Centralized currency formatting for Philippine Peso
// Usage: import { formatCurrencyPHP } from '../utils/currency';

export function formatCurrencyPHP(amount, options = {}) {
  // Robust numeric parsing: accept strings with commas and extraneous text
  const numeric = (() => {
    if (typeof amount === 'number' && Number.isFinite(amount)) return amount;
    if (typeof amount === 'string') {
      const cleaned = amount.replace(/[^0-9.\-]/g, '');
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  })();
  const value = numeric;
  const formatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
  // Ensure the symbol renders as ₱ and avoid duplicates
  const formatted = formatter.format(value);
  // Some environments already return with ₱, this keeps consistency
  return formatted.replace('PHP', '').replace('₱', '₱');
}

export function formatNumber(value, options = {}) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(num);
}
