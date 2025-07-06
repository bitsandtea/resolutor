import { AgreementFactoryABI } from "@/lib/ABIs";
import { MediatorInput, runMediator } from "@/lib/ai/mediator";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { filecoinCalibration } from "viem/chains";

export async function POST(req: NextRequest) {
  console.log("Debug: OPENAI_API_KEY is set:", !!process.env.OPENAI_API_KEY);
  console.log("Debug: OPEN_AI_API_KEY is set:", !!process.env.OPEN_AI_API_KEY);
  try {
    const { agreementId } = await req.json();

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required." },
        { status: 400 }
      );
    }

    const dispute = await prisma.dispute.findFirst({
      where: { agreementId },
      include: { agreement: true },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found." },
        { status: 404 }
      );
    }

    if (
      !dispute.agreement ||
      !dispute.agreement.draftContent ||
      !dispute.agreement.partyA_address ||
      !dispute.agreement.partyB_address
    ) {
      return NextResponse.json(
        { success: false, error: "Agreement data is incomplete." },
        { status: 400 }
      );
    }

    const {
      agreement: {
        draftContent,
        partyA_address,
        partyB_address,
        depositA,
        depositB,
      },
      opener,
      openerSummary,
      openerEvidenceCids,
      responderSummary,
      responderEvidenceCids,
      requestedAmount,
    } = dispute;

    const totalDeposit = (depositA ?? 0) + (depositB ?? 0);
    const amountToOpener = requestedAmount;
    const amountToResponder = totalDeposit - amountToOpener;

    let proposedResolution = "";
    if (opener === partyA_address) {
      proposedResolution = `Party A (opener) receives ${amountToOpener}, Party B (responder) receives ${amountToResponder}.`;
    } else {
      proposedResolution = `Party B (opener) receives ${amountToOpener}, Party A (responder) receives ${amountToResponder}.`;
    }

    const mediatorInput: MediatorInput = {
      agreementId,
      contractText: draftContent,
      partyA_address,
      partyB_address,
      opener: {
        address: opener,
        summary: openerSummary,
        cids: openerEvidenceCids,
        proposedResolution,
      },
      responder: responderSummary
        ? {
            summary: responderSummary,
            cids: responderEvidenceCids,
          }
        : undefined,
    };

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { mediationInputs: mediatorInput as any },
    });

    const mediationResult = await runMediator(mediatorInput);

    if (mediationResult.decision === "approveResolution") {
      try {
        const mediatorPkey = process.env.MEDIATOR_PKEY;
        const multisigAddr = process.env.NEXT_PUBLIC_MULTISIG_ADDRESS;

        if (!mediatorPkey || !multisigAddr) {
          throw new Error("Mediator key or multisig address not configured.");
        }

        const account = privateKeyToAccount(`0x${mediatorPkey}`);

        const walletClient = createWalletClient({
          account,
          chain: filecoinCalibration,
          transport: http(process.env.NEXT_PUBLIC_FILECOIN_RPC_URL),
        });

        const agreementIdBytes = toHex(agreementId, { size: 32 });
        console.log("Shooting the contract with:", {
          address: multisigAddr as `0x${string}`,
          abi: AgreementFactoryABI,
          functionName: "approveResolution",
          args: [agreementIdBytes],
        });

        const txHash = await walletClient.writeContract({
          address: multisigAddr as `0x${string}`,
          abi: AgreementFactoryABI,
          functionName: "approveResolution",
          args: [agreementIdBytes],
        });

        await prisma.dispute.update({
          where: { id: dispute.id },
          data: {
            mediationResult: mediationResult as any,
            status: "mediated",
            payoutTxHash: txHash,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Mediation successful and resolution approved on-chain.",
          result: mediationResult,
          txHash: txHash,
        });
      } catch (chainError) {
        console.error("On-chain execution failed:", chainError);
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: {
            mediationResult: mediationResult as any,
            status: "mediated_execution_failed",
          },
        });
        const message =
          chainError instanceof Error
            ? chainError.message
            : "On-chain execution failed.";
        return NextResponse.json(
          {
            success: false,
            error: `Mediation completed but on-chain execution failed: ${message}`,
          },
          { status: 500 }
        );
      }
    } else {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          mediationResult: mediationResult as any,
          status: "mediated",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Mediation triggered successfully.",
        result: mediationResult,
      });
    }
  } catch (error) {
    console.error("Error triggering mediation:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
