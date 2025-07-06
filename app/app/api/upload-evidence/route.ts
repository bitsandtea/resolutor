import { prisma } from "@/lib/prisma";
import lighthouse from "@lighthouse-web3/sdk";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";

async function uploadFileToLighthouse(filePath: string): Promise<string> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    throw new Error("LIGHTHOUSE_API_KEY is not set.");
  }
  const uploadResponse = await lighthouse.upload(filePath, apiKey);
  return uploadResponse.data.Hash;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const agreementId = formData.get("agreementId") as string | null;

    if (!files || files.length === 0 || !agreementId) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one file and an agreementId are required.",
        },
        { status: 400 }
      );
    }

    const cids: string[] = [];
    for (const file of files) {
      // Write file to a temporary location
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, file.name);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tempFilePath, fileBuffer);

      let cid;
      try {
        cid = await uploadFileToLighthouse(tempFilePath);
      } finally {
        // Clean up the temporary file
        await fs.unlink(tempFilePath);
      }

      cids.push(cid);

      // Check if a record for this CID already exists
      const existingUpload = await prisma.iPFSUpload.findUnique({
        where: { cid },
      });

      // If it doesn't exist, create it.
      if (!existingUpload) {
        await prisma.iPFSUpload.create({
          data: {
            agreementId,
            fileName: file.name,
            cid,
            fileSize: file.size,
            contentType: file.type,
            fileType: "evidence",
          },
        });
      }
    }

    return NextResponse.json({ success: true, cids }, { status: 200 });
  } catch (error) {
    console.error("Error uploading evidence:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload evidence file.",
        details: message,
      },
      { status: 500 }
    );
  }
}
