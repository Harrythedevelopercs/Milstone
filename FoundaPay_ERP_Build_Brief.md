# FoundaPay ERP — Build Brief for Claude Code

Build a multi-user web-based accounting/merchant-processing ERP for **FoundaPay**. This
document is the full spec. Start by scaffolding the project and the database schema, then
build feature by feature in the order under "Build Order". Ask me before making
irreversible product decisions, but don't re-interview me on anything already specified here.

---

## 1. Stack (already decided — use exactly this)
- **Next.js (App Router) + TypeScript**
- **PostgreSQL + Prisma ORM**
- **Auth.js (NextAuth)** with role-based access control
- **Tailwind CSS + shadcn/ui**
- **Money as decimals** (Prisma `Decimal` / Postgres `numeric(18,2)`) — never floats
- Deploy targets: Vercel (app) + Neon/Supabase (Postgres). Include `.env.example`.
- Use `pnpm`. Include seed scripts and Prisma migrations.

## 2. Core design principles (non-negotiable)
- **One permanent transaction database.** No per-month tables. Every transaction has an
  `accountingMonth` field (e.g. `2026-08`). An August transaction may get a
  refund/reserve-release/chargeback in September — that later event is recorded in its own
  month and *linked* to the original; August is never edited after close.
- **Immutable transactions.** Once posted, a transaction is append-only. Corrections happen
  via reversal + new transaction, never overwrite/delete. Keep full audit trail.
- **Immutable IDs**: `FP-YYYY-MM-000001` (per-month sequence), generated server-side.
- **Role-based access**: Employees never see profitability, bank balances, partner
  drawings, salaries, or FP fee economics.

## 3. Roles
- **Owner** (Farhan, Mukkarram, Mahdi): full access, including month reopen.
- **Accountant** (Shilpa): full operational access, approvals, month close.
- **Employee** (Fardeen, Farrukh, others): operational entry screen ONLY — submit
  transactions with client/date/method/gross/merchant/reference/notes/proof. They see only
  their own submissions and status. No ledgers, no economics.
  - **Superseded 2026-08-18**: Employees now have the same full access as Owner across the
    whole app (every page, every feature, all financial data), by explicit decision. See
    "Future Features" below — granular per-user role/permission control is planned via an
    Admin Module, not yet built.

## 4. Data model (entities)
Master data: Clients, ClientRateHistory (effective-dated: client+method+fromDate+toDate+rate+feeBasis),
Companies (Inc, tied to a Partner), Merchants (company, processor, settlementBank,
employeePartner, daily/monthly/per-txn limits, settlementCycle, defaultReserve%, active),
MerchantFeeRules (per method: %fee, flatFee, chargebackFee, refundFee, monthlyFee),
BankAccounts, PaymentMethods, PayoutMethods, Employees (isEmployeePartner, salary),
Partners (profitShare%), ExpenseCategories, Vendors/Subscriptions, ProductsServices
(cost, sellPrice), SettlementParties, BusinessUnits, SystemSettings.

Transaction engine: Transactions (the big one — see fields below), SettlementBatches
(one merchant deposit allocated across many transactions), ClientPayouts (separate from
transactions; one payout settles many transactions, one transaction can get many partial
payouts; remittance fee + fee bearer), RefundsChargebacksVoids, Expenses, InternalTransfers
(bank↔bank, bank↔USDT, cash — no P&L impact except actual fees), ThirdPartySettlements
(local cash agents like Ahmed), Adjustments (controlled reversals/corrections).

Subledgers (append-only, one row per debit/credit): ClientLedger, MerchantLedger,
BankLedger, UsdtCashLedger, EmployeePartnerLedger (10% commission), PartnerLedger
(profit entitlement/drawings/loans), BonusPoolLedger (4% pool), SalaryLedger,
BusinessUnitLedger, ThirdPartyLedger.

Controls: MonthClose (status open/closed/reopened, closedBy/at, reopenedBy/reason),
AuditLog (createdBy/at, updatedBy/at, approvedBy/at, action, before/after snapshot).

