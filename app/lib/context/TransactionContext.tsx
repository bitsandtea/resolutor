"use client";

import {
  TransactionError,
  TransactionStatus,
} from "@/lib/hooks/useTransaction";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { Hash } from "viem";

// Phase 2: Transaction State Context

export interface TransactionInfo {
  id: string;
  stepName: string;
  status: TransactionStatus;
  txHash?: Hash;
  error?: string;
  errorType?: TransactionError;
  retryCount: number;
  timestamp: number;
}

export interface TransactionContextState {
  transactions: Record<string, TransactionInfo>;
  activeTransactions: TransactionInfo[];
  addTransaction: (id: string, stepName: string) => void;
  updateTransaction: (id: string, updates: Partial<TransactionInfo>) => void;
  removeTransaction: (id: string) => void;
  getTransaction: (id: string) => TransactionInfo | undefined;
  clearCompletedTransactions: () => void;
  hasActiveTransactions: boolean;
}

const TransactionContext = createContext<TransactionContextState | null>(null);

export const useTransactionContext = (): TransactionContextState => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error(
      "useTransactionContext must be used within a TransactionProvider"
    );
  }
  return context;
};

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({
  children,
}) => {
  const [transactions, setTransactions] = useState<
    Record<string, TransactionInfo>
  >({});

  const addTransaction = useCallback((id: string, stepName: string) => {
    setTransactions((prev) => ({
      ...prev,
      [id]: {
        id,
        stepName,
        status: "idle",
        retryCount: 0,
        timestamp: Date.now(),
      },
    }));
  }, []);

  const updateTransaction = useCallback(
    (id: string, updates: Partial<TransactionInfo>) => {
      setTransactions((prev) => {
        const existing = prev[id];
        if (!existing) return prev;

        return {
          ...prev,
          [id]: {
            ...existing,
            ...updates,
            timestamp: Date.now(),
          },
        };
      });
    },
    []
  );

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const getTransaction = useCallback(
    (id: string): TransactionInfo | undefined => {
      return transactions[id];
    },
    [transactions]
  );

  const clearCompletedTransactions = useCallback(() => {
    setTransactions((prev) => {
      const filtered: Record<string, TransactionInfo> = {};
      Object.values(prev).forEach((tx) => {
        if (tx.status !== "confirmed" && tx.status !== "failed") {
          filtered[tx.id] = tx;
        }
      });
      return filtered;
    });
  }, []);

  const activeTransactions = Object.values(transactions).filter(
    (tx) =>
      tx.status === "preparing" ||
      tx.status === "pending" ||
      tx.status === "confirming"
  );

  const hasActiveTransactions = activeTransactions.length > 0;

  const contextValue: TransactionContextState = {
    transactions,
    activeTransactions,
    addTransaction,
    updateTransaction,
    removeTransaction,
    getTransaction,
    clearCompletedTransactions,
    hasActiveTransactions,
  };

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
};
