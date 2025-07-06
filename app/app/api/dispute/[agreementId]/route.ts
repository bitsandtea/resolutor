import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { agreementId: string } }
) {
  try {
    const { agreementId } = params;

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required." },
        { status: 400 }
      );
    }

    const dispute = await prisma.dispute.findFirst({
      where: { agreementId },
      orderBy: { createdAt: "desc" },
      include: {
        agreement: {
          select: {
            id: true,
            partyA_address: true,
            partyB_address: true,
            flowContractAddr: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, dispute });
  } catch (error) {
    console.error("Error fetching dispute:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
