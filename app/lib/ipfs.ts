import lighthouse from "@lighthouse-web3/sdk";
import fs from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "./prisma";

/**
 * Pins a file to IPFS using Lighthouse.storage (Filecoin-based storage).
 *
 * This function uploads content to IPFS through Filecoin storage deals
 * using the Lighthouse.storage service and updates the database accordingly.
 *
 * @param {string} content The content of the file to be pinned.
 * @param {string} filename The name of the file.
 * @param {string} agreementId The ID of the agreement this upload belongs to.
 * @param {string} fileType The type of file being uploaded (e.g., "contract_unsigned", "evidence").
 * @returns {Promise<{ cid: string; uploadRecord: any }>} The IPFS CID and database record.
 */
export async function pinToIPFS(
  content: string,
  filename: string,
  agreementId: string,
  fileType: string = "contract_unsigned"
): Promise<{ cid: string; uploadRecord: any }> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "LIGHTHOUSE_API_KEY must be set in environment variables. Get your API key from https://lighthouse.storage"
    );
  }

  // Create a temporary file
  const tempDir = tmpdir();
  const tempFilePath = path.join(tempDir, filename);

  try {
    // Write content to temporary file
    await fs.writeFile(tempFilePath, content, "utf8");

    // Mark deployment step as in progress
    await prisma.deploymentStep.upsert({
      where: {
        agreementId_stepName: {
          agreementId,
          stepName: "ipfs_upload",
        },
      },
      update: {
        status: "in_progress",
        startedAt: new Date(),
        errorMessage: null,
      },
      create: {
        agreementId,
        stepName: "ipfs_upload",
        status: "in_progress",
        startedAt: new Date(),
      },
    });

    // Check if this exact content has already been uploaded by computing a hash
    // or checking if we have an existing upload for this agreement
    const existingUpload = await prisma.iPFSUpload.findFirst({
      where: {
        agreementId,
        fileType,
      },
    });

    let cid: string;
    let uploadResponse: any;

    if (existingUpload) {
      console.log(
        `Found existing IPFS upload for agreement ${agreementId}: ${existingUpload.cid}`
      );
      cid = existingUpload.cid;
      // Verify the content still exists on IPFS (optional check)
    } else {
      // Upload file to Lighthouse
      console.log(`Uploading ${filename} to IPFS via Lighthouse...`);
      uploadResponse = await lighthouse.upload(tempFilePath, apiKey);
      cid = uploadResponse.data.Hash;
      console.log(`File uploaded to IPFS via Lighthouse: ${cid}`);
    }

    // Calculate file size
    const stats = await fs.stat(tempFilePath);
    const fileSize = stats.size;

    // Create or update IPFS upload record (handle duplicate CIDs)
    let uploadRecord;
    if (existingUpload) {
      // Use the existing upload record
      uploadRecord = existingUpload;
      console.log(`Reusing existing IPFS upload record for CID: ${cid}`);
    } else {
      // Try to create new record, but handle duplicate CID gracefully
      try {
        uploadRecord = await prisma.iPFSUpload.create({
          data: {
            agreementId,
            fileName: filename,
            cid,
            fileSize,
            contentType: "text/markdown", // Assuming markdown for contracts
            fileType,
            uploadedAt: new Date(),
          },
        });
        console.log(`Created new IPFS upload record for CID: ${cid}`);
      } catch (createError: any) {
        // If unique constraint fails, find the existing record with this CID
        if (
          createError.code === "P2002" &&
          createError.meta?.target?.includes("cid")
        ) {
          console.log(
            `CID ${cid} already exists in database, fetching existing record...`
          );
          uploadRecord = await prisma.iPFSUpload.findUnique({
            where: { cid },
          });

          if (!uploadRecord) {
            throw new Error(
              `Failed to find existing IPFS upload record for CID: ${cid}`
            );
          }

          console.log(`Using existing IPFS upload record for CID: ${cid}`);
        } else {
          // Re-throw if it's a different error
          throw createError;
        }
      }
    }

    // Update Agreement with CID if this is a contract upload
    if (fileType.includes("contract")) {
      try {
        await prisma.agreement.update({
          where: { id: agreementId },
          data: {
            cid,
            processStatus: "ipfs_uploaded",
            currentStep: "filecoin_access_deploy", // Move to filecoin access deploy step
            lastStepAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`Agreement ${agreementId} updated with CID: ${cid}`);
      } catch (updateError) {
        console.warn(`Failed to update agreement ${agreementId}:`, updateError);
        // Continue anyway - the CID upload was successful
      }
    }

    // Mark deployment step as completed
    try {
      await prisma.deploymentStep.update({
        where: {
          agreementId_stepName: {
            agreementId,
            stepName: "ipfs_upload",
          },
        },
        data: {
          status: "completed",
          completedAt: new Date(),
          ipfsCid: cid,
          metadata: {
            fileName: filename,
            fileSize,
            fileType,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
      console.log(
        `Deployment step 'ipfs_upload' marked as completed for agreement ${agreementId}`
      );
    } catch (updateError) {
      console.warn(
        `Failed to update deployment step for agreement ${agreementId}:`,
        updateError
      );
      // Continue anyway - the CID upload was successful
    }

    console.log(`Database updated: Agreement ${agreementId} with CID ${cid}`);

    return { cid, uploadRecord };
  } catch (error) {
    console.error("Error uploading to Lighthouse:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Mark deployment step as failed
    try {
      await prisma.deploymentStep.update({
        where: {
          agreementId_stepName: {
            agreementId,
            stepName: "ipfs_upload",
          },
        },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });

      // Update Agreement with error status
      await prisma.agreement.update({
        where: { id: agreementId },
        data: {
          processStatus: "failed",
          errorDetails: `IPFS Upload failed: ${errorMessage}`,
          lastStepAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error("Error updating database with failure status:", dbError);
    }

    throw new Error(`Failed to upload to IPFS via Lighthouse: ${errorMessage}`);
  } finally {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary file:", cleanupError);
    }
  }
}

/**
 * Simple IPFS upload without database tracking (for backward compatibility)
 *
 * @param {string} content The content of the file to be pinned.
 * @param {string} filename The name of the file.
 * @returns {Promise<string>} The IPFS CID of the pinned file.
 */
export async function pinToIPFSSimple(
  content: string,
  filename: string
): Promise<string> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "LIGHTHOUSE_API_KEY must be set in environment variables. Get your API key from https://lighthouse.storage"
    );
  }

  // Create a temporary file
  const tempDir = tmpdir();
  const tempFilePath = path.join(tempDir, filename);

  try {
    // Write content to temporary file
    await fs.writeFile(tempFilePath, content, "utf8");

    // Upload file to Lighthouse
    console.log(`Uploading ${filename} to IPFS via Lighthouse...`);
    const uploadResponse = await lighthouse.upload(tempFilePath, apiKey);
    const cid = uploadResponse.data.Hash;

    console.log(`File uploaded to IPFS via Lighthouse: ${cid}`);
    return cid;
  } catch (error) {
    console.error("Error uploading to Lighthouse:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to upload to IPFS via Lighthouse: ${errorMessage}`);
  } finally {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary file:", cleanupError);
    }
  }
}

/**
 * Upload JSON object to IPFS
 *
 * @param {any} jsonData The JSON data to upload
 * @param {string} filename Optional filename (defaults to "data.json")
 * @returns {Promise<string>} The IPFS CID of the uploaded JSON
 */
export async function uploadJsonToIPFS(
  jsonData: any,
  filename: string = "data.json"
): Promise<string> {
  const jsonString = JSON.stringify(jsonData, null, 2);
  return await pinToIPFSSimple(jsonString, filename);
}

/**
 * Upload File object to IPFS (for legacy API compatibility)
 *
 * @param {File} file The File object to upload
 * @returns {Promise<string>} The IPFS CID of the uploaded file
 */
export async function uploadToIPFS(file: File): Promise<string> {
  const content = await file.text();
  return await pinToIPFSSimple(content, file.name);
}
