-- AlterTable
ALTER TABLE "SupplierProfile" ADD COLUMN     "deliveryBaseFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryFreeAboveMinor" INTEGER;
