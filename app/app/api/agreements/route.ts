import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("address");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    // Query agreements where the wallet is either partyA or partyB
    const agreements = await prisma.agreement.findMany({
      where: {
        OR: [{ partyA: walletAddress }, { partyB: walletAddress }],
      },
      select: {
        id: true,
        contractName: true,
        templateType: true,
        status: true,
        depositA: true,
        depositB: true,
        depositAPaid: true,
        depositBPaid: true,
        createdAt: true,
        currentStep: true,
        processStatus: true,
        partyA: true,
        partyB: true,
        partyA_address: true,
        partyB_address: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform the data for the frontend
    const projectsList = agreements.map((agreement) => ({
      id: agreement.id,
      name:
        agreement.contractName || agreement.templateType || "Unnamed Agreement",
      status: agreement.status,
      deposits: {
        total: agreement.depositA + agreement.depositB,
        depositA: agreement.depositA,
        depositB: agreement.depositB,
        depositAPaid: agreement.depositAPaid,
        depositBPaid: agreement.depositBPaid,
      },
      created: agreement.createdAt,
      currentStep: agreement.currentStep,
      processStatus: agreement.processStatus,
      partyA: agreement.partyA,
      partyB: agreement.partyB,
      partyA_address: agreement.partyA_address,
      partyB_address: agreement.partyB_address,
    }));

    return NextResponse.json({
      success: true,
      agreements: projectsList,
    });
  } catch (error) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agreements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
