import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreementId = params.id;

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required" },
        { status: 400 }
      );
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        deploymentSteps: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, error: "Agreement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agreement,
    });
  } catch (error) {
    console.error(`Error in /api/contracts/[id]:`, error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve contract",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
