import type { ExportPayload } from "./types";
import { fetchConsolidatedPnl } from "./reports/consolidated-pnl";
import { fetchCompanyPnl } from "./reports/company-pnl";
import { fetchBusinessUnitPnl } from "./reports/business-unit-pnl";
import { fetchCashFlow } from "./reports/cash-flow";
import { fetchMerchantStatement } from "./reports/merchant-statement";
import { fetchClientExternalStatement } from "./reports/client-external-statement";
import { fetchCashPosition } from "./reports/cash-position";
import { fetchEmployeePartnerLedger } from "./reports/employee-partner-ledger";
import { fetchPartnerLedger } from "./reports/partner-ledger";
import { fetchBonusPool } from "./reports/bonus-pool";
import { fetchMerchantReconciliation } from "./reports/merchant-reconciliation";
import { fetchDistributions } from "./reports/distributions";
import { fetchTransactions } from "./reports/transactions";
import { fetchRcv } from "./reports/rcv";
import { fetchSettlementBatches } from "./reports/settlement-batches";
import { fetchPayouts } from "./reports/payouts";
import { fetchExpenses } from "./reports/expenses";
import { fetchClientLedgerInternal } from "./reports/client-ledger-internal";
import { fetchBankLedger } from "./reports/bank-ledger";
import { fetchMerchantLedger } from "./reports/merchant-ledger";
import { fetchThirdPartyLedger } from "./reports/third-party-ledger";
import { fetchIncomeStatement } from "./reports/income-statement";
import { fetchBalanceSheet } from "./reports/balance-sheet";

export type ReportFetcher = (params: URLSearchParams) => Promise<ExportPayload>;

export const REPORT_REGISTRY: Record<string, ReportFetcher> = {
  "consolidated-pnl": fetchConsolidatedPnl,
  "company-pnl": fetchCompanyPnl,
  "business-unit-pnl": fetchBusinessUnitPnl,
  "cash-flow": fetchCashFlow,
  "merchant-statement": fetchMerchantStatement,
  "client-external-statement": fetchClientExternalStatement,
  "cash-position": fetchCashPosition,
  "employee-partner-ledger": fetchEmployeePartnerLedger,
  "partner-ledger": fetchPartnerLedger,
  "bonus-pool": fetchBonusPool,
  "merchant-reconciliation": fetchMerchantReconciliation,
  distributions: fetchDistributions,
  transactions: fetchTransactions,
  rcv: fetchRcv,
  "settlement-batches": fetchSettlementBatches,
  payouts: fetchPayouts,
  expenses: fetchExpenses,
  "client-ledger-internal": fetchClientLedgerInternal,
  "bank-ledger": fetchBankLedger,
  "merchant-ledger": fetchMerchantLedger,
  "third-party-ledger": fetchThirdPartyLedger,
  "income-statement": fetchIncomeStatement,
  "balance-sheet": fetchBalanceSheet,
};
