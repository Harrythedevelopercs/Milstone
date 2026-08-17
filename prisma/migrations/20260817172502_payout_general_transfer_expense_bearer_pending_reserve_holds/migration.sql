-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('PENDING', 'SETTLED');

-- CreateEnum
CREATE TYPE "ReserveOwner" AS ENUM ('CLIENT', 'FOUNDAPAY');

-- CreateEnum
CREATE TYPE "ReserveActionType" AS ENUM ('RELEASE', 'APPLY_TO_CHARGEBACK', 'WRITE_OFF');

-- AlterTable
ALTER TABLE "client_payouts" ADD COLUMN     "general_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "client_id" TEXT,
ADD COLUMN     "fee_bearer" "FeeBearer" NOT NULL DEFAULT 'FOUNDAPAY',
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "settled_by_id" TEXT,
ADD COLUMN     "settlement_status" "TrackingStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "internal_transfers" ADD COLUMN     "client_id" TEXT,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "settled_by_id" TEXT,
ADD COLUMN     "settlement_status" "TrackingStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "reserve_holds" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "owner" "ReserveOwner" NOT NULL,
    "original_amount" DECIMAL(18,2) NOT NULL,
    "held_since" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserve_hold_actions" (
    "id" TEXT NOT NULL,
    "reserve_hold_id" TEXT NOT NULL,
    "type" "ReserveActionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "action_date" TIMESTAMP(3) NOT NULL,
    "bank_account_id" TEXT,
    "rcv_id" TEXT,
    "notes" TEXT,
    "performed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_hold_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reserve_holds_transaction_id_idx" ON "reserve_holds"("transaction_id");

-- CreateIndex
CREATE INDEX "reserve_holds_merchant_id_idx" ON "reserve_holds"("merchant_id");

-- CreateIndex
CREATE INDEX "reserve_hold_actions_reserve_hold_id_idx" ON "reserve_hold_actions"("reserve_hold_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_holds" ADD CONSTRAINT "reserve_holds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_holds" ADD CONSTRAINT "reserve_holds_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_hold_actions" ADD CONSTRAINT "reserve_hold_actions_reserve_hold_id_fkey" FOREIGN KEY ("reserve_hold_id") REFERENCES "reserve_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_hold_actions" ADD CONSTRAINT "reserve_hold_actions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserve_hold_actions" ADD CONSTRAINT "reserve_hold_actions_rcv_id_fkey" FOREIGN KEY ("rcv_id") REFERENCES "refunds_chargebacks_voids"("id") ON DELETE SET NULL ON UPDATE CASCADE;
