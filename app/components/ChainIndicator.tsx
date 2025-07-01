"use client";

import { type DeploymentStepName } from "@/lib/chain-config";
import { useChainManagement } from "@/lib/hooks/useChainManagement";
import React from "react";

// Phase 5: UI Enhancement - Chain Indicator

interface ChainIndicatorProps {
  stepName?: DeploymentStepName;
  className?: string;
  showName?: boolean;
}

export const ChainIndicator: React.FC<ChainIndicatorProps> = ({
  stepName,
  className = "",
  showName = true,
}) => {
  const { chainState } = useChainManagement(stepName);

  const getStatusColor = () => {
    if (chainState.isSwitching)
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (chainState.isCorrectChain)
      return "bg-green-100 text-green-800 border-green-300";
    if (chainState.lastSwitchError)
      return "bg-red-100 text-red-800 border-red-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getStatusIcon = () => {
    if (chainState.isSwitching) {
      return (
        <svg
          className="w-4 h-4 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    }
    if (chainState.isCorrectChain) {
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    }
    if (chainState.lastSwitchError) {
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
    );
  };

  const getDisplayText = () => {
    if (!showName) return null;

    if (chainState.requiredChainId && !chainState.isCorrectChain) {
      return `Switch to ${chainState.requiredChainName}`;
    }

    return chainState.currentChainName;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${getStatusColor()} ${className}`}
    >
      {getStatusIcon()}
      {showName && <span className="text-xs">{getDisplayText()}</span>}
      {chainState.lastSwitchError && (
        <span
          className="text-xs text-red-600 ml-1"
          title={chainState.lastSwitchError}
        >
          (Error)
        </span>
      )}
    </div>
  );
};
