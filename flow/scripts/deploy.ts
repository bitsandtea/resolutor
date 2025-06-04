import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

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

  // Get the implementation address
  const implementationAddress = await factory.implementation();
  console.log(
    "MultiSigAgreement implementation deployed to:",
    implementationAddress
  );

  console.log("\nDeployment completed!");
  console.log("Factory address:", factoryAddress);
  console.log("Implementation address:", implementationAddress);

  // Optionally deploy a mock USDC token for testing
  if (process.env.DEPLOY_MOCK_TOKEN === "true") {
    console.log("\nDeploying Mock USDC token...");
    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockToken.deploy("Flow USDC", "FUSDC");
    await mockUSDC.waitForDeployment();

    const mockUSDCAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", mockUSDCAddress);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
