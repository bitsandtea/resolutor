"use client";

import React from "react";

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
      {availableDefinitions.length === 0 && !isLoading && (
        <p className="text-gray-600">No contract definitions found.</p>
      )}
      {availableDefinitions.length > 0 && (
        <ul className="w-full max-w-md bg-white p-6 rounded-lg shadow-lg">
          {availableDefinitions.map((def) => (
            <li key={def.filename} className="mb-3">
              <button
                onClick={() => onSelectDefinition(def.filename)}
                className="w-full text-left py-3 px-4 bg-gray-100 hover:bg-blue-500 hover:text-white rounded-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {def.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ContractSelectionStep;
