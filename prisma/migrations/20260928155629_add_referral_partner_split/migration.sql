/*
  Warnings:

  - Added the required column `foundapay_pure_fee` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "client_rate_history" ADD COLUMN     "referral_partner_id" TEXT,
ADD COLUMN     "referral_partner_rate_percent" DECIMAL(5,2);

-- AlterTable: add foundapay_pure_fee nullable first, backfill from the
-- existing fp_fee (every historical transaction's fee was 100% FoundaPay's
-- own revenue, since referral tracking didn't exist before), THEN enforce
-- NOT NULL -- preserves existing rows instead of a bare NOT NULL add, which
-- fails on a non-empty table.
ALTER TABLE "transactions" ADD COLUMN     "foundapay_pure_fee" DECIMAL(18,2),
ADD COLUMN     "referral_partner_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "referral_partner_id" TEXT,
ADD COLUMN     "referral_partner_rate_percent" DECIMAL(5,2);

UPDATE "transactions" SET "foundapay_pure_fee" = "fp_fee";

ALTER TABLE "transactions" ALTER COLUMN "foundapay_pure_fee" SET NOT NULL;

-- CreateTable
CREATE TABLE "referral_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_partners_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_rate_history" ADD CONSTRAINT "client_rate_history_referral_partner_id_fkey" FOREIGN KEY ("referral_partner_id") REFERENCES "referral_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_referral_partner_id_fkey" FOREIGN KEY ("referral_partner_id") REFERENCES "referral_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
