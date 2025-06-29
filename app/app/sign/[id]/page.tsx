"use client";

import { MockERC20ABI, MultiSigAgreementABI } from "@/lib/ABIs";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

interface Agreement {
  id: string;
  flowContractAddr: string;
  depositA: number;
  depositB: number;
  partyA: string;
  partyB: string | null;
}

interface ContractState {
  partyA: string;
  partyB: string;
  mediator: string;
  depositA: bigint;
  depositB: bigint;
  status: number;
  filecoinAccessControl: string;
  propAmountToA: bigint;
  propAmountToB: bigint;
  approvalCount: number;
  partyAApproved: boolean;
  partyBApproved: boolean;
}

type Step =
  | "connect"
  | "checkContract"
  | "signContract"
  | "approveToken"
  | "approveDeposit"
  | "completed"
  | "error";

const STATUS_NAMES = [
  "Created",
  "Signed",
  "PartialDeposit",
  "FullDeposit",
  "Active",
  "Disputed",
  "Resolved",
];

const SignContractPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;
  const { address, isConnected } = useAccount();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("connect");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiredDeposit, setRequiredDeposit] = useState<bigint>(BigInt(0));
  const [formattedContractState, setFormattedContractState] =
    useState<ContractState | null>(null);

  // Contract write hooks
  const {
    writeContract: writeSignContract,
    data: signHash,
    isPending: isSignPending,
  } = useWriteContract();
  const {
    writeContract: writeApproveToken,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();
  const {
    writeContract: writeApproveDeposit,
    data: depositHash,
    isPending: isDepositPending,
  } = useWriteContract();

  // Transaction receipt hooks
  const { isLoading: isSignConfirming, isSuccess: isSignSuccess } =
    useWaitForTransactionReceipt({ hash: signHash });
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash });

  // Fetch agreement data
  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        const response = await fetch(`/api/contracts/${agreementId}`);
        if (!response.ok) throw new Error("Failed to fetch agreement");
        const result = await response.json();
        const agreementData = result.agreement;

        if (!agreementData.flowContractAddr) {
          throw new Error("No Flow contract address found for this agreement");
        }

        setAgreement(agreementData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching agreement:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load agreement"
        );
        setCurrentStep("error");
        setIsLoading(false);
      }
    };

    fetchAgreement();
  }, [agreementId]);

  // Read contract state
  const { data: contractState, refetch: refetchState } = useReadContract({
    address: agreement?.flowContractAddr as `0x${string}`,
    abi: MultiSigAgreementABI,
    functionName: "getState",
    query: {
      enabled: !!agreement?.flowContractAddr && isConnected,
      refetchInterval: 5000,
    },
  }) as { data: readonly unknown[] | undefined; refetch: () => void };

  useEffect(() => {
    /*
         address partyA,
        address partyB,
        address mediator,
        uint256 depositA,
        uint256 depositB,
        Status status,
        address filecoinAccessControl,
        uint256 propAmountToA,
        uint256 propAmountToB,
        uint8 approvalCount,
        bool partyAApproved,
        bool partyBApproved
        */

    if (
      contractState &&
      isConnected &&
      Array.isArray(contractState) &&
      contractState.length >= 12
    ) {
      console.log("contractState", contractState);
      const newContractState: ContractState = {
        partyA: contractState[0] as string,
        partyB: contractState[1] as string,
        mediator: contractState[2] as string,
        depositA: contractState[3] as bigint,
        depositB: contractState[4] as bigint,
        status: contractState[5] as number,
        filecoinAccessControl: contractState[6] as string,
        propAmountToA: contractState[7] as bigint,
        propAmountToB: contractState[8] as bigint,
        approvalCount: contractState[9] as number,
        partyAApproved: contractState[10] as boolean,
        partyBApproved: contractState[11] as boolean,
      };
      console.log("newContractState", newContractState);
      setFormattedContractState(newContractState);
    }
  }, [contractState, isConnected]);

  // Check user's token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.MOCK_ERC20,
    abi: MockERC20ABI,
    functionName: "allowance",
    args:
      address && agreement
        ? [address, agreement.flowContractAddr as `0x${string}`]
        : undefined,
    query: {
      enabled:
        !!address &&
        !!agreement?.flowContractAddr &&
        currentStep === "approveToken",
      refetchInterval: 3000,
    },
  }) as { data: bigint | undefined; refetch: () => void };

  // Update step based on contract state and user connection
  useEffect(() => {
    if (!isConnected) {
      setCurrentStep("connect");
      return;
    }

    if (!formattedContractState || !address || !agreement) {
      setCurrentStep("checkContract");
      return;
    }

    // Check if contract already signed
    if (formattedContractState.status === 0) {
      // Created status
      if (
        formattedContractState.partyB ===
        "0x0000000000000000000000000000000000000000"
      ) {
        setCurrentStep("signContract");
        return;
      }
    }

    // Check if user is party A or B and determine required deposit
    const isPartyA =
      formattedContractState.partyA.toLowerCase() === address.toLowerCase();
    const isPartyB =
      formattedContractState.partyB.toLowerCase() === address.toLowerCase();

    if (!isPartyA && !isPartyB) {
      setErrorMessage("You are not authorized to sign this contract");
      setCurrentStep("error");
      return;
    }

    const deposit = isPartyA
      ? formattedContractState.depositA
      : formattedContractState.depositB;
    const hasApproved = isPartyA
      ? formattedContractState.partyAApproved
      : formattedContractState.partyBApproved;

    setRequiredDeposit(deposit);

    // Contract is signed, check deposit flow
    if (formattedContractState.status >= 1) {
      // Signed or beyond
      if (!hasApproved) {
        // Check if user has sufficient allowance
        if (allowance && allowance >= deposit) {
          setCurrentStep("approveDeposit");
        } else {
          setCurrentStep("approveToken");
        }
      } else {
        // User has approved, check overall status
        if (formattedContractState.status >= 4) {
          // Active or beyond
          setCurrentStep("completed");
        } else {
          setCurrentStep("completed"); // Waiting for other party
        }
      }
    }
  }, [isConnected, formattedContractState, address, agreement, allowance]);

  // Handle transaction successes
  useEffect(() => {
    if (isSignSuccess) {
      refetchState();
      // Will automatically move to next step via the main effect
    }
  }, [isSignSuccess, refetchState]);

  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
      // Will automatically move to approveDeposit step
    }
  }, [isApproveSuccess, refetchAllowance]);

  useEffect(() => {
    if (isDepositSuccess) {
      refetchState();
      setCurrentStep("completed");
    }
  }, [isDepositSuccess, refetchState]);

  const handleSignContract = () => {
    if (!agreement?.flowContractAddr) return;

    writeSignContract({
      address: agreement.flowContractAddr as `0x${string}`,
      abi: MultiSigAgreementABI,
      functionName: "signContract",
    });
  };

  const handleApproveToken = () => {
    if (!agreement?.flowContractAddr) return;

    writeApproveToken({
      address: CONTRACT_ADDRESSES.MOCK_ERC20,
      abi: MockERC20ABI,
      functionName: "approve",
      args: [agreement.flowContractAddr as `0x${string}`, requiredDeposit],
    });
  };

  const handleApproveDeposit = () => {
    if (!agreement?.flowContractAddr) return;

    writeApproveDeposit({
      address: agreement.flowContractAddr as `0x${string}`,
      abi: MultiSigAgreementABI,
      functionName: "approveDeposit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading agreement...</p>
      </div>
    );
  }

  if (currentStep === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600 mx-auto"
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
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-red-500 mb-4">{errorMessage}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Agreement Signing Process
          </h1>
          <p className="text-gray-600">
            Complete the blockchain signing and deposit process
          </p>
        </div>

        {/* Contract Info */}
        {formattedContractState && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Contract Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span>{" "}
                {STATUS_NAMES[formattedContractState.status]}
              </div>
              <div>
                <span className="font-medium">Your Deposit:</span>{" "}
                {formatEther(requiredDeposit)} tokens
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">Contract Address:</span>
                <span className="font-mono text-xs ml-2">
                  {agreement?.flowContractAddr}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            {[
              "connect",
              "checkContract",
              "signContract",
              "approveToken",
              "approveDeposit",
              "completed",
            ].map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === step
                      ? "bg-blue-500 text-white"
                      : index <
                        [
                          "connect",
                          "checkContract",
                          "signContract",
                          "approveToken",
                          "approveDeposit",
                          "completed",
                        ].indexOf(currentStep)
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {index <
                  [
                    "connect",
                    "checkContract",
                    "signContract",
                    "approveToken",
                    "approveDeposit",
                    "completed",
                  ].indexOf(currentStep)
                    ? "✓"
                    : index + 1}
                </div>
                {index < 5 && <div className="w-8 h-1 bg-gray-300 mx-2"></div>}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="text-center">
            {currentStep === "connect" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-600 mb-6">
                  Please connect your wallet to continue with the signing
                  process.
                </p>
                <ConnectButton />
              </div>
            )}

            {currentStep === "checkContract" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Checking Contract State
                </h3>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 mt-4">
                  Verifying contract status...
                </p>
              </div>
            )}

            {currentStep === "signContract" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Sign the Contract
                </h3>
                <p className="text-gray-600 mb-6">
                  Sign the contract to become Party B and proceed with the
                  deposit process.
                </p>
                <button
                  onClick={handleSignContract}
                  disabled={isSignPending || isSignConfirming}
                  className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSignPending || isSignConfirming
                    ? "Signing..."
                    : "Sign Contract"}
                </button>
              </div>
            )}

            {currentStep === "approveToken" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Approve Token Allowance
                </h3>
                <p className="text-gray-600 mb-6">
                  Approve {formatEther(requiredDeposit)} tokens to be used for
                  your deposit.
                </p>
                <button
                  onClick={handleApproveToken}
                  disabled={isApprovePending || isApproveConfirming}
                  className="bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApprovePending || isApproveConfirming
                    ? "Approving..."
                    : "Approve Tokens"}
                </button>
              </div>
            )}

            {currentStep === "approveDeposit" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Approve Your Deposit
                </h3>
                <p className="text-gray-600 mb-6">
                  Finalize your deposit approval to activate the agreement.
                </p>
                <button
                  onClick={handleApproveDeposit}
                  disabled={isDepositPending || isDepositConfirming}
                  className="bg-purple-500 text-white py-3 px-6 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDepositPending || isDepositConfirming
                    ? "Approving Deposit..."
                    : "Approve Deposit"}
                </button>
              </div>
            )}

            {currentStep === "completed" && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Process Complete!
                </h3>
                <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600 mx-auto"
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
                </div>
                <p className="text-gray-600 mb-6">
                  Your part of the signing and deposit process is complete.
                  {formattedContractState?.status === 4
                    ? " The agreement is now active!"
                    : " Waiting for the other party to complete their part."}
                </p>
                <button
                  onClick={() => router.push(`/sign/${agreementId}/success`)}
                  className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Hashes */}
        {(signHash || approveHash || depositHash) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
            <div className="space-y-2 text-sm font-mono">
              {signHash && (
                <div>
                  <span className="font-normal">Sign Contract:</span> {signHash}
                </div>
              )}
              {approveHash && (
                <div>
                  <span className="font-normal">Token Approval:</span>{" "}
                  {approveHash}
                </div>
              )}
              {depositHash && (
                <div>
                  <span className="font-normal">Deposit Approval:</span>{" "}
                  {depositHash}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignContractPage;
