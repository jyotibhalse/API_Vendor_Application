export const FILTERS = ["Today", "This Week", "This Month"];

export const PERIOD_MAP = {
  Today: "today",
  "This Week": "week",
  "This Month": "month",
};

export const INITIAL_SETTINGS = {
  default_commission_rate: 8,
  platform_fee_flat: 0,
};

export function formatCurrency(value) {
  const numValue = parseFloat(value);
  const safeValue = Number.isFinite(numValue) ? numValue : 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatPercent(value) {
  const numValue = Number(value || 0);
  const safeValue = Number.isFinite(numValue) ? numValue : 0;
  return `${safeValue.toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "No activity yet";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
