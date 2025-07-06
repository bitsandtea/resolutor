/*
  Warnings:

  - You are about to drop the column `openerEvidence` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `responderEvidence` on the `Dispute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "openerEvidence",
DROP COLUMN "responderEvidence",
ADD COLUMN     "openerEvidenceCids" TEXT[],
ADD COLUMN     "responderEvidenceCids" TEXT[];
