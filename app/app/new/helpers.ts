import { config } from "@/lib/wagmi";
import { switchChain } from "@wagmi/core";
import { DeploymentStepName } from "./types";

const STEP_CHAIN_REQUIREMENTS: Record<DeploymentStepName, number | null> = {
  ipfs_upload: null, // No specific chain required
  filecoin_access_deploy: Number(
    process.env.NEXT_PUBLIC_FILECOIN_CALIBRATION_CHAIN_ID || "314159"
  ),
  flow_deploy: Number(
    process.env.NEXT_PUBLIC_FLOW_EVM_TESTNET_CHAIN_ID || "545"
  ), // Flow Testnet
  db_save: null, // No specific chain required
};

// Helper functions for chain management
export const getRequiredChainForStep = (
  stepName: DeploymentStepName
): number | null => {
  return STEP_CHAIN_REQUIREMENTS[stepName];
};

export const checkAndSwitchChainForStep = async (
  stepName: DeploymentStepName,
  currentChainId: number
): Promise<boolean> => {
  const requiredChainId = getRequiredChainForStep(stepName);

  if (!requiredChainId || currentChainId === requiredChainId) {
    return true; // Already on correct chain or no specific chain required
  }

  try {
    console.log(`Switching chain to ${requiredChainId} for step ${stepName}`);
    await switchChain(config, { chainId: requiredChainId as any });
    return true;
  } catch (error) {
    console.error(`Failed to switch chain for step ${stepName}:`, error);
    return false;
  }
};

export const updateDeploymentStep = async (
  agreementId: string,
  stepName: string,
  status: string,
  txHash?: string,
  contractAddr?: string,
  errorMessage?: string
): Promise<boolean> => {
  console.debug(
    `[helpers] Updating step '${stepName}' to '${status}' for agreement ${agreementId}`
  );
  try {
    const response = await fetch("/api/update-deployment-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agreementId,
        stepName,
        status,
        txHash,
        contractAddr,
        errorMessage,
      }),
    });

    const result = await response.json();
    if (!result.success) {
      console.error(
        `[helpers] Failed to update deployment step ${stepName} to ${status}:`,
        result.error
      );
    }
    return result.success;
  } catch (error) {
    console.error(
      `[helpers] Error updating deployment step ${stepName}:`,
      error
    );
    return false;
  }
};

export const fetchDeploymentStatus = async (agreementId: string) => {
  console.debug(
    `[helpers] Fetching deployment status for agreement: ${agreementId}`
  );
  try {
    const response = await fetch(
      `/api/deployment-status?agreementId=${encodeURIComponent(agreementId)}`,
      {
        method: "GET",
      }
    );

    const data = await response.json();
    if (data.success) {
      console.debug(`[helpers] Successfully fetched deployment status:`, data);
      return data;
    } else {
      throw new Error(data.error || "Failed to check deployment status");
    }
  } catch (error) {
    console.error("[helpers] Error checking deployment status:", error);
    return null;
  }
};
