import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function normalizeCreditAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round((numeric + Math.sign(numeric) * Number.EPSILON) * 100) / 100;
}

export function formatCreditAmount(value) {
  return String(normalizeCreditAmount(value));
}

export function formatCreditBalance(value) {
  return normalizeCreditAmount(value).toFixed(2);
}
