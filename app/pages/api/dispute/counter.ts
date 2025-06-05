import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

interface CounterEvidenceRequest {
  disputeId: string;
  evidenceCid: string;
  summary: string;
}

interface CounterEvidenceResponse {
  success: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CounterEvidenceResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { disputeId, evidenceCid, summary }: CounterEvidenceRequest =
      req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (dispute.status !== "triaged_proceed") {
      return res
        .status(400)
        .json({ error: "Dispute not ready for counter evidence" });
    }

    // Update dispute with counter evidence
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        counterEvidence: evidenceCid,
        counterSummary: summary,
        status: "counter_evidence",
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Counter evidence error:", error);
    res.status(500).json({ error: "Failed to submit counter evidence" });
  }
}
