import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

// A read-only aggregation over every money-movement source table into one
// common shape, purely for display/filtering -- it changes no money math
// and posts nothing. Each source keeps its own dedicated page/model; this
// is just the "everything, one list" view layered on top.
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

export async function getUnifiedMoneyMovements(params: {
  from?: Date | null;
  to?: Date | null;
  types?: MoneyMovementType[];
}): Promise<MoneyMovementRow[]> {
  const { from, to } = params;
  const range = (from || to) ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const wantsType = (t: MoneyMovementType) => !params.types || params.types.includes(t);

  const [
    transactions,
    payouts,
    transfers,
    expenses,
    rcvs,
    thirdParty,
    salaries,
    commissions,
    partnerEntries,
    productSales,
  ] = await Promise.all([
    wantsType("RECEIVED")
      ? prisma.transaction.findMany({
          where: range ? { transactionDate: range } : undefined,
          include: { client: { select: { name: true } }, paymentMethod: { select: { name: true } } },
          orderBy: { transactionDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("PAYOUT")
      ? prisma.clientPayout.findMany({
          where: range ? { payoutDate: range } : undefined,
          include: { client: { select: { name: true } } },
          orderBy: { payoutDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("TRANSFER")
      ? prisma.internalTransfer.findMany({
          where: range ? { transferDate: range } : undefined,
          include: {
            fromBankAccount: { select: { name: true } },
            toBankAccount: { select: { name: true } },
          },
          orderBy: { transferDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("EXPENSE")
      ? prisma.expense.findMany({
          where: range ? { expenseDate: range } : undefined,
          include: { expenseCategory: { select: { name: true } } },
          orderBy: { expenseDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("REFUND") || wantsType("CHARGEBACK") || wantsType("VOID")
      ? prisma.refundChargebackVoid.findMany({
          where: range ? { eventDate: range } : undefined,
          include: { originalTransaction: { select: { id: true, client: { select: { name: true } } } } },
          orderBy: { eventDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("THIRD_PARTY_SETTLEMENT")
      ? prisma.thirdPartySettlement.findMany({
          where: range ? { settlementDate: range } : undefined,
          include: { settlementParty: { select: { name: true } } },
          orderBy: { settlementDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("SALARY")
      ? prisma.salaryLedger.findMany({
          where: range ? { entryDate: range } : undefined,
          include: { employee: { select: { name: true } } },
          orderBy: { entryDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("COMMISSION")
      ? prisma.employeePartnerLedger.findMany({
          where: range ? { entryDate: range } : undefined,
          include: { employee: { select: { name: true } } },
          orderBy: { entryDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("PARTNER_DISTRIBUTION")
      ? prisma.partnerLedger.findMany({
          where: range ? { entryDate: range } : undefined,
          include: { partner: { select: { name: true } } },
          orderBy: { entryDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    wantsType("PRODUCT_SERVICE_SALE")
      ? prisma.productServiceSale.findMany({
          where: range ? { saleDate: range } : undefined,
          include: { productService: { select: { name: true } }, client: { select: { name: true } } },
          orderBy: { saleDate: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const rows: MoneyMovementRow[] = [];

  for (const t of transactions) {
    rows.push({
      id: t.id,
      type: "RECEIVED",
      date: t.transactionDate,
      description: `${t.paymentMethod.name} -- ${t.client.name}${t.clientReference ? ` (${t.clientReference})` : ""}`,
      amount: new Decimal(t.grossAmount),
      status: t.status,
      href: "/transactions/received",
    });
  }
  for (const p of payouts) {
    rows.push({
      id: p.id,
      type: "PAYOUT",
      date: p.payoutDate,
      description: p.reference || p.notes || `Payout to ${p.client.name}`,
      amount: new Decimal(p.amountPaid).negated(),
      status: null,
      href: "/payouts",
    });
  }
  for (const tr of transfers) {
    rows.push({
      id: tr.id,
      type: "TRANSFER",
      date: tr.transferDate,
      description: tr.notes || `${tr.fromBankAccount.name} → ${tr.toBankAccount.name}`,
      amount: new Decimal(tr.amount),
      status: tr.settlementStatus,
      href: "/transfers",
    });
  }
  for (const e of expenses) {
    rows.push({
      id: e.id,
      type: "EXPENSE",
      date: e.expenseDate,
      description: e.description || e.expenseCategory.name,
      amount: new Decimal(e.amount).negated(),
      status: e.settlementStatus,
      href: "/expenses",
    });
  }
  for (const r of rcvs) {
    rows.push({
      id: r.id,
      type: r.type,
      date: r.eventDate,
      description: `${r.originalTransaction.client.name} -- ${r.originalTransaction.id}${r.reasonCode ? ` (${r.reasonCode})` : ""}`,
      amount: new Decimal(r.amount).negated(),
      status: r.status,
      href: "/refunds-chargebacks-voids",
    });
  }
  for (const s of thirdParty) {
    rows.push({
      id: s.id,
      type: "THIRD_PARTY_SETTLEMENT",
      date: s.settlementDate,
      description: `${s.notes || s.settlementParty.name} (${s.direction === "CLIENT_PAYABLE_TO_THIRD_PARTY" ? "client → third party" : "FP → third party"})`,
      amount: new Decimal(s.amount),
      status: null,
      href: `/third-party/${s.id}`,
    });
  }
  for (const sl of salaries) {
    rows.push({
      id: sl.id,
      type: "SALARY",
      date: sl.entryDate,
      description: sl.description || `Salary -- ${sl.employee.name}`,
      amount: new Decimal(sl.amount).negated(),
      status: null,
      href: "/distributions",
    });
  }
  for (const c of commissions) {
    rows.push({
      id: c.id,
      type: "COMMISSION",
      date: c.entryDate,
      description: c.description || `${c.kind === "COMMISSION" ? "Commission accrued" : "Payment"} -- ${c.employee.name}`,
      amount: new Decimal(c.amount),
      status: c.kind,
      href: "/employee-partner-ledger",
    });
  }
  for (const pl of partnerEntries) {
    rows.push({
      id: pl.id,
      type: "PARTNER_DISTRIBUTION",
      date: pl.entryDate,
      description: pl.description || `${pl.kind.replace(/_/g, " ").toLowerCase()} -- ${pl.partner.name}`,
      amount: new Decimal(pl.amount),
      status: pl.kind,
      href: "/partner-ledger",
    });
  }
  for (const ps of productSales) {
    rows.push({
      id: ps.id,
      type: "PRODUCT_SERVICE_SALE",
      date: ps.saleDate,
      description: `${ps.productService.name}${ps.client ? ` -- ${ps.client.name}` : ""}`,
      amount: new Decimal(ps.totalRevenue),
      status: null,
      href: "/product-sales",
    });
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  return rows;
}
