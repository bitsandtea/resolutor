import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const contractsDir = path.join(
  process.cwd(),
  "public",
  "contracts",
  "temp_saved"
);

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

    // 1. Fetch Agreement details from the database
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return NextResponse.json(
        { success: false, error: "Agreement not found" },
        { status: 404 }
      );
    }

    // 2. Read the contract content from the local file
    // The file was saved as [agreementId]-[timestamp].md in the save-contract endpoint
    let content = "";
    try {
      // Find files matching the pattern [agreementId]-*.md
      const files = await fs.readdir(contractsDir);
      const matchingFiles = files.filter(
        (file) => file.startsWith(`${agreement.id}-`) && file.endsWith(".md")
      );

      if (matchingFiles.length === 0) {
        throw new Error(`No contract file found for agreement ${agreement.id}`);
      }

      // Get the most recent file (lexicographically, which works for ISO timestamps)
      const latestFile = matchingFiles.sort().reverse()[0];
      const localFilePath = path.join(contractsDir, latestFile);

      content = await fs.readFile(localFilePath, "utf8");
    } catch (fileError) {
      console.error(
        `Error reading contract file for agreement ${agreement.id}:`,
        fileError
      );
      // If the file isn't found, it's a critical issue as it should have been saved.
      // However, we can still return the agreement details from DB if needed,
      // or decide this is a hard error for content retrieval.
      return NextResponse.json(
        {
          success: false,
          error: "Failed to read contract content file.",
          agreementDetails: agreement,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        content: content,
        agreement: {
          id: agreement.id,
          cid: agreement.cid, // The conceptual/IPFS CID
          templateType: agreement.templateType,
          partyA: agreement.partyA,
          partyB: agreement.partyB,
          status: agreement.status,
          depositA: agreement.depositA,
          depositB: agreement.depositB,
          depositAPaid: agreement.depositAPaid,
          depositBPaid: agreement.depositBPaid,
          createdAt: agreement.createdAt,
          flowContractAddr: agreement.flowContractAddr,
          filecoinAccessControl: agreement.filecoinAccessControl,
          flowFactoryTx: agreement.flowFactoryTx,
          processStatus: agreement.processStatus,
          currentStep: agreement.currentStep,
          lastStepAt: agreement.lastStepAt,
          errorDetails: agreement.errorDetails,
          retryCount: agreement.retryCount,
          signersData: agreement.signersData,

          // Add any other details from the 'agreement' object you want to send to the frontend
        },
        message: "Agreement content retrieved successfully.",
      },
      { status: 200 }
    );
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
