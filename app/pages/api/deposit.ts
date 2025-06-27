import type { NextApiRequest, NextApiResponse } from "next";
import {
  generateDepositTransaction,
  TransactionRequest,
} from "../../lib/flow/generator";
import { prisma } from "../../lib/prisma";

interface DepositRequest {
  agreementId: string;
  party: "A" | "B"; // Specify which party is making the deposit
  partyAddr?: string; // Optional party address
  amount?: string; // Optional amount override
}

interface DepositResponse {
  tx: TransactionRequest;
}

const MOCK_ERC20_ADDRESS = process.env.MOCK_ERC20_ADDRESS || "";
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DepositResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agreementId, party, partyAddr, amount }: DepositRequest = req.body;

    // Get agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    // Determine the deposit amount to use
    let depositAmount: string;
    if (amount) {
      depositAmount = amount;
    } else if (party === "A") {
      depositAmount = agreement.depositA.toString();
    } else {
      depositAmount = agreement.depositB.toString();
    }

    // Check if deposit amount is greater than 0
    if (parseFloat(depositAmount) <= 0) {
      return res
        .status(400)
        .json({ error: "No deposit required for this party" });
    }

    // Generate ERC20 transfer transaction to escrow contract
    const tx = generateDepositTransaction(
      MOCK_ERC20_ADDRESS,
      ESCROW_CONTRACT_ADDRESS,
      depositAmount
    );

    // Update deposit payment status in database
    if (party === "A") {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: { depositAPaid: true },
      });
    } else if (party === "B") {
      await prisma.agreement.update({
        where: { id: agreementId },
        data: { depositBPaid: true },
      });
    }

    // Check if both parties have deposited (if required)
    const updatedAgreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    const partyADepositRequired = updatedAgreement!.depositA > 0;
    const partyBDepositRequired = updatedAgreement!.depositB > 0;
    const partyADepositComplete =
      !partyADepositRequired || updatedAgreement!.depositAPaid;
    const partyBDepositComplete =
      !partyBDepositRequired || updatedAgreement!.depositBPaid;

    if (
      partyADepositComplete &&
      partyBDepositComplete &&
      updatedAgreement!.status === "pending"
    ) {
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
