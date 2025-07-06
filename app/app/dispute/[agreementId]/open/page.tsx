"use client";
import { AgreementFactoryABI } from "@/lib/ABIs";
import { STEP_CHAIN_REQUIREMENTS } from "@/lib/chain-config";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { parseEther, stringToHex } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import Footer from "../../../../components/Footer";
import Header from "../../../../components/Header";
import FilePreview from "../../../components/dispute/FilePreview";

interface AgreementData {
  id: string;
  depositA: number;
  depositB: number;
  partyA_address: string;
  partyB_address: string;
  flowContractAddr: string;
}

const OpenDisputePage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const agreementId = params.agreementId as string;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [summary, setSummary] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (!agreementId) return;

    const fetchAgreement = async () => {
      try {
        const response = await fetch(`/api/contracts/${agreementId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch agreement details.");
        }
        const data = await response.json();
        if (data.success) {
          setAgreement(data.agreement);
        } else {
          throw new Error(data.error || "Could not load agreement.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgreement();
  }, [agreementId]);

  const totalDeposit = agreement
    ? (agreement.depositA || 0) + (agreement.depositB || 0)
    : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (evidenceFiles.length + newFiles.length > 3) {
        setError("You can upload a maximum of 3 files.");
        return;
      }
      setEvidenceFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setEvidenceFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    // Clear the file input and reset its key to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFileInputKey((prev) => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementId || !address || !agreement) {
      setError("Agreement ID or user address not found.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const requiredChainId = STEP_CHAIN_REQUIREMENTS.flow_deploy;
      if (!requiredChainId || chain?.id !== requiredChainId) {
        switchChain?.({ chainId: requiredChainId as any });
        throw new Error(`Please switch to the correct network.`);
      }

      const parsedAmountA = parseFloat(amountA || "0");
      const parsedAmountB = parseFloat(amountB || "0");

      if (parsedAmountA + parsedAmountB > totalDeposit) {
        throw new Error(
          "The sum of proposed amounts cannot exceed the total deposit."
        );
      }

      // 1. Smart contract call
      const agreementIdBytes = stringToHex(agreementId, { size: 32 });
      const amountToABigInt = parseEther(amountA || "0");
      const amountToBBigInt = parseEther(amountB || "0");

      if (!agreement.flowContractAddr) {
        throw new Error("Flow contract address not found for this agreement.");
      }

      const autoApproveResolution = true;

      const txHash = await writeContractAsync({
        address: agreement.flowContractAddr as `0x${string}`,
        abi: AgreementFactoryABI,
        functionName: "openDisputeAndPropose",
        args: [
          agreementIdBytes,
          amountToABigInt,
          amountToBBigInt,
          autoApproveResolution,
        ],
      });

      // 2. Upload evidence (if any)
      let evidenceCids: string[] = [];
      if (evidenceFiles.length > 0) {
        const formData = new FormData();
        evidenceFiles.forEach((file) => {
          formData.append("files", file);
        });
        formData.append("agreementId", agreementId);

        const uploadResponse = await fetch("/api/upload-evidence", {
          method: "POST",
          body: formData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload evidence.");
        }
        evidenceCids = uploadResult.cids;
      }

      // 3. Update database via API
      const disputeResponse = await fetch("/api/dispute/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          openerAddr: address,
          summary,
          evidenceCids,
          requestedAmount: parsedAmountA + parsedAmountB,
          txHash, // Include dispute opening transaction hash
          autoApproved: autoApproveResolution, // Include auto-approval flag
        }),
      });

      const disputeResult = await disputeResponse.json();
      if (!disputeResponse.ok || !disputeResult.success) {
        throw new Error(disputeResult.error || "Failed to open dispute.");
      }

      router.push(`/contract/${agreementId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            Error: {error}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full">
            <ConnectButton />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-8 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Open a Dispute
            </h1>
            <p className="text-gray-600 mb-6">
              For agreement:{" "}
              <code className="bg-gray-100 text-sm p-1 rounded">
                {agreementId}
              </code>
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="summary"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Summary of Dispute
                  </label>
                  <textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    rows={6}
                    required
                    minLength={10}
                    maxLength={2000}
                    placeholder="Clearly explain the reason for the dispute, what outcome you are seeking, and why."
                  />
                </div>

                <div>
                  <label
                    htmlFor="evidence"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Supporting Evidence (Up to 3 files)
                  </label>
                  <input
                    type="file"
                    id="evidence"
                    ref={fileInputRef}
                    key={fileInputKey}
                    onChange={handleFileChange}
                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.txt"
                  />
                  {evidenceFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      {evidenceFiles.map((file, i) => (
                        <FilePreview
                          key={i}
                          file={file}
                          onRemove={() => handleRemoveFile(i)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-6 space-y-4">
                  <p className="text-sm font-medium text-gray-700">
                    Proposed Payout
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="amountA"
                        className="block text-xs font-medium text-gray-600"
                      >
                        Amount for Party A ({agreement?.partyA_address})
                        {address === agreement?.partyA_address && (
                          <span className="text-blue-600 font-semibold">
                            {" "}
                            (your address)
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        id="amountA"
                        value={amountA}
                        onChange={(e) => setAmountA(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="amountB"
                        className="block text-xs font-medium text-gray-600"
                      >
                        Amount for Party B ({agreement?.partyB_address})
                        {address === agreement?.partyB_address && (
                          <span className="text-blue-600 font-semibold">
                            {" "}
                            (your address)
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        id="amountB"
                        value={amountB}
                        onChange={(e) => setAmountB(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      Total Proposed:{" "}
                      {(
                        parseFloat(amountA || "0") + parseFloat(amountB || "0")
                      ).toFixed(2)}{" "}
                      tokens
                    </p>
                    <p>Total available from deposits: {totalDeposit} tokens.</p>
                  </div>
                  {parseFloat(amountA || "0") + parseFloat(amountB || "0") >
                    totalDeposit && (
                    <p className="text-xs text-red-600">
                      Warning: The sum of the proposed amounts exceeds the total
                      deposit.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8 border-t pt-6">
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isConnected || isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OpenDisputePage;
