import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

interface InviteRequest {
  templateId: string;
  partyAAddr: string;
  partyBEmail: string;
}

interface InviteResponse {
  inviteURL: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InviteResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { templateId, partyAAddr, partyBEmail }: InviteRequest = req.body;

    // Create agreement record
    const agreement = await prisma.agreement.create({
      data: {
        cid: "", // Will be updated when contract is uploaded
        templateType: templateId,
        partyA: partyAAddr,
        partyB: null, // Set when party B accepts
        status: "pending",
      },
    });

    // Generate invite URL with agreement ID
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteURL = `${baseUrl}/invite/${
      agreement.id
    }?email=${encodeURIComponent(partyBEmail)}`;

    // TODO: Send email to partyBEmail with inviteURL

    res.status(200).json({ inviteURL });
  } catch (error) {
    console.error("Invite creation error:", error);
    res.status(500).json({ error: "Failed to create invitation" });
  }
}
