"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

// Simple markdown-to-HTML converter for contract display
const parseMarkdown = (markdown: string): string => {
  if (!markdown) return "";

  let html = markdown
    // Headers with better styling
    .replace(
      /^### (.*$)/gm,
      '<h3 class="text-lg font-semibold text-gray-800 mt-6 mb-3 border-b border-gray-200 pb-2">$1</h3>'
    )
    .replace(
      /^## (.*$)/gm,
      '<h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4 border-b-2 border-gray-300 pb-2">$1</h2>'
    )
    .replace(
      /^# (.*$)/gm,
      '<h1 class="text-2xl font-bold text-gray-800 mt-8 mb-6 border-b-2 border-gray-400 pb-3">$1</h1>'
    )

    // Contract-specific formatting
    .replace(
      /ARTICLE (\d+)/g,
      '<div class="bg-blue-50 px-3 py-1 rounded font-semibold text-blue-800 inline-block mb-2">ARTICLE $1</div>'
    )
    .replace(
      /Section (\d+)/g,
      '<span class="font-semibold text-gray-700">Section $1</span>'
    )

    // Bold and italic
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-semibold text-gray-800">$1</strong>'
    )
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-600">$1</em>')

    // Special contract elements
    .replace(
      /\[SIGNATURE\]/g,
      '<div class="border-t border-gray-400 mt-8 pt-2 text-center text-sm text-gray-600">SIGNATURE LINE</div>'
    )
    .replace(
      /\[DATE\]/g,
      '<div class="border-t border-gray-400 mt-4 pt-2 text-center text-sm text-gray-600">DATE</div>'
    )

    // Highlight any remaining placeholders
    .replace(
      /\{\{([^}]+)\}\}/g,
      '<span class="bg-yellow-100 px-2 py-1 rounded text-orange-800 font-mono text-sm border border-yellow-300">{{$1}}</span>'
    )

    // Contract sections and definitions
    .replace(
      /^(\d+\.\s+[A-Z][A-Z\s]+)$/gm,
      '<div class="mt-6 mb-3 text-lg font-semibold text-blue-800 border-l-4 border-blue-500 pl-3">$1</div>'
    )
    .replace(
      /^([A-Z][A-Z\s]{10,})$/gm,
      '<div class="mt-4 mb-2 text-base font-semibold text-gray-800 uppercase tracking-wide">$1</div>'
    )

    // Lists with better formatting
    .replace(
      /^\* (.*$)/gm,
      '<li class="ml-6 mb-2 relative"><span class="absolute -ml-4 text-blue-600">•</span> $1</li>'
    )
    .replace(
      /^- (.*$)/gm,
      '<li class="ml-6 mb-2 relative"><span class="absolute -ml-4 text-blue-600">•</span> $1</li>'
    )
    .replace(
      /^\d+\. (.*$)/gm,
      '<li class="ml-6 mb-2 pl-2 list-decimal list-inside">$1</li>'
    )

    // Paragraphs and line breaks
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    .replace(/\n/g, "<br/>")

    // Wrap in paragraph tags
    .replace(/^(.+)/, '<p class="mb-4 text-gray-700 leading-relaxed">$1')
    .replace(/(.+)$/, "$1</p>");

  // Clean up any empty paragraphs or malformed tags
  html = html
    .replace(/<p class="mb-4 text-gray-700 leading-relaxed"><\/p>/g, "")
    .replace(/<p class="mb-4 text-gray-700 leading-relaxed"><h/g, "<h")
    .replace(/<p class="mb-4 text-gray-700 leading-relaxed"><div/g, "<div")
    .replace(/<\/h([1-6])><\/p>/g, "</h$1>")
    .replace(/<\/div><\/p>/g, "</div>");

  return html;
};

interface Agreement {
  id: string;
  cid: string;
  templateType: string;
  partyA: string;
  partyB: string | null;
  status: string;
  createdAt: string;
  depositA: number;
  depositB: number;
}

interface SigningData {
  signerName: string;
  signerEmail: string;
  agreeToTerms: boolean;
}

const SignContractPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.id as string;

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [contractContent, setContractContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningStep, setIsSigningStep] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [signingData, setSigningData] = useState<SigningData>({
    signerName: "",
    signerEmail: "",
    agreeToTerms: false,
  });

  // Fetch contract details
  useEffect(() => {
    if (!agreementId) return;

    const fetchContract = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch(`/api/contracts/${agreementId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch contract");
        }
        const result = await response.json();
        setAgreement(result.agreement);
        setContractContent(result.content);
      } catch (error) {
        console.error("Error fetching contract:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load contract"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchContract();
  }, [agreementId]);

  const handleSigningDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSigningData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleReviewStep = () => {
    if (!signingData.signerName.trim() || !signingData.signerEmail.trim()) {
      setErrorMessage("Please fill in your name and email address");
      return;
    }
    setErrorMessage(null);
    setIsSigningStep(true);
  };

  const handleSignContract = async () => {
    if (!signingData.agreeToTerms) {
      setErrorMessage("You must agree to the terms to sign the contract");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/sign-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agreementId,
          signerName: signingData.signerName,
          signerEmail: signingData.signerEmail,
          signatureData: {
            timestamp: new Date().toISOString(),
            // In a real app, you'd collect digital signature data here
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to sign contract");
      }

      // Success - redirect to success page or show success message
      router.push(`/sign/${agreementId}/success`);
    } catch (error) {
      console.error("Error signing contract:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to sign contract"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setIsSigningStep(false);
    setErrorMessage(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !agreement) {
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
            Contract Not Found
          </h1>
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

  if (agreement?.status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="bg-yellow-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Contract Not Available
          </h1>
          <p className="text-gray-600 mb-4">
            This contract is not available for signing. Status:{" "}
            {agreement?.status}
          </p>
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
            Contract Signature Request
          </h1>
          <p className="text-gray-600">
            Please review the contract below and provide your information to
            sign
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  !isSigningStep
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {!isSigningStep ? "1" : "✓"}
              </div>
              <span className="ml-2 text-sm text-gray-600">
                Review Contract
              </span>
            </div>
            <div className="w-16 h-1 bg-gray-300">
              <div
                className={`h-1 transition-all duration-300 ${
                  isSigningStep ? "w-full bg-blue-500" : "w-0"
                }`}
              ></div>
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isSigningStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-300 text-gray-500"
                }`}
              >
                2
              </div>
              <span className="ml-2 text-sm text-gray-600">Sign Contract</span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {!isSigningStep ? (
            // Step 1: Review Contract and Fill Personal Information
            <>
              {/* Contract Content */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Contract Details
                </h2>
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">
                        Contract ID:
                      </span>
                      <p className="text-gray-600 font-mono">{agreement?.id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Contract Type:
                      </span>
                      <p className="text-gray-600">{agreement?.templateType}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Created By:
                      </span>
                      <p className="text-gray-600">{agreement?.partyA}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Created At:
                      </span>
                      <p className="text-gray-600">
                        {agreement?.createdAt
                          ? new Date(agreement.createdAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Party A Deposit:
                      </span>
                      <p className="text-gray-600 font-semibold">
                        ${(agreement?.depositA || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Party B Deposit:
                      </span>
                      <p className="text-gray-600 font-semibold">
                        ${(agreement?.depositB || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto shadow-inner">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">
                    Contract Content
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: parseMarkdown(contractContent),
                      }}
                      className="contract-content space-y-4"
                      style={{
                        fontFamily:
                          'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                        lineHeight: "1.7",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information Form */}
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Your Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="signerName"
                      value={signingData.signerName}
                      onChange={handleSigningDataChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="signerEmail"
                      value={signingData.signerEmail}
                      onChange={handleSigningDataChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your email address"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleReviewStep}
                    className="bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Continue to Sign
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Step 2: Final Signing Step
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Final Step: Sign the Contract
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">
                  Please confirm your details:
                </h3>
                <div className="text-sm text-blue-700">
                  <p>
                    <strong>Name:</strong> {signingData.signerName}
                  </p>
                  <p>
                    <strong>Email:</strong> {signingData.signerEmail}
                  </p>
                  <p>
                    <strong>Your Deposit Commitment:</strong> $
                    {(agreement?.depositB || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-yellow-800 mb-2">
                  💰 Important: Deposit Information
                </h3>
                <div className="text-sm text-yellow-700">
                  <p>
                    By signing this contract, you agree to deposit{" "}
                    <strong>${(agreement?.depositB || 0).toFixed(2)}</strong>{" "}
                    into escrow. This amount will be held securely until the
                    contract terms are fulfilled or the contract is resolved.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={signingData.agreeToTerms}
                    onChange={handleSigningDataChange}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    I have read and understood the contract terms above. I agree
                    to be bound by the terms and conditions set forth in this
                    contract. By checking this box and clicking "Sign Contract"
                    below, I am providing my electronic signature to this
                    agreement.
                  </span>
                </label>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex justify-between">
                  <button
                    onClick={handleBack}
                    className="bg-gray-300 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSignContract}
                    disabled={isSubmitting || !signingData.agreeToTerms}
                    className={`py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSubmitting || !signingData.agreeToTerms
                        ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Signing...
                      </span>
                    ) : (
                      "Sign Contract"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignContractPage;
