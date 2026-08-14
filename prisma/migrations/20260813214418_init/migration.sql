-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ACCOUNTANT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "FeeBasis" AS ENUM ('GROSS', 'AFTER_MERCHANT_CHARGES');

-- CreateEnum
CREATE TYPE "FeeBearer" AS ENUM ('FOUNDAPAY', 'CLIENT');

-- CreateEnum
CREATE TYPE "MerchantFeeSource" AS ENUM ('MANUAL', 'RULE_DEFAULT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('ENTERED', 'SUBMITTED', 'APPROVED', 'PROCESSED', 'SETTLED', 'CLIENT_PAYABLE', 'PARTIALLY_PAID', 'PAID', 'CLOSED', 'HOLD', 'RESERVE', 'VOID', 'REFUNDED', 'CHARGEBACK', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_DETAILS');

-- CreateEnum
CREATE TYPE "MonthCloseStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'USDT', 'CASH');

-- CreateEnum
CREATE TYPE "RcvType" AS ENUM ('REFUND', 'CHARGEBACK', 'VOID');

-- CreateEnum
CREATE TYPE "RcvStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('TRANSACTION', 'RCV', 'PAYOUT', 'SETTLEMENT_BATCH', 'EXPENSE', 'INTERNAL_TRANSFER', 'THIRD_PARTY_SETTLEMENT', 'ADJUSTMENT', 'PRODUCT_SERVICE_SALE', 'MONTH_CLOSE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PartnerLedgerKind" AS ENUM ('PROFIT_ENTITLEMENT', 'DRAWING', 'LOAN', 'LOAN_REPAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AdjustmentTargetType" AS ENUM ('CLIENT', 'MERCHANT', 'BANK', 'EMPLOYEE_PARTNER', 'PARTNER', 'BUSINESS_UNIT', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "SettlementBatchStatus" AS ENUM ('OPEN', 'RECONCILED', 'DIFFERENCE');

-- CreateEnum
CREATE TYPE "ThirdPartyDirection" AS ENUM ('CLIENT_PAYABLE_TO_THIRD_PARTY', 'FP_PAID_THIRD_PARTY');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_rate_history" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "fee_basis" "FeeBasis" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "profit_share_percent" DECIMAL(5,2) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "partner_id" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_employee_partner" BOOLEAN NOT NULL DEFAULT false,
    "salary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "business_unit_id" TEXT,
    "processor" TEXT NOT NULL,
    "settlement_bank_id" TEXT NOT NULL,
    "employee_partner_id" TEXT,
    "daily_limit" DECIMAL(18,2),
    "monthly_limit" DECIMAL(18,2),
    "per_txn_limit" DECIMAL(18,2),
    "settlement_cycle" TEXT NOT NULL,
    "default_reserve_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_fee_rules" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "flat_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "chargeback_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refund_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthly_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "bank_name" TEXT,
    "account_number_masked" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "country" TEXT,
    "opening_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "opening_balance_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_subscriptions" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "next_billing_date" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "sell_price" DECIMAL(18,2) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "transaction_sequences" (
    "accounting_month" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transaction_sequences_pkey" PRIMARY KEY ("accounting_month")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "original_txn_id" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "processing_date" TIMESTAMP(3),
    "settlement_date" TIMESTAMP(3),
    "accounting_month" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_reference" TEXT,
    "company_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "expected_bank_id" TEXT NOT NULL,
    "employee_partner_id" TEXT,
    "business_unit_id" TEXT,
    "payment_method_id" TEXT NOT NULL,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "fp_rate_percent" DECIMAL(5,2) NOT NULL,
    "fee_basis" "FeeBasis" NOT NULL,
    "fp_fee" DECIMAL(18,2) NOT NULL,
    "merchant_fee_manual" DECIMAL(18,2),
    "merchant_fee_default" DECIMAL(18,2),
    "merchant_fee" DECIMAL(18,2) NOT NULL,
    "merchant_fee_source" "MerchantFeeSource" NOT NULL,
    "fee_bearer" "FeeBearer" NOT NULL,
    "merchant_reserve_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "merchant_reserve_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fp_reserve_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fp_reserve_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expected_settlement" DECIMAL(18,2) NOT NULL,
    "actual_settlement" DECIMAL(18,2),
    "settlement_batch_id" TEXT,
    "client_net_payable" DECIMAL(18,2),
    "status" "TransactionStatus" NOT NULL DEFAULT 'ENTERED',
    "document_url" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "deposit_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "deposit_amount" DECIMAL(18,2) NOT NULL,
    "expected_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "difference_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payouts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "payout_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "payout_method_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL,
    "remittance_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fee_bearer" "FeeBearer" NOT NULL,
    "reference" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payout_allocations" (
    "id" TEXT NOT NULL,
    "client_payout_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount_allocated" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "client_payout_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds_chargebacks_voids" (
    "id" TEXT NOT NULL,
    "type" "RcvType" NOT NULL,
    "original_transaction_id" TEXT NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fee_bearer" "FeeBearer",
    "reason_code" TEXT,
    "status" "RcvStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "document_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "refunds_chargebacks_voids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expense_category_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "subscription_id" TEXT,
    "company_id" TEXT,
    "business_unit_id" TEXT,
    "bank_account_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expense_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "description" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "document_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "from_bank_account_id" TEXT NOT NULL,
    "to_bank_account_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fee_bearer" "FeeBearer",
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_settlements" (
    "id" TEXT NOT NULL,
    "settlement_party_id" TEXT NOT NULL,
    "client_id" TEXT,
    "related_transaction_id" TEXT,
    "direction" "ThirdPartyDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bank_account_id" TEXT,
    "settlement_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "third_party_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustments" (
    "id" TEXT NOT NULL,
    "target_type" "AdjustmentTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "related_transaction_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "adjustment_date" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_service_sales" (
    "id" TEXT NOT NULL,
    "product_service_id" TEXT NOT NULL,
    "client_id" TEXT,
    "business_unit_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" DECIMAL(18,2) NOT NULL,
    "unit_sell_price" DECIMAL(18,2) NOT NULL,
    "total_revenue" DECIMAL(18,2) NOT NULL,
    "total_cost" DECIMAL(18,2) NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "deduct_from_client_balance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_service_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_ledger" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "client_payout_id" TEXT,
    "product_service_sale_id" TEXT,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_ledger" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_ledger" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "usd_value" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "expense_id" TEXT,
    "internal_transfer_id" TEXT,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_partner_ledger" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_partner_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_ledger" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "kind" "PartnerLedgerKind" NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_pool_ledger" (
    "id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "allocated_to_employee_id" TEXT,
    "allocation_date" TIMESTAMP(3),
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_pool_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_ledger" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "pay_period" TEXT NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_unit_ledger" (
    "id" TEXT NOT NULL,
    "business_unit_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_unit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_ledger" (
    "id" TEXT NOT NULL,
    "settlement_party_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "accounting_month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "third_party_settlement_id" TEXT,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "third_party_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_closes" (
    "accounting_month" TEXT NOT NULL,
    "status" "MonthCloseStatus" NOT NULL DEFAULT 'OPEN',
    "checklist" JSONB,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "reopened_by_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "month_closes_pkey" PRIMARY KEY ("accounting_month")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "transaction_id" TEXT,
    "performed_by_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE INDEX "client_rate_history_client_id_payment_method_id_effective_f_idx" ON "client_rate_history"("client_id", "payment_method_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "partners_user_id_key" ON "partners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_fee_rules_merchant_id_payment_method_id_key" ON "merchant_fee_rules"("merchant_id", "payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_name_key" ON "payment_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payout_methods_name_key" ON "payout_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "transactions_accounting_month_idx" ON "transactions"("accounting_month");

-- CreateIndex
CREATE INDEX "transactions_client_id_idx" ON "transactions"("client_id");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_idx" ON "transactions"("merchant_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_settlement_batch_id_idx" ON "transactions"("settlement_batch_id");

-- CreateIndex
CREATE INDEX "settlement_batches_accounting_month_idx" ON "settlement_batches"("accounting_month");

-- CreateIndex
CREATE INDEX "settlement_batches_merchant_id_idx" ON "settlement_batches"("merchant_id");

-- CreateIndex
CREATE INDEX "client_payouts_accounting_month_idx" ON "client_payouts"("accounting_month");

-- CreateIndex
CREATE INDEX "client_payouts_client_id_idx" ON "client_payouts"("client_id");

-- CreateIndex
CREATE INDEX "client_payout_allocations_client_payout_id_idx" ON "client_payout_allocations"("client_payout_id");

-- CreateIndex
CREATE INDEX "client_payout_allocations_transaction_id_idx" ON "client_payout_allocations"("transaction_id");

-- CreateIndex
CREATE INDEX "refunds_chargebacks_voids_accounting_month_idx" ON "refunds_chargebacks_voids"("accounting_month");

-- CreateIndex
CREATE INDEX "refunds_chargebacks_voids_original_transaction_id_idx" ON "refunds_chargebacks_voids"("original_transaction_id");

-- CreateIndex
CREATE INDEX "expenses_accounting_month_idx" ON "expenses"("accounting_month");

-- CreateIndex
CREATE INDEX "internal_transfers_accounting_month_idx" ON "internal_transfers"("accounting_month");

-- CreateIndex
CREATE INDEX "third_party_settlements_accounting_month_idx" ON "third_party_settlements"("accounting_month");

-- CreateIndex
CREATE INDEX "adjustments_accounting_month_idx" ON "adjustments"("accounting_month");

-- CreateIndex
CREATE INDEX "adjustments_target_type_target_id_idx" ON "adjustments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "product_service_sales_accounting_month_idx" ON "product_service_sales"("accounting_month");

-- CreateIndex
CREATE INDEX "client_ledger_accounting_month_idx" ON "client_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "client_ledger_client_id_idx" ON "client_ledger"("client_id");

-- CreateIndex
CREATE INDEX "merchant_ledger_accounting_month_idx" ON "merchant_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "merchant_ledger_merchant_id_idx" ON "merchant_ledger"("merchant_id");

-- CreateIndex
CREATE INDEX "bank_ledger_accounting_month_idx" ON "bank_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "bank_ledger_bank_account_id_idx" ON "bank_ledger"("bank_account_id");

-- CreateIndex
CREATE INDEX "employee_partner_ledger_accounting_month_idx" ON "employee_partner_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "employee_partner_ledger_employee_id_idx" ON "employee_partner_ledger"("employee_id");

-- CreateIndex
CREATE INDEX "partner_ledger_accounting_month_idx" ON "partner_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "partner_ledger_partner_id_idx" ON "partner_ledger"("partner_id");

-- CreateIndex
CREATE INDEX "bonus_pool_ledger_accounting_month_idx" ON "bonus_pool_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "salary_ledger_accounting_month_idx" ON "salary_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "salary_ledger_employee_id_idx" ON "salary_ledger"("employee_id");

-- CreateIndex
CREATE INDEX "business_unit_ledger_accounting_month_idx" ON "business_unit_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "business_unit_ledger_business_unit_id_idx" ON "business_unit_ledger"("business_unit_id");

-- CreateIndex
CREATE INDEX "third_party_ledger_accounting_month_idx" ON "third_party_ledger"("accounting_month");

-- CreateIndex
CREATE INDEX "third_party_ledger_settlement_party_id_idx" ON "third_party_ledger"("settlement_party_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_performed_at_idx" ON "audit_logs"("performed_at");

-- AddForeignKey
ALTER TABLE "client_rate_history" ADD CONSTRAINT "client_rate_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_rate_history" ADD CONSTRAINT "client_rate_history_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_settlement_bank_id_fkey" FOREIGN KEY ("settlement_bank_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_employee_partner_id_fkey" FOREIGN KEY ("employee_partner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_fee_rules" ADD CONSTRAINT "merchant_fee_rules_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_fee_rules" ADD CONSTRAINT "merchant_fee_rules_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_expected_bank_id_fkey" FOREIGN KEY ("expected_bank_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_employee_partner_id_fkey" FOREIGN KEY ("employee_partner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_settlement_batch_id_fkey" FOREIGN KEY ("settlement_batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_original_txn_id_fkey" FOREIGN KEY ("original_txn_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payouts" ADD CONSTRAINT "client_payouts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payouts" ADD CONSTRAINT "client_payouts_payout_method_id_fkey" FOREIGN KEY ("payout_method_id") REFERENCES "payout_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payouts" ADD CONSTRAINT "client_payouts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payout_allocations" ADD CONSTRAINT "client_payout_allocations_client_payout_id_fkey" FOREIGN KEY ("client_payout_id") REFERENCES "client_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payout_allocations" ADD CONSTRAINT "client_payout_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds_chargebacks_voids" ADD CONSTRAINT "refunds_chargebacks_voids_original_transaction_id_fkey" FOREIGN KEY ("original_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_from_bank_account_id_fkey" FOREIGN KEY ("from_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_to_bank_account_id_fkey" FOREIGN KEY ("to_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_settlements" ADD CONSTRAINT "third_party_settlements_settlement_party_id_fkey" FOREIGN KEY ("settlement_party_id") REFERENCES "settlement_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_settlements" ADD CONSTRAINT "third_party_settlements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_settlements" ADD CONSTRAINT "third_party_settlements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_related_transaction_id_fkey" FOREIGN KEY ("related_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_service_sales" ADD CONSTRAINT "product_service_sales_product_service_id_fkey" FOREIGN KEY ("product_service_id") REFERENCES "products_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_service_sales" ADD CONSTRAINT "product_service_sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_service_sales" ADD CONSTRAINT "product_service_sales_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger" ADD CONSTRAINT "client_ledger_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger" ADD CONSTRAINT "client_ledger_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger" ADD CONSTRAINT "client_ledger_client_payout_id_fkey" FOREIGN KEY ("client_payout_id") REFERENCES "client_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger" ADD CONSTRAINT "client_ledger_product_service_sale_id_fkey" FOREIGN KEY ("product_service_sale_id") REFERENCES "product_service_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_ledger" ADD CONSTRAINT "merchant_ledger_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_ledger" ADD CONSTRAINT "merchant_ledger_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_ledger" ADD CONSTRAINT "bank_ledger_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_ledger" ADD CONSTRAINT "bank_ledger_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_ledger" ADD CONSTRAINT "bank_ledger_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_ledger" ADD CONSTRAINT "bank_ledger_internal_transfer_id_fkey" FOREIGN KEY ("internal_transfer_id") REFERENCES "internal_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_partner_ledger" ADD CONSTRAINT "employee_partner_ledger_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_partner_ledger" ADD CONSTRAINT "employee_partner_ledger_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_ledger" ADD CONSTRAINT "partner_ledger_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_pool_ledger" ADD CONSTRAINT "bonus_pool_ledger_allocated_to_employee_id_fkey" FOREIGN KEY ("allocated_to_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_ledger" ADD CONSTRAINT "salary_ledger_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_unit_ledger" ADD CONSTRAINT "business_unit_ledger_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_ledger" ADD CONSTRAINT "third_party_ledger_settlement_party_id_fkey" FOREIGN KEY ("settlement_party_id") REFERENCES "settlement_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_ledger" ADD CONSTRAINT "third_party_ledger_third_party_settlement_id_fkey" FOREIGN KEY ("third_party_settlement_id") REFERENCES "third_party_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
