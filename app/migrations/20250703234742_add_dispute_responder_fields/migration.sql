/*
  Warnings:

  - You are about to drop the column `counterEvidence` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `counterSummary` on the `Dispute` table. All the data in the column will be lost.
  - Made the column `openerSummary` on table `Dispute` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "counterEvidence",
DROP COLUMN "counterSummary",
ADD COLUMN     "responder" TEXT,
ADD COLUMN     "responderEvidence" TEXT,
ADD COLUMN     "responderSummary" TEXT,
ADD COLUMN     "respondingTxHash" TEXT,
ALTER COLUMN "openerSummary" SET NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
