-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('PERCENTAGE', 'FIXED', 'NONE');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('TRANSACTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- AlterTable
ALTER TABLE "refunds_chargebacks_voids" ADD COLUMN     "fulfilled_at" TIMESTAMP(3),
ADD COLUMN     "fulfilled_by_id" TEXT,
ADD COLUMN     "fulfillment_bank_account_id" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "charge_type" "ChargeType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "fixed_charge_amount" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'OPEN',
    "transaction_id" TEXT,
    "previous_status" "TransactionStatus",
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_due_date_idx" ON "reminders"("due_date");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_transaction_id_idx" ON "reminders"("transaction_id");

-- AddForeignKey
ALTER TABLE "refunds_chargebacks_voids" ADD CONSTRAINT "refunds_chargebacks_voids_fulfillment_bank_account_id_fkey" FOREIGN KEY ("fulfillment_bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
