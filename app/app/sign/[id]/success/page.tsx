"use client";

import { useParams, useRouter } from "next/navigation";
import React from "react";

const SigningSuccessPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-6">
              <svg
                className="w-16 h-16 text-green-600"
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
          </div>

          {/* Success Message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-800">
              Contract Signed Successfully! 🎉
            </h1>
            <p className="text-lg text-gray-600">
              Thank you for signing the contract. Your signature has been
              recorded and all parties will be notified.
            </p>
          </div>

          {/* Contract Details */}
          <div className="bg-white p-6 rounded-lg shadow-md mt-8 text-left">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              What happens next?
            </h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>
                  All parties have been notified of your signature via email
                </span>
              </div>
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>The contract is now active and legally binding</span>
              </div>
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>
                  You can access this contract anytime using the contract ID
                </span>
              </div>
            </div>
          </div>

          {/* Contract ID */}
          {agreementId && (
            <div className="bg-blue-50 p-4 rounded-lg mt-6">
              <p className="text-sm text-blue-700 mb-2">
                <strong>Contract ID for your records:</strong>
              </p>
              <p className="text-blue-800 font-mono text-sm break-all">
                {agreementId}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={() => router.push("/")}
              className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push(`/contract/${agreementId}`)}
              className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              View Contract
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              A copy of this signed contract has been stored securely on IPFS.
              If you have any questions, please contact the contract creator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SigningSuccessPage;
