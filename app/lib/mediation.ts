import { AgreementFactoryABI } from "@/lib/ABIs";
import { MediatorInput, runMediator } from "@/lib/ai/mediator";
import { prisma } from "@/lib/prisma";
import { Dispute } from "@prisma/client";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function triggerMediation(agreementId: string): Promise<Dispute> {
  if (!agreementId) {
    throw new Error("Agreement ID is required.");
  }

  const dispute = await prisma.dispute.findFirst({
    where: { agreementId },
    include: { agreement: true },
  });

  if (!dispute) {
    throw new Error("Dispute not found.");
  }

  if (
    !dispute.agreement ||
    !dispute.agreement.draftContent ||
    !dispute.agreement.partyA_address ||
    !dispute.agreement.partyB_address
  ) {
    throw new Error("Agreement data is incomplete.");
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
        chain: {
          id: Number(process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID),
          name: "Flow EVM Testnet",
          network: "flow-testnet",
          nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
          rpcUrls: {
            default: { http: [process.env.NEXT_PUBLIC_FLOW_RPC_URL || ""] },
            public: { http: [process.env.NEXT_PUBLIC_FLOW_RPC_URL || ""] },
          },
        },
        transport: http(process.env.NEXT_PUBLIC_FLOW_RPC_URL),
      });

      const agreementIdBytes = toHex(agreementId, { size: 32 });
      const txHash = await walletClient.writeContract({
        address: multisigAddr as `0x${string}`,
        abi: AgreementFactoryABI,
        functionName: "approveResolution",
        args: [agreementIdBytes],
      });

      const updatedDispute = await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          mediationResult: mediationResult as any,
          status: "resolved",
          payoutTxHash: txHash,
        },
      });

      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          status: "resolved",
        },
      });

      return updatedDispute;
    } catch (chainError) {
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
      throw new Error(
        `Mediation completed but on-chain execution failed: ${message}`
      );
    }
  } else {
    const updatedDispute = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        mediationResult: mediationResult as any,
        status: "mediated",
      },
    });
    return updatedDispute;
  }
}
