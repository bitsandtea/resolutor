/*
  Warnings:

  - You are about to drop the column `finalResult` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `triageResult` on the `Dispute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "finalResult",
DROP COLUMN "triageResult",
ADD COLUMN     "mediationInputs" JSONB,
ADD COLUMN     "mediationResult" JSONB;
