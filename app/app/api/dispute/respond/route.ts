import { triggerMediation } from "@/lib/mediation";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { agreementId, responderAddr, summary, evidenceCids } =
      await req.json();

    if (!agreementId || !responderAddr || !summary) {
      return NextResponse.json(
        {
          success: false,
          error: "Agreement ID, responder address, and summary are required.",
        },
        { status: 400 }
      );
    }

    // Find the latest dispute for the given agreement
    const dispute = await prisma.dispute.findFirst({
      where: { agreementId: agreementId },
      orderBy: { createdAt: "desc" },
      include: { agreement: true },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found for this agreement." },
        { status: 404 }
      );
    }

    // Determine who the responder should be (the party who is NOT the opener)
    // const responderParty =
    //   dispute.opener.toLowerCase() === dispute.agreement.partyA?.toLowerCase()
    //     ? dispute.agreement.partyB
    //     : dispute.agreement.partyA;

    // if (
    //   !responderParty ||
    //   responderAddr.toLowerCase() !== responderParty.toLowerCase()
    // ) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: "You are not authorized to respond to this dispute.",
    //     },
    //     { status: 403 }
    //   );
    // }

    if (dispute.responder) {
      return NextResponse.json(
        {
          success: false,
          error: "A response has already been submitted for this dispute.",
        },
        { status: 400 }
      );
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        responder: responderAddr,
        responderSummary: summary,
        responderEvidenceCids: evidenceCids || [],
        status: "mediating",
      },
    });

    // Trigger mediation after response
    const updatedDisputeWithMediation = await triggerMediation(agreementId);

    return NextResponse.json({
      success: true,
      message: "Response submitted and mediation completed.",
      dispute: updatedDisputeWithMediation,
    });
  } catch (error) {
    console.error("Error responding to dispute:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
