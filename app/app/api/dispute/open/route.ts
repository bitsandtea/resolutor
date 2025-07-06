import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      agreementId,
      openerAddr,
      summary,
      evidenceCids,
      requestedAmount,
      txHash,
    } = await req.json();

    if (!agreementId || !openerAddr || !summary) {
      return NextResponse.json(
        {
          success: false,
          error: "Agreement ID, opener address, and summary are required.",
        },
        { status: 400 }
      );
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement || !agreement.draftContent) {
      return NextResponse.json(
        { success: false, error: "Agreement or contract text not found." },
        { status: 404 }
      );
    }

    await prisma.agreement.update({
      where: { id: agreementId },
      data: { status: "disputed" },
    });

    const dispute = await prisma.dispute.create({
      data: {
        agreementId,
        opener: openerAddr,
        openerSummary: summary,
        openerEvidenceCids: evidenceCids || [],
        requestedAmount: requestedAmount,
        status: "opened",
        openingTxHash: txHash,
      },
    });

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      message: "Dispute opened successfully.",
    });
  } catch (error) {
    console.error("Error opening dispute:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
