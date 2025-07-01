"use client";

import { AccessControlABI, MultiSigAgreementABI } from "@/lib/ABIs";
import { formatContractContent } from "@/lib/contract-formatter";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { filecoinCalibration, flowTestnet } from "wagmi/chains";

interface Agreement {
  id: string;
  cid: string | null;
  templateType: string;
  partyA: string;
  partyB: string | null;
  status: string;
  depositA: number;
  depositB: number;
  depositAPaid: boolean;
  depositBPaid: boolean;
  createdAt: string;
  flowContractAddr: string | null;
  filecoinAccessControl: string | null;
  processStatus: string;
  currentStep: string;
  contractSigned: boolean;
  signedAt: string | null;
  signersData: string | null;
}

interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "creator" | "signer";
  status: "pending" | "signed" | "declined";
  depositAmount: number;
}

interface FilecoinAgreementState {
  partyA: string;
  partyB: string;
  mediator: string;
  createdAt: bigint;
  isActive: boolean;
}

interface FlowContractState {
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

interface FileInfo {
  cid: string;
  agreementId: string;
  uploadedAt: bigint;
  exists: boolean;
}

const STATUS_NAMES = [
  "Created",
  "Signed",
  "PartialDeposit",
  "FullDeposit",
  "Active",
  "Disputed",
  "Resolved",
];

const StateReaderPage: React.FC = () => {
  const params = useParams();
  const agreementId = params?.id as string;
  const { address, isConnected } = useAccount();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [contractContent, setContractContent] = useState<string | null>(null);
  const [ipfsContent, setIpfsContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<string>(
    "Loading agreement..."
  );

  // Fetch agreement data from backend
  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        setLoadingState("Fetching agreement from database...");
        const response = await fetch(`/api/contracts/${agreementId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch agreement: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to load agreement");
        }

        setAgreement(result.agreement);
        setContractContent(result.content);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching agreement:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load agreement"
        );
        setIsLoading(false);
      }
    };

    fetchAgreement();
  }, [agreementId]);

  // Read Filecoin AccessControl contract state
  const {
    data: filecoinAgreementData,
    error: filecoinAgreementError,
    isLoading: isFilecoinAgreementLoading,
  } = useReadContract({
    address: agreement?.filecoinAccessControl as `0x${string}`,
    abi: AccessControlABI,
    functionName: "getAgreement",
    args: agreementId ? [agreementId] : undefined,
    chainId: filecoinCalibration.id,
    query: {
      enabled: !!agreement?.filecoinAccessControl && !!agreementId,
    },
  }) as {
    data: readonly [string, string, string, bigint] | undefined;
    error: Error | null;
    isLoading: boolean;
  };

  // Read file info from Filecoin if CID exists
  console.log("reading accessControl:", {
    address: agreement?.filecoinAccessControl as `0x${string}`,
    abi: AccessControlABI,
    functionName: "getFile",
    args: agreement?.cid ? [agreement.cid] : undefined,
    chainId: filecoinCalibration.id,
    query: {
      enabled: !!agreement?.filecoinAccessControl && !!agreement?.cid,
    },
  });
  const {
    data: filecoinFileData,
    error: filecoinFileError,
    isLoading: isFilecoinFileLoading,
  } = useReadContract({
    address: agreement?.filecoinAccessControl as `0x${string}`,
    abi: AccessControlABI,
    functionName: "getFile",
    args: agreement?.cid ? [agreement.cid] : undefined,
    chainId: filecoinCalibration.id,
    query: {
      enabled: !!agreement?.filecoinAccessControl && !!agreement?.cid,
    },
  }) as {
    data: readonly [string, string, bigint] | undefined;
    error: Error | null;
    isLoading: boolean;
  };

  // Read Flow contract state
  const {
    data: flowContractData,
    error: flowContractError,
    isLoading: isFlowContractLoading,
  } = useReadContract({
    address: agreement?.flowContractAddr as `0x${string}`,
    abi: MultiSigAgreementABI,
    functionName: "getState",
    chainId: flowTestnet.id,
    query: {
      enabled: !!agreement?.flowContractAddr,
      refetchInterval: 5000,
    },
  }) as {
    data: readonly unknown[] | undefined;
    error: Error | null;
    isLoading: boolean;
  };

  // Load IPFS content
  useEffect(() => {
    if (!agreement?.cid) return;

    const fetchIpfsContent = async () => {
      try {
        setLoadingState("Loading IPFS content...");
        // Try multiple IPFS gateways
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

        throw new Error("Failed to fetch from all IPFS gateways");
      } catch (error) {
        console.error("Error fetching IPFS content:", error);
        setIpfsContent("Failed to load IPFS content");
      }
    };

    fetchIpfsContent();
  }, [agreement?.cid]);

  // Format contract states
  const formatFilecoinState = (): FilecoinAgreementState | null => {
    if (!filecoinAgreementData) return null;

    return {
      partyA: filecoinAgreementData[0],
      partyB: filecoinAgreementData[1],
      mediator: filecoinAgreementData[2],
      createdAt: filecoinAgreementData[3],
      isActive:
        filecoinAgreementData[0] !==
        "0x0000000000000000000000000000000000000000",
    };
  };

  const formatFlowState = (): FlowContractState | null => {
    if (
      !flowContractData ||
      !Array.isArray(flowContractData) ||
      flowContractData.length < 12
    ) {
      return null;
    }

    return {
      partyA: flowContractData[0] as string,
      partyB: flowContractData[1] as string,
      mediator: flowContractData[2] as string,
      depositA: flowContractData[3] as bigint,
      depositB: flowContractData[4] as bigint,
      status: flowContractData[5] as number,
      filecoinAccessControl: flowContractData[6] as string,
      propAmountToA: flowContractData[7] as bigint,
      propAmountToB: flowContractData[8] as bigint,
      approvalCount: flowContractData[9] as number,
      partyAApproved: flowContractData[10] as boolean,
      partyBApproved: flowContractData[11] as boolean,
    };
  };

  const formatFileInfo = (): FileInfo | null => {
    if (!filecoinFileData) return null;
    console.log("filecoinFileData", filecoinFileData);

    return {
      cid: filecoinFileData[0],
      agreementId: filecoinFileData[1],
      uploadedAt: filecoinFileData[2],
      exists: true,
    };
  };

  const filecoinState = formatFilecoinState();
  const flowState = formatFlowState();
  const fileInfo = formatFileInfo();

  const formatAddress = (addr: string) => {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") {
      return "Not set";
    }
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const formatTimestamp = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">{loadingState}</p>
      </div>
    );
  }

  if (error) {
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Error Loading Agreement
          </h1>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Agreement not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Agreement State Reader
          </h1>
          <p className="text-gray-600">Agreement ID: {agreementId}</p>
          {!isConnected && (
            <div className="mt-4">
              <ConnectButton />
              <p className="text-sm text-gray-500 mt-2">
                Connect wallet to view blockchain data
              </p>
            </div>
          )}
        </div>

        {/* Database State */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="bg-blue-100 p-2 rounded mr-3">🗄️</span>
            Database State
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <span className="font-medium">Template:</span>{" "}
                {agreement.templateType}
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-sm ${
                    agreement.status === "active"
                      ? "bg-green-100 text-green-800"
                      : agreement.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : agreement.status === "disputed"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {agreement.status}
                </span>
              </div>
              <div>
                <span className="font-medium">Process Status:</span>
                <span className="ml-2 px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                  {agreement.processStatus}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Party A:</span> {agreement.partyA}
              </div>
              <div>
                <span className="font-medium">Party B:</span>{" "}
                {agreement.partyB || "Not set"}
              </div>
              <div>
                <span className="font-medium">Created:</span>{" "}
                {new Date(agreement.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Contract Addresses */}
          <div className="mt-4 pt-4 border-t">
            <div>
              <span className="font-medium">IPFS CID:</span>
              <span className="font-mono ml-2">
                {agreement.cid || "Not uploaded"}
              </span>
            </div>
            <h3 className="font-semibold my-4">Contract Addresses:</h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Flow Contract:</span>
                <span className="font-mono ml-2">
                  {agreement.flowContractAddr || "Not deployed"}
                </span>
              </div>
              <div>
                <span className="font-medium">Filecoin Access Control:</span>
                <span className="font-mono ml-2">
                  {agreement.filecoinAccessControl || "Not deployed"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Signers Status */}
        {agreement.signersData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-indigo-100 p-2 rounded mr-3">👥</span>
              Signers Status
            </h2>
            <div className="space-y-4">
              {(() => {
                try {
                  const signers: ContractSigner[] = JSON.parse(
                    agreement.signersData
                  );
                  return signers.map((signer) => (
                    <div
                      key={signer.id}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <div className="font-medium text-gray-800">
                            {signer.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {signer.email}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Role:</span>
                          <span
                            className={`ml-2 px-2 py-1 rounded text-sm ${
                              signer.role === "creator"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {signer.role === "creator" ? "Creator" : "Signer"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <span
                            className={`ml-2 px-2 py-1 rounded text-sm ${
                              signer.status === "signed"
                                ? "bg-green-100 text-green-800"
                                : signer.status === "declined"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {signer.status === "signed"
                              ? "✅ Signed"
                              : signer.status === "declined"
                              ? "❌ Declined"
                              : "⏳ Pending"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Deposit:</span>
                          <span className="ml-2 text-blue-600">
                            {signer.depositAmount > 0
                              ? `${signer.depositAmount.toLocaleString()} tokens`
                              : "No deposit"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ));
                } catch (error) {
                  console.error("Error parsing signers data:", error);
                  return (
                    <div className="text-red-600 bg-red-50 border border-red-200 rounded p-4">
                      <p className="font-medium">Error parsing signers data</p>
                      <p className="text-sm mt-1">
                        Raw data: {agreement.signersData}
                      </p>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t bg-blue-50 rounded p-3">
              <div className="text-sm text-gray-700">
                {(() => {
                  try {
                    const signers: ContractSigner[] = JSON.parse(
                      agreement.signersData
                    );
                    const totalSigners = signers.length;
                    const signedCount = signers.filter(
                      (s) => s.status === "signed"
                    ).length;
                    const pendingCount = signers.filter(
                      (s) => s.status === "pending"
                    ).length;
                    const declinedCount = signers.filter(
                      (s) => s.status === "declined"
                    ).length;
                    const totalDeposit = signers.reduce(
                      (sum, s) => sum + s.depositAmount,
                      0
                    );

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="font-medium">Total Signers:</span>{" "}
                          {totalSigners}
                        </div>
                        <div>
                          <span className="font-medium">Signed:</span>{" "}
                          {signedCount}
                        </div>
                        <div>
                          <span className="font-medium">Pending:</span>{" "}
                          {pendingCount}
                        </div>
                        <div>
                          <span className="font-medium">Total Deposits:</span>{" "}
                          {totalDeposit.toLocaleString()} tokens
                        </div>
                      </div>
                    );
                  } catch (error) {
                    return (
                      <span className="text-red-600">
                        Unable to calculate summary
                      </span>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Filecoin State */}
        {agreement.filecoinAccessControl && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-purple-100 p-2 rounded mr-3">🟣</span>
              Filecoin AccessControl State
            </h2>

            {/* Contract Reference */}
            <div className="pt-4 border-t">
              <div>
                <span className="font-medium">Filecoin Access Control:</span>
                <span className="font-mono ml-2 text-sm">
                  {flowState?.filecoinAccessControl}
                </span>
              </div>
            </div>

            {!isConnected ? (
              <p className="text-gray-500">
                Connect wallet to view Filecoin data
              </p>
            ) : isFilecoinAgreementLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-3"></div>
                <span>Loading Filecoin data...</span>
              </div>
            ) : filecoinAgreementError ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-600">
                  Error loading Filecoin data: {filecoinAgreementError.message}
                </p>
              </div>
            ) : filecoinState ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Party A:</span>{" "}
                    {formatAddress(filecoinState.partyA)}
                  </div>
                  <div>
                    <span className="font-medium">Party B:</span>{" "}
                    {formatAddress(filecoinState.partyB)}
                  </div>
                  <div>
                    <span className="font-medium">Mediator:</span>{" "}
                    {formatAddress(filecoinState.mediator)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Created At:</span>{" "}
                    {formatTimestamp(filecoinState.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">Is Active:</span>{" "}
                    {filecoinState.isActive ? "✅ Yes" : "❌ No"}
                  </div>
                </div>

                {/* File Info */}
                <div className="md:col-span-2 mt-4 pt-4 border-t">
                  {agreement.cid && (
                    <>
                      <h3 className="font-medium mb-2">File Information:</h3>
                      {isFilecoinFileLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mr-3"></div>
                          <span>Loading file info...</span>
                        </div>
                      ) : filecoinFileError ? (
                        <p className="text-red-600">
                          Error loading file info: {filecoinFileError.message}
                        </p>
                      ) : fileInfo ? (
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium">CID:</span>{" "}
                            <span className="font-mono">{fileInfo.cid}</span>
                          </div>
                          <div>
                            <span className="font-medium">Agreement ID:</span>{" "}
                            {fileInfo.agreementId}
                          </div>
                          <div>
                            <span className="font-medium">Uploaded At:</span>{" "}
                            {formatTimestamp(fileInfo.uploadedAt)}
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          No file information found
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p className="text-gray-500">
                  No Filecoin agreement data found
                </p>
              </div>
            )}
          </div>
        )}

        {/* Flow State */}
        {agreement.flowContractAddr && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-green-100 p-2 rounded mr-3">⚡</span>
              Flow MultiSig Agreement State
            </h2>

            {!isConnected ? (
              <p className="text-gray-500">Connect wallet to view Flow data</p>
            ) : !agreement.flowContractAddr ? (
              <p className="text-gray-500">Flow contract not deployed yet</p>
            ) : isFlowContractLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-3"></div>
                <span>Loading Flow contract data...</span>
              </div>
            ) : flowContractError ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-600">
                  Error loading Flow data: {flowContractError.message}
                </p>
              </div>
            ) : flowState ? (
              <div className="space-y-4">
                {/* Parties and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Party A:</span>{" "}
                      {formatAddress(flowState.partyA)}
                    </div>
                    <div>
                      <span className="font-medium">Party B:</span>{" "}
                      {formatAddress(flowState.partyB)}
                    </div>
                    <div>
                      <span className="font-medium">Mediator:</span>{" "}
                      {formatAddress(flowState.mediator)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 rounded text-sm ${
                          flowState.status === 4
                            ? "bg-green-100 text-green-800"
                            : flowState.status === 5
                            ? "bg-red-100 text-red-800"
                            : flowState.status === 6
                            ? "bg-gray-100 text-gray-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {STATUS_NAMES[flowState.status] ||
                          `Status ${flowState.status}`}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Party A Approved:</span>{" "}
                      {flowState.partyAApproved ? "✅ Yes" : "❌ No"}
                    </div>
                    <div>
                      <span className="font-medium">Party B Approved:</span>{" "}
                      {flowState.partyBApproved ? "✅ Yes" : "❌ No"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Deposit A:</span>{" "}
                      {formatEther(flowState.depositA)} tokens
                    </div>
                    <div>
                      <span className="font-medium">Deposit B:</span>{" "}
                      {formatEther(flowState.depositB)} tokens
                    </div>
                    <div>
                      <span className="font-medium">Total Deposit:</span>{" "}
                      {formatEther(flowState.depositA + flowState.depositB)}{" "}
                      tokens
                    </div>
                  </div>
                </div>

                {/* Resolution Proposal (if any) */}
                {(flowState.propAmountToA > BigInt(0) ||
                  flowState.propAmountToB > BigInt(0)) && (
                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-2">
                      Current Resolution Proposal:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <span className="font-medium">Amount to A:</span>{" "}
                        {formatEther(flowState.propAmountToA)} tokens
                      </div>
                      <div>
                        <span className="font-medium">Amount to B:</span>{" "}
                        {formatEther(flowState.propAmountToB)} tokens
                      </div>
                      <div>
                        <span className="font-medium">Approvals:</span>{" "}
                        {flowState.approvalCount}/3
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No Flow contract data found</p>
            )}
          </div>
        )}

        {/* IPFS Content */}
        {agreement.cid && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="bg-orange-100 p-2 rounded mr-3">📁</span>
              IPFS Contract Content
            </h2>

            {!agreement.cid ? (
              <p className="text-gray-500">No IPFS content available</p>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">CID:</span>
                  <span className="font-mono ml-2">{agreement.cid}</span>
                  <div className="mt-2 space-x-4">
                    <a
                      href={`https://gateway.lighthouse.storage/ipfs/${agreement.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Lighthouse Gateway
                    </a>
                    <a
                      href={`https://ipfs.io/ipfs/${agreement.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      IPFS.io Gateway
                    </a>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  {ipfsContent === null ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-3"></div>
                      <span>Loading IPFS content...</span>
                    </div>
                  ) : ipfsContent === "Failed to load IPFS content" ? (
                    <div className="text-red-600">
                      <p>Failed to load IPFS content. This could be due to:</p>
                      <ul className="list-disc list-inside mt-2 text-sm">
                        <li>Network connectivity issues</li>
                        <li>IPFS node availability</li>
                        <li>Invalid CID</li>
                      </ul>
                      <p className="mt-2">
                        Try accessing the content directly using the gateway
                        links above.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: formatContractContent(ipfsContent || ""),
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StateReaderPage;
