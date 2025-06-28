import { pinToIPFS } from "@/lib/ipfs";
import { prisma } from "@/lib/prisma";
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
      cid, // Optional CID from frontend IPFS upload
      draftId, // Optional draft ID to update existing agreement
    } = body;

    // Validate required fields
    if (!filename || !content || !partyA) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: filename, content, or partyA",
        },
        { status: 400 }
      );
    }

    // Validate partyA format (basic validation)
    if (typeof partyA !== "string" || partyA.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "partyA must be a valid non-empty string",
        },
        { status: 400 }
      );
    }

    // Validate partyB if provided
    if (partyB !== null && partyB !== undefined) {
      if (typeof partyB !== "string" || partyB.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "partyB must be a valid non-empty string if provided",
          },
          { status: 400 }
        );
      }

      // Basic email validation for partyB
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmail = emailRegex.test(partyB.trim());

      // Basic wallet address validation (starts with 0x and appropriate length)
      const isWalletAddress = /^0x[a-fA-F0-9]{40}$/.test(partyB.trim());

      if (!isEmail && !isWalletAddress) {
        return NextResponse.json(
          {
            success: false,
            error:
              "partyB must be a valid email address or wallet address (0x...)",
          },
          { status: 400 }
        );
      }
    }

    let finalCid = cid;
    let agreement;

    // Check if draftId is provided and agreement exists
    if (draftId) {
      const existingAgreement = await prisma.agreement.findUnique({
        where: { id: draftId },
      });

      if (existingAgreement) {
        // Check if CID already exists in DB before updating
        if (!finalCid && existingAgreement.cid) {
          finalCid = existingAgreement.cid;
          console.log(`Using existing CID from DB: ${finalCid}`);
        }

        // Update existing agreement with new data
        agreement = await prisma.agreement.update({
          where: { id: draftId },
          data: {
            templateType: templateType || existingAgreement.templateType,
            partyA: partyA.trim(),
            partyB: partyB && partyB.trim() ? partyB.trim() : null,
            depositA: depositA || 0,
            depositB: depositB || 0,
            // Preserve existing CID if no new one provided
            cid: finalCid || existingAgreement.cid,
            lastStepAt: new Date(),
          },
        });
        console.log(`Updated existing agreement with ID: ${draftId}`);
        console.log(`- Updated partyA: ${agreement.partyA}`);
        console.log(`- Updated partyB: ${agreement.partyB}`);
        console.log(`- Preserved CID: ${agreement.cid}`);
      } else {
        console.log(`Agreement with ID ${draftId} not found, creating new one`);
      }
    }

    // Create new agreement if none exists
    if (!agreement) {
      agreement = await prisma.agreement.create({
        data: {
          templateType: templateType || "unknown",
          partyA: partyA.trim(),
          partyB: partyB && partyB.trim() ? partyB.trim() : null, // Store trimmed value or null
          status: "pending", // Default status as per schema
          depositA: depositA || 0, // Deposit amount for party A
          depositB: depositB || 0, // Deposit amount for party B
          processStatus: "db_saved", // Update process status
          currentStep: "ipfs_upload", // Move to next step
        },
      });
      console.log(`Created new agreement with ID: ${agreement.id}`);
    }

    // Upload to IPFS only if no CID exists
    if (!finalCid) {
      console.log("No CID found, uploading to IPFS...");
      console.log(`- finalCid: ${finalCid}`);
      console.log(`- agreement.cid: ${agreement.cid}`);
      const uploadResult = await pinToIPFS(
        content,
        filename,
        agreement.id,
        "contract_unsigned"
      );
      finalCid = uploadResult.cid;
      console.log(`- New CID from upload: ${finalCid}`);
    } else {
      console.log(`Skipping IPFS upload - using existing CID: ${finalCid}`);
    }

    // Update agreement with CID and status if needed
    if (finalCid && (!agreement.cid || agreement.cid !== finalCid)) {
      await prisma.agreement.update({
        where: { id: agreement.id },
        data: {
          cid: finalCid,
          processStatus: "ipfs_uploaded",
          currentStep: "filecoin_access_deploy",
          lastStepAt: new Date(),
        },
      });
    }

    // 4. Save the actual file content locally, named by agreement ID
    const localFilePath = path.join(contractsDir, `${agreement.id}.md`);
    await fs.writeFile(localFilePath, content, "utf8");
    console.log(`Contract content saved locally to: ${localFilePath}`);

    // Update the agreement record with the local file path if you want to store it.
    // For this example, we assume the cid field is primarily for IPFS and local path is derived.
    // Or, you could add another field to schema.prisma like `filePath String?`

    // Determine if this was an existing agreement or new one
    const isExisting = draftId && agreement.id === draftId;

    return NextResponse.json(
      {
        success: true,
        agreementId: agreement.id,
        cid: finalCid,
        isExisting: isExisting,
        message: isExisting
          ? "Using existing agreement and content saved locally."
          : "Agreement created and content saved locally.",
        steps: {
          "Upload to IPFS": {
            completed: !!finalCid,
            cid: finalCid,
            links: finalCid
              ? {
                  ipfs: `https://ipfs.io/ipfs/${finalCid}`,
                  gateway: `https://gateway.lighthouse.storage/ipfs/${finalCid}`,
                }
              : null,
          },
        },
      },
      { status: isExisting ? 200 : 201 } // 200 OK for existing, 201 Created for new
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
