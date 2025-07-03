import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agreementId, address } = body;

    if (!agreementId || !address) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: agreementId or address",
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

    // Parse existing signers data or initialize
    let signersData = [];
    if (agreement.signersData) {
      try {
        signersData = JSON.parse(agreement.signersData as string);
      } catch (e) {
        signersData = [];
      }
    }

    // Add or update Party B information
    const partyBSigner = {
      id: "partyB",
      name: "Party B",
      email: "partyB@example.com",
      address,
      role: "signer",
      status: "pending",
      depositAmount: agreement.depositB,
    };

    // Update or add Party B in signers data
    const existingIndex = signersData.findIndex((s: any) => s.id === "partyB");
    if (existingIndex >= 0) {
      signersData[existingIndex] = partyBSigner;
    } else {
      signersData.push(partyBSigner);
    }

    // Update the agreement
    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        partyB: address, // Use address for partyB field
        partyB_address: address, // Store wallet address as partyB_address
        signersData: JSON.stringify(signersData),
      },
    });

    return NextResponse.json(
      {
        success: true,
        agreementId: updatedAgreement.id,
        message: "Party B information updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/update-party-b:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update Party B information",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
