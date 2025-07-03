"use client";

import { formatContractContent } from "@/lib/contract-formatter";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";

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
}

interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "creator" | "signer";
  status: "pending" | "signed" | "declined";
  depositAmount: number;
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

const ContractViewPage: React.FC = () => {
  const params = useParams();
  const agreementId = params?.id as string;
  const { isConnected } = useAccount();

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
  const signers: ContractSigner[] = agreement.signersData
    ? JSON.parse(agreement.signersData)
    : [];
  const partyA = signers.find((s) => s.role === "creator");
  const partyB = signers.find((s) => s.role === "signer");

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
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      agreement.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {agreement.status}
                  </span>
                  {agreement.status === "active" && (
                    <Link
                      href={`/dispute/${agreement.id}`}
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
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    Party B (Signer)
                  </h2>
                  <p className="text-gray-600">{partyB?.name || "N/A"}</p>
                  <p className="text-sm text-gray-500">
                    {partyB?.email || "Not yet signed"}
                  </p>
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
