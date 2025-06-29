/*
  Warnings:

  - You are about to drop the column `filecoinAccessTx` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `filecoinStorageManager` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `filecoinStorageTx` on the `Agreement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "filecoinAccessTx",
DROP COLUMN "filecoinStorageManager",
DROP COLUMN "filecoinStorageTx";
