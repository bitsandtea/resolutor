import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      agreementId,
      signerName,
      signerEmail,
      signatureData, // Could be a digital signature or just confirmation
      depositAmount, // Optional deposit amount if the signer wants to modify it
    } = body;

    if (!agreementId || !signerName || !signerEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: agreementId, signerName, or signerEmail",
        },
        { status: 400 }
      );
    }

    // Find the agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, error: "Agreement not found" },
        { status: 404 }
      );
    }

    if (agreement.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Agreement is not in pending status" },
        { status: 400 }
      );
    }

    // Update the agreement with party B information
    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        partyB: signerEmail,
        // Note: depositB amount is already set when contract was created
        // In the future, we could allow modification here if needed
        status: "active", // Assuming this means both parties have agreed to the terms
      },
    });

    return NextResponse.json(
      {
        success: true,
        agreementId: updatedAgreement.id,
        message: "Contract signed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/sign-contract:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sign contract",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
