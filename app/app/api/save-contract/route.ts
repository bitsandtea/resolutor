import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import fs from "fs/promises"; // For file system operations
import { NextRequest, NextResponse } from "next/server";
import path from "path"; // For path manipulation

// Ensure the directory for saving contracts exists
const contractsDir = path.join(
  process.cwd(),
  "public",
  "contracts",
  "temp_saved"
);
const ensureContractsDirExists = async () => {
  try {
    await fs.access(contractsDir);
  } catch (error) {
    // Directory does not exist, so create it
    await fs.mkdir(contractsDir, { recursive: true });
  }
};

// Placeholder for actual IPFS pinning logic
async function pinToIPFS(content: string, filename: string): Promise<string> {
  // In a real scenario, this function would interact with an IPFS pinning service
  // or a local IPFS node to upload the content and get a CID.
  console.log(`Simulating IPFS pinning for ${filename}...`);
  // Generate a random UUID for the CID to avoid collisions
  const uuid = crypto.randomUUID();
  return `simulated-ipfs-cid-${uuid}`;
}

export async function POST(req: NextRequest) {
  try {
    await ensureContractsDirExists(); // Make sure directory exists before saving
    const body = await req.json();
    const {
      filename,
      content,
      templateType,
      partyA, // Expecting partyA (e.g., wallet address of the creator)
      partyB, // Party B email (optional, can be null if no second signer)
      depositA, // Deposit amount for party A
      depositB, // Deposit amount for party B (optional, defaults to 0)
    } = body;

    if (!filename || !content || !partyA) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: filename, content, or partyA",
        },
        { status: 400 }
      );
    }

    // 1. Save content (e.g., to IPFS or local storage) and get a CID or path
    const cid = await pinToIPFS(content, filename);

    // 2. Actually save the contract content to a local file for now
    // The filename for the saved content will be based on the agreement ID for uniqueness
    // We need the agreement ID first, so this step will be done after creating the agreement record.

    // 3. Create a new Agreement record in the database
    const newAgreement = await prisma.agreement.create({
      data: {
        cid: cid,
        templateType: templateType || "unknown",
        partyA: partyA,
        partyB: partyB || null, // Party B email if provided, null otherwise
        status: "pending", // Default status as per schema
        depositA: depositA || 0, // Deposit amount for party A
        depositB: depositB || 0, // Deposit amount for party B
      },
    });

    // 4. Save the actual file content locally, named by agreement ID
    const localFilePath = path.join(contractsDir, `${newAgreement.id}.md`);
    await fs.writeFile(localFilePath, content, "utf8");
    console.log(`Contract content saved locally to: ${localFilePath}`);

    // Update the agreement record with the local file path if you want to store it.
    // For this example, we assume the cid field is primarily for IPFS and local path is derived.
    // Or, you could add another field to schema.prisma like `filePath String?`

    return NextResponse.json(
      {
        success: true,
        agreementId: newAgreement.id,
        cid: newAgreement.cid,
        message: "Agreement created and content saved locally.",
      },
      { status: 201 } // 201 Created
    );
  } catch (error) {
    console.error("Error in /api/save-contract:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save contract",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
