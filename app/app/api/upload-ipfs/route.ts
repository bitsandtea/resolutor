import { prisma } from "@/lib/prisma";
import { create } from "@web3-storage/w3up-client";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

async function makeStorageClient() {
  const client = await create();

  // Login with email
  const email = process.env.W3UP_EMAIL;
  if (!email) {
    throw new Error("W3UP_EMAIL environment variable is required");
  }

  await client.login(email as `${string}@${string}`);

  // Set the space
  const spaceDid = process.env.W3UP_SPACE_DID;
  if (!spaceDid) {
    throw new Error("W3UP_SPACE_DID environment variable is required");
  }

  await client.setCurrentSpace(spaceDid as `did:${string}:${string}`);

  return client;
}

function makeFileObjects(name: string, content: string) {
  const buffer = Buffer.from(content, "utf-8");
  const files = [
    new File([buffer], name, {
      type: "text/markdown",
    }),
  ];
  return files;
}

// Generate SHA-256 hash of content for duplicate detection
function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const {
      agreementId,
      content,
      fileName,
      fileType = "contract_unsigned",
    } = await request.json();

    if (!agreementId || !content || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: agreementId, content, fileName" },
        { status: 400 }
      );
    }

    // Check if agreement exists
    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { deploymentSteps: true },
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    // Generate content hash for duplicate detection
    const contentHash = generateContentHash(content);
    console.log(`Content hash: ${contentHash}`);

    // Check if identical content already exists in database
    const existingUpload = await prisma.iPFSUpload.findFirst({
      where: {
        OR: [
          // Check by agreement ID and file type (existing logic)
          {
            agreementId,
            fileType,
          },
          // Check by content hash (new logic for cross-agreement duplicates)
          {
            contentHash,
          },
        ],
      },
    });

    if (existingUpload) {
      console.log(`Found existing IPFS upload with CID: ${existingUpload.cid}`);
      console.log(`Skipping IPFS upload, reusing existing content...`);

      // Update deployment step to completed for this agreement
      let ipfsStep = await prisma.deploymentStep.findFirst({
        where: {
          agreementId,
          stepName: "ipfs_upload",
        },
      });

      if (!ipfsStep) {
        ipfsStep = await prisma.deploymentStep.create({
          data: {
            agreementId,
            stepName: "ipfs_upload",
            status: "completed",
            ipfsCid: existingUpload.cid,
            completedAt: new Date(),
            metadata: {
              fileName,
              fileType,
              fileSize: Buffer.byteLength(content, "utf-8"),
              reusedExistingUpload: true,
              originalUploadId: existingUpload.id,
            },
          },
        });
      } else {
        ipfsStep = await prisma.deploymentStep.update({
          where: { id: ipfsStep.id },
          data: {
            status: "completed",
            completedAt: new Date(),
            ipfsCid: existingUpload.cid,
            metadata: {
              ...((ipfsStep.metadata as Record<string, unknown>) || {}),
              reusedExistingUpload: true,
              originalUploadId: existingUpload.id,
            },
          },
        });
      }

      // Update agreement with CID and process status
      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          cid: existingUpload.cid,
          processStatus: "ipfs_uploaded",
          currentStep: "filecoin_access_deploy",
          lastStepAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        cid: existingUpload.cid,
        fileName,
        fileSize: existingUpload.fileSize,
        uploadedAt: existingUpload.uploadedAt,
        reusedExisting: true,
        nextStep: "filecoin_access_deploy",
      });
    }

    // No existing content found, proceed with new upload
    console.log(`No CID provided, uploading to IPFS...`);

    // Update deployment step to in_progress
    let ipfsStep = await prisma.deploymentStep.findFirst({
      where: {
        agreementId,
        stepName: "ipfs_upload",
      },
    });

    if (!ipfsStep) {
      ipfsStep = await prisma.deploymentStep.create({
        data: {
          agreementId,
          stepName: "ipfs_upload",
          status: "in_progress",
          metadata: {
            fileName,
            fileType,
            fileSize: Buffer.byteLength(content, "utf-8"),
            contentHash,
          },
        },
      });
    } else {
      ipfsStep = await prisma.deploymentStep.update({
        where: { id: ipfsStep.id },
        data: {
          status: "in_progress",
          startedAt: new Date(),
          errorMessage: null,
          retryCount: ipfsStep.retryCount + 1,
          metadata: {
            ...((ipfsStep.metadata as Record<string, unknown>) || {}),
            contentHash,
          },
        },
      });
    }

    try {
      // Upload to IPFS via w3up-client
      const client = await makeStorageClient();
      const files = makeFileObjects(fileName, content);

      console.log(`Uploading ${fileName} to IPFS...`);
      const cidLink = await client.uploadDirectory(files);
      const cid = cidLink.toString();

      console.log(`Successfully uploaded to IPFS: ${cid}`);

      // Record IPFS upload with content hash
      await prisma.iPFSUpload.create({
        data: {
          agreementId,
          fileName,
          cid,
          fileSize: Buffer.byteLength(content, "utf-8"),
          contentType: "text/markdown",
          fileType,
          contentHash, // Store content hash for future duplicate detection
          version: 1,
        },
      });

      // Update deployment step to completed
      await prisma.deploymentStep.update({
        where: { id: ipfsStep.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          ipfsCid: cid,
          metadata: {
            ...((ipfsStep.metadata as Record<string, unknown>) || {}),
            uploadedAt: new Date().toISOString(),
            cid,
            contentHash,
          },
        },
      });

      // Update agreement with CID and process status
      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          cid,
          processStatus: "ipfs_uploaded",
          currentStep: "filecoin_access_deploy",
          lastStepAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        cid,
        fileName,
        fileSize: Buffer.byteLength(content, "utf-8"),
        uploadedAt: new Date(),
        nextStep: "filecoin_access_deploy",
      });
    } catch (uploadError) {
      console.error("IPFS upload failed:", uploadError);

      // Update deployment step to failed
      await prisma.deploymentStep.update({
        where: { id: ipfsStep.id },
        data: {
          status: "failed",
          errorMessage:
            uploadError instanceof Error
              ? uploadError.message
              : "IPFS upload failed",
          completedAt: new Date(),
        },
      });

      // Update agreement status
      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          processStatus: "failed",
          errorDetails:
            uploadError instanceof Error
              ? uploadError.message
              : "IPFS upload failed",
          lastStepAt: new Date(),
        },
      });

      throw uploadError;
    }
  } catch (error) {
    console.error("Upload IPFS API error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload to IPFS",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
