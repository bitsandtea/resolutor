import {
  getChainName,
  STEP_CHAIN_REQUIREMENTS,
  type DeploymentStepName,
} from "@/lib/chain-config";
import { config } from "@/lib/wagmi";
import { switchChain } from "@wagmi/core";
import { useCallback, useEffect, useState } from "react";
import { useChainId } from "wagmi";

// Phase 1: Chain Configuration & Switching

export interface ChainState {
  currentChainId: number;
  currentChainName: string;
  isCorrectChain: boolean;
  requiredChainId: number | null;
  requiredChainName: string | null;
  isValidating: boolean;
  isSwitching: boolean;
  lastSwitchError: string | null;
}

export interface UseChainManagementReturn {
  chainState: ChainState;
  validateChainForStep: (stepName: DeploymentStepName) => boolean;
  switchToRequiredChain: (stepName: DeploymentStepName) => Promise<boolean>;
  clearError: () => void;
}

// Cache for successful chain switches to avoid redundant calls
const chainSwitchCache = new Map<number, number>(); // chainId -> timestamp

const isChainSwitchCached = (chainId: number, cacheTimeMs = 30000): boolean => {
  const timestamp = chainSwitchCache.get(chainId);
  return timestamp ? Date.now() - timestamp < cacheTimeMs : false;
};

const setCachedChainSwitch = (chainId: number): void => {
  chainSwitchCache.set(chainId, Date.now());
};

export const useChainManagement = (
  stepName?: DeploymentStepName
): UseChainManagementReturn => {
  const currentChainId = useChainId();
  const [state, setState] = useState({
    isValidating: false,
    isSwitching: false,
    lastSwitchError: null as string | null,
  });

  const requiredChainId = stepName ? STEP_CHAIN_REQUIREMENTS[stepName] : null;
  const requiredChainName = requiredChainId
    ? getChainName(requiredChainId)
    : null;
  const isCorrectChain = !requiredChainId || currentChainId === requiredChainId;

  const chainState: ChainState = {
    currentChainId,
    currentChainName: getChainName(currentChainId),
    isCorrectChain,
    requiredChainId,
    requiredChainName,
    isValidating: state.isValidating,
    isSwitching: state.isSwitching,
    lastSwitchError: state.lastSwitchError,
  };

  const validateChainForStep = useCallback(
    (targetStepName: DeploymentStepName): boolean => {
      setState((prev) => ({
        ...prev,
        isValidating: true,
        lastSwitchError: null,
      }));

      const targetRequiredChainId = STEP_CHAIN_REQUIREMENTS[targetStepName];
      const isValid =
        !targetRequiredChainId || currentChainId === targetRequiredChainId;

      setState((prev) => ({ ...prev, isValidating: false }));
      return isValid;
    },
    [currentChainId]
  );

  const switchToRequiredChain = useCallback(
    async (targetStepName: DeploymentStepName): Promise<boolean> => {
      const targetRequiredChainId = STEP_CHAIN_REQUIREMENTS[targetStepName];

      // No chain required for this step
      if (!targetRequiredChainId) {
        return true;
      }

      // Already on correct chain
      if (currentChainId === targetRequiredChainId) {
        setCachedChainSwitch(targetRequiredChainId);
        return true;
      }

      // Check cache to avoid redundant switches
      if (isChainSwitchCached(targetRequiredChainId)) {
        console.log(
          `Chain switch to ${targetRequiredChainId} cached, skipping`
        );
        return true;
      }

      setState((prev) => ({
        ...prev,
        isSwitching: true,
        lastSwitchError: null,
      }));

      try {
        console.log(
          `Switching chain to ${targetRequiredChainId} (${getChainName(
            targetRequiredChainId
          )}) for step ${targetStepName}`
        );

        await switchChain(config, { chainId: targetRequiredChainId as any });

        // Cache successful switch
        setCachedChainSwitch(targetRequiredChainId);

        setState((prev) => ({ ...prev, isSwitching: false }));
        return true;
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to switch chain";
        console.error(
          `Failed to switch chain for step ${targetStepName}:`,
          error
        );

        setState((prev) => ({
          ...prev,
          isSwitching: false,
          lastSwitchError: errorMessage,
        }));

        return false;
      }
    },
    [currentChainId]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastSwitchError: null }));
  }, []);

  // Auto-validate when step changes
  useEffect(() => {
    if (stepName) {
      validateChainForStep(stepName);
    }
  }, [stepName, validateChainForStep]);

  return {
    chainState,
    validateChainForStep,
    switchToRequiredChain,
    clearError,
  };
};
