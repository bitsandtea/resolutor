"use client";

import React from "react";

interface ContractDefinition {
  filename: string;
  name: string;
  description?: string;
}

interface ContractSelectionStepProps {
  availableDefinitions: { filename: string; name: string }[];
  onSelectDefinition: (filename: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const ContractSelectionStep: React.FC<ContractSelectionStepProps> = ({
  availableDefinitions,
  onSelectDefinition,
  isLoading,
  errorMessage,
}) => {
  // Static contract definitions with descriptions
  const staticContracts: ContractDefinition[] = [
    {
      filename: "serviceAgreement",
      name: "Service Agreement",
      description:
        "Professional services contract for freelancers and consultants with payment terms and deliverables",
    },
    {
      filename: "nda",
      name: "Non-Disclosure Agreement",
      description:
        "Confidentiality agreement to protect sensitive information shared between parties",
    },
    {
      filename: "employmentContract",
      name: "Employment Contract",
      description:
        "Full-time employment agreement with salary, benefits, and terms of employment",
    },
    {
      filename: "purchaseAgreement",
      name: "Purchase Agreement",
      description:
        "Contract for buying and selling goods with payment and delivery terms",
    },
    {
      filename: "partnershipAgreement",
      name: "Partnership Agreement",
      description:
        "Business partnership contract defining roles, responsibilities, and profit sharing",
    },
  ];

  // Add descriptions to existing contracts
  const getDescriptionForContract = (filename: string): string | undefined => {
    switch (filename) {
      case "rentalLeaseDefinition":
        return "Residential or commercial property rental agreement with lease terms and conditions";
      case "freelanceContract.definition.json":
        return "Independent contractor agreement for project-based work with deliverables and payment terms";
      default:
        return undefined;
    }
  };

  // Combine static contracts with dynamic ones
  const allContracts: ContractDefinition[] = [
    ...staticContracts,
    ...availableDefinitions.map((def) => ({
      ...def,
      description: getDescriptionForContract(def.filename),
    })),
  ];

  if (isLoading && availableDefinitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">Loading available contracts...</p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full p-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-6">
        Select a Contract Template
      </h1>
      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
      {allContracts.length === 0 && !isLoading && (
        <p className="text-gray-600">No contract definitions found.</p>
      )}
      {allContracts.length > 0 && (
        <ul className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-lg">
          {allContracts.map((contract) => (
            <li key={contract.filename} className="mb-4">
              <button
                onClick={() => onSelectDefinition(contract.filename)}
                className="w-full text-left py-4 px-4 bg-gray-100 hover:bg-blue-500 hover:text-white rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <div className="font-semibold text-lg">{contract.name}</div>
                {contract.description && (
                  <div className="text-sm text-gray-600 hover:text-blue-100 mt-1">
                    {contract.description}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ContractSelectionStep;
