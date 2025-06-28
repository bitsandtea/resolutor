import hre from "hardhat";

const ACCESS_CONTROL_ADDRESS = "0x25408Bd25ad4923e86dEF78F53D67c6E0e63B143";

async function main() {
  console.log("Verifying AccessControl contract...");
  console.log("Network:", hre.network.name);
  console.log("Contract address:", ACCESS_CONTROL_ADDRESS);

  if (hre.network.name !== "filecoinCalibration") {
    console.log(
      "⚠️  Warning: This script is intended for filecoinCalibration network"
    );
    console.log("Current network:", hre.network.name);
  }

  try {
    // AccessControl contract has no constructor parameters
    const constructorArguments: never[] = [];

    await hre.run("verify:verify", {
      address: ACCESS_CONTROL_ADDRESS,
      constructorArguments: constructorArguments,
    });

    console.log("✅ AccessControl contract verified successfully!");
    console.log(
      `View on explorer: https://filecoin-testnet.blockscout.com/address/${ACCESS_CONTROL_ADDRESS}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else {
      console.error("❌ Verification failed:", error);
    }
  }
}

function waitSeconds(seconds: number): Promise<void> {
  const secs = seconds * 1000;
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, secs);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
