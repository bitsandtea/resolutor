/*
  Warnings:

  - You are about to drop the `NetworkConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "partyA_address" TEXT,
ADD COLUMN     "partyB_address" TEXT;

-- DropTable
DROP TABLE "NetworkConfig";
