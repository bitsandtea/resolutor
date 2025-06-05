"use client";

import React, { ChangeEvent } from "react";
import { ContractDefinition, ContractFormData, FormField } from "../types";

interface ContractFormStepProps {
  currentDefinition: ContractDefinition | null;
  formFields: FormField[];
  formData: ContractFormData;
  contractName: string;
  inputBaseClasses: string;
  isLoading: boolean;
  errorMessage: string | null;
  onContractNameChange: (value: string) => void;
  onFormFieldChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onSubmit: () => void;
  selectedDefinitionFilename: string | null; // Added to display in this component
}

const ContractFormStep: React.FC<ContractFormStepProps> = ({
  currentDefinition,
  formFields,
  formData,
  contractName,
  inputBaseClasses,
  isLoading,
  errorMessage,
  onContractNameChange,
  onFormFieldChange,
  onSubmit,
  selectedDefinitionFilename,
}) => {
  const renderFormFieldInternal = (field: FormField) => {
    console.log("Rendering field", field);
    const commonProps = {
      name: field.id,
      id: field.id,
      onChange: onFormFieldChange,
      key: field.id,
    };

    // if (field.isSectionHeader) {
    //   return (
    //     <div key={field.id} className="mt-6 mb-3">
    //       <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
    //         {field.label}
    //       </h3>
    //       {field.originalLine && (
    //         <p className="text-sm text-gray-500 mt-1">{field.originalLine}</p>
    //       )}
    //     </div>
    //   );
    // }

    if (field.dependsOn) {
      const dependentFieldId = field.dependsOn.placeholderId;
      const dependentValue = formData[dependentFieldId];
      let conditionMet = false;
      if (field.dependsOn.condition === "notEquals") {
        conditionMet = dependentValue !== field.dependsOn.value;
      } else if (
        field.dependsOn.condition === "contains" &&
        typeof dependentValue === "string" &&
        typeof field.dependsOn.value === "string"
      ) {
        conditionMet = dependentValue.includes(field.dependsOn.value);
      } else {
        conditionMet = dependentValue === field.dependsOn.value;
      }
      if (!conditionMet) return null;
    }

    const labelAndDescription = (
      <label
        htmlFor={field.id}
        className="block mb-1 font-semibold text-gray-700 text-sm"
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        {field.description && (
          <p className="text-xs text-gray-500 font-normal mt-0.5">
            {field.description}
          </p>
        )}
      </label>
    );

    switch (field.type) {
      case "text":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <input
              type="text"
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              className={inputBaseClasses}
              placeholder={field.placeholderText}
              required={field.required}
            />
          </div>
        );
      case "number":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <input
              type="number"
              {...commonProps}
              value={(formData[field.id] as number) || ""}
              className={inputBaseClasses}
              placeholder={field.placeholderText}
              required={field.required}
            />
          </div>
        );
      case "date":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <input
              type="date"
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              className={inputBaseClasses}
              required={field.required}
            />
          </div>
        );
      case "textarea":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <textarea
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              rows={3}
              className={`${inputBaseClasses} min-h-[80px] resize-y`}
              placeholder={field.placeholderText}
              required={field.required}
            ></textarea>
          </div>
        );
      case "checkbox":
        return (
          <div key={field.id} className="mb-4 flex items-center">
            <input
              type="checkbox"
              {...commonProps}
              checked={(formData[field.id] as boolean) || false}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mr-2"
              required={field.required && !(formData[field.id] as boolean)}
            />
            <label
              htmlFor={field.id}
              className="font-medium text-gray-700 text-sm"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 ml-2">
                ({field.description})
              </p>
            )}
          </div>
        );
      case "select":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <select
              {...commonProps}
              value={(formData[field.id] as string) || ""}
              className={inputBaseClasses}
              required={field.required}
            >
              <option value="" disabled={field.required}>
                Select {field.label.toLowerCase()}
              </option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );
      case "radio":
        return (
          <div key={field.id} className="mb-4">
            {labelAndDescription}
            <div className="mt-1 space-y-1">
              {field.options?.map((opt) => (
                <div
                  key={`${field.id}_${opt.value}`}
                  className="flex items-center"
                >
                  <input
                    type="radio"
                    id={`${field.id}_${opt.value}`}
                    name={field.id} // Group name is the field.id
                    value={opt.value}
                    checked={formData[field.id] === opt.value}
                    onChange={onFormFieldChange} // Ensure this is correct
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 mr-2"
                    required={field.required && !formData[field.id]}
                  />
                  <label
                    htmlFor={`${field.id}_${opt.value}`}
                    className="text-sm font-medium text-gray-700"
                  >
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      default:
      // return (
      //   <div key={field.id} className="text-red-500">
      //     Unsupported field type: {field.type} for {field.label}
      //   </div>
      // );
    }
  };

  if (isLoading && !currentDefinition) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          Loading contract details for {selectedDefinitionFilename}...
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  // This case might be redundant if the parent handles it before rendering this component,
  // but included for robustness of the component itself.
  if (!currentDefinition && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-red-500 text-lg">
          Failed to load contract details. Please try selecting a contract
          again.
        </p>
        {/* Consider a way to trigger going back to selection from here, or rely on parent for this action */}
      </div>
    );
  }

  if (!currentDefinition) return null; // Should not happen if parent logic is correct
  console.log("Form Fields", formFields);
  return (
    <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
      <p className="text-lg text-gray-600 mb-2">
        Selected Contract:{" "}
        <span className="font-semibold">
          {currentDefinition.templateMeta.title}
        </span>
      </p>
      <p className="text-sm text-gray-500 mb-8">
        Definition: {selectedDefinitionFilename}
      </p>

      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}

      <div className="mb-6">
        <label
          htmlFor="contractName"
          className="block mb-2 font-semibold text-gray-700 text-sm"
        >
          Contract Name (for generated file):
        </label>
        <input
          type="text"
          id="contractName"
          value={contractName}
          onChange={(e) => onContractNameChange(e.target.value)}
          placeholder="e.g., MyRentalAgreement_Jan2024"
          className={inputBaseClasses}
        />
      </div>

      <h2 className="text-2xl font-semibold mb-6 mt-8 text-gray-800 border-b pb-3">
        Fill Contract Details
      </h2>
      {formFields.length > 0 ? (
        formFields.map((field) => renderFormFieldInternal(field))
      ) : (
        <p className="text-gray-500">
          No placeholders found in the selected contract definition, or form is
          still loading.
        </p>
      )}

      <button
        onClick={onSubmit}
        className="bg-blue-600 text-white py-3 px-5 rounded-md cursor-pointer text-lg transition-colors duration-200 ease-in-out w-full mt-6 hover:bg-blue-700 disabled:opacity-50"
        disabled={isLoading || !currentDefinition}
      >
        {isLoading ? "Generating..." : "Generate & Save Contract"}
      </button>
    </div>
  );
};

export default ContractFormStep;
