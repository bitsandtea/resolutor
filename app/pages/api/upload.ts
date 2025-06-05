import type { NextApiRequest, NextApiResponse } from "next";
import { uploadToIPFS } from "../../lib/ipfs";

interface UploadResponse {
  cid: string;
}

export const config = {
  api: {
    bodyParser: false, // We'll handle multipart/form-data manually
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // In a real implementation, you'd parse multipart/form-data here
    // For hackathon simplicity, assuming single file upload

    // TODO: Parse multipart form data and extract files
    // const files = await parseMultipartForm(req)

    // Mock implementation - replace with actual file handling
    const mockFile = new File(["contract content"], "contract.md", {
      type: "text/markdown",
    });
    const cid = await uploadToIPFS(mockFile);

    res.status(200).json({ cid });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
}
