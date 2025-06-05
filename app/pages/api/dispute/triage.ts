import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

interface TriageResponse {
  action: "dismiss" | "proceed";
  reasoning: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TriageResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { disputeId } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (!dispute.triageResult) {
      return res.status(202).json({ error: "Triage still in progress" });
    }

    const triageResult = dispute.triageResult as TriageResponse;
    res.status(200).json(triageResult);
  } catch (error) {
    console.error("Triage get error:", error);
    res.status(500).json({ error: "Failed to get triage result" });
  }
}
