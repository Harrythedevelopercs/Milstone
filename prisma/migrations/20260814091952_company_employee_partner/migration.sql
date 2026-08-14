/*
  Warnings:

  - You are about to drop the column `partner_id` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `employee_partner_id` on the `merchants` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "merchants" DROP CONSTRAINT "merchants_employee_partner_id_fkey";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "partner_id",
ADD COLUMN     "employee_partner_id" TEXT;

-- AlterTable
ALTER TABLE "merchants" DROP COLUMN "employee_partner_id";

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_employee_partner_id_fkey" FOREIGN KEY ("employee_partner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
