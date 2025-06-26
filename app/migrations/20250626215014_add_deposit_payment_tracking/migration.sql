-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "depositAPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositBPaid" BOOLEAN NOT NULL DEFAULT false;
