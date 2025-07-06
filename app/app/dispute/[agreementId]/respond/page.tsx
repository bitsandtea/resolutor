"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import Footer from "../../../../components/Footer";
import Header from "../../../../components/Header";

interface DisputeData {
  id: string;
  openerSummary: string;
  openerEvidenceCids: string[];
  agreement: {
    id: string;
    partyA_address: string;
    partyB_address: string;
    flowContractAddr: string;
  };
}

const RespondToDisputePage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const agreementId = params.agreementId as string;

  const [dispute, setDispute] = useState<DisputeData | null>(null);
  const [summary, setSummary] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!agreementId) return;

    const fetchDispute = async () => {
      try {
        const response = await fetch(`/api/dispute/${agreementId}`); // This API needs to be created
        if (!response.ok) {
          throw new Error("Failed to fetch dispute details.");
        }
        const data = await response.json();
        if (data.success) {
          setDispute(data.dispute);
        } else {
          throw new Error(data.error || "Could not load dispute.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDispute();
  }, [agreementId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (e.target.files.length > 3) {
        setError("You can upload a maximum of 3 files.");
        setEvidenceFiles([]);
        e.target.value = ""; // Reset the input
        return;
      }
      setEvidenceFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementId || !address || !dispute) {
      setError("Dispute ID or user address not found.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      // For responding, we might not need an immediate on-chain transaction,
      // just updating the DB with evidence. The on-chain part could be separate
      // (approving or proposing a new resolution).

      // 1. Upload evidence (if any)
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

      // 2. Update database via API
      const disputeResponse = await fetch("/api/dispute/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          responderAddr: address,
          summary,
          evidenceCids,
        }),
      });

      const disputeResult = await disputeResponse.json();
      if (!disputeResponse.ok || !disputeResult.success) {
        throw new Error(disputeResult.error || "Failed to respond to dispute.");
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

  if (error && !dispute) {
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
              Respond to Dispute
            </h1>
            <p className="text-gray-600 mb-6">
              For agreement:{" "}
              <code className="bg-gray-100 text-sm p-1 rounded">
                {agreementId}
              </code>
            </p>

            <div className="mb-6 border-l-4 border-yellow-400 pl-4">
              <h2 className="text-lg font-semibold">Original Dispute Claim</h2>
              <p className="text-gray-700 mt-2">{dispute?.openerSummary}</p>
              {dispute?.openerEvidenceCids &&
                dispute.openerEvidenceCids.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-sm font-medium">Evidence:</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {dispute.openerEvidenceCids.map((cid) => (
                        <li key={cid}>
                          <a
                            href={`https://ipfs.io/ipfs/${cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {cid}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

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
                    Your Response
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
                    placeholder="Clearly explain your response to the dispute."
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
                    multiple
                    onChange={handleFileChange}
                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload any relevant documents, images, or other files. Max 3
                    files.
                  </p>
                  {evidenceFiles.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      <p>Selected files:</p>
                      <ul className="list-disc pl-5">
                        {evidenceFiles.map((file, i) => (
                          <li key={i}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
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
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Response"}
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

export default RespondToDisputePage;
