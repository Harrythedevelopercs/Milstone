/*
  Warnings:

  - You are about to drop the column `owner` on the `reserve_holds` table. All the data in the column will be lost.
  - Added the required column `direction` to the `reserve_holds` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReserveDirection" AS ENUM ('CLIENT_HELD', 'FP_FRONTED', 'FP_OWN');

-- CreateEnum
CREATE TYPE "ReserveValueType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "default_reserve_direction" "ReserveDirection",
ADD COLUMN     "default_reserve_type" "ReserveValueType",
ADD COLUMN     "default_reserve_value" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "default_reserve_direction" "ReserveDirection" NOT NULL DEFAULT 'CLIENT_HELD';

-- AlterTable: add nullable first, backfill from the old `owner` column,
-- THEN enforce NOT NULL -- preserves any existing rows instead of a bare
-- drop+add, which would fail on (or silently null out) a non-empty table.
ALTER TABLE "reserve_holds" ADD COLUMN     "direction" "ReserveDirection";

UPDATE "reserve_holds" SET "direction" = CASE "owner"
  WHEN 'CLIENT' THEN 'CLIENT_HELD'::"ReserveDirection"
  WHEN 'FOUNDAPAY' THEN 'FP_OWN'::"ReserveDirection"
END;

ALTER TABLE "reserve_holds" ALTER COLUMN "direction" SET NOT NULL;
ALTER TABLE "reserve_holds" DROP COLUMN "owner";

-- DropEnum
DROP TYPE "ReserveOwner";
