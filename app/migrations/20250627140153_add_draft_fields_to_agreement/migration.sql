-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "contractName" TEXT,
ADD COLUMN     "draftContent" TEXT,
ADD COLUMN     "formData" JSONB,
ADD COLUMN     "signersData" JSONB,
ALTER COLUMN "partyA" DROP NOT NULL,
ALTER COLUMN "currentStep" SET DEFAULT 'selectContract';
