import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const {
      agreementId,
      stepName,
      status,
      txHash,
      contractAddr,
      errorMessage,
    } = await request.json();

    if (!agreementId || !stepName || !status) {
      return NextResponse.json(
        { error: "Missing required fields: agreementId, stepName, status" },
        { status: 400 }
      );
    }

    // Update or create deployment step
    const deploymentStep = await prisma.deploymentStep.upsert({
      where: {
        agreementId_stepName: {
          agreementId,
          stepName,
        },
      },
      update: {
        status,
        txHash: txHash || undefined,
        contractAddr: contractAddr || undefined,
        errorMessage: errorMessage || null,
        completedAt: status === "completed" ? new Date() : undefined,
        updatedAt: new Date(),
      },
      create: {
        agreementId,
        stepName,
        status,
        txHash: txHash || undefined,
        contractAddr: contractAddr || undefined,
        errorMessage: errorMessage || null,
        startedAt: new Date(),
        completedAt: status === "completed" ? new Date() : undefined,
      },
    });

    // Update agreement status based on step completion
    if (status === "completed") {
      let newProcessStatus = "db_saved";
      let newCurrentStep = "ipfs_upload";
      let agreementUpdates: Record<string, any> = {
        processStatus: newProcessStatus,
        currentStep: newCurrentStep,
        lastStepAt: new Date(),
        errorDetails: null,
      };

      if (stepName === "ipfs_upload") {
        newProcessStatus = "ipfs_uploaded";
        newCurrentStep = "filecoin_access_deploy";
      } else if (stepName === "filecoin_access_deploy") {
        newProcessStatus = "filecoin_access_deployed";
        newCurrentStep = "flow_deploy";
        if (contractAddr) {
          agreementUpdates.filecoinAccessControl = contractAddr;
        }
      } else if (stepName === "flow_deploy") {
        newProcessStatus = "flow_deployed";
        newCurrentStep = "completed";
        if (contractAddr) {
          agreementUpdates.flowContractAddr = contractAddr;
          agreementUpdates.flowFactoryTx = txHash;
        }
      } else if (stepName === "sign_approve_token") {
        newProcessStatus = "sign_approved";
        newCurrentStep = "sign_contract";
      } else if (stepName === "sign_contract") {
        newProcessStatus = "sign_signed";
        newCurrentStep = "sign_take_deposits";
      } else if (stepName === "sign_take_deposits") {
        newProcessStatus = "sign_completed";
        newCurrentStep = "completed";
        agreementUpdates.depositBPaid = true;
      }

      agreementUpdates.processStatus = newProcessStatus;
      agreementUpdates.currentStep = newCurrentStep;

      await prisma.agreement.update({
        where: { id: agreementId },
        data: agreementUpdates,
      });
    } else if (status === "failed") {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          processStatus: "failed",
          errorDetails: errorMessage || "Step failed",
          lastStepAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      step: deploymentStep,
    });
  } catch (error) {
    console.error("Update deployment step API error:", error);
    return NextResponse.json(
      {
        error: "Failed to update deployment step",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
