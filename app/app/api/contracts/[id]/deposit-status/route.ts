import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreementId = params.id;
    const body = await req.json();
    const { partyA, partyB, depositAPaid, depositBPaid, partyA_address } = body;

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

    if (partyA_address !== undefined) {
      updateData.partyA_address = partyA_address;
    }

    // After updating deposit status, check if the contract can be moved to "active"
    const isPartyADepositPaid =
      depositAPaid !== undefined ? depositAPaid : agreement.depositAPaid;
    const isPartyBDepositPaid =
      depositBPaid !== undefined ? depositBPaid : agreement.depositBPaid;
    const hasPartyB = partyB !== undefined ? partyB : agreement.partyB;

    // The contract is considered active if both parties have paid (if required) and Party B exists.
    const isPartyAReady = agreement.depositA === 0 || isPartyADepositPaid;
    const isPartyBReady = agreement.depositB === 0 || isPartyBDepositPaid;

    if (isPartyAReady && isPartyBReady && hasPartyB) {
      updateData.status = "active";
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
          status: updatedAgreement.status,
          partyA_address: updatedAgreement.partyA_address,
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreementId = params.id;
    const body = await req.json();
    const { depositPaid } = body;

    if (!agreementId || typeof depositPaid !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        depositBPaid: depositPaid,
      },
    });

    return NextResponse.json({ success: true, agreement: updatedAgreement });
  } catch (error) {
    console.error("Error updating deposit status:", error);
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
