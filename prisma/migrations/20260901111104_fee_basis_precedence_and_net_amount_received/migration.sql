/*
  Warnings:

  - Added the required column `net_amount_received` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "default_fee_basis" "FeeBasis";

-- AlterTable: add nullable first, backfill existing rows from
-- gross_amount - merchant_fee, THEN enforce NOT NULL -- preserves existing
-- transactions instead of a bare NOT NULL add, which fails on a non-empty
-- table.
ALTER TABLE "transactions" ADD COLUMN     "net_amount_received" DECIMAL(18,2);

UPDATE "transactions" SET "net_amount_received" = "gross_amount" - "merchant_fee";

ALTER TABLE "transactions" ALTER COLUMN "net_amount_received" SET NOT NULL;
