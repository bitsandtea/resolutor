import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agreementId = url.searchParams.get("agreementId");

    if (!agreementId) {
      return NextResponse.json(
        { error: "Missing required parameter: agreementId" },
        { status: 400 }
      );
    }

    // Get agreement with all deployment steps
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        deploymentSteps: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    // Determine current deployment state
    const deploymentState = {
      agreementId: agreement.id,
      processStatus: agreement.processStatus,
      currentStep: agreement.currentStep,
      lastStepAt: agreement.lastStepAt,
      errorDetails: agreement.errorDetails,
      retryCount: agreement.retryCount,

      // Contract addresses
      flowContractAddr: agreement.flowContractAddr,
      filecoinAccessControl: agreement.filecoinAccessControl,

      // Transaction hashes
      flowFactoryTx: agreement.flowFactoryTx,

      // IPFS data
      cid: agreement.cid,

      // Steps
      deploymentSteps: agreement.deploymentSteps.map((step) => ({
        id: step.id,
        stepName: step.stepName,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        txHash: step.txHash,
        contractAddr: step.contractAddr,
        ipfsCid: step.ipfsCid,
        errorMessage: step.errorMessage,
        gasUsed: step.gasUsed,
        blockNumber: step.blockNumber,
        retryCount: step.retryCount,
        maxRetries: step.maxRetries,
        metadata: step.metadata,
      })),
    };

    // Determine if deployment can be resumed
    const canResume =
      agreement.processStatus === "failed" && agreement.retryCount < 3;

    // Determine next step to execute
    let nextStep: string | null = null;
    if (agreement.processStatus === "db_saved") {
      nextStep = "ipfs_upload";
    } else if (agreement.processStatus === "ipfs_uploaded") {
      nextStep = "filecoin_access_deploy";
    } else if (agreement.processStatus === "filecoin_deployed") {
      // Check if filecoin_store_file is completed
      const storeFileStep = agreement.deploymentSteps.find(
        (step) => step.stepName === "filecoin_store_file"
      );
      if (!storeFileStep || storeFileStep.status !== "completed") {
        nextStep = "filecoin_store_file";
      } else {
        nextStep = "flow_deploy";
      }
    } else if (agreement.processStatus === "failed") {
      // Find the last failed step
      const failedStep = agreement.deploymentSteps
        .filter((step) => step.status === "failed")
        .pop();
      if (failedStep && canResume) {
        nextStep = failedStep.stepName;
      }
    }

    return NextResponse.json({
      success: true,
      currentState: deploymentState,
      canResume,
      nextStep,
      isComplete:
        agreement.processStatus === "completed" ||
        agreement.processStatus === "flow_deployed",
    });
  } catch (error) {
    console.error("Deployment status API error:", error);
    return NextResponse.json(
      {
        error: "Failed to get deployment status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agreementId, action } = await request.json();

    if (!agreementId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: agreementId, action" },
        { status: 400 }
      );
    }

    if (action === "resume") {
      return await resumeDeployment(agreementId);
    } else if (action === "reset") {
      return await resetDeployment(agreementId);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'resume' or 'reset'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Deployment action API error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute deployment action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function resumeDeployment(agreementId: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: { deploymentSteps: true },
  });

  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }

  if (agreement.processStatus !== "failed") {
    return NextResponse.json(
      { error: "Can only resume failed deployments" },
      { status: 400 }
    );
  }

  if (agreement.retryCount >= 3) {
    return NextResponse.json(
      { error: "Maximum retry attempts reached" },
      { status: 400 }
    );
  }

  // Find the last failed step
  const failedStep = agreement.deploymentSteps
    .filter((step) => step.status === "failed")
    .pop();

  if (!failedStep) {
    return NextResponse.json(
      { error: "No failed step found to resume" },
      { status: 400 }
    );
  }

  // Reset the failed step to pending
  await prisma.deploymentStep.update({
    where: { id: failedStep.id },
    data: {
      status: "pending",
      errorMessage: null,
      startedAt: new Date(),
    },
  });

  // Update agreement status
  await prisma.agreement.update({
    where: { id: agreementId },
    data: {
      processStatus: "db_saved", // Reset to allow processing
      errorDetails: null,
      retryCount: agreement.retryCount + 1,
      lastStepAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: "Deployment resumed",
    nextStep: failedStep.stepName,
    retryCount: agreement.retryCount + 1,
  });
}

async function resetDeployment(agreementId: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
  });

  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }

  // Delete all deployment steps
  await prisma.deploymentStep.deleteMany({
    where: { agreementId },
  });

  // Reset agreement to initial state
  await prisma.agreement.update({
    where: { id: agreementId },
    data: {
      processStatus: "db_saved",
      currentStep: "ipfs_upload",
      flowContractAddr: null,

      filecoinAccessControl: null,
      flowFactoryTx: null,
      errorDetails: null,
      retryCount: 0,
      lastStepAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: "Deployment reset to initial state",
    nextStep: "ipfs_upload",
  });
}
