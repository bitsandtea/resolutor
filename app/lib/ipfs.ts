import { create } from "@web3-storage/w3up-client";

let client: Awaited<ReturnType<typeof create>> | null = null;

async function getClient() {
  if (!client) {
    client = await create();

    // Set the current space using the provided DID
    await client.setCurrentSpace(
      "did:key:z6MkiwJ3GqvF3eG4UUNNxpgkvWkVVdkhGnLuFgyAxqF9M3Br"
    );
  }
  return client;
}

export async function uploadToIPFS(file: File): Promise<string> {
  const client = await getClient();
  const cid = await client.uploadFile(file);
  return cid.toString();
}

export async function uploadJsonToIPFS(data: object): Promise<string> {
  const json = JSON.stringify(data, null, 2);
  const file = new File([json], "data.json", { type: "application/json" });
  return uploadToIPFS(file);
}
