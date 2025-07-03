"use client";

import { AccessControlABI, AgreementFactoryABI } from "@/lib/ABIs";
import { formatContractContent } from "@/lib/contract-formatter";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { formatEther, stringToHex } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { filecoinCalibration, flowTestnet } from "wagmi/chains";

// --- TYPES ---
interface DeploymentStep {
  id: string;
  stepName: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  txHash: string | null;
  contractAddr: string | null;
  ipfsCid: string | null;
  errorMessage: string | null;
}

interface Agreement {
  id: string;
  cid: string | null;
  templateType: string | null;
  partyA: string | null;
  partyB: string | null;
  status: string;
  depositA: number;
  depositB: number;
  depositAPaid: boolean;
  depositBPaid: boolean;
  createdAt: string;
  updatedAt: string;
  flowContractAddr: string | null;
  filecoinAccessControl: string | null;
  processStatus: string;
  currentStep: string;
  signersData: string | null; // Keep as string, parse in component
  deploymentSteps: DeploymentStep[];
  errorDetails: string | null;
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

interface FileInfo {
  cid: string;
  agreementId: string;
  uploadedAt: bigint;
  exists: boolean;
}

const FLOW_STATUS_NAMES: { [key: number]: string } = {
  0: "Created",
  1: "Signed",
  2: "PartialDeposit",
  3: "FullDeposit",
  4: "Active",
  5: "Disputed",
  6: "Resolved",
};

// --- HELPER FUNCTIONS & CONSTANTS ---
const formatAddress = (addr: string | null | undefined) => {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return "Not set";
  }
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
};

const formatTimestamp = (timestamp: bigint | string) => {
  if (typeof timestamp === "string") {
    return new Date(timestamp).toLocaleString();
  }
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

// --- SUB-COMPONENTS ---
const InfoCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-700">
      <span className="p-2 rounded mr-3 bg-gray-100">{icon}</span>
      {title}
    </h2>
    {children}
  </div>
);

