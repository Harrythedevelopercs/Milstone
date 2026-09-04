-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "default_merchant_reserve_basis" "FeeBasis";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "merchant_reserve_basis" "FeeBasis" NOT NULL DEFAULT 'GROSS';
