import "@nomicfoundation/hardhat-ethers";
import hre, { network, run } from "hardhat";

async function verifyContract(
  address: string,
  constructorArguments: unknown[] = []
) {
  console.log(`Verifying contract at ${address}...`);
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
      force: true, // Force verification even if already verified
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
  console.log("Starting AccessControl deployment...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "FIL");

  // Deploy AccessControl (no constructor parameters)
  console.log("\n1. Deploying AccessControl...");
  const AccessControl = await hre.ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy();
  await accessControl.waitForDeployment();
  const deployedAddress = await accessControl.getAddress();
  console.log("AccessControl deployed to:", deployedAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("AccessControl:", deployedAddress);
  console.log("\nContract deployed successfully!");

  // Verify contract (skip for hardhat local network)
  if (network.name !== "hardhat") {
    console.log("\n=== Contract Verification ===");
    console.log("Waiting 10 seconds before verification...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Verify AccessControl (no constructor args)
    console.log("\nVerifying AccessControl...");
    await verifyContract(deployedAddress, []);

    console.log("\n✅ Verification process completed!");
    console.log(
      `Check verified contract at: https://filecoin-testnet.blockscout.com/address/${deployedAddress}`
    );
  } else {
    console.log("Skipping verification on local hardhat network");
  }

  return {
    accessControl: deployedAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