const DataField: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className = "" }) => (
  <div className={className}>
    <span className="font-medium text-gray-600">{label}:</span>
    <span className="ml-2 text-gray-800">{children}</span>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusClasses: { [key: string]: string } = {
    active: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    disputed: "bg-orange-100 text-orange-800",
    failed: "bg-red-100 text-red-800",
    declined: "bg-red-100 text-red-800",
    signed: "bg-green-100 text-green-800",
    default: "bg-gray-100 text-gray-800",
  };

  const a = status.toLowerCase();

  return (
    <span
      className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
        statusClasses[a] || statusClasses.default
      }`}
    >
      {status}
    </span>
  );
};

const DeploymentStatus: React.FC<{ steps: DeploymentStep[] }> = ({ steps }) => {
  const getIcon = (status: DeploymentStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case "in_progress":
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        );
      case "failed":
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      case "pending":
      default:
        return <ClockIcon className="h-6 w-6 text-gray-400" />;
    }
  };

  return (
    <InfoCard title="Deployment Progress" icon="🚀">
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start space-x-4">
            <div className="flex flex-col items-center">
              {getIcon(step.status)}
              {index < steps.length - 1 && (
                <div className="w-px h-12 bg-gray-200 mt-2"></div>
              )}
            </div>
            <div className="flex-1 pb-8">
              <p className="font-semibold text-gray-800">{step.stepName}</p>
              <p className="text-sm text-gray-500">
                Status: <StatusBadge status={step.status} />
              </p>
              {step.txHash && (
                <p className="text-sm text-gray-500 font-mono mt-1">
                  Tx: {formatAddress(step.txHash)}
                </p>
              )}
              {step.contractAddr && (
                <p className="text-sm text-gray-500 font-mono mt-1">
                  Address: {formatAddress(step.contractAddr)}
                </p>
              )}
              {step.errorMessage && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded mt-1">
                  Error: {step.errorMessage}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </InfoCard>
  );
};

// --- MAIN PAGE COMPONENT ---
const StateReaderPage: React.FC = () => {
  const params = useParams();
  const agreementId = params?.id as string;
  const { address, isConnected } = useAccount();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
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
        if (!result.success || !result.agreement) {
          throw new Error(result.error || "Failed to load agreement");
        }

        setAgreement(result.agreement);
      } catch (error) {
        console.error("Error fetching agreement:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load agreement"
        );
      } finally {
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
    data: flowAgreementData,
    error: flowAgreementError,
    isLoading: isFlowAgreementLoading,
  } = useReadContract({
    address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
    abi: AgreementFactoryABI,
    functionName: "getAgreement",
    args: agreementId ? [stringToHex(agreementId, { size: 32 })] : undefined,
    chainId: flowTestnet.id,
    query: {
      enabled: !!agreementId,
      refetchInterval: 5000,
    },
  });

  const {
    data: flowProposalData,
    error: flowProposalError,
    isLoading: isFlowProposalLoading,
  } = useReadContract({
    address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
    abi: AgreementFactoryABI,
    functionName: "getProposal",
    args: agreementId ? [stringToHex(agreementId, { size: 32 })] : undefined,
    chainId: flowTestnet.id,
    query: {
      enabled: !!agreementId,
      refetchInterval: 5000,
    },
  }) as {
    data: readonly [bigint, bigint, number] | undefined;
    error: Error | null;
    isLoading: boolean;
  };

  // Load IPFS content
  useEffect(() => {
    if (!agreement?.cid) return;

    const fetchIpfsContent = async () => {
      try {
        setLoadingState("Loading IPFS content...");
        const gateways = [
          `https://gateway.lighthouse.storage/ipfs/${agreement.cid}`,
          `https://ipfs.io/ipfs/${agreement.cid}`,
          `https://cloudflare-ipfs.com/ipfs/${agreement.cid}`,
        ];

        for (const gateway of gateways) {
          try {
            const response = await fetch(gateway);
            if (response.ok) {
              setIpfsContent(await response.text());
              return;
            }
          } catch (gatewayError) {
            console.warn(`Failed to fetch from ${gateway}:`, gatewayError);
          }
        }
        throw new Error("Failed to fetch from all IPFS gateways");
      } catch (err) {
        console.error("Error fetching IPFS content:", err);
        setIpfsContent("Failed to load IPFS content");
      }
    };

    fetchIpfsContent();
  }, [agreement?.cid]);

  // Format contract states
  const filecoinState: FilecoinAgreementState | null = filecoinAgreementData
    ? {
        partyA: filecoinAgreementData[0],
        partyB: filecoinAgreementData[1],
        mediator: filecoinAgreementData[2],
        createdAt: filecoinAgreementData[3],
        isActive:
          filecoinAgreementData[0] !==
          "0x0000000000000000000000000000000000000000",
      }
    : null;

  const flowState: FlowContractState | null =
    flowAgreementData &&
    Array.isArray(flowAgreementData) &&
    flowAgreementData.length >= 12
      ? {
          partyA: flowAgreementData[0] as string,
          partyB: flowAgreementData[1] as string,
          mediator: flowAgreementData[2] as string,
          depositA: flowAgreementData[3] as bigint,
          depositB: flowAgreementData[4] as bigint,
          balance: flowAgreementData[5] as bigint,
          status: flowAgreementData[6] as number,
          token: flowAgreementData[7] as string,
          filecoinAccessControl: flowAgreementData[8] as string,
          partyAApproved: flowAgreementData[9] as boolean,
          partyBApproved: flowAgreementData[10] as boolean,
          creationTimestamp: flowAgreementData[11] as bigint,
          propAmountToA: flowProposalData?.[0] ?? BigInt(0),
          propAmountToB: flowProposalData?.[1] ?? BigInt(0),
          approvalCount: flowProposalData?.[2] ?? 0,
        }
      : null;

  const fileInfo: FileInfo | null = filecoinFileData
    ? {
        cid: filecoinFileData[0],
        agreementId: filecoinFileData[1],
        uploadedAt: filecoinFileData[2],
        exists: true,
      }
    : null;

  // --- RENDER LOGIC ---
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
        <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Error Loading Agreement
        </h1>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Agreement not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Agreement State Explorer
          </h1>
          <p className="text-gray-600 font-mono">ID: {agreementId}</p>
          {!isConnected && (
            <div className="mt-4 flex flex-col items-center">
              <ConnectButton />
              <p className="text-sm text-gray-500 mt-2">
                Connect wallet to view live blockchain data
              </p>
            </div>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {agreement.deploymentSteps && (
              <DeploymentStatus steps={agreement.deploymentSteps} />
            )}
            {agreement.signersData && (
              <InfoCard title="Signers Status" icon="👥">
                <div className="space-y-4">
                  {(() => {
                    try {
                      const signers: ContractSigner[] = JSON.parse(
                        agreement.signersData!
                      );
                      return signers.map((signer) => (
                        <div
                          key={signer.id}
                          className="border rounded-lg p-4 bg-gray-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center"
                        >
                          <div>
                            <div className="font-medium text-gray-800">
                              {signer.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {signer.email}
                            </div>
                          </div>
                          <DataField label="Role">
                            <StatusBadge status={signer.role} />
                          </DataField>
                          <DataField label="Status">
                            <StatusBadge status={signer.status} />
                          </DataField>
                          <DataField label="Deposit">
                            {signer.depositAmount > 0
                              ? `${signer.depositAmount.toLocaleString()} tokens`
                              : "N/A"}
                          </DataField>
                        </div>
                      ));
                    } catch (e) {
                      return (
                        <p className="text-red-500">Error parsing signers</p>
                      );
                    }
                  })()}
                </div>
              </InfoCard>
            )}

            {agreement.filecoinAccessControl && (
              <InfoCard title="Filecoin AccessControl State" icon="🟣">
                {isFilecoinAgreementLoading ? (
                  <p>Loading Filecoin data...</p>
                ) : filecoinAgreementError ? (
                  <p className="text-red-500">
                    {filecoinAgreementError.message}
                  </p>
                ) : filecoinState ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DataField label="Party A">
                      {formatAddress(filecoinState.partyA)}
                    </DataField>
                    <DataField label="Party B">
                      {formatAddress(filecoinState.partyB)}
                    </DataField>
                    <DataField label="Mediator">
                      {formatAddress(filecoinState.mediator)}
                    </DataField>
                    <DataField label="Is Active">
                      {filecoinState.isActive ? "✅ Yes" : "❌ No"}
                    </DataField>
                    <DataField label="Created At">
                      {formatTimestamp(filecoinState.createdAt)}
                    </DataField>
                  </div>
                ) : (
                  <p>No Filecoin agreement data found.</p>
                )}
                {agreement.cid && fileInfo && (
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="font-medium mb-2">File Information:</h3>
                    {isFilecoinFileLoading ? (
                      <p>Loading file info...</p>
                    ) : filecoinFileError ? (
                      <p className="text-red-600">
                        Error: {filecoinFileError.message}
                      </p>
                    ) : fileInfo ? (
                      <div className="space-y-1 text-sm">
                        <DataField label="CID">
                          <span className="font-mono">{fileInfo.cid}</span>
                        </DataField>
                        <DataField label="Uploaded At">
                          {formatTimestamp(fileInfo.uploadedAt)}
                        </DataField>
                      </div>
                    ) : (
                      <p>No file info on chain.</p>
                    )}
                  </div>
                )}
              </InfoCard>
            )}

            {agreement.flowContractAddr && (
              <InfoCard title="Flow MultiSig Agreement State" icon="⚡">
                {isFlowAgreementLoading || isFlowProposalLoading ? (
                  <p>Loading Flow data...</p>
                ) : flowAgreementError || flowProposalError ? (
                  <p className="text-red-500">
                    {flowAgreementError?.message || flowProposalError?.message}
                  </p>
                ) : flowState ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <DataField label="Party A">
                        {formatAddress(flowState.partyA)}
                      </DataField>
                      <DataField label="Party B">
                        {formatAddress(flowState.partyB)}
                      </DataField>
                      <DataField label="Mediator">
                        {formatAddress(flowState.mediator)}
                      </DataField>
                      <DataField label="Deposit A">
                        {formatEther(flowState.depositA)} tokens
                      </DataField>
                      <DataField label="Deposit B">
                        {formatEther(flowState.depositB)} tokens
                      </DataField>
                      <DataField label="Balance">
                        {formatEther(flowState.balance)} tokens
                      </DataField>
                      <DataField label="Status">
                        <StatusBadge
                          status={
                            FLOW_STATUS_NAMES[flowState.status] ||
                            `Unknown (${flowState.status})`
                          }
                        />
                      </DataField>
                      <DataField label="Party A Approved">
                        {flowState.partyAApproved ? "✅" : "❌"}
                      </DataField>
                      <DataField label="Party B Approved">
                        {flowState.partyBApproved ? "✅" : "❌"}
                      </DataField>
                    </div>
                    {(flowState.propAmountToA > 0n ||
                      flowState.propAmountToB > 0n) && (
                      <div className="pt-4 border-t">
                        <h3 className="font-medium mb-2">
                          Resolution Proposal:
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <DataField label="To A">
                            {formatEther(flowState.propAmountToA)} tokens
                          </DataField>
                          <DataField label="To B">
                            {formatEther(flowState.propAmountToB)} tokens
                          </DataField>
                          <DataField label="Approvals">
                            {flowState.approvalCount}/3
                          </DataField>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>No Flow contract data found.</p>
                )}
              </InfoCard>
            )}
          </div>

          <aside className="lg:col-span-1">
            <InfoCard title="Database State" icon="🗄️">
              <div className="space-y-3">
                <DataField label="Template">
                  {agreement.templateType || "N/A"}
                </DataField>
                <DataField label="DB Status">
                  <StatusBadge status={agreement.status} />
                </DataField>
                <DataField label="Process Status">
                  <StatusBadge status={agreement.processStatus} />
                </DataField>
                <DataField label="Current Step">
                  <StatusBadge status={agreement.currentStep} />
                </DataField>
                <DataField label="Party A">
                  {agreement.partyA || "Not set"}
                </DataField>
                <DataField label="Party B">
                  {agreement.partyB || "Not set"}
                </DataField>
                <DataField label="Created">
                  {formatTimestamp(agreement.createdAt)}
                </DataField>
                <DataField label="Last Update">
                  {formatTimestamp(agreement.updatedAt)}
                </DataField>

                <div className="pt-4 border-t mt-4">
                  <DataField label="IPFS CID">
                    <span className="font-mono text-sm break-all">
                      {agreement.cid || "Not uploaded"}
                    </span>
                  </DataField>
                  <DataField label="Flow Contract">
                    <span className="font-mono text-sm break-all">
                      {agreement.flowContractAddr || "Not deployed"}
                    </span>
                  </DataField>
                  <DataField label="Filecoin Contract">
                    <span className="font-mono text-sm break-all">
                      {agreement.filecoinAccessControl || "Not deployed"}
                    </span>
                  </DataField>
                </div>
                {agreement.errorDetails && (
                  <div className="pt-4 border-t mt-4">
                    <p className="font-medium text-red-600">Last Error:</p>
                    <p className="text-sm text-red-500 bg-red-50 p-2 rounded mt-1">
                      {agreement.errorDetails}
                    </p>
                  </div>
                )}
              </div>
            </InfoCard>
            {agreement.cid && (
              <InfoCard title="IPFS Contract Content" icon="📁">
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                  {ipfsContent === null ? (
                    <p>Loading IPFS content...</p>
                  ) : ipfsContent === "Failed to load IPFS content" ? (
                    <p className="text-red-500">Failed to load IPFS content.</p>
                  ) : (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: formatContractContent(ipfsContent || ""),
                      }}
                    />
                  )}
                </div>
              </InfoCard>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
};

export default StateReaderPage;
