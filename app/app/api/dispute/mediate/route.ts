import { triggerMediation } from "@/lib/mediation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { agreementId } = await req.json();

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required." },
        { status: 400 }
      );
    }

    const updatedDispute = await triggerMediation(agreementId);

    return NextResponse.json({
      success: true,
      message: "Mediation triggered successfully.",
      result: updatedDispute.mediationResult,
      txHash: updatedDispute.payoutTxHash,
      dispute: updatedDispute,
    });
  } catch (error) {
    console.error("Error triggering mediation:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
