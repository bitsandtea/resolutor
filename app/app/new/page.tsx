"use client";

import { rentalLeaseDefinition } from "@/contracts/defined";
import React, { ChangeEvent, useEffect, useState } from "react";
import ContractFormStep from "./components/ContractFormStep";
import ContractSelectionStep from "./components/ContractSelectionStep";
import { ContractDefinition, ContractFormData, FormField } from "./types";

// --- START: Type Definitions ---
// Removed local type definitions as they are now imported
// --- END: Type Definitions ---

// type ContractFormData = Record<string, string | number | boolean | undefined>; // Also removed, part of imported types

const NewContractPage: React.FC = () => {
  const [uiStep, setUiStep] = useState<
    "selectContract" | "fillForm" | "generating"
  >("selectContract");
  const [availableDefinitions, setAvailableDefinitions] = useState<
    { filename: string; name: string }[]
  >([]);
  const [selectedDefinitionFilename, setSelectedDefinitionFilename] = useState<
    string | null
  >(null);
  const [currentDefinition, setCurrentDefinition] =
    useState<ContractDefinition | null>(null);

  const [contractName, setContractName] = useState<string>("MyContract");
  const [templateOriginalContent, setTemplateOriginalContent] =
    useState<string>("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<ContractFormData>({});
  const [isLoading, setIsLoading] = useState<boolean>(false); // Initially false, true during async ops
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effect to fetch available contract definitions
  useEffect(() => {
    const fetchDefinitions = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const definitions = [
          {
            filename: "rentalLeaseDefinition",
            name: "Rental Lease",
          },
          {
            filename: "freelanceContract.definition.json",
            name: "Freelance Contract",
          },
        ];
        setAvailableDefinitions(definitions);
      } catch (error) {
        console.error("Error setting contract definitions:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load contract definitions."
        );
        setAvailableDefinitions([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefinitions();
  }, []);

  // Effect to load selected definition and its template
  useEffect(() => {
    if (!selectedDefinitionFilename) {
      setCurrentDefinition(null);
      setTemplateOriginalContent("");
      setFormFields([]);
      setFormData({});
      return;
    }

    const loadDefinitionAndTemplate = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Fetch the definition JSON using the filename
        let definitionData: ContractDefinition;
        if (selectedDefinitionFilename === "rentalLeaseDefinition") {
          definitionData = rentalLeaseDefinition as ContractDefinition;
        } else {
          // TODO: replace with actual definition
          definitionData = rentalLeaseDefinition as ContractDefinition;
          // const definitionData = await import(
          //   `../../contracts/defined/${selectedDefinitionFilename}`
          // );
        }
        setCurrentDefinition(definitionData);
        if (
          definitionData.templateMeta &&
          definitionData.templateMeta.templateFile
        ) {
          const templatePath =
            definitionData.templateMeta.templateFile.startsWith("/")
              ? definitionData.templateMeta.templateFile
              : `/${definitionData.templateMeta.templateFile}`;

          const templateResponse = await fetch(templatePath);
          if (!templateResponse.ok) {
            throw new Error(
              `Failed to fetch template ${templatePath}: ${templateResponse.statusText}`
            );
          }
          const templateText = await templateResponse.text();
          setTemplateOriginalContent(templateText);

          // Call the new parser function
          parseContractDefinition(definitionData);

          if (definitionData.templateMeta.title) {
            setContractName(
              definitionData.templateMeta.title.replace(/\s+/g, "_") + "_Filled"
            );
          }
        } else {
          throw new Error("Template file path not specified in definition.");
        }
        setUiStep("fillForm");
      } catch (error) {
        console.error("Error loading definition or template:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load selected contract details."
        );
        setCurrentDefinition(null);
        setTemplateOriginalContent("");
        setFormFields([]);
        setUiStep("selectContract"); // Revert to selection on error
      } finally {
        setIsLoading(false);
      }
    };

    loadDefinitionAndTemplate();
  }, [selectedDefinitionFilename]);

  // NEW: Function to parse the contract definition JSON into form fields
  const parseContractDefinition = (definition: ContractDefinition) => {
    const newFormFields: FormField[] = [];
    const newFormData: ContractFormData = {};

    // Optional: Process sections to create headers
    if (definition.sections) {
      definition.sections
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .forEach((section) => {
          newFormFields.push({
            id: `section_header_${section.sectionId}`,
            label: section.title,
            type: "group_header",
            dataType: "string", // Dummy, not a real input
            originalLine: section.description, // Can use this to display section description
            isSectionHeader: true,
          });
        });
    }

    definition.placeholders.forEach((p) => {
      let fieldType: FormField["type"] = "text";
      if (p.dataType === "boolean") {
        fieldType = "checkbox";
      } else if (p.dataType === "date") {
        fieldType = "date";
      } else if (p.dataType === "number" || p.dataType === "integer") {
        fieldType = "number";
      } else if (p.dataType === "text") {
        fieldType = "textarea"; // Default longer text to textarea
      } else if (p.dataType === "string") {
        fieldType = "text";
      }
      if (p.dataType === "enum") {
        fieldType = p.uiHint === "radio" ? "radio" : "select";
      }
      if (p.uiHint === "textarea") fieldType = "textarea"; // Explicit uiHint overrides

      const formField: FormField = {
        id: p.id,
        label: p.label,
        type: fieldType,
        dataType: p.dataType,
        options: p.options,
        required: p.required,
        description: p.description,
        placeholderText: p.description || p.label, // Use description or label as placeholder
        sectionId: p.sectionId,
        uiHint: p.uiHint,
        dependsOn: p.dependsOn,
        // groupName will be needed if type is 'radio' for multiple options under one group
      };

      if (fieldType === "radio" && p.options) {
        // For radio, we create one entry for each option, but they share a groupName (p.id)
        // The main formField can represent the group, or we handle it in rendering
        // For simplicity, renderFormField will iterate options if fieldType is radio.
        newFormFields.push(formField); // Add the main field descriptor
        newFormData[p.id] =
          p.defaultValue ?? (p.options.length > 0 ? p.options[0].value : "");
      } else {
        newFormFields.push(formField);
        if (p.dataType === "boolean") {
          newFormData[p.id] =
            p.defaultValue !== undefined ? Boolean(p.defaultValue) : false;
        } else {
          newFormData[p.id] =
            p.defaultValue !== undefined ? p.defaultValue : "";
        }
      }
    });

    // Simple sort: section headers first, then by placeholder order in definition (implicitly)
    // A more robust sort might use sectionId and placeholder order within sections.
    newFormFields.sort((a, b) => {
      if (a.isSectionHeader && !b.isSectionHeader) return -1;
      if (!a.isSectionHeader && b.isSectionHeader) return 1;
      return 0; // Keep placeholder order as is for now, or implement more complex sort
    });

    setFormFields(newFormFields);
    setFormData(newFormData);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "radio") {
      // For radio, name is the group id (placeholder.id), value is the selected option's value
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const generateContractText = (): string => {
    if (!currentDefinition || !templateOriginalContent) return "";
    let populatedText = templateOriginalContent;

    currentDefinition.placeholders.forEach((placeholder) => {
      // Using a regex that matches {{ID}}, {{ ID }}, {{ID }}, etc.
      const regex = new RegExp(
        `{{\s*${placeholder.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*}}`,
        "g"
      );
      const value = formData[placeholder.id];

      if (value !== undefined) {
        populatedText = populatedText.replace(regex, String(value));
      } else if (placeholder.defaultValue !== undefined) {
        populatedText = populatedText.replace(
          regex,
          String(placeholder.defaultValue)
        );
      } else {
        // Optional: replace with empty string or a notice like "[NOT_FILLED]"
        // populatedText = populatedText.replace(regex, "");
      }
    });
    return populatedText;
  };

  const handleSaveContract = async () => {
    if (!currentDefinition) {
      setErrorMessage("No contract definition loaded.");
      return;
    }
    setIsLoading(true);
    setUiStep("generating");
    setErrorMessage(null);

    const populatedContract = generateContractText();
    const filename = `${
      contractName.replace(/[^a-z0-9_\-]/gi, "_") || "contract"
    }.md`;

    try {
      const response = await fetch("/api/save-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content: populatedContract }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to save contract: ${response.statusText}`
        );
      }
      const result = await response.json();
      alert(`Contract saved successfully: ${result.path}`);
    } catch (error) {
      console.error("Error saving contract:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save contract."
      );
    } finally {
      setIsLoading(false);
      setUiStep("selectContract");
      setSelectedDefinitionFilename(null);
      setCurrentDefinition(null);
      setContractName("MyContract");
      setFormFields([]);
      setFormData({});
    }
  };

  const inputBaseClasses =
    "w-full py-2.5 px-3 border border-gray-300 rounded text-base text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none";

  if (
    isLoading &&
    uiStep === "selectContract" &&
    availableDefinitions.length === 0
  ) {
    return (
      <ContractSelectionStep
        availableDefinitions={availableDefinitions}
        onSelectDefinition={setSelectedDefinitionFilename}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  if (uiStep === "selectContract") {
    return (
      <ContractSelectionStep
        availableDefinitions={availableDefinitions}
        onSelectDefinition={setSelectedDefinitionFilename}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  if (isLoading && uiStep === "fillForm" && !currentDefinition) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          Loading contract details for {selectedDefinitionFilename}...
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  if (uiStep === "fillForm" && !currentDefinition && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-red-500 text-lg">
          Failed to load contract details. Please try selecting a contract
          again.
        </p>
        <button
          onClick={() => {
            setUiStep("selectContract");
            setSelectedDefinitionFilename(null);
            setErrorMessage(null);
          }}
          className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Back to Selection
        </button>
      </div>
    );
  }

  if (isLoading || uiStep === "generating") {
    return (
      <div className="flex flex-col items-center justify-center flex-grow">
        <p className="text-gray-600 text-lg">
          {uiStep === "generating"
            ? `Generating ${contractName}...`
            : "Loading..."}
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          New Contract Wizard
        </h1>
        {currentDefinition && uiStep === "fillForm" ? (
          <>
            <p className="text-lg text-gray-600 mb-2">
              Selected Contract:{" "}
              <span className="font-semibold">
                {currentDefinition.templateMeta.title}
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Definition: {selectedDefinitionFilename}
            </p>
          </>
        ) : (
          <p className="text-lg text-gray-600 mb-8">
            Follow the steps below to generate your new contract.
          </p>
        )}
        {errorMessage && uiStep === "fillForm" && (
          <p className="text-red-500 mb-4">{errorMessage}</p>
        )}

        <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-xl">
          {uiStep === "fillForm" && currentDefinition && (
            <ContractFormStep
              currentDefinition={currentDefinition}
              formFields={formFields}
              formData={formData}
              contractName={contractName}
              inputBaseClasses={inputBaseClasses}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onContractNameChange={setContractName}
              onFormFieldChange={handleChange}
              onSubmit={handleSaveContract}
              selectedDefinitionFilename={selectedDefinitionFilename}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default NewContractPage;
