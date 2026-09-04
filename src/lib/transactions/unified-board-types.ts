import type Decimal from "decimal.js";

// Pure types/constants shared by both the server-side aggregation
// (unified-board.ts, which also imports prisma) and client components that
// only need the shape/labels -- kept in a separate file with no server-only
// imports so importing these from a "use client" component never drags
// prisma into the browser bundle.
export const MONEY_MOVEMENT_TYPES = [
  "RECEIVED",
  "PAYOUT",
  "TRANSFER",
  "EXPENSE",
  "REFUND",
  "CHARGEBACK",
  "VOID",
  "THIRD_PARTY_SETTLEMENT",
  "SALARY",
  "COMMISSION",
  "PARTNER_DISTRIBUTION",
  "PRODUCT_SERVICE_SALE",
] as const;

export type MoneyMovementType = (typeof MONEY_MOVEMENT_TYPES)[number];

export const MONEY_MOVEMENT_TYPE_LABEL: Record<MoneyMovementType, string> = {
  RECEIVED: "Received",
  PAYOUT: "Payout",
  TRANSFER: "Internal Transfer",
  EXPENSE: "Expense",
  REFUND: "Refund",
  CHARGEBACK: "Chargeback",
  VOID: "Void",
  THIRD_PARTY_SETTLEMENT: "Third-Party Settlement",
  SALARY: "Salary Disbursement",
  COMMISSION: "Commission (Employee-Partner)",
  PARTNER_DISTRIBUTION: "Partner Distribution",
  PRODUCT_SERVICE_SALE: "Product/Service Sale",
};

export type MoneyMovementRow = {
  id: string;
  type: MoneyMovementType;
  date: Date;
  description: string;
  amount: Decimal;
  status: string | null;
  href: string;
};

// A Decimal instance can't cross the Server->Client Component boundary as a
// prop (React Server Components only serialize plain data) -- this is the
// same row shape with `amount` pre-formatted to a plain string instead.
export type ClientMoneyMovementRow = Omit<MoneyMovementRow, "amount"> & { amount: string };

export function toClientMoneyMovementRow(row: MoneyMovementRow): ClientMoneyMovementRow {
  return { ...row, amount: row.amount.toFixed(2) };
}

// Status-tone and pending-approval classification -- pure logic with no
// server-only dependency, so it's safe to import from either a Server
// Component (for the totals calc) or a "use client" component (for the
// board's row rendering) without pulling anything else along with it.
import { statusTone, type StatusTone } from "@/lib/status-tone";

const RCV_STATUSES = new Set(["OPEN", "RESOLVED", "DISPUTED"]);
const TRACKING_STATUSES = new Set(["PENDING", "SETTLED"]);
const TRANSACTION_STATUSES = new Set([
  "ENTERED", "SUBMITTED", "APPROVED", "PROCESSED", "SETTLED", "CLIENT_PAYABLE",
  "PARTIALLY_PAID", "PAID", "CLOSED", "HOLD", "RESERVE", "VOID", "REFUNDED",
  "CHARGEBACK", "DISPUTED", "REJECTED", "DETAILS_REQUESTED",
]);

// Awaiting-approval statuses for a Received transaction -- the same set the
// review/approve queue (transactions/received) works through. Not "on hold"
// (HOLD/RESERVE) or any other in-flight status -- those have already been
// approved at least once; this is specifically "hasn't been approved yet".
const PENDING_APPROVAL_STATUSES = new Set(["ENTERED", "SUBMITTED", "DETAILS_REQUESTED"]);

export function isPendingApproval(row: { type: MoneyMovementType; status: string | null }): boolean {
  return row.type === "RECEIVED" && !!row.status && PENDING_APPROVAL_STATUSES.has(row.status);
}

export function moneyMovementRowTone(row: { type: MoneyMovementType; status: string | null }): StatusTone {
  if (!row.status) return "neutral";
  if (row.type === "RECEIVED" && TRANSACTION_STATUSES.has(row.status)) return statusTone.transaction(row.status);
  if ((row.type === "REFUND" || row.type === "CHARGEBACK" || row.type === "VOID") && RCV_STATUSES.has(row.status)) {
    return statusTone.rcvStatus(row.status);
  }
  if (TRACKING_STATUSES.has(row.status)) return row.status === "PENDING" ? "warning" : "success";
  return "neutral";
}
