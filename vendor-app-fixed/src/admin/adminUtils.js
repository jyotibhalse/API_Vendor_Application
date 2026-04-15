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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) {
    return "No activity yet";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
