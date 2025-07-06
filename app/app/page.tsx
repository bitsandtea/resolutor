"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Footer from "../components/Footer";
import Header from "../components/Header";

interface ProjectData {
  id: string;
  name: string;
  status: string;
  deposits: {
    total: number;
    depositA: number;
    depositB: number;
    depositAPaid: boolean;
    depositBPaid: boolean;
  };
  created: string;
  currentStep: string;
  processStatus: string;
  partyA: string;
  partyB: string | null;
  partyA_address: string | null;
  partyB_address: string | null;
}

const Dashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch agreements for the connected wallet
  useEffect(() => {
    if (!isConnected || !address) {
      setProjects([]);
      return;
    }

    const fetchAgreements = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/agreements?address=${address}`);
        if (!response.ok) {
          throw new Error("Failed to fetch agreements");
        }

        const data = await response.json();
        if (data.success) {
          setProjects(data.agreements);
        } else {
          throw new Error(data.error || "Failed to load agreements");
        }
      } catch (err) {
        console.error("Error fetching agreements:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load projects"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgreements();
  }, [address, isConnected]);

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status.toLowerCase()) {
      case "active":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "pending":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "disputed":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "resolved":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDeposits = (deposits: ProjectData["deposits"]) => {
    const total = deposits.total;
    const paidCount =
      (deposits.depositAPaid ? 1 : 0) + (deposits.depositBPaid ? 1 : 0);
    const totalCount =
      (deposits.depositA > 0 ? 1 : 0) + (deposits.depositB > 0 ? 1 : 0);

    return (
      <div className="text-sm">
        <div className="font-medium">{total} tokens</div>
        <div className="text-gray-500">
          {paidCount}/{totalCount} paid
        </div>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrentStep = (step: string, processStatus: string) => {
    return (
      <div className="text-sm">
        <div className="font-medium">{step}</div>
        <div className="text-gray-500">{processStatus}</div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              Welcome to Resolutor
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to view your projects and agreements
            </p>
            <ConnectButton />
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Projects</h1>
            <p className="text-gray-600">
              Manage your agreements and contracts
            </p>
          </div>
          <div className="flex gap-4">
            <ConnectButton />
            <Link
              href="/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              New Contract
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Error: {error}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No projects found
            </h3>
            <p className="text-gray-600 mb-4">
              You haven't created or joined any agreements yet.
            </p>
            <Link
              href="/new"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create your first contract
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Parties
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Deposits
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Current Step
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <Link
                        href={`/contract/${project.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      <div>
                        <strong>A:</strong>{" "}
                        {project.partyA_address || project.partyA}
                      </div>
                      <div>
                        <strong>B:</strong>{" "}
                        {project.partyB_address || project.partyB || "N/A"}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={getStatusBadge(project.status)}>
                        {project.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {formatDeposits(project.deposits)}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {formatDate(project.created)}
                    </td>
                    <td className="py-4 px-4">
                      {formatCurrentStep(
                        project.currentStep,
                        project.processStatus
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/contract/${project.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View
                        </Link>
                        {project.status === "active" && (
                          <Link
                            href={`/dispute/${project.id}/open`}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Open Dispute
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
