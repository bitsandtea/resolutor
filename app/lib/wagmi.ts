import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { filecoinCalibration, flowTestnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Resolutor",
  projectId:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [filecoinCalibration, flowTestnet],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

// Contract addresses using your existing environment variables
export const CONTRACT_ADDRESSES = {
  ACCESS_CONTROL: process.env
    .NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS as `0x${string}`,
  MOCK_ERC20: process.env.NEXT_PUBLIC_MOCK_ERC20_ADDRESS as `0x${string}`,
  ESCROW_CONTRACT: process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}`,
  // Add these when you have them deployed
  AGREEMENT_FACTORY: process.env
    .NEXT_PUBLIC_AGREEMENT_FACTORY_ADDRESS as `0x${string}`,
};

// Other useful constants
export const MEDIATOR_ADDRESS = process.env
  .NEXT_PUBLIC_MEDIATOR_ADDRESS as `0x${string}`;
export const FILECOIN_RPC_URL = process.env.FILECOIN_RPC_URL;
