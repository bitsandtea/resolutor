import { ethers, network, run } from "hardhat";

async function verifyContract(
  address: string,
  constructorArguments: unknown[] = []
) {
  console.log(`Verifying contract at ${address}...`);
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
    console.log(`✅ Contract verified at ${address}`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`✅ Contract already verified at ${address}`);
    } else {
      console.log(`❌ Failed to verify contract at ${address}:`, error.message);
    }
  }
}

async function main() {
  console.log("Starting Filecoin contracts deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "FIL");

  // Deploy AccessControlManager first (no constructor parameters)
  console.log("\n1. Deploying AccessControlManager...");
  const AccessControlManager = await ethers.getContractFactory(
    "AccessControlManager"
  );
  const accessControlManager = await AccessControlManager.deploy();
  await accessControlManager.waitForDeployment();
  const accessControlAddress = await accessControlManager.getAddress();
  console.log("AccessControlManager deployed to:", accessControlAddress);

  // Deploy StorageManager (no constructor parameters)
  console.log("\n2. Deploying StorageManager...");
  const StorageManager = await ethers.getContractFactory("StorageManager");
  const storageManager = await StorageManager.deploy();
  await storageManager.waitForDeployment();
  const storageManagerAddress = await storageManager.getAddress();
  console.log("StorageManager deployed to:", storageManagerAddress);

  // Deploy EncryptedStorage with AccessControlManager address
  console.log("\n3. Deploying EncryptedStorage...");
  const EncryptedStorage = await ethers.getContractFactory("EncryptedStorage");
  const encryptedStorage = await EncryptedStorage.deploy(accessControlAddress);
  await encryptedStorage.waitForDeployment();
  const encryptedStorageAddress = await encryptedStorage.getAddress();
  console.log("EncryptedStorage deployed to:", encryptedStorageAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("AccessControlManager:", accessControlAddress);
  console.log("StorageManager:", storageManagerAddress);
  console.log("EncryptedStorage:", encryptedStorageAddress);
  console.log("\nAll contracts deployed successfully!");

  // Verify contracts (skip for hardhat local network)
  if (network.name !== "hardhat") {
    console.log("\n=== Contract Verification ===");
    console.log("Waiting 30 seconds before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify AccessControlManager (no constructor args)
    await verifyContract(accessControlAddress, []);

    // Verify StorageManager (no constructor args)
    await verifyContract(storageManagerAddress, []);

    // Verify EncryptedStorage (with AccessControlManager address)
    await verifyContract(encryptedStorageAddress, [accessControlAddress]);

    console.log("\n✅ Verification process completed!");
  }

  return {
    accessControlManager: accessControlAddress,
    storageManager: storageManagerAddress,
    encryptedStorage: encryptedStorageAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
