/*
  Warnings:

  - A unique constraint covering the columns `[agreementId,stepName]` on the table `DeploymentStep` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DeploymentStep_agreementId_stepName_key" ON "DeploymentStep"("agreementId", "stepName");
