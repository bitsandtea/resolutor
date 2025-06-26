-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "templateType" TEXT,
    "partyA" TEXT NOT NULL,
    "partyB" TEXT,
    "depositA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "opener" TEXT NOT NULL,
    "openerEvidence" TEXT,
    "openerSummary" TEXT,
    "counterEvidence" TEXT,
    "counterSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'filed',
    "triageResult" JSONB,
    "finalResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_cid_key" ON "Agreement"("cid");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