### Transaction fields
id (FP-YYYY-MM-######), parentId, originalTxnId, transactionDate, processingDate,
settlementDate, accountingMonth, client, clientReference, company, merchant, expectedBank,
employeePartner, paymentMethod, grossAmount, fpRate% (looked up from rate history by
client+method+date), feeBasis (Gross | After Merchant Charges), fpFee (computed),
merchantFee (manual actual + rule default), feeBearer (FoundaPay|Client),
merchantReserve% + $, fpReserve% + $, expectedSettlement (gross − merchantFee −
merchantReserve), actualSettlement, settlementBatchId, clientNetPayable, status, audit
fields, documentUrl, notes.

## 5. Key business logic
- **FP Fee**: if feeBasis=Gross → gross × rate; if After Merchant Charges → (gross −
  merchantFee) × rate. Example: gross 10000, merchantFee 400, rate 15% → Gross=1500,
  AfterMerchant=1440.
- **Rate lookup**: from ClientRateHistory by client+method where txnDate between
  effectiveFrom and effectiveTo (null = current). Changing Sept pricing must NOT change Aug.
- **Client position** = released reserves + client deposits − payouts − chargebacks −
  refunds − client-owned merchant fees − client-owned remittance fees − products/services
  ± adjustments. Positive = FoundaPay owes client; negative = client owes FoundaPay. Carries
  across months indefinitely.
- **Settlement batches**: one actual merchant deposit ($14,430) allocated across N
  transactions; compare expected vs actual to surface differences.
- **Payouts** decoupled from transactions (partial/multi allowed). Remittance fee bearer:
  FoundaPay → client gets full amount, FP expenses the fee; Client → client receives net.
- **Local third-party (Ahmed)**: client payable ↓ $5000, third-party payable to Ahmed
  ↑ $5000; when FP later pays Ahmed from US bank, bank ↓ $5000, Ahmed payable → 0. No
  revenue/expense created.
- **Products/services** (e.g. Dialpad cost 5 / sell 10): revenue 10, COGS 5, GP 5; can be
  deducted from client balance.
- **Internal transfers**: no P&L; only actual fees are expense when FP bears them.
- **Employee Partner**: each merchant → one employee partner; monthly eligible FP revenue
  through their merchants × 10%. Later chargeback does NOT reverse the commission. Running
  balance carries forward.
- **Owners/profit**: distributable profit = revenue − salaries − expenses. Split Farhan 43%
  / Mukkarram 33% / Mahdi 20% / Employee Bonus Pool 4%. Salaries are P&L expense; profit
  share is not salary; drawings reduce accumulated equity; over-draw → negative balance
  carried forward.
- **Bonus pool**: 4% of net distributable profit accrues each close; management allocates
  manually.
- **Cash position** is separate from P&L — actual money in each bank/USDT/cash right now.
  PKR keeps its PKR figure + a manually entered USD accounting value (no auto FX).
- **Reconciliation**: per bank/merchant — book vs actual, show difference.

## 6. Lifecycle & controls
- Transaction status flow: Entered → Submitted → Approved → Processed → Settled → Client
  Payable → Partially Paid → Paid → Closed. Special (linked, non-destructive): Hold,
  Reserve, Void, Refund, Chargeback, Disputed.
- **Approval**: employee submits → Accountant approves / rejects (correction required) /
  requests details → on approve, posts to Master + subledgers. Accountant's own entries
  auto-approve. No size-based approval rule for now.
- **Month close**: checklist (merchant/bank/USDT/cash recon, chargebacks, refunds, client
  balances, EP commission, salaries, expenses, partner drawings, P&L review) → CLOSE locks
  the period. Only Owner can reopen (with reason logged). Aug stays closed even if a
  chargeback hits in Sept.
- **Audit log** on every posted record; never hard-delete.

## 7. Dashboards & statements
- **Management dashboard** (Owner): cash position, gross volume, FP revenue, net profit,
  client payables/receivables, merchant pending settlement, reserves (merchant + FP), EP
  payable, partner balances, bonus pool, outstanding chargebacks, bank/merchant recon
  differences. Filters: date/month/company/BU/client/merchant/bank/employee-partner/method.
- **Accountant dashboard**: pending approvals, awaiting settlement, settlement diffs, recon
  diffs, payments due, negative client balances, outstanding reserves, chargebacks/refunds,
  upcoming subscriptions, EP commission due, month-close progress.
- **Employee screen**: entry form + their submissions/status only.
- **Statements** (dynamic, date-filtered): Client (internal full + a clean external version
  without FP economics), Merchant, Bank, Employee Partner, Partner, Business Unit P&L,
  Company P&L, Consolidated P&L, Cash Flow.

## 8. Data import
Import ONLY master data (clients, merchants, companies) from my existing sheet — NOT
transactions. I'll provide the file. Build an importer/seed I can re-run.

## 9. Build order (follow this to avoid unstable foundations)
1. Project scaffold, DB schema + migrations, auth + roles, seed master data.
2. Master-data CRUD screens (clients, rate history, merchants, fee rules, companies, banks,
   employees, partners, methods, categories, vendors, products, settlement parties, BUs, settings).
3. Transaction engine + rate lookup + fee/reserve/settlement math + immutable IDs.
4. Approval workflow + employee entry screen + audit log.
5. Client ledger + client position.
6. Settlement batches + payouts + third-party settlements.
7. Cash position + bank/merchant reconciliation + internal transfers.
8. Expenses + products/services + vendors.
9. Employee-partner + partner + bonus-pool + salary accounting.
10. Statements + dashboards.
11. Month close / lock / reopen.

Start with step 1 now. After scaffolding, show me the schema before generating all the CRUD.

## 10. Future Features (planned, not yet built)
- **Admin Module + User Management** (added 2026-08-18): a screen for managing users —
  create/deactivate logins, assign granular per-user roles/permissions, and control who sees
  what (rather than the current all-or-nothing role model). Recorded as a TODO only; not to
  be built until explicitly requested.
