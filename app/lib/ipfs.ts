import { Web3Storage } from "web3.storage";

const client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });

export async function uploadToIPFS(file: File): Promise<string> {
  const cid = await client.put([file]);
  return cid;
}

export async function uploadJsonToIPFS(data: object): Promise<string> {
  const json = JSON.stringify(data, null, 2);
  const file = new File([json], "data.json", { type: "application/json" });
  return uploadToIPFS(file);
}
