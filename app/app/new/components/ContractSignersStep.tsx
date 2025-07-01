"use client";

import { ContractSigner } from "@/types";
import React, { useState } from "react";

interface ContractSignersStepProps {
  signers: ContractSigner[];
  onSignersChange: (signers: ContractSigner[]) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
  inputBaseClasses: string;
}

const ContractSignersStep: React.FC<ContractSignersStepProps> = ({
  signers,
  onSignersChange,
  onNext,
  onBack,
  isLoading,
  inputBaseClasses,
}) => {
  const [newSignerName, setNewSignerName] = useState("Michael Davis");
  const [newSignerEmail, setNewSignerEmail] = useState(
    "michael.davis@company.com"
  );
  const [newSignerDeposit, setNewSignerDeposit] = useState<number>(1000);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Wallet address validation function
  const validateWalletAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  };

  // Validate signer data
  const validateSigner = (signer: ContractSigner): string[] => {
    const errors: string[] = [];

    if (!signer.name || signer.name.trim().length === 0) {
      errors.push("Name is required");
    }

    if (!signer.email || signer.email.trim().length === 0) {
      errors.push("Email or wallet address is required");
    } else {
      const trimmedEmail = signer.email.trim();
      if (
        !validateEmail(trimmedEmail) &&
        !validateWalletAddress(trimmedEmail)
      ) {
        errors.push("Must be a valid email address or wallet address (0x...)");
      }
    }

    return errors;
  };

  // Validate all signers and update errors
  const validateAllSigners = () => {
    const errors: Record<string, string> = {};

    signers.forEach((signer) => {
      const signerErrors = validateSigner(signer);
      if (signerErrors.length > 0) {
        errors[signer.id] = signerErrors.join(", ");
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addSigner = () => {
    // Validate new signer before adding
    const tempSigner: ContractSigner = {
      id: "temp",
      name: newSignerName.trim(),
      email: newSignerEmail.trim(),
      role: "signer",
      status: "pending",
      depositAmount: newSignerDeposit,
    };

    const errors = validateSigner(tempSigner);
    if (errors.length > 0) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return;
    }

    const newSigner: ContractSigner = {
      id: Date.now().toString(),
      name: newSignerName.trim(),
      email: newSignerEmail.trim(),
      role: "signer",
      status: "pending",
      depositAmount: newSignerDeposit,
    };

    onSignersChange([...signers, newSigner]);
    setNewSignerName("Another Signer");
    setNewSignerEmail("signer@email.com");
    setNewSignerDeposit(500);
  };

  const removeSigner = (signerId: string) => {
    onSignersChange(signers.filter((s) => s.id !== signerId));
  };

  const updateSigner = (
    signerId: string,
    field: keyof ContractSigner,
    value: string | number
  ) => {
    onSignersChange(
      signers.map((s) => (s.id === signerId ? { ...s, [field]: value } : s))
    );
  };

  const otherSigners = signers.filter((s) => s.role !== "creator");
  const creatorSigner = signers.find((s) => s.role === "creator");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Contract Signers & Deposits
        </h2>
        <p className="text-gray-600 mb-2">
          Configure who needs to sign this contract and their deposit amounts
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium">💡 About Deposit Amounts:</p>
          <p>
            Deposit amounts represent the financial commitment each party makes
            to the contract. These amounts will be held in escrow until the
            contract is fulfilled or resolved.
          </p>
        </div>
      </div>

      {/* Creator Information */}
      {creatorSigner && (
        <div className="bg-blue-50 p-4 rounded border">
          <h3 className="font-medium text-gray-800 mb-3 flex items-center">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
              CREATOR
            </span>
            Contract Creator (You)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={creatorSigner.name}
                onChange={(e) =>
                  updateSigner(creatorSigner.id, "name", e.target.value)
                }
                className={inputBaseClasses}
                placeholder="e.g., John Smith"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email / Wallet Address
              </label>
              <input
                type="text"
                value={creatorSigner.email}
                onChange={(e) => {
                  updateSigner(creatorSigner.id, "email", e.target.value);
                  // Clear validation error when user starts typing
                  if (validationErrors[creatorSigner.id]) {
                    const newErrors = { ...validationErrors };
                    delete newErrors[creatorSigner.id];
                    setValidationErrors(newErrors);
                  }
                }}
                onBlur={() => {
                  // Validate on blur
                  const errors = validateSigner(creatorSigner);
                  if (errors.length > 0) {
                    setValidationErrors((prev) => ({
                      ...prev,
                      [creatorSigner.id]: errors.join(", "),
                    }));
                  }
                }}
                className={`${inputBaseClasses} ${
                  validationErrors[creatorSigner.id] ? "border-red-500" : ""
                }`}
                placeholder="john.smith@company.com or 0x..."
                required
              />
              {validationErrors[creatorSigner.id] && (
                <p className="mt-1 text-sm text-red-600">
                  {validationErrors[creatorSigner.id]}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deposit Amount (USD)
              </label>
              <input
                type="number"
                value={creatorSigner.depositAmount || 0}
                onChange={(e) =>
                  updateSigner(
                    creatorSigner.id,
                    "depositAmount",
                    parseFloat(e.target.value) || 0
                  )
                }
                className={inputBaseClasses}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>
      )}

      {/* Other Signers */}
      {otherSigners.length > 0 && (
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-medium text-gray-800 mb-3">Other Signers</h3>
          <div className="space-y-3">
            {otherSigners.map((signer) => (
              <div key={signer.id} className="bg-white p-3 rounded border">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) =>
                        updateSigner(signer.id, "name", e.target.value)
                      }
                      className={inputBaseClasses}
                      placeholder="e.g., Sarah Johnson"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email / Wallet Address
                    </label>
                    <input
                      type="text"
                      value={signer.email}
                      onChange={(e) => {
                        updateSigner(signer.id, "email", e.target.value);
                        // Clear validation error when user starts typing
                        if (validationErrors[signer.id]) {
                          const newErrors = { ...validationErrors };
                          delete newErrors[signer.id];
                          setValidationErrors(newErrors);
                        }
                      }}
                      onBlur={() => {
                        // Validate on blur
                        const errors = validateSigner(signer);
                        if (errors.length > 0) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            [signer.id]: errors.join(", "),
                          }));
                        }
                      }}
                      className={`${inputBaseClasses} ${
                        validationErrors[signer.id] ? "border-red-500" : ""
                      }`}
                      placeholder="sarah.johnson@email.com or 0x..."
                    />
                    {validationErrors[signer.id] && (
                      <p className="mt-1 text-sm text-red-600">
                        {validationErrors[signer.id]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deposit Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={signer.depositAmount || 0}
                      onChange={(e) =>
                        updateSigner(
                          signer.id,
                          "depositAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className={inputBaseClasses}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeSigner(signer.id)}
                    className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
                  >
                    Remove Signer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Signer */}
      {otherSigners.length === 0 && (
        <div className="bg-yellow-50 p-4 rounded border border-yellow-300">
          <h4 className="font-medium text-gray-800 mb-3">
            ⚠️ No Other Signers Added
          </h4>
          <p className="text-sm text-yellow-700 mb-3">
            Most contracts require at least two parties. Add a second signer
            below, or proceed to create a single-party contract.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                className={inputBaseClasses}
                placeholder="e.g., Michael Davis"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email / Wallet Address
              </label>
              <input
                type="text"
                value={newSignerEmail}
                onChange={(e) => setNewSignerEmail(e.target.value)}
                className={inputBaseClasses}
                placeholder="michael.davis@company.com or 0x..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deposit Amount (USD)
              </label>
              <input
                type="number"
                value={newSignerDeposit}
                onChange={(e) =>
                  setNewSignerDeposit(parseFloat(e.target.value) || 0)
                }
                className={inputBaseClasses}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={addSigner}
            className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
          >
            Add Signer
          </button>
        </div>
      )}

      {/* Coming Soon for Multiple Signers */}
      {otherSigners.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Note:</strong> Multiple signers functionality is coming
                soon. For now, you can add one additional signer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 disabled:opacity-50 font-medium"
        >
          Back to Form
        </button>
        <button
          type="button"
          onClick={() => {
            if (validateAllSigners()) {
              // Show confirmation for single-party contracts
              if (otherSigners.length === 0) {
                const confirmed = confirm(
                  "This means only you will sign this contract. Is this correct?\n\n" +
                    "Click OK to proceed with single-party contract, or Cancel to add more signers."
                );
                if (!confirmed) {
                  return;
                }
              }
              onNext();
            } else {
              alert("Please fix validation errors before proceeding");
            }
          }}
          disabled={
            isLoading ||
            !creatorSigner?.name ||
            !creatorSigner?.email ||
            otherSigners.some((s) => !s.name || !s.email)
          }
          className={`py-3 px-6 rounded-lg font-medium disabled:opacity-50 ${
            otherSigners.length === 0
              ? "bg-yellow-600 text-white hover:bg-yellow-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isLoading
            ? "Creating & Signing..."
            : otherSigners.length === 0
            ? "Create & Sign Agreement"
            : "Create & Sign Agreement"}
        </button>
      </div>
    </div>
  );
};

export default ContractSignersStep;
