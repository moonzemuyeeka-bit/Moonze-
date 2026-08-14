-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "createdByRole" "ContractPartyRole" NOT NULL DEFAULT 'CUSTOMER';
