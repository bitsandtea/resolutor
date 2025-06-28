import type { NextApiRequest, NextApiResponse } from "next";
import { runMediator } from "../../../lib/ai/mediator";
import { generateDepositTransaction } from "../../../lib/flow/generator";
import { prisma } from "../../../lib/prisma";

interface ResolveRequest {
  disputeId: string;
}

interface ResolveResponse {
  decision: "signInitiator" | "createNewTx" | "dismiss";
  tx?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResolveResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { disputeId }: ResolveRequest = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        agreement: true,
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (dispute.status !== "counter_evidence") {
      return res
        .status(400)
        .json({ error: "Dispute not ready for resolution" });
    }

    // Run AI mediation
    const mediationResult = await runMediator({
      agreementId: dispute.agreementId,
      contractText: `Contract CID: ${dispute.agreement.cid}`, // TODO: Fetch from IPFS
      tokenSymbol: "mockERC20",
      totalDeposit: 5000, // TODO: Get from agreement
      opener: {
        summary: dispute.openerSummary || "",
        files: dispute.openerEvidence
          ? [
              {
                cid: dispute.openerEvidence,
                filename: "evidence",
                mimeType: "application/octet-stream",
              },
            ]
          : [],
      },
      counter: {
        summary: dispute.counterSummary || "",
        files: dispute.counterEvidence
          ? [
              {
                cid: dispute.counterEvidence,
                filename: "counter-evidence",
                mimeType: "application/octet-stream",
              },
            ]
          : [],
      },
    });

    // Update dispute with final result
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        finalResult: mediationResult as any,
        status: "resolved",
      },
    });

    // Update agreement status
    await prisma.agreement.update({
      where: { id: dispute.agreementId },
      data: { status: "resolved" },
    });

    const response: ResolveResponse = {
      decision: mediationResult.decision,
    };

    // Generate transaction if needed
    if (
      mediationResult.decision === "createNewTx" &&
      mediationResult.amountToA
    ) {
      // Mock transaction generation
      response.tx = JSON.stringify(
        generateDepositTransaction(
          process.env.NEXT_PUBLIC_MULTISIG_ADDRESS || "",
          dispute.agreement.partyA,
          mediationResult.amountToA.toString()
        )
      );
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Resolve dispute error:", error);
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
}
