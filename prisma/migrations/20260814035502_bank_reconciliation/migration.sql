-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "book_balance" DECIMAL(18,2) NOT NULL,
    "actual_balance" DECIMAL(18,2) NOT NULL,
    "difference_amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_reconciliations_bank_account_id_idx" ON "bank_reconciliations"("bank_account_id");

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
