-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'NOT_APPLIED');

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "status" "BankAccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
