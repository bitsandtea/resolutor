import { AgreementFactoryABI } from "@/lib/ABIs";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { NextRequest, NextResponse } from "next/server";

// Flow EVM Testnet configuration
const FLOW_CONFIG = {
  rpcUrl: process.env.FLOW_RPC_URL || "https://testnet.evm.nodes.onflow.org",
  chainId: "545",
  explorerUrl: "https://evm-testnet.flowscan.io",
  factoryAddr: process.env.FLOW_FACTORY_ADDRESS || "",
  tokenAddr: process.env.FLOW_TOKEN_ADDRESS || "",
  privateKey: process.env.FLOW_PRIVATE_KEY || "",
};

export async function POST(request: NextRequest) {
  try {
    const { agreementId } = await request.json();

    if (!agreementId) {
      return NextResponse.json(
        { error: "Missing required field: agreementId" },
        { status: 400 }
      );
    }

    // Check if agreement exists and has Filecoin contracts deployed
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { deploymentSteps: true },
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    if (!agreement.filecoinStorageManager || !agreement.filecoinAccessControl) {
      return NextResponse.json(
        { error: "Filecoin contracts must be deployed before Flow deployment" },
        { status: 400 }
      );
    }

    // Setup Flow provider and wallet
    if (!FLOW_CONFIG.privateKey) {
      throw new Error("FLOW_PRIVATE_KEY environment variable is required");
    }

    if (!FLOW_CONFIG.factoryAddr) {
      throw new Error("FLOW_FACTORY_ADDRESS environment variable is required");
    }

    const provider = new ethers.JsonRpcProvider(FLOW_CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(FLOW_CONFIG.privateKey, provider);

    console.log(`Deploying Flow contract for agreement ${agreementId}`);

    return await deployFlowAgreement(agreementId, agreement, wallet);
  } catch (error) {
    console.error("Deploy Flow API error:", error);
    return NextResponse.json(
      {
        error: "Failed to deploy Flow contract",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function deployFlowAgreement(
  agreementId: string,
  agreement: any,
  wallet: ethers.Wallet
) {
  // Update deployment step to in_progress
  let flowStep = await prisma.deploymentStep.findFirst({
    where: {
      agreementId,
      stepName: "flow_deploy",
    },
  });

  if (!flowStep) {
    flowStep = await prisma.deploymentStep.create({
      data: {
        agreementId,
        stepName: "flow_deploy",
        status: "in_progress",
        metadata: {
          partyA: agreement.partyA,
          partyB: agreement.partyB,
          depositA: agreement.depositA,
          depositB: agreement.depositB,
          filecoinStorageManager: agreement.filecoinStorageManager,
          filecoinAccessControl: agreement.filecoinAccessControl,
        },
      },
    });
  } else {
    flowStep = await prisma.deploymentStep.update({
      where: { id: flowStep.id },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        errorMessage: null,
        retryCount: flowStep.retryCount + 1,
      },
    });
  }

  try {
    // Connect to AgreementFactory
    const factory = new ethers.Contract(
      FLOW_CONFIG.factoryAddr,
      AgreementFactoryABI,
      wallet
    );

    console.log("Creating Flow agreement contract...");

    // Prepare deposit amounts (convert to wei)
    const depositAWei = ethers.parseEther(agreement.depositA.toString());
    const depositBWei = ethers.parseEther(agreement.depositB.toString());

    // Create agreement through factory
    const createTx = await factory.createAgreement(
      agreement.partyA,
      agreement.partyB || "0x0000000000000000000000000000000000000000", // PartyB might be null initially
      process.env.MEDIATOR_ADDRESS || "",
      depositAWei,
      depositBWei,
      FLOW_CONFIG.tokenAddr, // Token address
      agreement.cid || "" // Initial manifest CID
    );

    const receipt = await createTx.wait();
    console.log(`Flow agreement created: ${createTx.hash}`);

    // Extract new agreement address from events
    let newAgreementAddr = "";
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed && parsed.name === "AgreementCreated") {
            newAgreementAddr = parsed.args[0]; // contractAddr is the first indexed parameter
            break;
          }
        } catch (e) {
          // Skip unparseable logs
        }
      }
    }

    if (!newAgreementAddr) {
      throw new Error(
        "Failed to extract agreement contract address from transaction"
      );
    }

    console.log(`Flow agreement deployed at: ${newAgreementAddr}`);

    // Update deployment step to completed
    await prisma.deploymentStep.update({
      where: { id: flowStep.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        contractAddr: newAgreementAddr,
        txHash: createTx.hash,
        gasUsed: receipt?.gasUsed?.toString(),
        blockNumber: receipt?.blockNumber?.toString(),
        metadata: {
          factoryAddr: FLOW_CONFIG.factoryAddr,
          tokenAddr: FLOW_CONFIG.tokenAddr,
          blockNumber: receipt?.blockNumber,
          deployedAt: new Date().toISOString(),
          ...(typeof flowStep.metadata === "object" &&
          flowStep.metadata !== null
            ? flowStep.metadata
            : {}),
        },
      },
    });

    // Update agreement with Flow contract address
    await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        flowContractAddr: newAgreementAddr,
        flowFactoryTx: createTx.hash,
        processStatus: "flow_deployed",
        currentStep: "completed",
        lastStepAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      step: {
        stepName: "flow_deploy",
        status: "completed",
        contractAddr: newAgreementAddr,
        txHash: createTx.hash,
        blockNumber: receipt?.blockNumber?.toString(),
      },
      nextStep: "completed",
      flowContractAddr: newAgreementAddr,
    });
  } catch (deployError) {
    console.error("Flow deployment failed:", deployError);

    // Update deployment step to failed
    await prisma.deploymentStep.update({
      where: { id: flowStep.id },
      data: {
        status: "failed",
        errorMessage:
          deployError instanceof Error
            ? deployError.message
            : "Flow deployment failed",
        completedAt: new Date(),
      },
    });

    // Update agreement status
    await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        processStatus: "failed",
        errorDetails:
          deployError instanceof Error
            ? deployError.message
            : "Flow deployment failed",
        lastStepAt: new Date(),
      },
    });

    throw deployError;
  }
}
