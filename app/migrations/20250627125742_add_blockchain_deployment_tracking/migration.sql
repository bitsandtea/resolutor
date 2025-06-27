-- DropIndex
DROP INDEX "Agreement_cid_key";

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "currentStep" TEXT NOT NULL DEFAULT 'contract_creation',
ADD COLUMN     "errorDetails" TEXT,
ADD COLUMN     "filecoinAccessControl" TEXT,
ADD COLUMN     "filecoinAccessTx" TEXT,
ADD COLUMN     "filecoinStorageManager" TEXT,
ADD COLUMN     "filecoinStorageTx" TEXT,
ADD COLUMN     "flowContractAddr" TEXT,
ADD COLUMN     "flowFactoryTx" TEXT,
ADD COLUMN     "lastStepAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "processStatus" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "cid" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DeploymentStep" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "contractAddr" TEXT,
    "ipfsCid" TEXT,
    "errorMessage" TEXT,
    "gasUsed" TEXT,
    "blockNumber" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPFSUpload" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT,
    "fileName" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPFSUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkConfig" (
    "id" TEXT NOT NULL,
    "networkName" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "explorerUrl" TEXT,
    "factoryAddr" TEXT,
    "storageManager" TEXT,
    "tokenAddr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IPFSUpload_cid_key" ON "IPFSUpload"("cid");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkConfig_networkName_key" ON "NetworkConfig"("networkName");

-- AddForeignKey
ALTER TABLE "DeploymentStep" ADD CONSTRAINT "DeploymentStep_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
