import dotenv from "dotenv";
dotenv.config();

import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-toolbox";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  paths: {
    sources: "./filecoin",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    flowEVMTestnet: {
      url: "https://testnet.evm.nodes.onflow.org",
      chainId: 545,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    filecoinCalibration: {
      url: "https://api.calibration.node.glif.io/rpc/v1",
      chainId: 314159,
      accounts: process.env.PRIVATE_KEY_FCOIN
        ? [process.env.PRIVATE_KEY_FCOIN]
        : [],
    },
  },
  etherscan: {
    apiKey: {
      flowEVMTestnet: process.env.FLOWSCAN_API_KEY || "abc",
      filecoinCalibration: "abc",
    },
    customChains: [
      {
        network: "flowEVMTestnet",
        chainId: 545,
        urls: {
          apiURL: "https://evm-testnet.flowscan.io/api",
          browserURL: "https://evm-testnet.flowscan.io",
        },
      },
      {
        network: "filecoinCalibration",
        chainId: 314159,
        urls: {
          apiURL: "https://filecoin-testnet.blockscout.com/api",
          browserURL: "https://filecoin-testnet.blockscout.com",
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
