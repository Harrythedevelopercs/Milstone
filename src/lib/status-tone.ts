// Shared semantic color system, used across tables/badges/rows app-wide so
// the same meaning always reads the same color:
//   success (green)  -- profit / settled / reconciled / paid / active
//   danger  (red)     -- loss / unreconciled / difference / chargeback / suspended / negative balance
//   warning (amber)   -- pending / awaiting / hold
//   neutral (gray)    -- void / inactive
export type StatusTone = "success" | "danger" | "warning" | "neutral";

export const TONE_BADGE_CLASS: Record<StatusTone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  neutral:
    "bg-muted text-muted-foreground border-border",
};

export const TONE_TEXT_CLASS: Record<StatusTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
};

// A row-level "needs attention" tint -- used for unreconciled settlements,
// open disputes, negative client balances, etc.
export const NEEDS_ATTENTION_ROW_CLASS =
  "bg-amber-50/60 dark:bg-amber-500/[0.06]";

const TRANSACTION_STATUS_TONE: Record<string, StatusTone> = {
  ENTERED: "neutral",
  SUBMITTED: "warning",
  DETAILS_REQUESTED: "warning",
  APPROVED: "success",
  PROCESSED: "success",
  SETTLED: "success",
  CLIENT_PAYABLE: "success",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  CLOSED: "neutral",
  HOLD: "warning",
  RESERVE: "warning",
  VOID: "neutral",
  REFUNDED: "danger",
  CHARGEBACK: "danger",
  DISPUTED: "danger",
  REJECTED: "danger",
};

const RCV_TYPE_TONE: Record<string, StatusTone> = {
  REFUND: "warning",
  CHARGEBACK: "danger",
  VOID: "neutral",
};

const RCV_STATUS_TONE: Record<string, StatusTone> = {
  OPEN: "warning",
  RESOLVED: "success",
  DISPUTED: "danger",
};

const SETTLEMENT_BATCH_STATUS_TONE: Record<string, StatusTone> = {
  RECONCILED: "success",
  DIFFERENCE: "danger",
  OPEN: "warning",
};

const BANK_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  NOT_APPLIED: "neutral",
};

const RECORD_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

function toneFrom(map: Record<string, StatusTone>, status: string): StatusTone {
  return map[status] ?? "neutral";
}

export const statusTone = {
  transaction: (status: string) => toneFrom(TRANSACTION_STATUS_TONE, status),
  rcvType: (type: string) => toneFrom(RCV_TYPE_TONE, type),
  rcvStatus: (status: string) => toneFrom(RCV_STATUS_TONE, status),
  settlementBatch: (status: string) => toneFrom(SETTLEMENT_BATCH_STATUS_TONE, status),
  bank: (status: string) => toneFrom(BANK_STATUS_TONE, status),
  record: (status: string) => toneFrom(RECORD_STATUS_TONE, status),
  balance: (amount: number): StatusTone => (amount < 0 ? "danger" : amount > 0 ? "success" : "neutral"),
};
