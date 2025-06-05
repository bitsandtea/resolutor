import type { NextApiRequest, NextApiResponse } from "next";
import { runTriage } from "../../../lib/ai/mediator";
import { prisma } from "../../../lib/prisma";

interface OpenDisputeRequest {
  agreementId: string;
  openerAddr: string;
  evidenceCid: string;
  summary: string;
}

interface OpenDisputeResponse {
  disputeId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OpenDisputeResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      agreementId,
      openerAddr,
      evidenceCid,
      summary,
    }: OpenDisputeRequest = req.body;

    // Verify agreement exists and is active
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    if (agreement.status !== "active") {
      return res
        .status(400)
        .json({ error: "Agreement must be active to open dispute" });
    }

    // Verify opener is a party to the agreement
    if (agreement.partyA !== openerAddr && agreement.partyB !== openerAddr) {
      return res
        .status(403)
        .json({ error: "Only parties to the agreement can open disputes" });
    }

    // Create dispute record
    const dispute = await prisma.dispute.create({
      data: {
        agreementId,
        opener: openerAddr,
        openerEvidence: evidenceCid,
        openerSummary: summary,
        status: "filed",
      },
    });

    // Update agreement status
    await prisma.agreement.update({
      where: { id: agreementId },
      data: { status: "disputed" },
    });

    // Trigger AI triage asynchronously
    setImmediate(async () => {
      try {
        const triageResult = await runTriage({
          agreementId,
          contractText: `Contract CID: ${agreement.cid}`, // TODO: Fetch actual contract text from IPFS
          opener: openerAddr,
          evidence: {
            summary,
            files: [
              {
                cid: evidenceCid,
                filename: "evidence",
                mimeType: "application/octet-stream",
              },
            ],
          },
        });

        // Update dispute with triage result
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: {
            triageResult: triageResult as any,
            status:
              triageResult.action === "dismiss"
                ? "triaged_dismiss"
                : "triaged_proceed",
          },
        });
      } catch (error) {
        console.error("Triage error:", error);
      }
    });

    res.status(200).json({ disputeId: dispute.id });
  } catch (error) {
    console.error("Open dispute error:", error);
    res.status(500).json({ error: "Failed to open dispute" });
  }
}
