"use client";

import { formatContractContent } from "@/lib/contract-formatter";
import { fetchIpfsContentWithFallback } from "@/lib/ipfs";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import AddressDisplay from "../../../components/AddressDisplay";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import { parseSignersData } from "../../new/helpers";

interface MediatorOutput {
  rationale: string;
  decision: "approveResolution" | "rejectResolution" | "proposeAlternative";
  party_a_split?: number;
  party_b_split?: number;
}

interface Dispute {
  id: string;
  opener: string;
  openerSummary: string;
  openerEvidenceCids?: string[];
  responder?: string;
  responderSummary?: string;
  responderEvidenceCids?: string[];
  status: string;
  mediationResult?: MediatorOutput;
  payoutTxHash?: string | null;
  requestedAmount?: number;
}

interface Agreement {
  id: string;
  cid: string | null;
  templateType: string | null;
  partyA: string | null;
  partyB: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  signersData: string | null;
  disputes: Dispute[];
  partyA_address: string;
  partyB_address: string;
  depositA: number;
  depositB: number;
}

interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "creator" | "signer";
  status: "pending" | "signed" | "declined";
  depositAmount: number;
}

const DisputeResponseForm: React.FC<{
  agreementId: string;
  responderAddress: string;
  onResponseSubmitted: () => void;
}> = ({ agreementId, responderAddress, onResponseSubmitted }) => {
  const [summary, setSummary] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidenceFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSubmissionStatus("Submitting your response...");

    try {
      let evidenceCids: string[] = [];
      if (evidenceFiles.length > 0) {
        setSubmissionStatus("Uploading evidence...");
        const formData = new FormData();
        evidenceFiles.forEach((file) => {
          formData.append("files", file);
        });
        formData.append("agreementId", agreementId);

        const response = await fetch("/api/upload-evidence", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to upload evidence.");
        }
        evidenceCids = result.cids;
      }

      setSubmissionStatus(
        "Response submitted. Triggering automated mediation... This may take a moment."
      );
      const response = await fetch("/api/dispute/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          responderAddr: responderAddress,
          summary,
          evidenceCids,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to submit response.");
      }

      setSubmissionStatus("Mediation complete! Refreshing data...");

      // Refresh the page data after a short delay
      setTimeout(() => {
        onResponseSubmitted();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    } finally {
      setIsSubmitting(false);
      setSubmissionStatus(null);
    }
  };

  if (isSubmitting) {
    return (
      <div className="mt-8 bg-white shadow-md rounded-lg p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-700 font-semibold">{submissionStatus}</p>
        <p className="text-sm text-gray-500 mt-2">Please wait...</p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Provide Your Response
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="summary"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your Summary of the Situation
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="evidence"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Supporting Evidence (Optional)
          </label>
          <input
            type="file"
            id="evidence"
            onChange={handleFileChange}
            multiple
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="text-right">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {isSubmitting ? "Submitting..." : "Submit Response"}
          </button>
        </div>
      </form>
    </div>
  );
};

const DisputeDetails: React.FC<{
  dispute: Dispute;
  agreement: Agreement;
  partyA: ContractSigner | undefined;
  partyB: ContractSigner | undefined;
}> = ({ dispute, agreement, partyA, partyB }) => {
  return (
    <div className="mt-8 bg-white shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Dispute Details</h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
            dispute.status.startsWith("triaged")
              ? "bg-yellow-100 text-yellow-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {dispute.status.replace("_", " ")}
        </span>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            Dispute Opener (Party A)
          </h3>
          <p className="text-sm text-gray-500 truncate">{dispute.opener}</p>
          <p className="mt-2 text-gray-600">{dispute.openerSummary}</p>
          {dispute.openerEvidenceCids &&
            dispute.openerEvidenceCids.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium text-gray-600">Evidence:</h4>
                <ul className="list-disc list-inside text-sm mt-1">
                  {dispute.openerEvidenceCids.map((cid, index) => (
                    <li key={index}>
                      <a
                        href={`https://gateway.lighthouse.storage/ipfs/${cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        View Evidence File {index + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {dispute.responder ? (
          <div>
            <h3 className="text-lg font-semibold text-gray-700">
              Responder (Party B)
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {dispute.responder}
            </p>
            <p className="mt-2 text-gray-600">{dispute.responderSummary}</p>
            {dispute.responderEvidenceCids &&
              dispute.responderEvidenceCids.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium text-gray-600">
                    Evidence:
                  </h4>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {dispute.responderEvidenceCids.map((cid, index) => (
                      <li key={index}>
                        <a
                          href={`https://gateway.lighthouse.storage/ipfs/${cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View Evidence File {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold text-gray-700">
              Responder (Party B)
            </h3>
            <p className="text-gray-500 italic">
              Awaiting response from Party B.
            </p>
          </div>
        )}
      </div>
      {(dispute.status === "mediated" ||
        dispute.status === "resolved" ||
        dispute.status === "mediated_execution_failed") &&
        dispute.mediationResult && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 mr-4">
                  <img
                    src="/judge.png"
                    alt="AI Judge"
                    className="w-16 h-16 rounded-full border-2 border-blue-300 shadow-lg"
                  />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-1">
                    ⚖️ Official AI Mediation Judgment
                  </h3>
                  <p className="text-sm text-gray-600">
                    Rendered by Autonomous yet FAIR AI Mediator •{" "}
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    📋 Judicial Rationale
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                    <p className="text-gray-700 leading-relaxed italic">
                      "{dispute.mediationResult.rationale}"
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    ⚡ Court Decision
                  </h4>
                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                    <p className="text-green-800 font-semibold text-lg">
                      {dispute.mediationResult.decision === "approveResolution"
                        ? "✅ RESOLUTION APPROVED & EXECUTED"
                        : dispute.mediationResult.decision ===
                          "proposeAlternative"
                        ? "📋 ALTERNATIVE RESOLUTION PROPOSED"
                        : "❌ RESOLUTION DENIED"}
                    </p>
                  </div>
                </div>

                {dispute.status === "resolved" && dispute.payoutTxHash && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      💰 Fund Transfer Executed
                    </h4>
                    <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                      <div className="space-y-3">
                        {(() => {
                          const totalDeposit =
                            (agreement.depositA || 0) +
                            (agreement.depositB || 0);
                          const disputeOpener = dispute?.opener;
                          const requestedAmount = dispute?.requestedAmount || 0;

                          // Calculate amounts based on who opened the dispute
                          let amountToA, amountToB;
                          if (disputeOpener === agreement.partyA_address) {
                            // Party A opened dispute
                            amountToA = requestedAmount;
                            amountToB = totalDeposit - requestedAmount;
                          } else {
                            // Party B opened dispute
                            amountToA = totalDeposit - requestedAmount;
                            amountToB = requestedAmount;
                          }

                          return (
                            <>
                              <div className="bg-white rounded-md p-3 border border-green-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                      <span className="text-green-600 font-semibold text-sm">
                                        {partyA?.name?.charAt(0) || "A"}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-800">
                                        {partyA?.name || "Party A"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Received
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">
                                      {amountToA.toFixed(2)} tokens
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-md p-3 border border-green-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-blue-600 font-semibold text-sm">
                                        {partyB?.name?.charAt(0) || "B"}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-800">
                                        {partyB?.name || "Party B"}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Received
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-blue-600">
                                      {amountToB.toFixed(2)} tokens
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-md p-2">
                                <span className="font-medium">
                                  Total Distributed:
                                </span>{" "}
                                {totalDeposit.toFixed(2)} tokens
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {dispute.status === "resolved" && dispute.payoutTxHash && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      🔗 Blockchain Execution
                    </h4>
                    <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <p className="text-sm text-gray-600 mb-2">
                        Transaction executed on Flow EVM Testnet:
                      </p>
                      <a
                        href={`https://evm-testnet.flowscan.io/tx/${dispute.payoutTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        🔍 View Transaction
                        <svg
                          className="ml-1 w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                      <p className="text-xs text-gray-500 mt-2 font-mono break-all">
                        {dispute.payoutTxHash}
                      </p>
                    </div>
                  </div>
                )}

                {dispute.status === "mediated_execution_failed" && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-red-700 mb-3 flex items-center">
                      ⚠️ Execution Status
                    </h4>
                    <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                      <p className="text-red-700 font-medium">
                        Judgment rendered but automated blockchain execution
                        failed.
                      </p>
                      <p className="text-red-600 text-sm mt-1">
                        Manual intervention may be required. Please contact
                        support.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 text-center">
                    This judgment is final and has been recorded on the
                    blockchain. Both parties are legally bound by this decision.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

const ContractViewPage: React.FC = () => {
  const params = useParams();
  const agreementId = params?.id as string;
  const { address, isConnected } = useAccount();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [ipfsContent, setIpfsContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        setIsLoading(true);
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

  useEffect(() => {
    if (!agreement?.cid) return;

    const fetchIpfsContent = async () => {
      try {
        const content = await fetchIpfsContentWithFallback(agreement.cid!);
        setIpfsContent(content);
      } catch (err) {
        console.error("Error fetching IPFS content:", err);
        setIpfsContent("Failed to load IPFS content");
      }
    };

    fetchIpfsContent();
  }, [agreement?.cid]);

  const refetchAgreement = () => {
    if (!agreementId) return;
    const fetchAgreement = async () => {
      try {
        const response = await fetch(`/api/contracts/${agreementId}`);
        const result = await response.json();
        if (result.success) {
          setAgreement(result.agreement);
        }
      } catch (error) {
        console.error("Error refetching agreement:", error);
      }
    };
    fetchAgreement();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading Contract...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
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
  console.log("trying to parse signers", agreement.signersData);
  const signers: ContractSigner[] = parseSignersData(agreement.signersData);
  console.log("full signers", signers);
  const partyA = signers.find((s) => s.role === "creator");
  const partyB = signers.find((s) => s.role === "signer");
  console.log("partyA", partyA);
  console.log("partyB", partyB);
  const latestDispute = agreement.disputes?.[0];

  const canOpenDispute =
    !latestDispute &&
    (address?.toLowerCase() === agreement.partyA_address?.toLowerCase() ||
      address?.toLowerCase() === agreement.partyB_address?.toLowerCase());

  const canRespondToDispute =
    latestDispute &&
    !latestDispute.responder &&
    address &&
    latestDispute.opener.toLowerCase() !== address.toLowerCase() &&
    (address?.toLowerCase() === agreement.partyA_address?.toLowerCase() ||
      address?.toLowerCase() === agreement.partyB_address?.toLowerCase()) &&
    agreement.status === "disputed";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="px-6 py-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {agreement.templateType || "Agreement"}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Created on {formatTimestamp(agreement.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                      agreement.status === "active"
                        ? "bg-green-100 text-green-800"
                        : agreement.status === "disputed"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {agreement.status}
                  </span>
                  {canOpenDispute && (
                    <Link
                      href={`/dispute/${agreement.id}/open`}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                    >
                      Open Dispute
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    Party A (Creator)
                  </h2>
                  <p className="text-gray-600">{partyA?.name}</p>
                  <p className="text-sm text-gray-500">{partyA?.email}</p>
                  {/* {JSON.stringify(agreement)} */}
                  {agreement.partyA && (
                    <AddressDisplay
                      address={agreement.partyA_address}
                      className="text-sm text-gray-500"
                      clipboard
                    />
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    Party B (Signer)
                  </h2>
                  <p className="text-gray-600">{partyB?.name || "N/A"}</p>
                  <p className="text-sm text-gray-500">
                    {partyB?.email || "Not yet signed"}
                  </p>
                  {agreement.partyB_address ? (
                    <AddressDisplay
                      address={agreement.partyB_address}
                      className="text-sm text-gray-500"
                      clipboard
                    />
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Not yet signed
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Contract Details
                </h2>
                <div className="border rounded-lg p-6 bg-gray-50 max-h-[60vh] overflow-y-auto prose max-w-none">
                  {ipfsContent === null ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    </div>
                  ) : ipfsContent === "Failed to load IPFS content" ? (
                    <p className="text-red-500">
                      Failed to load contract content.
                    </p>
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatContractContent(ipfsContent || ""),
                      }}
                    />
                  )}
                </div>
              </div>

              {latestDispute && (
                <DisputeDetails
                  dispute={latestDispute}
                  agreement={agreement}
                  partyA={partyA}
                  partyB={partyB}
                />
              )}

              {canRespondToDispute && address && (
                <DisputeResponseForm
                  agreementId={agreement.id}
                  responderAddress={address}
                  onResponseSubmitted={refetchAgreement}
                />
              )}
            </div>
            {!isConnected && (
              <div className="px-6 py-4 bg-yellow-50 border-t">
                <div className="flex items-center justify-center gap-4">
                  <p className="text-sm text-yellow-800">
                    Connect your wallet to manage your agreements.
                  </p>
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContractViewPage;
