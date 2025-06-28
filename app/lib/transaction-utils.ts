// Network configurations for explorer links
const EXPLORER_CONFIGS = {
  filecoin: {
    name: "Filecoin Calibration",
    baseUrl: "https://calibration.filfox.info/en",
    txPath: "/message",
  },
  flow: {
    name: "Flow EVM Testnet",
    baseUrl: "https://evm-testnet.flowscan.io",
    txPath: "/tx",
  },
};

export type SupportedNetwork = "filecoin" | "flow";

/**
 * Generate explorer URL for a transaction hash
 */
export const getExplorerUrl = (
  txHash: string,
  network: SupportedNetwork
): string => {
  const config = EXPLORER_CONFIGS[network];
  return `${config.baseUrl}${config.txPath}/${txHash}`;
};

/**
 * Generate a formatted log message with transaction hash and explorer link
 */
export const formatTxLogMessage = (
  txHash: string,
  network: SupportedNetwork
): string => {
  const config = EXPLORER_CONFIGS[network];
  const explorerUrl = getExplorerUrl(txHash, network);
  return `📋 Transaction: ${txHash}\n🔗 View on ${config.name}: ${explorerUrl}`;
};

/**
 * Get short display format for transaction hash (first 8 + last 6 characters)
 */
export const formatTxHashShort = (txHash: string): string => {
  if (txHash.length < 14) return txHash;
  return `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
};

/**
 * Generate deployment step update parameters for completed transactions
 */
export const createCompletedStepUpdate = (
  stepName: string,
  txHash: string,
  contractAddr?: string
) => ({
  stepName,
  status: "completed" as const,
  txHash,
  contractAddr,
});

/**
 * Generate deployment step update parameters for failed transactions
 */
export const createFailedStepUpdate = (
  stepName: string,
  errorMessage: string,
  txHash?: string
) => ({
  stepName,
  status: "failed" as const,
  txHash,
  errorMessage,
});
