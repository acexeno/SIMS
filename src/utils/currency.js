// Centralized currency formatting for Philippine Peso
// Usage: import { formatCurrencyPHP } from '../utils/currency';

export function formatCurrencyPHP(amount, options = {}) {
  const value = Number(amount) || 0;
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
