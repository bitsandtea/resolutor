"use client";

import AddressDisplay from "@/components/AddressDisplay";
import { AgreementFactoryABI, MockERC20ABI } from "@/lib/ABIs";
import { formatContractContent } from "@/lib/contract-formatter";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { formatEther, parseEther, stringToHex } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { flowTestnet } from "wagmi/chains";

interface Signer {
  name: string;
  email: string;
  role: "creator" | "signer";
}

interface Agreement {
  id: string;
  cid: string | null;
  flowContractAddr: string;
  depositA: number;
  depositB: number;
  partyA: string;
  partyB: string | null;
  templateType: string;
  signersData: Signer[] | null;
}

interface ContractState {
  partyA: string;
  partyB: string;
  mediator: string;
  depositA: bigint;
  depositB: bigint;
  balance: bigint;
  status: number;
  token: string;
  filecoinAccessControl: string;
  partyAApproved: boolean;
  partyBApproved: boolean;
  creationTimestamp: bigint;
  propAmountToA: bigint;
  propAmountToB: bigint;
  approvalCount: number;
}

type Step =
  | "connect"
  | "loadingContract"
  | "approveToken"
  | "signContract"
  | "completed"
  | "readOnly"
  | "error";

const STATUS_NAMES = ["Created", "Signed", "Active", "Disputed", "Resolved"];

const SignContractPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;
  const { address, isConnected } = useAccount();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [contractContent, setContractContent] = useState<string | null>(null);
  const [ipfsContent, setIpfsContent] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("connect");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading...");
  const [contractState, setContractState] = useState<ContractState | null>(
    null
  );
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [requiredDeposit, setRequiredDeposit] = useState<bigint>(BigInt(0));
  const [isPartyA, setIsPartyA] = useState<boolean>(false);

  const partyAInfo =
    agreement?.signersData?.find((s) => s.role === "creator") || null;

  // Contract write hooks
  const {
    writeContract: writeApproveToken,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const {
    writeContract: writeSignContract,
    data: signHash,
    isPending: isSignPending,
  } = useWriteContract();

  // Transaction receipt hooks
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isSignConfirming, isSuccess: isSignSuccess } =
    useWaitForTransactionReceipt({ hash: signHash });

  // Database step management functions
  const updateSigningStep = async (
    stepName: string,
    status: string,
    txHash?: string,
    errorMessage?: string
  ) => {
    try {
      const response = await fetch("/api/update-deployment-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          stepName,
          status,
          txHash,
          errorMessage,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        console.error("Failed to update signing step:", result.error);
      }
      return result.success;
    } catch (error) {
      console.error("Error updating signing step:", error);
      return false;
    }
  };

  const loadSigningState = async () => {
    try {
      const response = await fetch(
        `/api/deployment-status?agreementId=${agreementId}`
      );
      if (!response.ok) return null;

      const result = await response.json();
      if (!result.success) return null;

      return result.currentState;
    } catch (error) {
      console.error("Error loading signing state:", error);
      return null;
    }
  };

  // Fetch agreement data
  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        setLoadingMessage("Fetching agreement data...");
        const response = await fetch(`/api/contracts/${agreementId}`);
        if (!response.ok) throw new Error("Failed to fetch agreement");
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to load agreement");
        }

        const agreementData = result.agreement;
        if (!agreementData.flowContractAddr) {
          throw new Error("No Flow contract address found for this agreement");
        }

        if (
          agreementData.signersData &&
          typeof agreementData.signersData === "string"
        ) {
          try {
            agreementData.signersData = JSON.parse(agreementData.signersData);
          } catch (e) {
            console.error("Failed to parse signersData", e);
            agreementData.signersData = null; // Set to null if parsing fails
          }
        }

        setAgreement(agreementData);
        setContractContent(result.content);
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

  // Fetch IPFS content
  useEffect(() => {
    if (!agreement?.cid) return;

    const fetchIpfsContent = async () => {
      try {
        setLoadingMessage("Loading contract content from IPFS...");
        const gateways = [
          `https://gateway.lighthouse.storage/ipfs/${agreement.cid}`,
          `https://ipfs.io/ipfs/${agreement.cid}`,
          `https://cloudflare-ipfs.com/ipfs/${agreement.cid}`,
        ];

        for (const gateway of gateways) {
          try {
            const response = await fetch(gateway);
            if (response.ok) {
              const content = await response.text();
              setIpfsContent(content);
              return;
            }
          } catch (gatewayError) {
            console.warn(`Failed to fetch from ${gateway}:`, gatewayError);
          }
        }

        // Fallback to local content if IPFS fails
        if (contractContent) {
          setIpfsContent(contractContent);
        } else {
          throw new Error("Failed to fetch from all IPFS gateways");
        }
      } catch (error) {
        console.error("Error fetching IPFS content:", error);
        setIpfsContent(contractContent || "Failed to load contract content");
      }
    };

    fetchIpfsContent();
  }, [agreement?.cid, contractContent]);

  // Read contract state
  const { data: rawAgreementState, refetch: refetchAgreementState } =
    useReadContract({
      address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
      abi: AgreementFactoryABI,
      functionName: "getAgreement",
      args: agreementId ? [stringToHex(agreementId, { size: 32 })] : undefined,
      query: {
        enabled: !!agreementId && isConnected,
        refetchInterval: 5000,
      },
    });

  const { data: rawProposalState, refetch: refetchProposalState } =
    useReadContract({
      address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
      abi: AgreementFactoryABI,
      functionName: "getProposal",
      args: agreementId ? [stringToHex(agreementId, { size: 32 })] : undefined,
      query: {
        enabled: !!agreementId && isConnected,
        refetchInterval: 5000,
      },
    });
  // Read user's token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.MOCK_ERC20,
    chainId: flowTestnet.id,
    abi: MockERC20ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 10000,
    },
  }) as { data: bigint | undefined; refetch: () => void };

  // Read user's token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.MOCK_ERC20,
    chainId: flowTestnet.id,
    abi: MockERC20ABI,
    functionName: "allowance",
    args:
      address && agreement
        ? [address, agreement.flowContractAddr as `0x${string}`]
        : undefined,
    query: {
      enabled: !!address && !!agreement?.flowContractAddr && isConnected,
      refetchInterval: 5000,
    },
  }) as { data: bigint | undefined; refetch: () => void };

  // Process contract state
  useEffect(() => {
    if (
      rawAgreementState &&
      Array.isArray(rawAgreementState) &&
      rawAgreementState.length >= 12
    ) {
      const proposal =
        rawProposalState &&
        Array.isArray(rawProposalState) &&
        rawProposalState.length >= 3
          ? {
              propAmountToA: rawProposalState[0] as bigint,
              propAmountToB: rawProposalState[1] as bigint,
              approvalCount: rawProposalState[2] as number,
            }
          : {
              propAmountToA: BigInt(0),
              propAmountToB: BigInt(0),
              approvalCount: 0,
            };

      const state: ContractState = {
        partyA: rawAgreementState[0] as string,
        partyB: rawAgreementState[1] as string,
        mediator: rawAgreementState[2] as string,
        depositA: rawAgreementState[3] as bigint,
        depositB: rawAgreementState[4] as bigint,
        balance: rawAgreementState[5] as bigint,
        status: rawAgreementState[6] as number,
        token: rawAgreementState[7] as string,
        filecoinAccessControl: rawAgreementState[8] as string,
        partyAApproved: rawAgreementState[9] as boolean,
        partyBApproved: rawAgreementState[10] as boolean,
        creationTimestamp: rawAgreementState[11] as bigint,
        ...proposal,
      };

      setContractState(state);
    }
  }, [rawAgreementState, rawProposalState]);

  // Set user balance
  useEffect(() => {
    if (balance) {
      setUserBalance(balance);
    }
  }, [balance]);

  // Main step flow logic
  useEffect(() => {
    if (!isConnected) {
      setCurrentStep("connect");
      return;
    }

    if (!contractState || !address || !agreement) {
      setCurrentStep("loadingContract");
      return;
    }

    const determineStep = async () => {
      const userIsPartyA =
        contractState.partyA.toLowerCase() === address.toLowerCase();
      if (userIsPartyA) {
        setIsPartyA(true);
        setCurrentStep("readOnly");
        return;
      }

      const partyBIsAssigned =
        contractState.partyB !== "0x0000000000000000000000000000000000000000";

      if (
        partyBIsAssigned &&
        contractState.partyB.toLowerCase() !== address.toLowerCase()
      ) {
        setErrorMessage("This agreement has been claimed by another Party B.");
        setCurrentStep("error");
        return;
      }

      const signingState = await loadSigningState();
      setRequiredDeposit(
        agreement.depositB
          ? parseEther(agreement.depositB.toString())
          : BigInt(0)
      );

      const approveStep = signingState?.deploymentSteps?.find(
        (s: { stepName: string; status: string }) =>
          s.stepName === "sign_approve_token"
      );
      const signStep = signingState?.deploymentSteps?.find(
        (s: { stepName: string; status: string }) =>
          s.stepName === "sign_contract"
      );

      if (signStep?.status === "completed" || contractState.status >= 2) {
        setCurrentStep("completed");
      } else if (
        approveStep?.status === "completed" &&
        allowance &&
        allowance >= contractState.depositB
      ) {
        setCurrentStep("signContract");
      } else {
        setCurrentStep("approveToken");
      }
    };

    determineStep();
  }, [isConnected, contractState, address, agreement, allowance]);

  // Handle transaction successes
  useEffect(() => {
    if (isApproveSuccess && approveHash) {
      updateSigningStep("sign_approve_token", "completed", approveHash);
      refetchAllowance();
      setCurrentStep("signContract");
    }
  }, [isApproveSuccess, approveHash, refetchAllowance]);

  useEffect(() => {
    const updateStatus = async () => {
      if (isSignSuccess && signHash) {
        await updateSigningStep("sign_contract", "completed", signHash);
        await fetch("/api/agreements/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agreementId, status: "active" }),
        });
        await fetch(`/api/contracts/${agreementId}/deposit-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ depositPaid: true, partyB_address: address }),
        });
        refetchAgreementState();
        refetchProposalState();
        setCurrentStep("completed");
      }
    };
    updateStatus();
  }, [
    isSignSuccess,
    signHash,
    refetchAgreementState,
    refetchProposalState,
    agreementId,
    address,
  ]);

  const handleApproveToken = async () => {
    if (!agreement?.flowContractAddr || !requiredDeposit) return;

    await updateSigningStep("sign_approve_token", "in_progress");

    writeApproveToken({
      address: CONTRACT_ADDRESSES.MOCK_ERC20,
      abi: MockERC20ABI,
      functionName: "approve",
      args: [agreement.flowContractAddr as `0x${string}`, requiredDeposit],
    });
  };

  const handleSignContract = async () => {
    if (!agreement?.flowContractAddr || !address) return;

    await updateSigningStep("sign_contract", "in_progress");

    try {
      const partyBIsAssigned =
        contractState?.partyB !== "0x0000000000000000000000000000000000000000";
      if (!partyBIsAssigned) {
        const response = await fetch("/api/update-party-b", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agreementId,
            address: address,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update Party B: ${await response.text()}`);
        }
      }
    } catch (error) {
      console.error("Error updating party B", error);
      updateSigningStep(
        "sign_contract",
        "error",
        undefined,
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      setErrorMessage("Failed to register you as Party B. Please try again.");
      return;
    }

    writeSignContract({
      address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
      abi: AgreementFactoryABI,
      functionName: "signContract",
      args: [stringToHex(agreementId, { size: 32 })],
    });
  };

  const hasInsufficientBalance = userBalance < requiredDeposit;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">{loadingMessage}</p>
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
            {isPartyA ? "Agreement Status" : "Agreement Signing Process"}
          </h1>
          <p className="text-gray-600">
            {isPartyA
              ? "View your agreement status (read-only)"
              : "Complete the blockchain signing and deposit process"}
          </p>
        </div>

        {/* Contract Content Display */}
        {(ipfsContent || contractContent) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-blue-100 p-2 rounded mr-3">📄</span>
              Contract Content
              {agreement?.cid && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  IPFS: {agreement.cid.slice(0, 8)}...
                </span>
              )}
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg max-h-196 overflow-y-auto">
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: formatContractContent(
                    ipfsContent || contractContent || ""
                  ),
                }}
              />
            </div>
          </div>
        )}

        {/* Contract Info */}
        {contractState && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Contract Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* {agreement?.depositA && agreement.depositA > 0 && (
                <div>
                  <span className="font-medium">Party A Deposit:</span>{" "}
                  {agreement?.depositA} tokens
                </div>
              )} */}
              <div className="flex items-center">
                <span className="font-medium">Created and signed by:</span>
                <div className="ml-2 flex items-center">
                  {partyAInfo && (
                    <span className="mr-2 font-semibold">
                      {partyAInfo.name}
                    </span>
                  )}
                  {contractState.partyA !==
                    "0x0000000000000000000000000000000000000000" && (
                    <AddressDisplay
                      address={contractState.partyA}
                      maxLength={16}
                      clipboard={true}
                    />
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium">Party B Deposit Required:</span>{" "}
                {agreement?.depositB} tokens
              </div>

              {contractState.partyB &&
                contractState.partyB !==
                  "0x0000000000000000000000000000000000000000" && (
                  <div className="flex items-center">
                    <span className="font-medium">Party B:</span>
                    <div className="ml-2">
                      {contractState.partyB ===
                      "0x0000000000000000000000000000000000000000" ? (
                        <span className="text-gray-500 text-xs">
                          Not assigned
                        </span>
                      ) : (
                        <AddressDisplay
                          address={contractState.partyB}
                          maxLength={16}
                          clipboard={true}
                        />
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Read-only view for Party A */}
        {currentStep === "readOnly" && (
          <div className="bg-blue-50 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">
              Creator View (Read-Only)
            </h2>
            <p className="text-blue-700 mb-4">
              You are the creator of this agreement (Party A). You can view the
              contract status but cannot sign as Party B.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Your Deposit Status:</span>
                <span
                  className={`ml-2 ${
                    contractState?.partyAApproved
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {contractState?.partyAApproved ? "Approved" : "Pending"}
                </span>
              </div>
              <div>
                <span className="font-medium">Party B Deposit Status:</span>
                <span
                  className={`ml-2 ${
                    contractState?.partyBApproved
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {contractState?.partyBApproved ? "Approved" : "Pending"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step Content for signers */}
        {currentStep !== "readOnly" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            {currentStep === "connect" && (
              <div className="text-center">
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

            {currentStep === "loadingContract" && (
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">
                  Loading Contract State
                </h3>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-600 mt-4">
                  Verifying contract status...
                </p>
              </div>
            )}

            {currentStep === "approveToken" && (
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">
                  Approve Token Allowance
                </h3>
                <p className="text-gray-600 mb-4">
                  Approve {formatEther(requiredDeposit)} tokens to be used for
                  your deposit.
                </p>

                {/* Balance check */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span>Your Balance:</span>
                    <span className="font-mono">
                      {formatEther(userBalance)} tokens
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Required Deposit:</span>
                    <span className="font-mono">
                      {formatEther(requiredDeposit)} tokens
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-semibold mt-2">
                    <span>Sufficient Balance:</span>
                    <span
                      className={
                        hasInsufficientBalance
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {hasInsufficientBalance ? "No" : "Yes"}
                    </span>
                  </div>
                </div>

                {hasInsufficientBalance ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-700 text-sm">
                      Insufficient balance to pay deposit (deposit:{" "}
                      {formatEther(requiredDeposit)}, your balance:{" "}
                      {formatEther(userBalance)}). Get more tokens.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleApproveToken}
                    disabled={isApprovePending || isApproveConfirming}
                    className="bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApprovePending || isApproveConfirming
                      ? "Approving..."
                      : "Approve Tokens"}
                  </button>
                )}
              </div>
            )}

            {currentStep === "signContract" && (
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">
                  Sign Contract & Execute Deposit
                </h3>
                <p className="text-gray-600 mb-6">
                  Execute the final signature to complete your participation in
                  this agreement. Your deposit of {formatEther(requiredDeposit)}{" "}
                  tokens will be automatically transferred when you sign.
                </p>
                <button
                  onClick={handleSignContract}
                  disabled={isSignPending || isSignConfirming}
                  className="bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSignPending || isSignConfirming
                    ? "Signing & Depositing..."
                    : "Sign Contract & Deposit"}
                </button>
              </div>
            )}

            {currentStep === "completed" && (
              <div className="text-center">
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
                  Your signing process is complete! The agreement is now active
                  and your deposit has been automatically transferred and
                  locked.
                </p>
                <button
                  onClick={() => router.push(`/sign/${agreementId}/success`)}
                  className="bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600"
                >
                  Continue to Success Page
                </button>
              </div>
            )}
          </div>
        )}

        {/* Transaction Hashes */}
        {(approveHash || signHash) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
            <div className="space-y-2 text-sm">
              {approveHash && (
                <div className="flex items-center">
                  <span className="font-normal">Token Approval:</span>
                  <div className="ml-2">
                    <AddressDisplay
                      address={approveHash}
                      maxLength={20}
                      clipboard={true}
                    />
                  </div>
                </div>
              )}
              {signHash && (
                <div className="flex items-center">
                  <span className="font-normal">
                    Contract Signature & Deposit:
                  </span>
                  <div className="ml-2">
                    <AddressDisplay
                      address={signHash}
                      maxLength={20}
                      clipboard={true}
                    />
                  </div>
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
