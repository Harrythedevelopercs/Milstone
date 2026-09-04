-- CreateIndex
CREATE INDEX "bank_ledger_entry_date_idx" ON "bank_ledger"("entry_date");

-- CreateIndex
CREATE INDEX "client_ledger_entry_date_idx" ON "client_ledger"("entry_date");

-- CreateIndex
CREATE INDEX "client_payouts_payout_date_idx" ON "client_payouts"("payout_date");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "internal_transfers_transfer_date_idx" ON "internal_transfers"("transfer_date");

-- CreateIndex
CREATE INDEX "merchant_ledger_entry_date_idx" ON "merchant_ledger"("entry_date");

-- CreateIndex
CREATE INDEX "refunds_chargebacks_voids_event_date_idx" ON "refunds_chargebacks_voids"("event_date");

-- CreateIndex
CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "transactions_payment_method_id_idx" ON "transactions"("payment_method_id");
