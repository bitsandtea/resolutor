import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agreementId, status } = body;

    if (!agreementId || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const updatedAgreement = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        status,
      },
    });

    return NextResponse.json({ success: true, agreement: updatedAgreement });
  } catch (error) {
    console.error("Error updating agreement status:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update agreement status",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
