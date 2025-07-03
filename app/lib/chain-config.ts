import { filecoinCalibration, flowTestnet } from "wagmi/chains";

// Phase 1: Centralized chain configuration
export interface ChainConfig {
  chainId: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorers: {
    default: {
      name: string;
      url: string;
      txPath: string;
    };
  };
  testnet: boolean;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  filecoin: {
    chainId: 314159,
    name: "Filecoin Calibration",
    nativeCurrency: {
      name: "Test Filecoin",
      symbol: "tFIL",
      decimals: 18,
    },
    rpcUrls: ["https://api.calibration.node.glif.io/rpc/v1"],
    blockExplorers: {
      default: {
        name: "Filfox",
        url: "https://calibration.filfox.info/en",
        txPath: "/message",
      },
    },
    testnet: true,
  },
  flow: {
    chainId: 545,
    name: "Flow EVM Testnet",
    nativeCurrency: {
      name: "Flow",
      symbol: "FLOW",
      decimals: 18,
    },
    rpcUrls: ["https://testnet.evm.nodes.onflow.org"],
    blockExplorers: {
      default: {
        name: "Flow Scan",
        url: "https://evm-testnet.flowscan.io",
        txPath: "/tx",
      },
    },
    testnet: true,
  },
};

export const CHAIN_IDS = {
  FILECOIN_CALIBRATION: 314159,
  FLOW_EVM_TESTNET: 545,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

export const getChainConfig = (chainId: number): ChainConfig | null => {
  return (
    Object.values(SUPPORTED_CHAINS).find(
      (chain) => chain.chainId === chainId
    ) || null
  );
};

export const getChainName = (chainId: number): string => {
  const config = getChainConfig(chainId);
  return config?.name || `Unknown Chain (${chainId})`;
};

export const getExplorerUrl = (chainId: number, txHash: string): string => {
  const config = getChainConfig(chainId);
  if (!config) return "";
  return `${config.blockExplorers.default.url}${config.blockExplorers.default.txPath}/${txHash}`;
};

// Step-specific chain requirements
export type DeploymentStepName =
  | "ipfs_upload"
  | "filecoin_access_deploy"
  | "filecoin_store_file"
  | "flow_deploy"
  | "db_save";

export const STEP_CHAIN_REQUIREMENTS: Record<
  DeploymentStepName,
  number | null
> = {
  ipfs_upload: null,
  filecoin_access_deploy: CHAIN_IDS.FILECOIN_CALIBRATION,
  filecoin_store_file: CHAIN_IDS.FILECOIN_CALIBRATION,
  flow_deploy: CHAIN_IDS.FLOW_EVM_TESTNET,
  db_save: null,
};

// Contract addresses per chain
export const CONTRACT_ADDRESSES = {
  [CHAIN_IDS.FILECOIN_CALIBRATION]: {
    ACCESS_CONTROL: process.env
      .NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS as `0x${string}`,
    MOCK_ERC20: process.env.NEXT_PUBLIC_MOCK_ERC20_ADDRESS as `0x${string}`,
  },
  [CHAIN_IDS.FLOW_EVM_TESTNET]: {
    MOCK_ERC20: process.env.NEXT_PUBLIC_MOCK_ERC20_ADDRESS as `0x${string}`,
  },
} as const;

// Global constants
export const MEDIATOR_ADDRESS = process.env
  .NEXT_PUBLIC_MEDIATOR_ADDRESS as `0x${string}`;

// Wagmi chains mapping
export const WAGMI_CHAINS = [filecoinCalibration, flowTestnet];
