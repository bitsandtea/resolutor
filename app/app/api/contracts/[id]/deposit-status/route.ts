import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreementId = params.id;
    const body = await req.json();
    const { partyA, partyB, depositAPaid, depositBPaid } = body;

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required" },
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

    // Prepare update data
    const updateData: any = {};

    if (depositAPaid !== undefined) {
      updateData.depositAPaid = depositAPaid;
    }

    if (depositBPaid !== undefined) {
      updateData.depositBPaid = depositBPaid;
    }

    if (partyA !== undefined) {
      updateData.partyA = partyA;
    }

    if (partyB !== undefined) {
      updateData.partyB = partyB;
    }

    // Update the agreement
    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        agreementId: updatedAgreement.id,
        message: "Deposit status updated successfully",
        agreement: {
          id: updatedAgreement.id,
          depositAPaid: updatedAgreement.depositAPaid,
          depositBPaid: updatedAgreement.depositBPaid,
          partyA: updatedAgreement.partyA,
          partyB: updatedAgreement.partyB,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/contracts/[id]/deposit-status:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update deposit status",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
