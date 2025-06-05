import type { NextApiRequest, NextApiResponse } from "next";
import {
  generateDepositTransaction,
  TransactionRequest,
} from "../../lib/flow/generator";
import { prisma } from "../../lib/prisma";

interface DepositRequest {
  agreementId: string;
  partyAddr: string;
  amount: string;
}

interface DepositResponse {
  tx: TransactionRequest;
}

// Mock ERC20 token address for hackathon
const MOCK_ERC20_ADDRESS = "0x1234567890123456789012345678901234567890";
const ESCROW_CONTRACT_ADDRESS = "0x0987654321098765432109876543210987654321";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DepositResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agreementId, partyAddr, amount }: DepositRequest = req.body;

    // Get agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    // Generate ERC20 transfer transaction to escrow contract
    const tx = generateDepositTransaction(
      MOCK_ERC20_ADDRESS,
      ESCROW_CONTRACT_ADDRESS,
      amount
    );

    // Update deposit status in database
    const isPartyA = agreement.partyA === partyAddr;
    const isPartyB = agreement.partyB === partyAddr;

    if (isPartyA) {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: { depositA: true },
      });
    } else if (isPartyB) {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: { depositB: true },
      });
    }

    // Check if both parties have deposited
    const updatedAgreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (updatedAgreement?.depositA && updatedAgreement?.depositB) {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: { status: "active" },
      });
    }

    res.status(200).json({ tx });
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({ error: "Failed to create deposit transaction" });
  }
}
