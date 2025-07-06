-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "payoutTxHash" TEXT,
ADD COLUMN     "requestedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
