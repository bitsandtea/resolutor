import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";
import { verifyContract } from "./verify/contract";

async function main() {
  console.log("Deploying contracts to Flow EVM testnet...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address))
  );

  // Deploy AgreementFactory
  console.log("\nDeploying AgreementFactory...");
  const AgreementFactory = await hre.ethers.getContractFactory(
    "AgreementFactory"
  );
  const factory = await AgreementFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("AgreementFactory deployed to:", factoryAddress);

  // Verify AgreementFactory
  console.log("Verifying AgreementFactory...");
  await verifyContract(factoryAddress, []);

  // Get the implementation address
  const implementationAddress = await factory.implementation();
  console.log(
    "MultiSigAgreement implementation deployed to:",
    implementationAddress
  );

  // Verify MultiSigAgreement implementation
  console.log("Verifying MultiSigAgreement implementation...");
  await verifyContract(implementationAddress, []);

  console.log("\nDeployment completed!");
  console.log("Factory address:", factoryAddress);
  console.log("Implementation address:", implementationAddress);

  console.log("\nDeploying Mock USDC token...");
  const MockToken = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockToken.deploy("Flow USDC", "FUSDC");
  await mockUSDC.waitForDeployment();

  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("Mock USDC deployed to:", mockUSDCAddress);

  // Mint 100M tokens to deployer
  console.log("Minting 100M tokens to deployer...");
  await mockUSDC.mintToSelf();
  const balance = await mockUSDC.balanceOf(deployer.address);
  console.log(
    "Deployer token balance:",
    hre.ethers.formatEther(balance),
    "FUSDC"
  );

  // Verify Mock USDC
  console.log("Verifying Mock USDC...");
  await verifyContract(mockUSDCAddress, ["Flow USDC", "FUSDC"]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
