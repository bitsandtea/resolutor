"use client";

import { type DeploymentStepName } from "@/lib/chain-config";
import { useTransactionContext } from "@/lib/context/TransactionContext";
import { useChainManagement } from "@/lib/hooks/useChainManagement";
import { useTransaction } from "@/lib/hooks/useTransaction";
import React from "react";
import { ChainIndicator } from "./ChainIndicator";

// Phase 5: UI Enhancement - Smart Transaction Button

interface TransactionButtonProps {
  stepName: DeploymentStepName;
  contractParams: any;
  onSuccess?: (txHash: string, receipt: any) => void;
  onError?: (error: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  showChainIndicator?: boolean;
}

export const TransactionButton: React.FC<TransactionButtonProps> = ({
  stepName,
  contractParams,
  onSuccess,
  onError,
  children,
  className = "",
  disabled = false,
  showChainIndicator = true,
}) => {
  const { chainState, switchToRequiredChain } = useChainManagement(stepName);
  const { addTransaction, updateTransaction } = useTransactionContext();

  const transactionId = `${stepName}_${Date.now()}`;

  const {
    state: txState,
    execute,
    retry,
    reset,
  } = useTransaction({
    maxRetries: 3,
    retryDelayMs: 2000,
    onPending: (txHash) => {
      addTransaction(transactionId, stepName);
      updateTransaction(transactionId, {
        status: "pending",
        txHash,
      });
    },
    onConfirmed: (txHash, receipt) => {
      updateTransaction(transactionId, {
        status: "confirmed",
        txHash,
      });
      onSuccess?.(txHash, receipt);
    },
    onError: (error, errorType) => {
      updateTransaction(transactionId, {
        status: "failed",
        error,
        errorType,
        retryCount: txState.retryCount,
      });
      onError?.(error);
    },
  });

  const handleExecute = async () => {
    // First ensure we're on the correct chain
    if (!chainState.isCorrectChain) {
      const switchSuccess = await switchToRequiredChain(stepName);
      if (!switchSuccess) {
        onError?.(
          `Failed to switch to required chain: ${chainState.requiredChainName}`
        );
        return;
      }
    }

    // Execute the transaction
    await execute(contractParams);
  };

  const getButtonContent = () => {
    if (chainState.isSwitching) {
      return (
        <>
          <svg
            className="w-4 h-4 animate-spin mr-2"
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
          Switching Chain...
        </>
      );
    }

    if (txState.status === "preparing") {
      return (
        <>
          <svg
            className="w-4 h-4 animate-spin mr-2"
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
          Preparing...
        </>
      );
    }

    if (txState.status === "pending") {
      return (
        <>
          <svg
            className="w-4 h-4 animate-pulse mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Pending...
        </>
      );
    }

    if (txState.status === "confirming") {
      return (
        <>
          <svg
            className="w-4 h-4 animate-spin mr-2"
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
          Confirming...
        </>
      );
    }

    if (txState.status === "confirmed") {
      return (
        <>
          <svg
            className="w-4 h-4 mr-2"
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
          Confirmed
        </>
      );
    }

    if (txState.status === "failed") {
      return (
        <>
          <svg
            className="w-4 h-4 mr-2"
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
          Failed
        </>
      );
    }

    return children;
  };

  const getButtonStyle = () => {
    const base =
      "inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

    if (txState.status === "confirmed") {
      return `${base} bg-green-600 text-white cursor-default`;
    }

    if (txState.status === "failed") {
      return `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;
    }

    if (
      chainState.isSwitching ||
      txState.status === "preparing" ||
      txState.status === "pending" ||
      txState.status === "confirming"
    ) {
      return `${base} bg-gray-400 text-white cursor-not-allowed`;
    }

    if (!chainState.isCorrectChain) {
      return `${base} bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500`;
    }

    return `${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 ${className}`;
  };

  const isDisabled =
    disabled ||
    chainState.isSwitching ||
    txState.status === "preparing" ||
    txState.status === "pending" ||
    txState.status === "confirming" ||
    txState.status === "confirmed";

  const showRetryButton =
    txState.status === "failed" &&
    txState.errorType !== "user_rejected" &&
    txState.retryCount < 3;

  return (
    <div className="flex flex-col gap-2">
      {showChainIndicator && (
        <ChainIndicator stepName={stepName} className="self-start" />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={txState.status === "failed" ? () => reset() : handleExecute}
          disabled={isDisabled}
          className={getButtonStyle()}
        >
          {getButtonContent()}
        </button>

        {showRetryButton && (
          <button
            onClick={retry}
            disabled={txState.isRetrying}
            className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {txState.isRetrying ? "Retrying..." : "Retry"}
          </button>
        )}

        {(txState.status === "failed" || txState.status === "confirmed") && (
          <button
            onClick={reset}
            className="px-3 py-2 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Reset
          </button>
        )}
      </div>

      {txState.error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <strong>Error:</strong> {txState.error}
          {txState.retryCount > 0 && (
            <span className="ml-2 text-xs">
              (Attempt {txState.retryCount + 1})
            </span>
          )}
        </div>
      )}

      {txState.txHash && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">Transaction:</span>{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded">
            {txState.txHash}
          </code>
        </div>
      )}
    </div>
  );
};
