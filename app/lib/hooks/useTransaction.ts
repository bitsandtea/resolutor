import { useCallback, useEffect, useRef, useState } from "react";
import { Hash } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

// Phase 2: Transaction Lifecycle Abstraction

export type TransactionStatus =
  | "idle"
  | "preparing"
  | "pending"
  | "confirming"
  | "confirmed"
  | "failed";

export type TransactionError =
  | "user_rejected"
  | "reverted"
  | "network_error"
  | "timeout"
  | "unknown";

export interface TransactionState {
  status: TransactionStatus;
  txHash?: Hash;
  error?: string;
  errorType?: TransactionError;
  retryCount: number;
  isRetrying: boolean;
}

export interface TransactionConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  onPending?: (txHash: Hash) => void;
  onConfirmed?: (txHash: Hash, receipt: any) => void;
  onError?: (error: string, errorType: TransactionError) => void;
}

export interface UseTransactionReturn {
  state: TransactionState;
  execute: (params: any) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

const classifyError = (error: any): TransactionError => {
  const errorMessage = error?.message?.toLowerCase() || "";

  if (
    errorMessage.includes("user rejected") ||
    errorMessage.includes("user denied")
  ) {
    return "user_rejected";
  }
  if (
    errorMessage.includes("execution reverted") ||
    errorMessage.includes("revert")
  ) {
    return "reverted";
  }
  if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
    return "network_error";
  }
  if (errorMessage.includes("timeout")) {
    return "timeout";
  }
  return "unknown";
};

const getRetryDelay = (retryCount: number, baseDelay: number): number => {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
};

export const useTransaction = (
  config: TransactionConfig = {}
): UseTransactionReturn => {
  const {
    maxRetries = 3,
    retryDelayMs = 2000,
    onPending,
    onConfirmed,
    onError,
  } = config;

  const {
    writeContract,
    isPending: isWritePending,
    error: writeError,
    data: contractTxHash,
  } = useWriteContract();
  const [state, setState] = useState<TransactionState>({
    status: "idle",
    retryCount: 0,
    isRetrying: false,
  });

  const lastParamsRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isLoading: isReceiptLoading,
    isSuccess: isReceiptSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: state.txHash,
  });

  const updateState = useCallback((updates: Partial<TransactionState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setState({
      status: "idle",
      retryCount: 0,
      isRetrying: false,
    });
    lastParamsRef.current = null;
  }, []);

  const executeTransaction = useCallback(
    async (params: any, isRetry = false) => {
      try {
        if (!isRetry) {
          updateState({
            status: "preparing",
            error: undefined,
            errorType: undefined,
            isRetrying: false,
          });
          lastParamsRef.current = params;
        } else {
          updateState({ isRetrying: true, status: "preparing" });
        }

        await writeContract(params);
        // Note: txHash will be available via contractTxHash from useWriteContract hook
      } catch (error: any) {
        const errorType = classifyError(error);
        const errorMessage = error?.message || "Transaction failed";

        updateState({
          status: "failed",
          error: errorMessage,
          errorType,
          isRetrying: false,
        });

        onError?.(errorMessage, errorType);
      }
    },
    [writeContract, updateState, onPending, onError]
  );

  const retry = useCallback(async () => {
    if (!lastParamsRef.current || state.retryCount >= maxRetries) {
      return;
    }

    // Don't retry user-rejected transactions
    if (state.errorType === "user_rejected") {
      return;
    }

    const newRetryCount = state.retryCount + 1;
    updateState({ retryCount: newRetryCount });

    const delay = getRetryDelay(newRetryCount - 1, retryDelayMs);

    retryTimeoutRef.current = setTimeout(() => {
      executeTransaction(lastParamsRef.current, true);
    }, delay);
  }, [
    state.retryCount,
    state.errorType,
    maxRetries,
    retryDelayMs,
    executeTransaction,
    updateState,
  ]);

  const execute = useCallback(
    async (params: any) => {
      reset();
      await executeTransaction(params, false);
    },
    [executeTransaction, reset]
  );

  // Handle transaction confirmation
  useEffect(() => {
    if (state.status === "pending" && isReceiptLoading) {
      updateState({ status: "confirming" });
    }
  }, [state.status, isReceiptLoading, updateState]);

  useEffect(() => {
    if (isReceiptSuccess && receipt && state.txHash) {
      updateState({ status: "confirmed" });
      onConfirmed?.(state.txHash, receipt);
    }
  }, [isReceiptSuccess, receipt, state.txHash, updateState, onConfirmed]);

  useEffect(() => {
    if (receiptError) {
      const errorType = classifyError(receiptError);
      const errorMessage =
        receiptError?.message || "Transaction receipt failed";

      updateState({
        status: "failed",
        error: errorMessage,
        errorType,
      });

      onError?.(errorMessage, errorType);
    }
  }, [receiptError, updateState, onError]);

  // Handle transaction hash from writeContract
  useEffect(() => {
    if (contractTxHash && state.status === "preparing") {
      updateState({
        status: "pending",
        txHash: contractTxHash,
        isRetrying: false,
      });
      onPending?.(contractTxHash);
    }
  }, [contractTxHash, state.status, updateState, onPending]);

  // Handle write contract errors
  useEffect(() => {
    if (writeError && state.status === "preparing") {
      const errorType = classifyError(writeError);
      const errorMessage =
        writeError?.message || "Transaction preparation failed";

      updateState({
        status: "failed",
        error: errorMessage,
        errorType,
      });

      onError?.(errorMessage, errorType);
    }
  }, [writeError, state.status, updateState, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    execute,
    retry,
    reset,
  };
};
