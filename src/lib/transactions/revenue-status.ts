// Shared by P&L, employee-partner commission, and dashboard aggregates: which
// transaction statuses are excluded from fpFee-based revenue recognition.
// Revenue is recognized the moment a transaction is approved and is never
// reversed by a later refund/chargeback (brief section 5) -- Void is the one
// exception, since a voided transaction never really happened.
export const REVENUE_RECOGNIZED_EXCLUDED_STATUSES = [
  "ENTERED",
  "SUBMITTED",
  "DETAILS_REQUESTED",
  "REJECTED",
  "VOID",
] as const;
