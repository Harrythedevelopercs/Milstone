/*
  Warnings:

  - Added the required column `accounting_month` to the `reserve_hold_actions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "LedgerSourceType" ADD VALUE 'RESERVE';

-- AlterTable
ALTER TABLE "reserve_hold_actions" ADD COLUMN     "accounting_month" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "reserve_hold_actions_accounting_month_idx" ON "reserve_hold_actions"("accounting_month");
